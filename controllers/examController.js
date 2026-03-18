const Exam = require('../models/Exam');
const ExamAttempt = require('../models/ExamAttempt');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// @desc    Create a new exam
// @route   POST /api/exams
// @access  Private (Admin/Instructor)
exports.createExam = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const examData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Calculate total points
    if (examData.questions && examData.questions.length > 0) {
      examData.totalPoints = examData.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    }

    const exam = new Exam(examData);
    await exam.save();

    res.status(201).json({
      success: true,
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private
exports.getExams = async (req, res) => {
  try {
    const { role, id } = req.user;
    let query = {};

    // Filter based on user role
    if (role === 'student') {
      query = {
        status: 'published',
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() }
      };
    } else if (role === 'instructor') {
      query = { createdBy: id };
    }
    // Admin sees all exams

    const exams = await Exam.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: exams.length,
      data: exams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single exam by ID
// @route   GET /api/exams/:examId
// @access  Private
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId)
      .populate('createdBy', 'name email');

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    // Check if user has access to this exam
    if (req.user.role === 'student') {
      const now = new Date();
      if (exam.status !== 'published' || now < exam.startTime || now > exam.endTime) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this exam'
        });
      }
    }

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update exam
// @route   PUT /api/exams/:examId
// @access  Private (Admin/Instructor)
exports.updateExam = async (req, res) => {
  try {
    let exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    // Check ownership (instructors can only update their own exams)
    if (req.user.role === 'instructor' && exam.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this exam'
      });
    }

    // Recalculate total points if questions are updated
    if (req.body.questions) {
      req.body.totalPoints = req.body.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    }

    exam = await Exam.findByIdAndUpdate(
      req.params.examId,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete exam
// @route   DELETE /api/exams/:examId
// @access  Private (Admin only)
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    // Check if there are any attempts for this exam
    const attempts = await ExamAttempt.find({ exam: req.params.examId });
    if (attempts.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete exam with existing attempts'
      });
    }

    await exam.deleteOne();

    res.json({
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Start an exam
// @route   POST /api/exams/:examId/start
// @access  Private (Student only)
exports.startExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;

    // Check if exam exists and is available
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    // Check if exam is published and within time window
    const now = new Date();
    if (exam.status !== 'published') {
      return res.status(400).json({
        success: false,
        error: 'Exam is not available'
      });
    }

    if (now < exam.startTime) {
      return res.status(400).json({
        success: false,
        error: 'Exam has not started yet'
      });
    }

    if (now > exam.endTime) {
      return res.status(400).json({
        success: false,
        error: 'Exam has already ended'
      });
    }

    // Check if user already has an in-progress attempt
    const existingAttempt = await ExamAttempt.findOne({
      exam: examId,
      user: userId,
      status: 'in-progress'
    });

    if (existingAttempt) {
      return res.status(400).json({
        success: false,
        error: 'You already have an ongoing exam attempt'
      });
    }

    // Check if user has already completed this exam
    const completedAttempt = await ExamAttempt.findOne({
      exam: examId,
      user: userId,
      status: 'completed'
    });

    if (completedAttempt) {
      return res.status(400).json({
        success: false,
        error: 'You have already completed this exam'
      });
    }

    // Create new attempt
    const attempt = new ExamAttempt({
      exam: examId,
      user: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceInfo: {
        platform: req.headers['sec-ch-ua-platform'] || 'unknown',
        mobile: req.headers['sec-ch-ua-mobile'] || 'unknown'
      }
    });

    await attempt.save();

    // Remove correct answers from response for students
    const examForStudent = exam.toObject();
    if (examForStudent.questions) {
      examForStudent.questions.forEach(q => {
        delete q.correctAnswers;
      });
    }

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        exam: examForStudent,
        config: exam.config,
        startTime: attempt.startTime
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Submit exam
// @route   POST /api/exams/:attemptId/submit
// @access  Private
exports.submitExam = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers, videoRecordings, faceDetectionLogs } = req.body;

    const attempt = await ExamAttempt.findById(attemptId).populate('exam');
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    // Check if user owns this attempt
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to submit this attempt'
      });
    }

    // Check if attempt is already submitted
    if (attempt.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        error: 'This attempt has already been submitted'
      });
    }

    // Calculate score
    let totalScore = 0;
    const processedAnswers = answers.map(answer => {
      const question = attempt.exam.questions.id(answer.questionId);
      let isCorrect = false;
      let pointsEarned = 0;

      if (question) {
        // Check answer based on question type
        switch (question.questionType) {
          case 'mcq':
            isCorrect = answer.answer === question.correctAnswers[0];
            break;
          case 'multiple':
            isCorrect = JSON.stringify(answer.answer.sort()) === 
                       JSON.stringify(question.correctAnswers.sort());
            break;
          case 'essay':
            // Essay questions need manual grading
            isCorrect = null; // Will be graded by instructor
            pointsEarned = 0;
            break;
          case 'coding':
            // Coding questions might need auto-evaluation
            isCorrect = false; // Will be evaluated
            pointsEarned = 0;
            break;
          default:
            isCorrect = false;
        }

        if (isCorrect) {
          pointsEarned = question.points;
          totalScore += pointsEarned;
        }
      }

      return {
        questionId: answer.questionId,
        answer: answer.answer,
        isCorrect,
        pointsEarned
      };
    });

    attempt.answers = processedAnswers;
    attempt.videoRecordings = videoRecordings || [];
    attempt.faceDetectionLogs = faceDetectionLogs || [];
    attempt.totalScore = totalScore;
    attempt.status = 'completed';
    attempt.endTime = new Date();
    attempt.submittedAt = new Date();

    await attempt.save();

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        score: totalScore,
        totalPoints: attempt.exam.totalPoints,
        passingScore: attempt.exam.passingScore,
        passed: totalScore >= (attempt.exam.passingScore || 0),
        status: attempt.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Log violation
