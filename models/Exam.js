const mongoose = require('mongoose');

const examConfigSchema = new mongoose.Schema({
  videoRecording: {
    enabled: { type: Boolean, default: true },
    duration: { type: Number, default: 60 }, // minutes
    quality: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    faceDetection: { type: Boolean, default: true },
    multipleFaceDetection: { type: Boolean, default: true },
    autoSubmitOnFaceViolation: { type: Boolean, default: false },
    maxFaceViolations: { type: Number, default: 3 }
  },
  restrictions: {
    copyPaste: { type: Boolean, default: true },
    rightClick: { type: Boolean, default: true },
    tabSwitch: { type: Boolean, default: true },
    maxTabSwitches: { type: Number, default: 2 },
    fullScreen: { type: Boolean, default: true },
    screenshot: { type: Boolean, default: true },
    print: { type: Boolean, default: true }
  },
  proctoring: {
    aiMonitoring: { type: Boolean, default: true },
    liveProctor: { type: Boolean, default: false },
    audioMonitoring: { type: Boolean, default: false },
    screenSharing: { type: Boolean, default: true }
  },
  security: {
    ipRestriction: { type: Boolean, default: false },
    allowedIPs: [String],
    browserRestriction: { type: Boolean, default: false },
    allowedBrowsers: [String],
    deviceRestriction: { type: Boolean, default: false }
  }
});

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  duration: {
    type: Number,
    required: true // in minutes
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  questions: [{
    questionText: String,
    questionType: {
      type: String,
      enum: ['mcq', 'multiple', 'essay', 'coding']
    },
    options: [String],
    correctAnswers: [String],
    points: Number,
    imageUrl: String,
    codeSnippet: String
  }],
  totalPoints: Number,
  passingScore: Number,
  config: examConfigSchema,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'in-progress', 'completed'],
    default: 'draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Exam', examSchema);