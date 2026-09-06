import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

function normalizeOrigin(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) return '';

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

const origins = String(process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

function isPrivateDevelopmentOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const { protocol, hostname } = new URL(origin);
    if (!['http:', 'https:'].includes(protocol)) return false;

    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || /^10\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, cb) {
    if (
      !origin
      || !origins.length
      || origins.includes(normalizeOrigin(origin))
      || isPrivateDevelopmentOrigin(origin)
    ) {
      return cb(null, true);
    }

    cb(Object.assign(new Error('Origin not allowed by CORS.'), { status: 403 }));
  }
}));

app.use('/api/public', rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api', (req, res) => res.json({ ok: true, service: 'Employee Portal API' }));
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

// In a single-domain deployment, Express serves the production Vue build as
// well as the API. Support both the repository layout (frontend/dist) and the
// common cPanel layout where index.html and assets sit beside backend/.
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const configuredFrontendDirectory = String(process.env.FRONTEND_DIST || '').trim();
const frontendCandidates = configuredFrontendDirectory
  ? [path.resolve(configuredFrontendDirectory)]
  : [
      path.resolve(sourceDirectory, '../../frontend/dist'),
      path.resolve(sourceDirectory, '../..')
    ];
const frontendDirectory = frontendCandidates.find((candidate) => (
  fs.existsSync(path.join(candidate, 'index.html'))
));
const frontendIndex = frontendDirectory
  ? path.join(frontendDirectory, 'index.html')
  : '';

if (frontendDirectory) {
  app.use(express.static(frontendDirectory, { index: false }));

  // Vue Router uses history mode, so browser requests such as /admin must
  // return index.html. API and health requests must keep their normal 404s.
  app.use((req, res, next) => {
    const isFrontendRoute = req.method === 'GET'
      && !req.path.startsWith('/api')
      && req.path !== '/health'
      && req.accepts('html');

    if (!isFrontendRoute) return next();

    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(frontendIndex);
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Server error.'
  });
});

const port = Number(process.env.PORT || 3003);
const host = String(process.env.HOST || '0.0.0.0');

// Vercel loads the Express app as a serverless function. Locally, this file
// continues to start the HTTP server with `npm run dev` or `npm start`.
if (!process.env.VERCEL) {
  app.listen(port, host, () => {
    console.log(`Employee Portal API listening on ${host}:${port}`);
  });
}

export default app;
