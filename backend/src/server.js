// =============================================================================
// Point d'entrée du microservice backend « bijoux-api »
// =============================================================================
const express = require('express');
const multer = require('multer');
const os = require('os');
const config = require('./config');
const db = require('./db');
const bijouxRouter = require('./routes/bijoux');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// Petit log d'accès
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api/health') || req.path.startsWith('/api/ready')) return;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start} ms)`);
  });
  next();
});

// --- Sondes (utiles pour les livenessProbe / readinessProbe Kubernetes) ------
// liveness : le processus répond
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// readiness : la base de données est joignable
app.get('/api/ready', async (req, res) => {
  const ok = db.isReady() && (await db.ping());
  res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not-ready', database: ok ? 'up' : 'down' });
});

// --- Configuration exposée au frontend --------------------------------------
app.get('/api/config', (req, res) => {
  res.json({
    shopName: config.shopName,
    currency: config.currency,
    maxFileSizeMb: config.maxFileSizeMb,
    categories: bijouxRouter.CATEGORIES,
    carats: bijouxRouter.CARATS,
    servedBy: os.hostname(), // nom du pod qui a répondu (pratique pour observer le load-balancing)
  });
});

// Tant que la base n'est pas prête, l'API métier répond 503
app.use('/api/bijoux', (req, res, next) => {
  if (!db.isReady()) return res.status(503).json({ error: 'Base de données indisponible, réessayez dans un instant' });
  next();
});
app.use('/api/bijoux', bijouxRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

// --- Gestion centralisée des erreurs -----------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Photo trop volumineuse (max ${config.maxFileSizeMb} Mo)` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[erreur]', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// --- Démarrage ---------------------------------------------------------------
const server = app.listen(config.port, () => {
  console.log(`[server] bijoux-api à l'écoute sur le port ${config.port} (boutique : ${config.shopName})`);
});

db.init().catch((err) => {
  console.error('[db]', err.message);
  process.exit(1); // Kubernetes / docker redémarreront le conteneur
});

// Arrêt propre (SIGTERM envoyé par Kubernetes lors d'un rolling update)
function shutdown(signal) {
  console.log(`[server] ${signal} reçu, arrêt en cours...`);
  server.close(() => db.close().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
