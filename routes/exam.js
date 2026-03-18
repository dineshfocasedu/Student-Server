const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const examController = require('../controllers/examController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// All exam routes are protected
router.use(authMiddleware);

// Create exam (admin/instructor only)
router.post('/',
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('duration').isNumeric().withMessage('Duration must be a number'),
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
    body('questions').isArray().withMessage('Questions must be an array')
  ],
  examController.createExam
);

// Get all exams
router.get('/', examController.getExams);

// Get single exam
router.get('/:examId', examController.getExamById);

// Update exam (admin/instructor only)
router.put('/:examId',
  [
    body('title').optional().notEmpty(),
    body('duration').optional().isNumeric(),
    body('startTime').optional().isISO8601(),
    body('endTime').optional().isISO8601()
  ],
  examController.updateExam
);

// Delete exam (admin only)
router.delete('/:examId', examController.deleteExam);

// Start exam
router.post('/:examId/start', examController.startExam);

// Submit exam
router.post('/:attemptId/submit', examController.submitExam);

// Log violation
router.post('/:attemptId/violation', examController.logViolation);

// Save face detection log
router.post('/:attemptId/face-detection', examController.saveFaceDetection);

// Upload video chunk
router.post('/upload-video-chunk',
  upload.single('video'),
  examController.uploadVideoChunk
);

// Get exam results
router.get('/:attemptId/results', examController.getExamResults);

// Terminate exam
router.post('/:attemptId/terminate', examController.terminateExam);

module.exports = router;