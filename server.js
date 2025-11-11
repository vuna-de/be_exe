const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const logger = require('./services/logger');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:5000", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "http://localhost:5000"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100000, // giới hạn 100 requests mỗi IP trong 15 phút
  message: {
    error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.'
  }
});
app.use('/api/', limiter);
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, { ip: req.ip });
  next();
});

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://localhost:3000'] 
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle OPTIONS requests for static files
app.options('/uploads/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.sendStatus(200);
});

// Static files - serve uploaded files
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // Set proper MIME type for images
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users', require('./routes/users'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/nutrition', require('./routes/nutrition'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/personalization', require('./routes/personalization'));
app.use('/api/pt', require('./routes/pt'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/meal-suggestions', require('./routes/mealSuggestions'));
app.use('/api/pt-dashboard', require('./routes/ptDashboard'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Gymnet API đang hoạt động!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Test image display page
app.get('/test-image', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-image.html'));
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint không tồn tại',
    path: req.path 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: err.message
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token không hợp lệ'
    });
  }
  
  res.status(500).json({
    error: 'Lỗi server nội bộ',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Có lỗi xảy ra'
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-manager')
  .then(() => {
    console.log('✅ Kết nối MongoDB thành công');
  })
  .catch((error) => {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Realtime signaling (Socket.IO) for PT calls
try {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: process.env.NODE_ENV === 'production' ? ['http://localhost:3000'] : '*',
      methods: ['GET', 'POST']
    }
  });

  const nsp = io.of('/pt-call');
  nsp.on('connection', (socket) => {
    // Client joins a room by connectionId
    socket.on('join', ({ connectionId }) => {
      if (!connectionId) return;
      socket.join(connectionId);
      socket.to(connectionId).emit('peer-joined');
    });

    socket.on('offer', ({ connectionId, sdp }) => {
      socket.to(connectionId).emit('offer', { connectionId, sdp });
    });

    socket.on('answer', ({ connectionId, sdp }) => {
      socket.to(connectionId).emit('answer', { connectionId, sdp });
    });

    socket.on('ice', ({ connectionId, candidate }) => {
      socket.to(connectionId).emit('ice', { connectionId, candidate });
    });

    socket.on('end', ({ connectionId }) => {
      socket.to(connectionId).emit('end', { connectionId });
    });
  });
  // Notifications namespace: mỗi user join vào room userId để nhận noti
  try {
    const { registerNotificationIO } = require('./services/notificationService');
    registerNotificationIO(io);
    const notiNsp = io.of('/notifications');
    notiNsp.on('connection', (socket) => {
      const authUserId = socket.handshake.auth && socket.handshake.auth.userId;
      const queryUserId = socket.handshake.query && socket.handshake.query.userId;
      const userId = authUserId || queryUserId;
      if (userId) {
        socket.join(String(userId));
      }
      socket.on('auth', ({ userId: uid }) => {
        if (!uid) return;
        socket.join(String(uid));
      });
    });
  } catch (e) {
    console.error('Notifications namespace error:', e.message);
  }
} catch (e) {
  console.error('Socket.IO init error:', e.message);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => {
    mongoose.connection.close();
    console.log('Server đã đóng');
  });
});

module.exports = app;
