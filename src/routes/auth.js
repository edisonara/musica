const express = require('express');
const router = express.Router();
const passport = require('passport');
const { generateToken } = require('../config/passport');

// Google OAuth login route
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account' // Force account selection
  })
);

// Google OAuth callback route
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login',
    session: false 
  }),
  (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken(req.user);
      
      // Create a simple HTML page that stores the token and redirects
      const html = `
        <html>
          <head>
            <title>Redirecting...</title>
            <script>
              // Store the token in localStorage
              localStorage.setItem('jwt_token', '${token}');
              // Redirect to dashboard
              window.location.href = '${process.env.CLIENT_URL || 'http://localhost:5000'}/dashboard';
            </script>
          </head>
          <body>
            <p>Redirecting to dashboard...</p>
          </body>
        </html>
      `;
      
      res.send(html);
    } catch (error) {
      console.error('Error in Google callback:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5000'}/?error=auth_failed`);
    }
  }
);
// Get current user
router.get('/me',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    try {
      // Return user data without sensitive information
      const { id, name, email, photo, lastLogin } = req.user;
      res.json({ id, name, email, photo, lastLogin });
    } catch (error) {
      console.error('Error getting user data:', error);
      res.status(500).json({ error: 'Error fetching user data' });
    }
  }
);

// Logout
router.post('/logout', (req, res) => {
  try {
    // In a real app, you might want to invalidate the token
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Error during logout' });
  }
});

// Get current user
router.get('/me', 
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json({
      id: req.user.id,
      displayName: req.user.displayName,
      email: req.user.email
    });
  }
);

module.exports = router;
