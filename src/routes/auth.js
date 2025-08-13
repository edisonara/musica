const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { generateJwt, users } = require('../config/passport');

/**
 * @route   GET /auth/google
 * @desc    Authenticate with Google OAuth
 * @access  Public
 */
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false,
    accessType: 'offline',
    prompt: 'consent'
  })
);

/**
 * @route   GET /auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login?error=auth_failed',
    session: false 
  }),
  (req, res) => {
    try {
      const user = req.user;
      
      // Generate JWT token
      const token = generateJwt(user);
      
      // Set the JWT in an HTTP-only cookie
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });
      
      // Redirect to the frontend with the token in the URL (for client-side storage)
      const redirectUrl = new URL(process.env.CLIENT_URL || 'http://localhost:3000');
      redirectUrl.searchParams.set('token', token);
      
      // For development, you might want to see more details
      if (process.env.NODE_ENV !== 'production') {
        console.log(`User logged in: ${user.email}`);
        console.log(`Redirecting to: ${redirectUrl.toString()}`);
      }
      
      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      const redirectUrl = new URL(process.env.CLIENT_URL || 'http://localhost:3000');
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('error', 'auth_failed');
      res.redirect(redirectUrl.toString());
    }
  }
);

/**
 * @route   GET /auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', (req, res) => {
  try {
    // Get token from header, query, or cookie
    const token = req.headers.authorization?.split(' ')[1] || 
                 req.query.token || 
                 req.cookies?.jwt;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secure-jwt-secret', {
      issuer: 'voting-app',
      audience: 'voting-app-users'
    });
    
    // Get user from database
    const user = users.get(decoded.userId || decoded.sub);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Return user data (excluding sensitive info)
    const { id, name, email, photo, role, createdAt } = user;
    res.json({ 
      success: true, 
      user: { id, name, email, photo, role, createdAt }
    });
  } catch (error) {
    console.error('Error in /auth/me:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired. Please log in again.' 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
});

/**
 * @route   POST /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', (req, res) => {
  try {
    // Clear the JWT cookie
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });
    
    // If there's a token in the Authorization header, we can't invalidate it
    // In a real app, you might want to implement token blacklisting
    
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to log out',
      email: req.user?.email || ''
    });
  }
});

module.exports = router;
