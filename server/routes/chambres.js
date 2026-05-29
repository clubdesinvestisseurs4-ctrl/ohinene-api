const express = require('express');
const { db } = require('../firebase-admin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/chambres
router.get('/', authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection('chambres').orderBy('numero').get();
    const chambres = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(chambres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chambres/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { statut, ...rest } = req.body;
    const allowed = ['available', 'occupied', 'maintenance', 'cleaning', 'reserved'];
    if (statut && !allowed.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const update = { ...rest, updatedAt: new Date().toISOString() };
    if (statut) update.statut = statut;
    await db.collection('chambres').doc(req.params.id).update(update);
    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chambres — créer une chambre individuelle
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { numero, etage, type, prix, statut = 'available' } = req.body;
    if (!numero || !etage || !type || !prix) {
      return res.status(400).json({ error: 'Champs obligatoires : numero, etage, type, prix' });
    }
    const typesValides = ['Standard', 'Deluxe', 'Suite'];
    if (!typesValides.includes(type)) {
      return res.status(400).json({ error: 'Type invalide (Standard, Deluxe, Suite)' });
    }
    const statutsValides = ['available', 'occupied', 'maintenance', 'cleaning', 'reserved'];
    if (!statutsValides.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const docId = `CH${String(Number(numero)).padStart(2, '0')}`;
    const existing = await db.collection('chambres').doc(docId).get();
    if (existing.exists) {
      return res.status(409).json({ error: `La chambre ${docId} existe déjà` });
    }
    const data = {
      numero: Number(numero),
      etage: Number(etage),
      type,
      prix: Number(prix),
      statut,
      createdAt: new Date().toISOString()
    };
    await db.collection('chambres').doc(docId).set(data);
    res.status(201).json({ id: docId, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chambres/seed — initialise les 15 chambres
router.post('/seed', authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection('chambres').limit(1).get();
    if (!snap.empty) return res.status(409).json({ error: 'Chambres déjà initialisées' });

    const types = [
      { type: 'Standard', prix: 25000, etage: 1 },
      { type: 'Deluxe',   prix: 35000, etage: 2 },
      { type: 'Suite',    prix: 75000, etage: 3 },
    ];
    const batch = db.batch();
    for (let i = 1; i <= 15; i++) {
      const t = types[Math.floor((i - 1) / 5)];
      const ref = db.collection('chambres').doc(`CH${String(i).padStart(2, '0')}`);
      batch.set(ref, {
        numero: i,
        etage: t.etage,
        type: t.type,
        prix: t.prix,
        statut: 'available',
        createdAt: new Date().toISOString()
      });
    }
    await batch.commit();
    res.json({ message: '15 chambres créées' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
