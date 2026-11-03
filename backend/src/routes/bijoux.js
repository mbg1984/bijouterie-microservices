// =============================================================================
// Routes CRUD des bijoux
// -----------------------------------------------------------------------------
//  GET    /api/bijoux              liste (filtres : ?categorie=...&q=...)
//  GET    /api/bijoux/:id          détail
//  GET    /api/bijoux/:id/photo    photo binaire du bijou
//  POST   /api/bijoux              création   (multipart/form-data, champ "photo")
//  PUT    /api/bijoux/:id          mise à jour (multipart/form-data, photo optionnelle)
//  DELETE /api/bijoux/:id          suppression
// =============================================================================
const express = require('express');
const multer = require('multer');
const db = require('../db');
const config = require('../config');

const router = express.Router();

const CATEGORIES = ['bague', 'collier', 'bracelet', 'boucles', 'pendentif', 'montre'];
const CARATS = [9, 14, 18, 22, 24];
const MIME_AUTORISES = ['image/jpeg', 'image/png', 'image/webp'];

// Les photos sont gardées en mémoire puis stockées en base (LONGBLOB).
// => le backend reste "stateless" et peut avoir plusieurs replicas.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (MIME_AUTORISES.includes(file.mimetype)) return cb(null, true);
    const err = new Error('Format de photo non supporté (JPEG, PNG ou WEBP uniquement)');
    err.status = 400;
    cb(err);
  },
});

// Colonnes renvoyées par l'API (jamais le BLOB dans une liste !)
const COLONNES = `
  id, nom, description, categorie, carat, poids_g, prix, stock,
  (photo IS NOT NULL) AS has_photo, created_at, updated_at
`;

function serialize(row) {
  return { ...row, has_photo: Boolean(row.has_photo) };
}

function parseId(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return null;
  }
  return id;
}

// Validation des champs du formulaire. partial=true pour une mise à jour.
function validate(body) {
  const errors = [];
  const data = {};

  const nom = (body.nom || '').trim();
  if (nom.length < 2 || nom.length > 120) errors.push('Le nom doit contenir entre 2 et 120 caractères');
  data.nom = nom;

  data.description = (body.description || '').trim().slice(0, 2000);

  if (!CATEGORIES.includes(body.categorie)) errors.push(`Catégorie invalide (${CATEGORIES.join(', ')})`);
  data.categorie = body.categorie;

  const carat = parseInt(body.carat, 10);
  if (!CARATS.includes(carat)) errors.push(`Carat invalide (${CARATS.join(', ')})`);
  data.carat = carat;

  const poids = Number(body.poids_g);
  if (!Number.isFinite(poids) || poids <= 0 || poids > 99999) errors.push('Poids (g) invalide');
  data.poids_g = poids;

  const prix = Number(body.prix);
  if (!Number.isFinite(prix) || prix < 0 || prix > 99999999) errors.push('Prix invalide');
  data.prix = prix;

  const stock = parseInt(body.stock, 10);
  if (!Number.isInteger(stock) || stock < 0) errors.push('Stock invalide');
  data.stock = stock;

  return { errors, data };
}

// --- Liste -------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.categorie && CATEGORIES.includes(req.query.categorie)) {
      where.push('categorie = ?');
      params.push(req.query.categorie);
    }
    if (req.query.q) {
      where.push('(nom LIKE ? OR description LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    const sql = `SELECT ${COLONNES} FROM bijoux ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC`;
    const [rows] = await db.query(sql, params);
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

// --- Détail ------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  const id = parseId(req, res);
  if (!id) return;
  try {
    const [rows] = await db.query(`SELECT ${COLONNES} FROM bijoux WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Bijou introuvable' });
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

// --- Photo -------------------------------------------------------------------
router.get('/:id/photo', async (req, res, next) => {
  const id = parseId(req, res);
  if (!id) return;
  try {
    const [rows] = await db.query('SELECT photo, photo_mime FROM bijoux WHERE id = ?', [id]);
    if (!rows.length || !rows[0].photo) return res.status(404).json({ error: 'Aucune photo' });
    res.set('Content-Type', rows[0].photo_mime);
    res.set('Cache-Control', 'public, max-age=300');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(rows[0].photo);
  } catch (err) {
    next(err);
  }
});

// --- Création ----------------------------------------------------------------
router.post('/', upload.single('photo'), async (req, res, next) => {
  const { errors, data } = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' · ') });
  try {
    const [result] = await db.query(
      `INSERT INTO bijoux (nom, description, categorie, carat, poids_g, prix, stock, photo, photo_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nom, data.description, data.categorie, data.carat, data.poids_g, data.prix, data.stock,
        req.file ? req.file.buffer : null,
        req.file ? req.file.mimetype : null,
      ]
    );
    const [rows] = await db.query(`SELECT ${COLONNES} FROM bijoux WHERE id = ?`, [result.insertId]);
    console.log(`[api] Bijou créé #${result.insertId} (${data.nom})`);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

// --- Mise à jour -------------------------------------------------------------
router.put('/:id', upload.single('photo'), async (req, res, next) => {
  const id = parseId(req, res);
  if (!id) return;
  const { errors, data } = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' · ') });
  try {
    const sets = ['nom = ?', 'description = ?', 'categorie = ?', 'carat = ?', 'poids_g = ?', 'prix = ?', 'stock = ?'];
    const params = [data.nom, data.description, data.categorie, data.carat, data.poids_g, data.prix, data.stock];

    if (req.file) {
      sets.push('photo = ?', 'photo_mime = ?');
      params.push(req.file.buffer, req.file.mimetype);
    } else if (req.body.supprimerPhoto === 'true') {
      sets.push('photo = NULL', 'photo_mime = NULL');
    }
    params.push(id);

    const [result] = await db.query(`UPDATE bijoux SET ${sets.join(', ')} WHERE id = ?`, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Bijou introuvable' });
    const [rows] = await db.query(`SELECT ${COLONNES} FROM bijoux WHERE id = ?`, [id]);
    console.log(`[api] Bijou modifié #${id}`);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

// --- Suppression -------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  const id = parseId(req, res);
  if (!id) return;
  try {
    const [result] = await db.query('DELETE FROM bijoux WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Bijou introuvable' });
    console.log(`[api] Bijou supprimé #${id}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.CATEGORIES = CATEGORIES;
router.CARATS = CARATS;
module.exports = router;
