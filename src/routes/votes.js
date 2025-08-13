const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { getVotes, submitVote, resetVotes } = require('../controllers/voteController');

// Get current votes (public endpoint)
router.get('/', getVotes);

// Submit a vote (requires authentication)
router.post('/', isAuthenticated, submitVote);

// Reset all votes (admin only)
router.post('/reset', isAuthenticated, isAdmin, resetVotes);

module.exports = router;
