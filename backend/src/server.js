import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

app.use(cors({
  origin(origin, cb) {
    if (!origin || !origins.length || origins.includes(normalizeOrigin(origin))) return cb(null, true);
    cb(new Error('Origin not allowed by CORS.'));
  }
}));

app.use('/api/public', rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

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
