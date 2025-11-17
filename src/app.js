// src/app.js

const express = require('express');
const axios = require('axios');
const { JournalService } = require('./services/journalService');
const createJournalRoutes = require('./routes/journalRoutes');
const authRoutes = require('./routes/authRoutes');
const templateRoutes = require('./routes/templateRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const { authenticate } = require('./middleware/auth');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://192.168.29.220:3001',
  credentials: true
}));

// Add ngrok skip browser warning header for free tier
app.use((req, res, next) => {
  if (req.headers.host && (req.headers.host.includes('ngrok-free.dev') || req.headers.host.includes('ngrok-free.app'))) {
    res.setHeader('ngrok-skip-browser-warning', 'true');
  }
  next();
});
// LLM Proxy: Route /llm/* requests to local Ollama instance
// Must be before express.json() to avoid body parsing issues
app.use('/llm', express.raw({ type: 'application/json', limit: '50mb' }), async (req, res) => {
  try {
    // Remove /llm prefix from path
    const targetPath = req.path.replace(/^\/llm/, '') || req.url.replace(/^\/llm/, '');
    // Use 127.0.0.1 instead of localhost to force IPv4 (Ollama might only listen on IPv4)
    const targetUrl = `http://127.0.0.1:11434${targetPath}`;
    
    console.log(`[LLM Proxy] ${req.method} ${req.originalUrl} -> ${targetUrl}`);
    
    // Parse body if it's a Buffer (from express.raw)
    let requestBody = req.body;
    if (Buffer.isBuffer(req.body)) {
      try {
        requestBody = JSON.parse(req.body.toString('utf8'));
      } catch (e) {
        // If parsing fails, use as-is
        requestBody = req.body;
      }
    }
    
    // Forward the request to Ollama
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: requestBody,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 second timeout for LLM requests (increased for CPU inference)
      validateStatus: () => true, // Don't throw on any status
    });
    
    // Forward response
    res.status(response.status);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    res.json(response.data);
  } catch (error) {
    console.error('[LLM Proxy Error]', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('[LLM Proxy] Ollama is not running on 127.0.0.1:11434');
    }
    if (!res.headersSent) {
      res.status(error.response?.status || 502).json({
        error: 'LLM service unavailable',
        message: 'Failed to connect to Ollama. Make sure Ollama is running on localhost:11434',
        details: error.message
      });
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);

// Protected routes
app.use('/api/onboarding', authenticate, onboardingRoutes);
app.use('/api/journal', authenticate, (req, res, next) => {
  // Create journal service with user context
  req.journalService = new JournalService(req.user);
  next();
}, createJournalRoutes());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

module.exports = app;

