const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'nom-fast-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static('public'));

const USER = 'nomin';
const PASS = 'nomin';
let conversations = {};
let responseCache = new Map();

const SYSTEM_PROMPT = `You are CyberNom AI, an ETHICAL cybersecurity tutor by Nomin Methdam.
You teach hacking legally. Only for systems you OWN or have permission.
Be concise and fast. Give commands and explanations directly.
Topics: Kali, Nmap, Metasploit, Web Security, CTF, Crypto, Python hacking.`;

app.get('/', (req, res) => {
  req.session.loggedIn ? res.redirect('/chat') : res.redirect('/login');
});

app.get('/login', (req, res) => {
  req.session.loggedIn ? res.redirect('/chat') : res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USER && password === PASS) {
    req.session.loggedIn = true;
    res.json({ success: true, redirect: '/chat' });
  } else {
    res.status(401).json({ success: false });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/chat', (req, res) => {
  req.session.loggedIn ? res.sendFile(path.join(__dirname, 'public', 'chat.html')) : res.redirect('/login');
});

function requireAuth(req, res, next) {
  req.session.loggedIn ? next() : res.status(401).json({ error: 'Login required' });
}

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    
    // Check cache first for speed
    const cacheKey = message.toLowerCase().trim();
    if (responseCache.has(cacheKey)) {
      return res.json({ reply: responseCache.get(cacheKey) + '\n\n⚡ [Cached Response]' });
    }
    
    let prompt = SYSTEM_PROMPT + '\n\nUser: ' + message + '\nAI:';

    // Use faster model with optimized settings
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: false,
        options: {
          num_predict: 512,        // Shorter response = faster
          temperature: 0.1,        // Less creative = faster
          top_k: 10,               // Fewer tokens = faster
          top_p: 0.5,
          num_thread: 8            // Use all CPU threads
        }
      })
    });
    
    const data = await response.json();
    
    // Cache the response
    if (responseCache.size > 100) responseCache.clear();
    responseCache.set(cacheKey, data.response);
    
    res.json({ reply: data.response });
  } catch(err) {
    res.json({ reply: 'Error: ' + err.message });
  }
});

app.listen(3000, '0.0.0.0', () => console.log('Fast CyberNom AI on port 3000'));
