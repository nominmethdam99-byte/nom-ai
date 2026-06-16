const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const http = require('http');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'ultra-ai-nomin-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static('public'));

const USER = 'nomin';
const PASS = 'nomin';
let conversations = {};

// System prompts for different modes
const MODES = {
  default: "You are Ultra AI, the most advanced AI created by Nomin Methdam. You are extremely intelligent, accurate, and helpful. You never make mistakes.",
  coder: "You are Ultra AI - Code Mode. You write perfect, bug-free code. Always explain your code. Created by Nomin Methdam.",
  hacker: "You are Ultra AI - Security Mode. You teach ethical cybersecurity. Only for legal/authorized testing. Created by Nomin Methdam.",
  creative: "You are Ultra AI - Creative Mode. You write stories, poems, and content. Be imaginative and detailed. Created by Nomin Methdam.",
  teacher: "You are Ultra AI - Teacher Mode. Explain complex topics simply. Use examples. Created by Nomin Methdam."
};

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
    res.json({ success: true });
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

// Ultra AI Chat API
app.post('/api/chat', (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(401).json({ error: 'Login required' });
  }
  
  const { message, mode, conversationId } = req.body;
  
  if (!message) {
    return res.json({ reply: 'Please send a message.' });
  }
  
  // Get system prompt based on mode
  const systemPrompt = MODES[mode] || MODES.default;
  
  // Build conversation context
  let context = systemPrompt + '\n\n';
  if (conversationId && conversations[conversationId]) {
    const history = conversations[conversationId].slice(-15);
    context += history.map(m => m.role + ': ' + m.content).join('\n') + '\n';
  }
  context += 'User: ' + message + '\nUltra AI:';
  
  // Call Ollama with best settings
  const postData = JSON.stringify({
    model: 'llama3.2',
    prompt: context,
    stream: false,
    options: {
      num_predict: 2048,
      temperature: 0.1,
      top_k: 40,
      top_p: 0.9,
      repeat_penalty: 1.1,
      num_thread: 16
    }
  });
  
  const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const ollamaReq = http.request(options, (ollamaRes) => {
    let body = '';
    ollamaRes.on('data', (chunk) => body += chunk);
    ollamaRes.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // Save conversation
        if (conversationId) {
          if (!conversations[conversationId]) conversations[conversationId] = [];
          conversations[conversationId].push(
            { role: 'User', content: message },
            { role: 'Ultra AI', content: data.response }
          );
        }
        
        res.json({ 
          reply: data.response,
          mode: mode || 'default',
          model: 'Ultra AI v8.0'
        });
      } catch(e) {
        res.json({ reply: 'Processing... Please try again.' });
      }
    });
  });
  
  ollamaReq.on('error', () => {
    res.json({ reply: 'AI engine starting. Try again in 10 seconds.' });
  });
  
  ollamaReq.write(postData);
  ollamaReq.end();
});

// Get AI info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Ultra AI v8.0',
    creator: 'Nomin Methdam',
    models: ['LLaMA 3.2', 'DeepSeek R1'],
    capabilities: ['Code', 'Security', 'Creative', 'Teaching', 'Analysis'],
    speed: 'Ultra Fast'
  });
});

app.listen(3000, '0.0.0.0', () => console.log('Ultra AI v8.0 on port 3000'));