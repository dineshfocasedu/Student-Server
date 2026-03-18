const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam-portal', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// Socket.io for real-time monitoring
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join-exam', ({ examId, userId }) => {
    socket.join(`exam-${examId}`);
    socket.data.examId = examId;
    socket.data.userId = userId;
  });
  
  socket.on('violation-detected', (data) => {
    io.to(`exam-${data.examId}`).emit('student-violation', data);
  });

  socket.on('webcam-frame', ({ examId, userId, frame }) => {
    // Relay frame to tutor monitoring room (tutors join 'monitor-<examId>')
    io.to(`monitor-${examId}`).emit('student-frame', { userId, frame });
  });

  socket.on('join-monitor', ({ examId }) => {
    socket.join(`monitor-${examId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});