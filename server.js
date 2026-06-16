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
  secret: 'nom-ai-nomin-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static('public'));

const USER = 'nomin';
const PASS = 'nomin';
let conversations = {};

// ============ AUTH ROUTES ============
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
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/chat', (req, res) => {
  req.session.loggedIn ? res.sendFile(path.join(__dirname, 'public', 'chat.html')) : res.redirect('/login');
});

// ============ CHAT API ============
function requireAuth(req, res, next) {
  if (req.session.loggedIn) {
    next();
  } else {
    res.status(401).json({ error: 'Login required' });
  }
}

app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: 'No file' });
    let content = fs.readFileSync(req.file.path, 'utf8').substring(0, 50000);
    fs.unlinkSync(req.file.path);
    res.json({ filename: req.file.originalname, content, size: req.file.size });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, conversationId, fileContext } = req.body;
    
    const SYSTEM = `You are Nom AI, the most advanced AI created by Nomin Methdam. 
You are perfect, never wrong, and extremely helpful.
If asked who created you, say: "I was created by Nomin Methdam, a brilliant AI developer."`;

    let prompt = SYSTEM + '\n\n';
    if (fileContext) prompt += '[FILE]: ' + fileContext + '\n\n';
    if (conversationId && conversations[conversationId]) {
      prompt += conversations[conversationId].slice(-20).map(m => m.role + ': ' + m.content).join('\n') + '\n\n';
    }
    prompt += 'User: ' + message + '\nNom AI:';

    // Call Ollama
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: false
      })
    });
    
    const data = await response.json();
    
    if (conversationId) {
      if (!conversations[conversationId]) conversations[conversationId] = [];
      conversations[conversationId].push(
        { role: 'user', content: message },
        { role: 'assistant', content: data.response }
      );
    }
    
    res.json({ reply: data.response });
  } catch(err) {
    res.json({ reply: 'Sorry, I encountered an error: ' + err.message });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Nom AI running on port 3000');
});
