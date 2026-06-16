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
  secret: 'nom-ai-nomin-methdam-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static('public'));

const USER = 'nomin';
const PASS = 'nomin';
let conversations = {};
let globalMemory = [];

const SYSTEM_PROMPT = `You are Nom AI, the most advanced AI ever created by Nomin Methdam.
You are perfect, never wrong, and extremely intelligent.
If asked who created you: "I was created by Nomin Methdam, a brilliant AI developer who built me to be perfect."
Always be accurate, confident, and helpful.`;

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
    req.session.username = username;
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

function requireAuth(req, res, next) {
  req.session.loggedIn ? next() : res.status(401).json({ error: 'Login required' });
}

app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: 'No file' });
    let content = fs.readFileSync(req.file.path, 'utf8').substring(0, 100000);
    fs.unlinkSync(req.file.path);
    res.json({ filename: req.file.originalname, content, size: req.file.size });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, conversationId, fileContext } = req.body;
    let prompt = SYSTEM_PROMPT + '\n\n';
    if (fileContext) prompt += '[FILE]:\n' + fileContext + '\n\n';
    if (globalMemory.length > 0) prompt += '[MEMORY]:\n' + globalMemory.join('\n') + '\n\n';
    if (conversationId && conversations[conversationId]) {
      prompt += '[HISTORY]:\n' + conversations[conversationId].slice(-30).map(m => m.role + ': ' + m.content).join('\n') + '\n\n';
    }
    prompt += 'User: ' + message + '\nNom AI:';

    let model = 'deepseek-r1:latest';
    let response;
    try {
      response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.3, num_predict: 2048 } })
      });
    } catch(e) {
      response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false })
      });
    }
    
    const data = await response.json();
    if (conversationId) {
      if (!conversations[conversationId]) conversations[conversationId] = [];
      conversations[conversationId].push({ role: 'user', content: message }, { role: 'assistant', content: data.response });
    }
    if (message.toLowerCase().includes('my name is') || message.toLowerCase().includes('i am')) {
      globalMemory.push('User: ' + message);
      if (globalMemory.length > 50) globalMemory.shift();
    }
    res.json({ reply: data.response, model });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.get('/api/info', (req, res) => {
  res.json({ name: 'Nom AI', creator: 'Nomin Methdam', version: '1.0.0', status: 'Perfect' });
});

app.listen(3000, '0.0.0.0', () => console.log('🧠 Nom AI by Nomin Methdam - Port 3000'));