// @route   POST /api/exams/:attemptId/violation
// @access  Private
exports.logViolation = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { type, details, screenshot } = req.body;

    const attempt = await ExamAttempt.findById(attemptId).populate('exam');
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    // Check if user owns this attempt
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Add violation
    attempt.violations.push({
      type,
      details,
      screenshot,
      timestamp: new Date()
    });

    // Check if max violations exceeded
    if (type === 'face' || type === 'multiple_faces') {
      const faceViolations = attempt.violations.filter(
        v => v.type === 'face' || v.type === 'multiple_faces'
      ).length;

      const maxViolations = attempt.exam.config?.videoRecording?.maxFaceViolations || 3;
      
      if (faceViolations >= maxViolations) {
        attempt.status = 'terminated';
        
        res.json({
          success: true,
          data: attempt.violations,
          terminated: true,
          message: 'Exam terminated due to excessive violations'
        });
      } else {
        await attempt.save();
        
        res.json({
          success: true,
          data: attempt.violations,
          terminated: false,
          violationsCount: faceViolations,
          maxViolations
        });
      }
    } else {
      await attempt.save();
      
      res.json({
        success: true,
        data: attempt.violations
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Save face detection log
// @route   POST /api/exams/:attemptId/face-detection
// @access  Private
exports.saveFaceDetection = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { facesDetected, imageUrl } = req.body;

    const attempt = await ExamAttempt.findById(attemptId);
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    attempt.faceDetectionLogs.push({
      timestamp: new Date(),
      facesDetected,
      imageUrl
    });

    await attempt.save();

    res.json({
      success: true,
      message: 'Face detection log saved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Upload video chunk
// @route   POST /api/exams/upload-video-chunk
// @access  Private
exports.uploadVideoChunk = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }

    const { attemptId, timestamp } = req.body;
    
    // Save video reference to attempt
    const attempt = await ExamAttempt.findById(attemptId);
    if (attempt) {
      attempt.videoRecordings.push({
        startTime: new Date(timestamp),
        endTime: new Date(),
        videoUrl: `/uploads/videos/${req.file.filename}`
      });
      await attempt.save();
    }

    res.json({
      success: true,
      message: 'Video chunk uploaded successfully',
      filename: req.file.filename
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get exam results
// @route   GET /api/exams/:attemptId/results
// @access  Private
exports.getExamResults = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findById(attemptId)
      .populate('exam')
      .populate('user', 'name email');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        req.user.role !== 'instructor' && 
        attempt.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view these results'
      });
    }

    res.json({
      success: true,
      data: {
        attempt: {
          _id: attempt._id,
          startTime: attempt.startTime,
          endTime: attempt.endTime,
          status: attempt.status,
          totalScore: attempt.totalScore,
          violations: attempt.violations
        },
        exam: {
          title: attempt.exam.title,
          totalPoints: attempt.exam.totalPoints,
          passingScore: attempt.exam.passingScore
        },
        user: attempt.user,
        answers: attempt.answers,
        passed: attempt.totalScore >= (attempt.exam.passingScore || 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Terminate exam
// @route   POST /api/exams/:attemptId/terminate
// @access  Private
exports.terminateExam = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findById(attemptId);
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    attempt.status = 'terminated';
    attempt.endTime = new Date();
    await attempt.save();

    res.json({
      success: true,
      message: 'Exam terminated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};