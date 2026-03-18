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

// ─── Allowed Origins ────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://focasedutechhand.netlify.app',
  'https://student-dashboard-blue-nu.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

// ─── Socket.io ──────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// ─── JSON Logger ───────────────────────────────────────────────
const log = (type, data) => {
  console.log(JSON.stringify({
    type,
    timestamp: new Date().toISOString(),
    ...data
  }));
};

// ─── CORS ───────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      log('CORS_BLOCKED', { origin });
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── Middleware ─────────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Request Logger Middleware ──────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    log('HTTP_REQUEST', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: req.ip,
      origin: req.get('Origin') || null,
      user_agent: req.get('User-Agent') || null,
      content_type: req.get('Content-Type') || null,
      response_size: res.get('Content-Length') || null
    });
  });

  next();
});

// ─── Rate Limiting ──────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res) => {
    log('RATE_LIMIT', {
      ip: req.ip,
      url: req.originalUrl,
      message: 'Too many requests'
    });
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});
app.use('/api/', limiter);

// ─── MongoDB Connection ─────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam-portal', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => log('DB_CONNECT', { status: 'success', db: 'MongoDB', message: 'Connected successfully' }))
.catch(err => log('DB_CONNECT', { status: 'error', db: 'MongoDB', message: err.message }));

mongoose.connection.on('disconnected', () =>
  log('DB_EVENT', { status: 'disconnected', db: 'MongoDB' })
);
mongoose.connection.on('reconnected', () =>
  log('DB_EVENT', { status: 'reconnected', db: 'MongoDB' })
);

// ─── Root Route ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      exams: '/api/exams',
      admin: '/api/admin',
      users: '/api/users'
    }
  });
});

// ─── Routes ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// ─── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  log('NOT_FOUND', { method: req.method, url: req.originalUrl, ip: req.ip });
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  log('SERVER_ERROR', {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Socket.io Events ───────────────────────────────────────────
io.on('connection', (socket) => {
  log('SOCKET_CONNECT', { socket_id: socket.id, ip: socket.handshake.address });

  socket.on('join-exam', ({ examId, userId }) => {
    socket.join(`exam-${examId}`);
    socket.data.examId = examId;
    socket.data.userId = userId;
    log('SOCKET_EVENT', { event: 'join-exam', socket_id: socket.id, examId, userId });
  });

  socket.on('violation-detected', (data) => {
    log('SOCKET_EVENT', { event: 'violation-detected', socket_id: socket.id, ...data });
    io.to(`exam-${data.examId}`).emit('student-violation', data);
  });

  socket.on('webcam-frame', ({ examId, userId, frame }) => {
    log('SOCKET_EVENT', { event: 'webcam-frame', socket_id: socket.id, examId, userId });
    io.to(`monitor-${examId}`).emit('student-frame', { userId, frame });
  });

  socket.on('join-monitor', ({ examId }) => {
    socket.join(`monitor-${examId}`);
    log('SOCKET_EVENT', { event: 'join-monitor', socket_id: socket.id, examId });
  });

  socket.on('disconnect', (reason) => {
    log('SOCKET_DISCONNECT', {
      socket_id: socket.id,
      reason,
      examId: socket.data.examId || null,
      userId: socket.data.userId || null
    });
  });

  socket.on('error', (err) => {
    log('SOCKET_ERROR', { socket_id: socket.id, error: err.message });
  });
});

// ─── Server Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  log('SERVER_START', {
    status: 'running',
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    allowed_origins: allowedOrigins
  });
});