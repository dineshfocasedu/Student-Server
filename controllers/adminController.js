const User = require('../models/User');
const Exam = require('../models/Exam');
const ExamAttempt = require('../models/ExamAttempt');
const AdminConfig = require('../models/AdminConfig');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalInstructors = await User.countDocuments({ role: 'instructor' });
    const totalExams = await Exam.countDocuments();
    
    const activeExams = await Exam.countDocuments({ 
      status: 'published',
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() }
    });
    
    const ongoingAttempts = await ExamAttempt.countDocuments({ status: 'in-progress' });
    const completedAttempts = await ExamAttempt.countDocuments({ status: 'completed' });
    
    // Recent activities
    const recentAttempts = await ExamAttempt.find()
      .populate('user', 'name email')
      .populate('exam', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalStudents,
          totalInstructors,
          totalExams,
          activeExams,
          ongoingAttempts,
          completedAttempts
        },
        recentActivities: recentAttempts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;
    let query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:userId
// @access  Private (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's exam attempts
    const attempts = await ExamAttempt.find({ user: req.params.userId })
      .populate('exam', 'title')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        user,
        attempts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:userId
// @access  Private (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

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

// @desc    Delete user
// @route   DELETE /api/admin/users/:userId
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user has any exam attempts
    const attempts = await ExamAttempt.find({ user: req.params.userId });
    if (attempts.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete user with existing exam attempts'
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Toggle user status
// @route   POST /api/admin/users/:userId/toggle-status
// @access  Private (Admin only)
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      data: {
        isActive: user.isActive,
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all exams
// @route   GET /api/admin/exams
// @access  Private (Admin only)
exports.getAllExams = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const exams = await Exam.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Exam.countDocuments(query);

    res.json({
      success: true,
      data: exams,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get exam details
// @route   GET /api/admin/exams/:examId
// @access  Private (Admin only)
exports.getExamDetails = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId)
      .populate('createdBy', 'name email');

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    // Get statistics for this exam
    const totalAttempts = await ExamAttempt.countDocuments({ exam: req.params.examId });
    const completedAttempts = await ExamAttempt.countDocuments({ 
      exam: req.params.examId,
      status: 'completed'
    });
    const inProgressAttempts = await ExamAttempt.countDocuments({ 
      exam: req.params.examId,
      status: 'in-progress'
    });
    const terminatedAttempts = await ExamAttempt.countDocuments({ 
      exam: req.params.examId,
      status: 'terminated'
    });

    // Average score
    const attempts = await ExamAttempt.find({ 
      exam: req.params.examId,
      status: 'completed'
    });
    const averageScore = attempts.length > 0
      ? attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / attempts.length
      : 0;

    res.json({
      success: true,
      data: {
        exam,
        statistics: {
          totalAttempts,
          completedAttempts,
          inProgressAttempts,
          terminatedAttempts,
          averageScore
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

// @desc    Update exam status
// @route   PUT /api/admin/exams/:examId/status
// @access  Private (Admin only)
exports.updateExamStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const exam = await Exam.findById(req.params.examId);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    exam.status = status;
    await exam.save();

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

// @desc    Get exam attempts
// @route   GET /api/admin/exams/:examId/attempts
// @access  Private (Admin only)
exports.getExamAttempts = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    let query = { exam: req.params.examId };

    if (status) {
      query.status = status;
    }

    const attempts = await ExamAttempt.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ExamAttempt.countDocuments(query);

    res.json({
      success: true,
      data: attempts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get settings
// @route   GET /api/admin/settings
// @access  Private (Admin only)
exports.getSettings = async (req, res) => {
  try {
    let settings = await AdminConfig.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await AdminConfig.create({
        globalExamSettings: {
          defaultVideoQuality: 'medium',
          maxFaceViolations: 3,
          autoTerminateOnViolation: false,
          requireCamera: true,
          requireMicrophone: false
        },
        proctoringSettings: {
          aiProctoring: true,
          humanProctoring: false,
          randomScreenshotInterval: 30,
          faceDetectionInterval: 5
        },
        securitySettings: {
          maxLoginAttempts: 5,
          sessionTimeout: 30,
          ipWhitelisting: false,
          browserFingerprinting: true
        },
        storageSettings: {
          videoRetentionDays: 30,
          screenshotRetentionDays: 30,
          maxVideoSize: 500
        }
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update settings
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
exports.updateSettings = async (req, res) => {
  try {
    let settings = await AdminConfig.findOne();
    
    if (!settings) {
      settings = new AdminConfig(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    
    settings.updatedBy = req.user.id;
    settings.updatedAt = new Date();
    
    await settings.save();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get violations report
// @route   GET /api/admin/reports/violations
// @access  Private (Admin only)
exports.getViolationsReport = async (req, res) => {
  try {
    const { startDate, endDate, examId } = req.query;
    let query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (examId) {
      query.exam = examId;
    }

    const attempts = await ExamAttempt.find(query)
      .populate('user', 'name email')
      .populate('exam', 'title')
      .select('violations user exam');

    // Aggregate violations by type
    const violationStats = {
      face: 0,
      multiple_faces: 0,
      tab_switch: 0,
      copy_paste: 0,
      right_click: 0,
      fullscreen_exit: 0
    };

    attempts.forEach(attempt => {
      attempt.violations.forEach(violation => {
        if (violationStats.hasOwnProperty(violation.type)) {
          violationStats[violation.type]++;
        }
      });
    });

    res.json({
      success: true,
      data: {
        totalViolations: Object.values(violationStats).reduce((a, b) => a + b, 0),
        violationStats,
        recentViolations: attempts
          .filter(a => a.violations.length > 0)
          .slice(0, 20)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get performance report
// @route   GET /api/admin/reports/performance
// @access  Private (Admin only)
exports.getPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { status: 'completed' };

    if (startDate || endDate) {
      query.submittedAt = {};
      if (startDate) query.submittedAt.$gte = new Date(startDate);
      if (endDate) query.submittedAt.$lte = new Date(endDate);
    }

    const attempts = await ExamAttempt.find(query)
      .populate('exam', 'title totalPoints')
      .select('totalScore exam submittedAt');

    // Calculate overall statistics
    const scores = attempts.map(a => a.totalScore || 0);
    const averageScore = scores.length > 0 
      ? scores.reduce((a, b) => a + b, 0) / scores.length 
      : 0;

    const passRate = attempts.length > 0
      ? attempts.filter(a => a.totalScore >= (a.exam?.passingScore || 0)).length / attempts.length * 100
      : 0;

    res.json({
      success: true,
      data: {
        totalAttempts: attempts.length,
        averageScore,
        passRate,
        highestScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowestScore: scores.length > 0 ? Math.min(...scores) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Export exam report
// @route   GET /api/admin/reports/export/:examId
// @access  Private (Admin only)
exports.exportExamReport = async (req, res) => {
  try {
    const { examId } = req.params;
    const { format = 'json' } = req.query;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    const attempts = await ExamAttempt.find({ exam: examId })
      .populate('user', 'name email')
      .select('-faceDetectionLogs -videoRecordings');

    if (format === 'json') {
      res.json({
        success: true,
        data: {
          exam: {
            title: exam.title,
            duration: exam.duration,
            totalPoints: exam.totalPoints,
            passingScore: exam.passingScore
          },
          attempts: attempts.map(a => ({
            student: a.user,
            startTime: a.startTime,
            endTime: a.endTime,
            score: a.totalScore,
            status: a.status,
            violations: a.violations.length,
            submittedAt: a.submittedAt
          }))
        }
      });
    } else {
      // For CSV format, you would implement CSV generation here
      res.status(400).json({
        success: false,
        error: 'CSV export not implemented yet'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get live exams
// @route   GET /api/admin/live-proctoring
// @access  Private (Admin only)
exports.getLiveExams = async (req, res) => {
  try {
    const liveAttempts = await ExamAttempt.find({ status: 'in-progress' })
      .populate('user', 'name email')
      .populate('exam', 'title')
      .sort({ startTime: -1 });

    res.json({
      success: true,
      data: liveAttempts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get live proctoring data
// @route   GET /api/admin/live-proctoring/:attemptId
// @access  Private (Admin only)
exports.getLiveProctoringData = async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.attemptId)
      .populate('user', 'name email')
      .populate('exam', 'title config');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Attempt not found'
      });
    }

    res.json({
      success: true,
      data: {
        attempt: {
          _id: attempt._id,
          startTime: attempt.startTime,
          status: attempt.status,
          violations: attempt.violations.slice(-10), // Last 10 violations
          faceDetectionLogs: attempt.faceDetectionLogs.slice(-5), // Last 5 face detections
          currentViolationCount: attempt.violations.length
        },
        user: attempt.user,
        exam: {
          title: attempt.exam.title,
          config: attempt.exam.config
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

// @desc    Send warning to student
// @route   POST /api/admin/live-proctoring/:attemptId/warning
// @access  Private (Admin only)
exports.sendWarningToStudent = async (req, res) => {
  try {
    const { message } = req.body;
    const { attemptId } = req.params;

    // Here you would implement real-time notification via socket.io
    // For now, we'll just log it

    res.json({
      success: true,
      message: 'Warning sent to student'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Terminate student exam
// @route   POST /api/admin/live-proctoring/:attemptId/terminate
// @access  Private (Admin only)
exports.terminateStudentExam = async (req, res) => {
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