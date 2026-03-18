const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// All user routes require authentication
router.use(authMiddleware);

// Profile routes
router.get('/profile', userController.getProfile);
router.put('/profile',
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Please enter a valid email')
  ],
  userController.updateProfile
);

// Exam-related routes
router.get('/exams', userController.getUserExams);
router.get('/attempts', userController.getUserAttempts);
router.get('/attempts/:attemptId', userController.getAttemptDetails);

// Notification routes
router.get('/notifications', userController.getNotifications);
router.put('/notifications/:notificationId/read', userController.markNotificationRead);

// Profile picture upload
router.post('/profile-picture', 
  upload.single('profilePicture'),
  userController.uploadProfilePicture
);

// Preferences
router.put('/preferences/language', 
  [
    body('language').notEmpty().withMessage('Language is required')
  ],
  userController.updateLanguagePreference
);

// Certificate routes
router.get('/certificates', userController.getCertificates);
router.get('/certificates/:attemptId/download', userController.downloadCertificate);

// Account management
router.post('/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
  ],
  userController.changePassword
);

router.delete('/account',
  [
    body('password').notEmpty().withMessage('Password is required for verification')
  ],
  userController.deleteAccount
);

module.exports = router;