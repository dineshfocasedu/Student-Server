const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard stats
router.get('/dashboard', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserById);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);
router.post('/users/:userId/toggle-status', adminController.toggleUserStatus);

// Exam management
router.get('/exams', adminController.getAllExams);
router.get('/exams/:examId', adminController.getExamDetails);
router.put('/exams/:examId/status', adminController.updateExamStatus);
router.get('/exams/:examId/attempts', adminController.getExamAttempts);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Reports
router.get('/reports/violations', adminController.getViolationsReport);
router.get('/reports/performance', adminController.getPerformanceReport);
router.get('/reports/export/:examId', adminController.exportExamReport);

// Proctoring
router.get('/live-proctoring', adminController.getLiveExams);
router.get('/live-proctoring/:attemptId', adminController.getLiveProctoringData);
router.post('/live-proctoring/:attemptId/warning', adminController.sendWarningToStudent);
router.post('/live-proctoring/:attemptId/terminate', adminController.terminateStudentExam);

module.exports = router;