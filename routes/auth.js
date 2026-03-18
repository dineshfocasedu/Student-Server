const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Register route
router.post('/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ],
  authController.register
);

// Login route
router.post('/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  authController.login
);

// Get current user route (protected)
router.get('/me', authMiddleware, authController.getCurrentUser);

// Logout route
router.post('/logout', authMiddleware, authController.logout);

// Change password route
router.post('/change-password',
  authMiddleware,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
  ],
  authController.changePassword
);

// Forgot password route
router.post('/forgot-password',
  [
    body('email').isEmail().withMessage('Please enter a valid email')
  ],
  authController.forgotPassword
);

// Reset password route
router.post('/reset-password/:token',
  [
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ],
  authController.resetPassword
);

module.exports = router;