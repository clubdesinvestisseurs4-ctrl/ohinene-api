const express = require('express');
const { db } = require('../firebase-admin');
const { authenticateToken } = require('../middleware/auth');
const { pushNotification } = require('../utils/notifications');

const router = express.Router();

// GET /api/reservations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { statut, date } = req.query;
    const snap = await db.collection('reservations').orderBy('createdAt', 'desc').get();
    let reservations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (statut) reservations = reservations.filter(r => r.statut === statut);
    if (date)   reservations = reservations.filter(r => r.arrivee === date || r.depart === date);
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reservations
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { clientId, chambreId, arrivee, depart, personnes, prix, acompte } = req.body;

    if (!clientId || !chambreId || !arrivee || !depart) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    if (new Date(depart) <= new Date(arrivee)) {
      return res.status(400).json({ error: 'Date de départ doit être après arrivée' });
    }

    // Vérifier disponibilité
    const conflicts = await db.collection('reservations')
      .where('chambreId', '==', chambreId)
      .where('statut', 'in', ['confirmed', 'checked-in'])
      .get();

    const hasConflict = conflicts.docs.some(d => {
      const r = d.data();
      return new Date(arrivee) < new Date(r.depart) && new Date(depart) > new Date(r.arrivee);
    });

    if (hasConflict) {
      return res.status(409).json({ error: 'Chambre non disponible pour ces dates' });
    }

    const nuits = Math.ceil((new Date(depart) - new Date(arrivee)) / 86400000);
    const data = {
      clientId,
      chambreId,
      arrivee,
      depart,
      nuits,
      personnes: personnes || 1,
      prix: prix || 0,
      acompte: acompte || 0,
      statut: 'confirmed',
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };

    const ref = await db.collection('reservations').add(data);
    await db.collection('chambres').doc(chambreId).update({ statut: 'reserved' });

    // Notification (non bloquante)
    db.collection('clients').doc(clientId).get().then(cDoc => {
      const clientNom = cDoc.exists ? `${cDoc.data().nom} ${cDoc.data().prenom}` : '—';
      pushNotification({
        type: 'success', icon: 'calendar-plus',
        titre: 'Nouvelle réservation',
        message: `Ch. ${chambreId} – ${clientNom} (${arrivee} → ${depart}, ${nuits} nuit${nuits > 1 ? 's' : ''})`,
        createdBy: req.user.username,
      });
    }).catch(() => {});

    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reservations/:id  — check-in, check-out, annulation
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { statut } = req.body;
    const docRef = db.collection('reservations').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const reservation = doc.data();
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update.id;

    await docRef.update(update);

    // Sync statut chambre
    if (statut === 'checked-in') {
      await db.collection('chambres').doc(reservation.chambreId).update({ statut: 'occupied' });
    } else if (statut === 'checked-out' || statut === 'annulee') {
      await db.collection('chambres').doc(reservation.chambreId).update({ statut: 'cleaning' });
      if (statut === 'checked-out') {
        await db.collection('clients').doc(reservation.clientId).update({
          visites: (reservation.visites || 0) + 1
        });
      }
    }

    // Notification selon le statut
    const notifMap = {
      'checked-in':  { type: 'info',    icon: 'sign-in-alt',  titre: 'Check-in effectué'   },
      'checked-out': { type: 'warning', icon: 'sign-out-alt', titre: 'Check-out effectué'  },
      'annulee':     { type: 'danger',  icon: 'times-circle', titre: 'Réservation annulée' },
    };

    if (notifMap[statut]) {
      db.collection('clients').doc(reservation.clientId).get().then(cDoc => {
        const clientNom = cDoc.exists ? `${cDoc.data().nom} ${cDoc.data().prenom}` : '—';
        pushNotification({
          ...notifMap[statut],
          message: `Ch. ${reservation.chambreId} – ${clientNom}`,
          createdBy: req.user.username,
        });
      }).catch(() => {});
    }

    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
