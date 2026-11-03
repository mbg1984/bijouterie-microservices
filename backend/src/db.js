// =============================================================================
// Accès à la base MySQL
// -----------------------------------------------------------------------------
// - Pool de connexions mysql2
// - Tentatives de reconnexion au démarrage (MySQL met souvent plus de temps
//   à démarrer que le backend, que ce soit avec docker compose ou Kubernetes)
// - Création de la table si elle n'existe pas encore
// =============================================================================
const mysql = require('mysql2/promise');
const config = require('./config');

let pool = null;
let ready = false;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS bijoux (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nom          VARCHAR(120)  NOT NULL,
    description  TEXT,
    categorie    VARCHAR(40)   NOT NULL,
    carat        TINYINT       NOT NULL,
    poids_g      DECIMAL(7,2)  NOT NULL,
    prix         DECIMAL(10,2) NOT NULL,
    stock        INT           NOT NULL DEFAULT 0,
    photo        LONGBLOB      NULL,
    photo_mime   VARCHAR(40)   NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function init() {
  const { host, port, name, user, password, connectRetries, connectRetryDelayMs } = config.db;

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: name,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true, // DECIMAL -> Number en JavaScript
    charset: 'utf8mb4',
  });

  for (let attempt = 1; attempt <= connectRetries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[db] Connecté à MySQL ${host}:${port}/${name} (tentative ${attempt})`);
      await pool.query(CREATE_TABLE_SQL);
      ready = true;
      return;
    } catch (err) {
      console.warn(
        `[db] MySQL indisponible (${err.code || err.message}) — tentative ${attempt}/${connectRetries}, ` +
          `nouvel essai dans ${connectRetryDelayMs} ms`
      );
      await sleep(connectRetryDelayMs);
    }
  }
  throw new Error('Impossible de se connecter à MySQL après plusieurs tentatives');
}

async function ping() {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  init,
  ping,
  isReady: () => ready,
  query: (...args) => pool.query(...args),
  close: () => (pool ? pool.end() : Promise.resolve()),
};
