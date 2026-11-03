// =============================================================================
// Configuration du backend
// -----------------------------------------------------------------------------
// TOUTES les valeurs ci-dessous proviennent de variables d'environnement.
// Rien n'est codé en dur : c'est ce qui permet de les externaliser dans des
// ConfigMaps (valeurs non sensibles) et des Secrets (valeurs sensibles)
// lors du déploiement sur Kubernetes.
// =============================================================================

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    console.error(`[config] Variable d'environnement obligatoire manquante : ${name}`);
    process.exit(1);
  }
  return value;
}

function intEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) {
    console.error(`[config] ${name} doit être un entier (reçu : "${raw}")`);
    process.exit(1);
  }
  return n;
}

module.exports = {
  // --- Serveur HTTP ---------------------------------------------------------
  port: intEnv('PORT', 3000),

  // --- Base de données MySQL ------------------------------------------------
  db: {
    host: required('DB_HOST'),
    port: intEnv('DB_PORT', 3306),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'), // valeur SENSIBLE
    connectRetries: intEnv('DB_CONNECT_RETRIES', 30),
    connectRetryDelayMs: intEnv('DB_CONNECT_RETRY_DELAY_MS', 3000),
  },

  // --- Paramètres métier ----------------------------------------------------
  shopName: process.env.SHOP_NAME || 'Maison Aurore',
  currency: process.env.CURRENCY || 'EUR',
  maxFileSizeMb: intEnv('MAX_FILE_SIZE_MB', 5),
};
