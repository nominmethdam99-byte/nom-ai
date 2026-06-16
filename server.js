const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'deepseek-fast-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static('public'));

const USER = 'nomin';
const PASS = 'nomin';
let conversations = {};

const SYSTEM_PROMPT = `You are DeepNom AI, a fast and intelligent AI assistant created by Nomin Methdam. 
You are helpful, concise, and always accurate. Respond quickly and directly.`;

// Auth routes
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
    res.status(401).json({ success: false, message: 'Wrong credentials' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/chat', (req, res) => {
  req.session.loggedIn ? res.sendFile(path.join(__dirname, 'public', 'chat.html')) : res.redirect('/login');
});

// Middleware
function requireAuth(req, res, next) {
  req.session.loggedIn ? next() : res.status(401).json({ error: 'Login required' });
}

// STREAMING Chat API - Ultra Fast
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    let prompt = SYSTEM_PROMPT + '\n\n';
    
    if (conversationId && conversations[conversationId]) {
      const history = conversations[conversationId].slice(-10);
      prompt += history.map(m => m.role + ': ' + m.content).join('\n') + '\n';
    }
    
    prompt += 'User: ' + message + '\nAssistant:';

    // Set streaming headers
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Stream from Ollama
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: true,
        options: {
          num_predict: 1024,
          temperature: 0.3,
          num_thread: 8
        }
      })
    });
    
    let fullResponse = '';
    
    // Stream each chunk
    for await (const chunk of response.body) {
      const lines = chunk.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullResponse += data.response;
            res.write(data.response);
          }
        } catch(e) {}
      }
    }
    
    res.end();
    
    // Save to conversation
    if (conversationId) {
      if (!conversations[conversationId]) conversations[conversationId] = [];
      conversations[conversationId].push(
        { role: 'user', content: message },
        { role: 'assistant', content: fullResponse }
      );
    }
    
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Non-streaming fallback
app.post('/api/chat-fast', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: SYSTEM_PROMPT + '\n\nUser: ' + message + '\nAssistant:',
        stream: false,
        options: { num_predict: 512, temperature: 0.1, num_thread: 8 }
      })
    });
    
    const data = await response.json();
    res.json({ reply: data.response });
    
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.listen(3000, '0.0.0.0', () => console.log('DeepNom AI ready on port 3000'));
