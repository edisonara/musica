// Load environment variables first
require('dotenv').config();

// Core dependencies
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const passport = require('passport');

// Initialize Express app and server
const app = express();
const server = http.createServer(app);

// Import passport configuration
require('./config/passport');

// Import routes
const authRoutes = require('./routes/auth');
const voteRoutes = require('./routes/votes');

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store io instance in app for use in routes
app.set('io', io);

// Socket.IO connection handling with authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token || 
               socket.handshake.query.token ||
               socket.handshake.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secure-jwt-secret');
    socket.user = decoded;
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user?.userId || 'unknown'}`);
  
  // Join user to their own room for private messages
  if (socket.user?.userId) {
    socket.join(`user_${socket.user.userId}`);
  }
  
  // Handle vote events
  socket.on('vote', (data) => {
    // Broadcast vote to all connected clients
    io.emit('voteUpdate', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user?.userId || 'unknown'}`);
  });
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: true,
  index: 'index.html'
}));

// API Routes
app.use('/auth', authRoutes);
app.use('/api/votes', voteRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
  console.log(`Auth URL: http://localhost:${PORT}/auth/google`);
  console.log(`WebSocket URL: ws://localhost:${PORT}/socket.io`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Close server and exit process
  server.close(() => process.exit(1));
});
