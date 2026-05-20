// backend/server.js  —  production-hardened entry point
'use strict';
require('dotenv').config();

// ── Validate required env vars before anything else ──────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FRONTEND_URL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const toolsRouter       = require('./routes/tools');
const submissionsRouter = require('./routes/submissions');
const changelogRouter   = require('./routes/changelog');
const collectionsRouter = require('./routes/collections');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const isProd = process.env.NODE_ENV === 'production';

// ── SECURITY HEADERS ─────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,  // allow embedding fonts/images
  contentSecurityPolicy: isProd ? undefined : false
}));

// ── CORS ──────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server (no origin) + listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.options('*', cors());  // pre-flight all routes

// ── RATE LIMITING ─────────────────────────────────────────────────
const makeLimit = (max, windowMinutes, msg) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: msg }
});

app.use('/api/',            makeLimit(200, 15, 'Too many requests. Try again shortly.'));
app.use('/api/submissions', makeLimit(5,   60, 'Submission limit reached. Try again in an hour.'));

// ── BODY PARSING ─────────────────────────────────────────────────
app.use(express.json({ limit: '32kb' }));

// ── REQUEST LOGGING (non-prod: console, prod: structured) ─────────
app.use((req, _res, next) => {
  if (isProd) {
    // structured log for Render/Datadog/etc
    process.stdout.write(JSON.stringify({
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip
    }) + '\n');
  } else {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ── HEALTH CHECK ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() });
});

// ── ROUTES ───────────────────────────────────────────────────────
app.use('/api/tools',       toolsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/changelog',   changelogRouter);
app.use('/api/collections', collectionsRouter);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── GLOBAL ERROR HANDLER ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Never leak stack traces in production
  if (isProd) {
    console.error('[Error]', err.message);
    return res.status(err.status || 500).json({ error: 'Internal server error' });
  }
  console.error('[Error]', err);
  res.status(err.status || 500).json({ error: err.message, stack: err.stack });
});

// ── START ────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  ORBIT API  |  port ${PORT}  |  ${process.env.NODE_ENV}`);
  console.log(`   CORS origins: ${ALLOWED_ORIGINS.join(', ')}\n`);
});
