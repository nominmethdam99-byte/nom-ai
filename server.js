const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'nom-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static('public'));

const USER = 'nomin';
const PASS = 'nomin';

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

app.post('/api/chat', (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(401).json({ error: 'Login required' });
  }
  
  const { message } = req.body;
  
  if (!message) {
    return res.json({ reply: 'Please send a message.' });
  }
  
  // Call Ollama
  const http = require('http');
  
  const postData = JSON.stringify({
    model: 'llama3.2',
    prompt: 'You are Nom AI by Nomin Methdam. Be helpful and concise.\n\nUser: ' + message + '\nAssistant:',
    stream: false,
    options: {
      num_predict: 500,
      temperature: 0.3
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
        res.json({ reply: data.response || 'No response from AI.' });
      } catch(e) {
        res.json({ reply: 'Error processing response.' });
      }
    });
  });
  
  ollamaReq.on('error', (e) => {
    res.json({ reply: 'AI server not ready. Please try again in a moment.' });
  });
  
  ollamaReq.write(postData);
  ollamaReq.end();
});

app.listen(3000, '0.0.0.0', () => console.log('Nom AI on port 3000'));