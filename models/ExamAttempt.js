const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['face', 'multiple_faces', 'tab_switch', 'copy_paste', 'right_click', 'fullscreen_exit']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: mongoose.Schema.Types.Mixed,
  screenshot: String
});

const examAttemptSchema = new mongoose.Schema({
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    answer: mongoose.Schema.Types.Mixed,
    isCorrect: Boolean,
    pointsEarned: Number
  }],
  violations: [violationSchema],
  faceDetectionLogs: [{
    timestamp: Date,
    facesDetected: Number,
    imageUrl: String
  }],
  videoRecordings: [{
    startTime: Date,
    endTime: Date,
    videoUrl: String
  }],
  totalScore: Number,
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'terminated', 'review'],
    default: 'in-progress'
  },
  ipAddress: String,
  userAgent: String,
  deviceInfo: mongoose.Schema.Types.Mixed,
  submittedAt: Date
});

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);