const express = require('express');
const { db } = require('../firebase-admin');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { pushNotification } = require('../utils/notifications');

const router = express.Router();

// GET /api/stocks
router.get('/', authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection('stocks').orderBy('nom').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stocks
router.post('/', authenticateToken, requireRole('directeur', 'manager'), async (req, res) => {
  try {
    const { nom, categorie, quantite, minimum, unite } = req.body;
    if (!nom || quantite === undefined || !minimum) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    const data = {
      nom: nom.trim(),
      categorie: categorie || 'Général',
      quantite: Number(quantite),
      minimum: Number(minimum),
      unite: unite || 'pièces',
      createdAt: new Date().toISOString()
    };
    const ref = await db.collection('stocks').add(data);

    // Notification
    pushNotification({
      type: 'success', icon: 'plus-circle',
      titre: 'Article de stock ajouté',
      message: `${data.nom} – ${data.quantite} ${data.unite} (min. ${data.minimum})`,
      createdBy: req.user.username,
    });

    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stocks/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const docRef = db.collection('stocks').doc(req.params.id);
    const doc = await docRef.get();

    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update.id;
    if (update.quantite !== undefined) update.quantite = Number(update.quantite);
    await docRef.update(update);

    // Notification
    const existing = doc.exists ? doc.data() : {};
    const nom      = update.nom      || existing.nom      || req.params.id;
    const quantite = update.quantite !== undefined ? update.quantite : existing.quantite;
    const unite    = update.unite    || existing.unite    || '';
    pushNotification({
      type: 'info', icon: 'boxes',
      titre: 'Stock mis à jour',
      message: `${nom} – ${quantite} ${unite}`,
      createdBy: req.user.username,
    });

    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stocks/alerts
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection('stocks').get();
    const alerts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.quantite < s.minimum);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stocks/seed
router.post('/seed', authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection('stocks').limit(1).get();
    if (!snap.empty) return res.status(409).json({ error: 'Stocks déjà initialisés' });

    const items = [
      { nom: 'Savon',        categorie: 'Hygiène',  quantite: 50,  minimum: 20, unite: 'pièces' },
      { nom: 'Shampooing',   categorie: 'Hygiène',  quantite: 40,  minimum: 20, unite: 'pièces' },
      { nom: 'Serviettes',   categorie: 'Linge',    quantite: 100, minimum: 50, unite: 'pièces' },
      { nom: 'Draps',        categorie: 'Linge',    quantite: 80,  minimum: 30, unite: 'pièces' },
      { nom: 'Eau minérale', categorie: 'Boisson',  quantite: 200, minimum: 100, unite: 'bouteilles' },
      { nom: 'Café',         categorie: 'Boisson',  quantite: 10,  minimum: 5,  unite: 'kg' },
    ];

    const batch = db.batch();
    for (const item of items) {
      const ref = db.collection('stocks').doc();
      batch.set(ref, { ...item, createdAt: new Date().toISOString() });
    }
    await batch.commit();
    res.json({ message: `${items.length} articles de stock créés` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
