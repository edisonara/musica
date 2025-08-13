// Check if user is authenticated
const token = getCookie('jwt') || new URLSearchParams(window.location.search).get('token');
const socket = io({
  auth: {
    token: token
  }
});

// DOM Elements
const loginSection = document.getElementById('login-section');
const userInfo = document.getElementById('user-info');
const usernameSpan = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');
const voteBtnA = document.getElementById('vote-a');
const voteBtnB = document.getElementById('vote-b');
const votesASpan = document.getElementById('votes-a');
const votesBSpan = document.getElementById('votes-b');
const progressBar = document.getElementById('progress-bar');
const totalVotesSpan = document.getElementById('total-votes');

// Check authentication status
if (token) {
  // Store token in cookie for future requests
  document.cookie = `jwt=${token}; path=/; max-age=86400`; // 24 hours
  
  // Fetch user data
  fetchUserData();
  
  // Show user info and enable voting
  loginSection.classList.add('hidden');
  userInfo.classList.remove('hidden');
  voteBtnA.disabled = false;
  voteBtnB.disabled = false;
  
  // Clear token from URL
  if (window.location.search.includes('token=')) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Event Listeners
voteBtnA.addEventListener('click', () => submitVote('A'));
voteBtnB.addEventListener('click', () => submitVote('B'));
logoutBtn.addEventListener('click', logout);

// Socket.IO Events
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  alert('Error de conexión. Por favor, recarga la página.');
});

socket.on('votes:updated', (votes) => {
  updateVotesUI(votes);
});

// Functions
function submitVote(song) {
  if (!token) {
    window.location.href = '/auth/google';
    return;
  }
  
  socket.emit('vote:submit', { song });
  
  // Disable buttons temporarily to prevent spam
  voteBtnA.disabled = true;
  voteBtnB.disabled = true;
  
  // Re-enable buttons after a short delay
  setTimeout(() => {
    voteBtnA.disabled = false;
    voteBtnB.disabled = false;
  }, 1000);
}

function updateVotesUI(votes) {
  const total = votes.songA + votes.songB;
  const percentA = total > 0 ? Math.round((votes.songA / total) * 100) : 50;
  const percentB = 100 - percentA;
  
  votesASpan.textContent = votes.songA;
  votesBSpan.textContent = votes.songB;
  totalVotesSpan.textContent = `${total} voto${total !== 1 ? 's' : ''} total${total !== 1 ? 'es' : ''}`;
  
  // Update progress bar
  progressBar.style.width = `${percentA}%`;
  progressBar.style.background = `linear-gradient(90deg, #4f46e5 ${percentA}%, #db2777 ${percentA}%)`;
}

async function fetchUserData() {
  try {
    const response = await fetch('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      usernameSpan.textContent = userData.displayName || userData.email;
    } else {
      // If not authenticated, clear token and reload
      document.cookie = 'jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.reload();
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
}

function logout() {
  // Clear token
  document.cookie = 'jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  // Redirect to logout endpoint
  window.location.href = '/auth/logout';
}

// Helper function to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Initial fetch for current votes
fetch('/api/votes')
  .then(response => response.json())
  .then(updateVotesUI)
  .catch(error => console.error('Error fetching initial votes:', error));
