const express = require('express');
const { db } = require('../firebase-admin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/factures
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = db.collection('factures').orderBy('createdAt', 'desc');
    const snap = await query.get();
    let factures = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const { dateStart, dateEnd } = req.query;
    if (dateStart) factures = factures.filter(f => f.date >= dateStart);
    if (dateEnd)   factures = factures.filter(f => f.date <= dateEnd);

    res.json(factures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/factures — générer depuis une réservation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { reservationId, modePaiement } = req.body;

    if (!reservationId) return res.status(400).json({ error: 'reservationId requis' });

    const resDoc = await db.collection('reservations').doc(reservationId).get();
    if (!resDoc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const reservation = resDoc.data();
    const clientDoc = await db.collection('clients').doc(reservation.clientId).get();
    const chambreDoc = await db.collection('chambres').doc(reservation.chambreId).get();

    const client = clientDoc.data();
    const chambre = chambreDoc.data();

    const sousTotal = chambre.prix * reservation.nuits;
    const tva = Math.round(sousTotal * 0.18);
    const total = sousTotal + tva;
    const reste = total - (reservation.acompte || 0);

    const data = {
      reservationId,
      clientId: reservation.clientId,
      clientNom: `${client.nom} ${client.prenom}`,
      clientTel: client.tel,
      chambreId: reservation.chambreId,
      chambreType: chambre.type,
      arrivee: reservation.arrivee,
      depart: reservation.depart,
      nuits: reservation.nuits,
      prixUnitaire: chambre.prix,
      sousTotal,
      tva,
      total,
      acompte: reservation.acompte || 0,
      reste,
      modePaiement: modePaiement || 'especes',
      statut: reste <= 0 ? 'payee' : 'partielle',
      date: new Date().toISOString().split('T')[0],
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };

    const ref = await db.collection('factures').add(data);

    // Mettre à jour dépense client
    await db.collection('clients').doc(reservation.clientId).update({
      depense: (client.depense || 0) + total
    });

    // Marquer réservation comme checked-out si paiement complet
    if (reste <= 0) {
      await db.collection('reservations').doc(reservationId).update({ statut: 'checked-out' });
      await db.collection('chambres').doc(reservation.chambreId).update({ statut: 'cleaning' });
    }

    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
