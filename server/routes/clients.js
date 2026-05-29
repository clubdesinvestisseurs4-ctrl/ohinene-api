const express = require('express');
const { db } = require('../firebase-admin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection('clients').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { nom, prenom, tel, email, piece, numPiece } = req.body;
    if (!nom || !prenom || !tel) {
      return res.status(400).json({ error: 'Nom, prénom et téléphone requis' });
    }
    const data = {
      nom: nom.toUpperCase().trim(),
      prenom: prenom.trim(),
      tel: tel.trim(),
      email: email?.trim() || '',
      piece: piece || 'cni',
      numPiece: numPiece?.trim() || '',
      visites: 0,
      depense: 0,
      points: 0,
      niveau: 'Bronze',
      actif: true,
      createdAt: new Date().toISOString()
    };
    const ref = await db.collection('clients').add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update.id;
    await db.collection('clients').doc(req.params.id).update(update);
    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/search?q=
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const snap = await db.collection('clients').get();
    const results = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c =>
        c.nom?.toLowerCase().includes(q) ||
        c.prenom?.toLowerCase().includes(q) ||
        c.tel?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
