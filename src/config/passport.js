const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const jwt = require('jsonwebtoken');

// In-memory store for users and votes (in a real app, use a database)
const users = new Map();
const votes = new Map();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-jwt-secret',
    { expiresIn: '24h' }
  );
};

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback',
    scope: ['profile', 'email']
  },
  (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = users.get(profile.id);
      
      if (!user) {
        // Create new user
        user = {
          id: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          photo: profile.photos && profile.photos[0] ? profile.photos[0].value : '/default-avatar.png',
          lastLogin: new Date()
        };
        users.set(profile.id, user);
      } else {
        // Update last login
        user.lastLogin = new Date();
        users.set(profile.id, user);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-jwt-secret'
};

passport.use(new JwtStrategy(jwtOptions, (payload, done) => {
  try {
    const user = users.get(payload.userId);
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (error) {
    return done(error, false);
  }
}));

// Helper function to get user votes
const getUserVotes = (userId) => {
  if (!votes.has(userId)) {
    votes.set(userId, new Map());
  }
  return votes.get(userId);
};

// Helper function to add/update vote
const addVote = (userId, songId, voteType) => {
  const userVotes = getUserVotes(userId);
  userVotes.set(songId, { 
    type: voteType, 
    timestamp: new Date() 
  });
  return userVotes.get(songId);
};

// Serialize/Deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.get(id);
  done(null, user || false);
});

module.exports = { 
  generateToken, 
  users, 
  votes,
  getUserVotes,
  addVote
};
