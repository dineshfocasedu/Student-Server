const User = require('../models/User');
const Exam = require('../models/Exam');
const ExamAttempt = require('../models/ExamAttempt');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email } = req.body;
    
    const user = await User.findById(req.user.id);
    
    // Check if email is already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use'
        });
      }
      user.email = email;
    }
    
    if (name) user.name = name;
    
    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get user exams (exams user has taken or is taking)
// @route   GET /api/users/exams
// @access  Private
exports.getUserExams = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    let query = { user: req.user.id };

    if (status) {
      query.status = status;
    }

    const attempts = await ExamAttempt.find(query)
      .populate('exam', 'title duration totalPoints description startTime endTime')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ExamAttempt.countDocuments(query);

    // Get upcoming exams (published exams user hasn't taken)
    const now = new Date();
    const upcomingExams = await Exam.find({
      status: 'published',
      startTime: { $gt: now },
      _id: { $nin: attempts.map(a => a.exam._id) }
    })
    .select('title description duration startTime endTime')
    .limit(5);

    res.json({
      success: true,
      data: {
        attempts,
        upcomingExams,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get user attempts
// @route   GET /api/users/attempts
// @access  Private
exports.getUserAttempts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const attempts = await ExamAttempt.find({ user: req.user.id })
      .populate('exam', 'title totalPoints passingScore')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ExamAttempt.countDocuments({ user: req.user.id });

    // Calculate statistics
    const completedAttempts = attempts.filter(a => a.status === 'completed');
    const averageScore = completedAttempts.length > 0
      ? completedAttempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / completedAttempts.length
      : 0;

    const passedExams = completedAttempts.filter(a => 
      a.totalScore >= (a.exam?.passingScore || 0)
    ).length;

    res.json({
      success: true,
      data: {
        attempts,
        statistics: {
          totalAttempts: total,
          completedAttempts: completedAttempts.length,
          inProgressAttempts: attempts.filter(a => a.status === 'in-progress').length,
          terminatedAttempts: attempts.filter(a => a.status === 'terminated').length,
          averageScore,
          passedExams,
          passRate: completedAttempts.length > 0 
            ? (passedExams / completedAttempts.length) * 100 
            : 0
        },
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single attempt details
// @route   GET /api/users/attempts/:attemptId
// @access  Private
exports.getAttemptDetails = async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.attemptId)
      .populate('exam')
      .populate('user', 'name email');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    // Check if user owns this attempt
    if (attempt.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this attempt'
      });
    }

    // For completed exams, show answers with correct/incorrect marking
    let questionsWithAnswers = [];
    if (attempt.status === 'completed') {
      questionsWithAnswers = attempt.exam.questions.map(question => {
        const userAnswer = attempt.answers.find(
          a => a.questionId.toString() === question._id.toString()
        );
        
        return {
          ...question.toObject(),
          userAnswer: userAnswer ? userAnswer.answer : null,
          isCorrect: userAnswer ? userAnswer.isCorrect : null,
          pointsEarned: userAnswer ? userAnswer.pointsEarned : 0
        };
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
          violations: attempt.violations,
          submittedAt: attempt.submittedAt
        },
        exam: {
          title: attempt.exam.title,
          description: attempt.exam.description,
          duration: attempt.exam.duration,
          totalPoints: attempt.exam.totalPoints,
          passingScore: attempt.exam.passingScore
        },
        questions: questionsWithAnswers,
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

// @desc    Get notifications
// @route   GET /api/users/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    // This is a placeholder - you would implement a real notification system
    // For now, return mock notifications based on user's exam activities
    
    const now = new Date();
    const upcomingExams = await Exam.find({
      status: 'published',
      startTime: { $gt: now, $lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
    }).limit(5);

    const recentAttempts = await ExamAttempt.find({ 
      user: req.user.id,
      status: 'completed'
    })
    .populate('exam', 'title')
    .sort({ submittedAt: -1 })
    .limit(5);

    const notifications = [
      ...upcomingExams.map(exam => ({
        id: `exam-${exam._id}`,
        type: 'upcoming_exam',
        title: 'Upcoming Exam',
        message: `You have an exam "${exam.title}" scheduled on ${new Date(exam.startTime).toLocaleString()}`,
        createdAt: exam.startTime,
        read: false,
        data: { examId: exam._id }
      })),
      ...recentAttempts.map(attempt => ({
        id: `result-${attempt._id}`,
        type: 'exam_result',
        title: 'Exam Result Available',
        message: `Your result for "${attempt.exam.title}" is now available. Score: ${attempt.totalScore || 0}`,
        createdAt: attempt.submittedAt,
        read: false,
        data: { attemptId: attempt._id }
      }))
    ];

    // Sort by date, most recent first
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: notifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/users/notifications/:notificationId/read
// @access  Private
exports.markNotificationRead = async (req, res) => {
  try {
    // This is a placeholder - implement actual notification system
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Upload profile picture
// @route   POST /api/users/profile-picture
// @access  Private
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const user = await User.findById(req.user.id);
    
    // Delete old profile picture if exists
    if (user.profileImage) {
      const oldImagePath = path.join(__dirname, '../', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Update user with new profile picture path
    user.profileImage = `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      data: {
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update language preference
// @route   PUT /api/users/preferences/language
// @access  Private
exports.updateLanguagePreference = async (req, res) => {
  try {
    const { language } = req.body;
    
    const user = await User.findById(req.user.id);
    
    // Add language preference to user schema if not exists
    // You may need to add this field to your User model
    user.language = language || 'en';
    await user.save();

    res.json({
      success: true,
      data: {
        language: user.language
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get certificates
// @route   GET /api/users/certificates
// @access  Private
exports.getCertificates = async (req, res) => {
  try {
    // Get all completed exams where user passed
    const passedAttempts = await ExamAttempt.find({
      user: req.user.id,
      status: 'completed'
    })
    .populate('exam', 'title totalPoints passingScore')
    .lean();

    // Filter only passed exams
    const certificates = passedAttempts
      .filter(attempt => attempt.totalScore >= (attempt.exam?.passingScore || 0))
      .map(attempt => ({
        id: attempt._id,
        examTitle: attempt.exam.title,
        studentName: req.user.name,
        score: attempt.totalScore,
        totalPoints: attempt.exam.totalPoints,
        percentage: (attempt.totalScore / attempt.exam.totalPoints) * 100,
        issuedDate: attempt.submittedAt,
        certificateId: `CERT-${attempt._id.toString().slice(-8).toUpperCase()}`,
        downloadUrl: `/api/certificates/${attempt._id}/download`
      }));

    res.json({
      success: true,
      data: certificates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Download certificate
// @route   GET /api/certificates/:attemptId/download
// @access  Private
exports.downloadCertificate = async (req, res) => {
  try {
    const { attemptId } = req.params;
    
    const attempt = await ExamAttempt.findById(attemptId)
      .populate('exam')
      .populate('user');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    // Check if user owns this certificate
    if (attempt.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to download this certificate'
      });
    }

    // Check if user passed
    if (attempt.totalScore < (attempt.exam.passingScore || 0)) {
      return res.status(400).json({
        success: false,
        error: 'Certificate not available - exam not passed'
      });
    }

    // Here you would generate and send a PDF certificate
    // For now, return a JSON response
    res.json({
      success: true,
      message: 'Certificate download functionality will be implemented here',
      data: {
        certificateId: `CERT-${attempt._id.toString().slice(-8).toUpperCase()}`,
        studentName: attempt.user.name,
        examTitle: attempt.exam.title,
        score: attempt.totalScore,
        issuedDate: attempt.submittedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Change password (additional method that might be needed)
// @route   POST /api/users/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete account
// @route   DELETE /api/users/account
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Check for ongoing exams
    const ongoingAttempts = await ExamAttempt.findOne({
      user: req.user.id,
      status: 'in-progress'
    });

    if (ongoingAttempts) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete account while exams are in progress'
      });
    }

    // Delete user's profile picture if exists
    if (user.profileImage) {
      const imagePath = path.join(__dirname, '../', user.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete user
    await user.deleteOne();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};