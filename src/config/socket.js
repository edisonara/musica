const jwt = require('jsonwebtoken');
const { users } = require('./passport');

const initializeSocket = (io) => {
  io.use((socket, next) => {
    // Get token from handshake or query
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
      
      // Add user to socket
      socket.user = users.get(decoded.userId);
      
      if (!socket.user) {
        return next(new Error('User not found'));
      }
      
      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.displayName}`);
    
    // Join a room for real-time updates
    socket.join('voting-room');
    
    // Handle vote submission
    socket.on('vote:submit', ({ song }) => {
      if (song === 'A' || song === 'B') {
        // Update votes
        socket.user.votes[`song${song}`] = (socket.user.votes[`song${song}`] || 0) + 1;
        
        // Calculate total votes
        const votes = Array.from(users.values()).reduce((acc, user) => {
          acc.songA += user.votes.songA || 0;
          acc.songB += user.votes.songB || 0;
          return acc;
        }, { songA: 0, songB: 0 });
        
        // Broadcast updated votes to all clients
        io.to('voting-room').emit('votes:updated', votes);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.displayName}`);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
  
  console.log('Socket.IO initialized');
};

module.exports = { initializeSocket };
