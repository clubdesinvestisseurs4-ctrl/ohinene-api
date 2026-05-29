const express = require('express');
const { db } = require('../firebase-admin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats/dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [chambresSnap, reservationsSnap, facturesSnap, stocksSnap] = await Promise.all([
      db.collection('chambres').get(),
      db.collection('reservations').get(),
      db.collection('factures').where('date', '==', today).get(),
      db.collection('stocks').get()
    ]);

    const chambres = chambresSnap.docs.map(d => d.data());
    const reservations = reservationsSnap.docs.map(d => d.data());
    const facturesToday = facturesSnap.docs.map(d => d.data());
    const stocks = stocksSnap.docs.map(d => d.data());

    const occupied = chambres.filter(c => c.statut === 'occupied').length;
    const occupation = chambres.length ? Math.round((occupied / chambres.length) * 100) : 0;

    const revenusJour = facturesToday.reduce((s, f) => s + (f.total || 0), 0);

    const arrivees = reservations.filter(r => r.arrivee === today).length;
    const departs  = reservations.filter(r => r.depart === today).length;

    const alertesStock = stocks.filter(s => s.quantite < s.minimum).length;
    const alertesMaintenance = chambres.filter(c => c.statut === 'maintenance').length;

    res.json({
      occupation: `${occupation}%`,
      clientsPresents: occupied,
      revenusJour,
      alertes: alertesStock + alertesMaintenance,
      arrivees,
      departs,
      chambresTotal: chambres.length,
      chambresDisponibles: chambres.filter(c => c.statut === 'available').length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/rapport?debut=YYYY-MM-DD&fin=YYYY-MM-DD
router.get('/rapport', authenticateToken, async (req, res) => {
  try {
    const { debut, fin } = req.query;
    const snap = await db.collection('factures').get();
    const factures = snap.docs
      .map(d => d.data())
      .filter(f => (!debut || f.date >= debut) && (!fin || f.date <= fin));

    const total = factures.reduce((s, f) => s + (f.total || 0), 0);
    const parMode = {};
    factures.forEach(f => {
      parMode[f.modePaiement] = (parMode[f.modePaiement] || 0) + (f.total || 0);
    });

    res.json({ total, nombre: factures.length, moyenne: Math.round(total / (factures.length || 1)), parMode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
