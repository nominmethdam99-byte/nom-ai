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
  secret: 'nom-ai-cyber-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static('public'));

const USER = 'nomin';
const PASS = 'nomin';
let conversations = {};

const SYSTEM_PROMPT = `You are CyberNom AI, an ETHICAL cybersecurity tutor created by Nomin Methdam.

RULES:
1. ONLY teach ethical/legal hacking on OWN systems or authorized targets
2. Always include warnings: "Use only on systems you own or have permission to test"
3. Teach concepts, not actual attacks on others
4. Recommend legal platforms: TryHackMe, HackTheBox, VulnHub
5. Never provide actual malware, crack tools, or help with illegal activities

TOPICS YOU TEACH:
- Kali Linux & Parrot OS commands
- Nmap, Wireshark, Burp Suite (ethical use)
- Web security (XSS, SQLi, CSRF - for defense/bug bounty)
- Network security concepts
- Cryptography basics
- CTF (Capture The Flag) solving tips
- OWASP Top 10 explanations
- Python for security scripting
- Metasploit (on own VMs only)
- Password security & hashing

ALWAYS SAY: "⚠️ This is for educational purposes only. Only test on systems you own or have explicit permission to test."

If asked for illegal activities, respond: "I cannot help with that. I only teach ethical/legal cybersecurity for learning and defense."`;

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

function requireAuth(req, res, next) {
  req.session.loggedIn ? next() : res.status(401).json({ error: 'Login required' });
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
    
    let prompt = SYSTEM_PROMPT + '\n\n';
    if (fileContext) prompt += '[FILE]: ' + fileContext + '\n\n';
    if (conversationId && conversations[conversationId]) {
      prompt += conversations[conversationId].slice(-20).map(m => m.role + ': ' + m.content).join('\n') + '\n\n';
    }
    prompt += 'User: ' + message + '\nCyberNom AI:';

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false })
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
    res.json({ reply: 'Error: ' + err.message });
  }
});

app.listen(3000, '0.0.0.0', () => console.log('CyberNom AI running on port 3000'));