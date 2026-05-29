require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5500',
    /\.vercel\.app$/,
    /\.web\.app$/,
  ],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' },
}));

// Rate limiting strict pour auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion.' },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',         authLimiter, require('./routes/auth'));
app.use('/api/chambres',     require('./routes/chambres'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/factures',     require('./routes/factures'));
app.use('/api/stocks',       require('./routes/stocks'));
app.use('/api/stats',        require('./routes/stats'));

// Health check (utile pour Render)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Hotel Ohinene API' });
});

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

// Error handler global
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅  Hotel Ohinene API démarrée sur le port ${PORT}`);
  console.log(`📌  Health check : http://localhost:${PORT}/health`);
});
