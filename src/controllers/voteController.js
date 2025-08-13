// In-memory storage for songs
const songs = [
  { id: 'song1', title: 'Bohemian Rhapsody', artist: 'Queen', votes: 0 },
  { id: 'song2', title: 'Stairway to Heaven', artist: 'Led Zeppelin', votes: 0 },
  { id: 'song3', title: 'Hotel California', artist: 'Eagles', votes: 0 },
  { id: 'song4', title: 'Sweet Child O\'Mine', artist: 'Guns N\' Roses', votes: 0 },
];

const { users, votes, songs: songList } = require('../config/passport');

// Get current vote counts
exports.getVotes = (req, res) => {
  try {
    const voteCounts = {};
    const userVotes = {};
    
    // Initialize vote counts for all songs
    songList.forEach(song => {
      voteCounts[song.id] = 0;
    });
    
    // Count votes and track user votes
    for (const [userId, voteData] of votes) {
      const { songId, type } = voteData;
      if (voteCounts[songId] !== undefined) {
        voteCounts[songId] += type === 'upvote' ? 1 : -1;
      }
      
      // If this is the current user's vote, track it
      if (req.user && userId === req.user.id) {
        userVotes[songId] = type;
      }
    }
    
    res.json({ 
      success: true, 
      votes: voteCounts,
      userVotes: req.user ? userVotes : {}
    });
  } catch (error) {
    console.error('Error getting votes:', error);
    res.status(500).json({ success: false, error: 'Failed to get votes' });
  }
};

// Submit a vote
exports.submitVote = (req, res) => {
  try {
    const { songId, voteType } = req.body;
    const userId = req.user.id;
    
    if (!songId || !voteType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Song ID and vote type are required' 
      });
    }
    
    if (voteType !== 'upvote' && voteType !== 'downvote') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid vote type. Must be "upvote" or "downvote"' 
      });
    }
    
    // Check if song exists
    if (!songList.some(song => song.id === songId)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Song not found' 
      });
    }
    
    // Update or add vote
    votes.set(userId, { songId, type: voteType });
    
    // Get updated vote counts and user votes
    const result = calculateVotes(songList, votes, userId);
    
    // Emit update to all connected clients
    req.app.get('io').emit('voteUpdate', {
      votes: result.voteCounts,
      userVotes: result.userVotes
    });
    
    res.json({ 
      success: true, 
      votes: result.voteCounts,
      userVotes: result.userVotes
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit vote' 
    });
  }
};

// Reset all votes (admin only)
exports.resetVotes = (req, res) => {
  try {
    // Clear all votes
    votes.clear();
    const io = req.app.get('io');
    if (io) {
      io.emit('voteUpdate', { songs: updatedVotes });
    }
    
    res.json({ 
      success: true, 
      message: 'Votes reset successfully',
      songs: updatedVotes
    });
  } catch (error) {
    console.error('Error resetting votes:', error);
    res.status(500).json({ success: false, error: 'Error resetting votes' });
  }
};

module.exports = {
  getVotes,
  submitVote,
  resetVotes
};
