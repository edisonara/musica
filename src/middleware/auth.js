const jwt = require('jsonwebtoken');
const passport = require('passport');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

// JWT Strategy for Passport
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET
};

passport.use(new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
  try {
    // Here you would typically look up the user in your database
    // For now, we'll just return the payload
    return done(null, jwtPayload);
  } catch (error) {
    return done(error, false);
  }
}));

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  // Get token from header or query parameter
  const token = req.header('Authorization')?.replace('Bearer ', '') || 
                req.query.token || 
                req.cookies?.jwt;

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'No token provided. Authentication required.' 
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists
    const user = users.get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found. Please log in again.' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired. Please log in again.' 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token. Please log in again.' 
    });
  }
};

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ 
    success: false, 
    error: 'Access denied. Admin privileges required.' 
  });
};

// Export the middleware functions
module.exports = { 
  isAuthenticated,
  isAdmin
};
