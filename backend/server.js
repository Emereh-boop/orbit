// backend/server.js
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const toolsRouter       = require('./routes/tools');
const submissionsRouter = require('./routes/submissions');
const changelogRouter   = require('./routes/changelog');

const app  = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

// ── SECURITY ─────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting: 120 req / 15 min per IP
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
}));

// Stricter limit for public submissions
app.use('/api/submissions', rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Submission limit reached. Try again in an hour.' }
}));

// ── BODY PARSING ─────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));

// ── HEALTH CHECK ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── ROUTES ───────────────────────────────────────────────────────
app.use('/api/tools',       toolsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/changelog',   changelogRouter);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── ERROR HANDLER ────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ORBIT API running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`);
});
