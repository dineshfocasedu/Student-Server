const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema({
  globalExamSettings: {
    defaultVideoQuality: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    maxFaceViolations: {
      type: Number,
      default: 3
    },
    autoTerminateOnViolation: {
      type: Boolean,
      default: false
    },
    requireCamera: {
      type: Boolean,
      default: true
    },
    requireMicrophone: {
      type: Boolean,
      default: false
    }
  },
  proctoringSettings: {
    aiProctoring: {
      type: Boolean,
      default: true
    },
    humanProctoring: {
      type: Boolean,
      default: false
    },
    randomScreenshotInterval: {
      type: Number,
      default: 30 // seconds
    },
    faceDetectionInterval: {
      type: Number,
      default: 5 // seconds
    }
  },
  securitySettings: {
    maxLoginAttempts: {
      type: Number,
      default: 5
    },
    sessionTimeout: {
      type: Number,
      default: 30 // minutes
    },
    ipWhitelisting: {
      type: Boolean,
      default: false
    },
    browserFingerprinting: {
      type: Boolean,
      default: true
    }
  },
  storageSettings: {
    videoRetentionDays: {
      type: Number,
      default: 30
    },
    screenshotRetentionDays: {
      type: Number,
      default: 30
    },
    maxVideoSize: {
      type: Number,
      default: 500 // MB
    }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AdminConfig', adminConfigSchema);