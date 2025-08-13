const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const jwt = require('jsonwebtoken');

// In-memory storage (replace with database in production)
const users = new Map();
const votes = new Map();

// Sample songs
const songs = [
  { id: 'song1', title: 'Bohemian Rhapsody', artist: 'Queen' },
  { id: 'song2', title: 'Stairway to Heaven', artist: 'Led Zeppelin' },
  { id: 'song3', title: 'Hotel California', artist: 'Eagles' },
  { id: 'song4', title: 'Sweet Child O\'Mine', artist: 'Guns N\' Roses' }
];

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    proxy: true // Required for production with proxy
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let user = users.get(profile.id);
      
      if (!user) {
        // Create new user
        user = {
          id: profile.id,
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          photo: profile.photos?.[0]?.value || '',
          role: 'user', // Default role
          createdAt: new Date()
        };
        
        // Make first user an admin
        if (users.size === 0) {
          user.role = 'admin';
        }
        
        users.set(profile.id, user);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// JWT Strategy Configuration
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    ExtractJwt.fromUrlQueryParameter('token'),
    (req) => req.cookies?.jwt,
    (req) => {
      let token = null;
      if (req && req.signedCookies) {
        token = req.signedCookies['jwt'];
      }
      return token;
    }
  ]),
  secretOrKey: process.env.JWT_SECRET || 'your-secure-jwt-secret',
  issuer: 'voting-app',
  audience: 'voting-app-users',
  ignoreExpiration: false,
  passReqToCallback: true
};

// JWT Strategy
passport.use(new JwtStrategy(jwtOptions, async (req, jwtPayload, done) => {
  try {
    const user = users.get(jwtPayload.userId || jwtPayload.sub);
    
    if (!user) {
      return done(null, false, { message: 'User not found' });
    }
    
    // You could add additional checks here, like token blacklisting
    
    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
}));

// Serialize/Deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.get(id);
  done(null, user || false);
});

// Helper functions
const generateJwt = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secure-jwt-secret', {
    expiresIn: '24h',
    issuer: 'voting-app',
    audience: 'voting-app-users'
  });
};

// Add vote for a user
const addVote = (userId, songId, voteType) => {
  votes.set(userId, { songId, type: voteType, timestamp: Date.now() });
  return votes.get(userId);
};

// Get user's vote for a specific song
const getUserVote = (userId, songId) => {
  const vote = votes.get(userId);
  return vote && vote.songId === songId ? vote : null;
};

// Get all votes for a user
const getUserVotes = (userId) => {
  const userVotes = {};
  const vote = votes.get(userId);
  if (vote) {
    userVotes[vote.songId] = vote.type;
  }
  return userVotes;
};

// Get all votes (admin only)
const getAllVotes = () => {
  return Array.from(votes.entries()).map(([userId, vote]) => ({
    userId,
    ...vote
  }));
};

// Reset all votes (admin only)
const resetVotes = () => {
  votes.clear();
  return true;
};

module.exports = {
  passport,
  users,
  votes,
  songs,
  generateJwt,
  addVote,
  getUserVote,
  getUserVotes,
  getAllVotes,
  resetVotes,
  jwtOptions
};
