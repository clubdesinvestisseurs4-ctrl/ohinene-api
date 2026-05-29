const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../firebase-admin');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

async function logSession(userId, username, nom, role, action, ip) {
  await db.collection('sessions').add({
    userId, username, nom, role, action,
    ip: ip || 'inconnue',
    timestamp: new Date().toISOString()
  });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiants requis' });
    }

    const snapshot = await db
      .collection('utilisateurs')
      .where('username', '==', username.toLowerCase().trim())
      .where('actif', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    await userDoc.ref.update({ lastLogin: new Date().toISOString() });
    await logSession(userDoc.id, user.username, user.nom, user.role, 'login', req.ip).catch(() => {});

    const token = jwt.sign(
      { id: userDoc.id, username: user.username, nom: user.nom, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: userDoc.id, username: user.username, nom: user.nom, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/logout — enregistre la déconnexion
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await logSession(req.user.id, req.user.username, req.user.nom, req.user.role, 'logout', req.ip);
    res.json({ message: 'Déconnexion enregistrée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/sessions — journal des connexions (directeur uniquement)
router.get('/sessions', authenticateToken, requireRole('directeur'), async (req, res) => {
  try {
    const { debut, fin, username } = req.query;
    const snap = await db.collection('sessions').orderBy('timestamp', 'desc').limit(500).get();
    let sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (debut)    sessions = sessions.filter(s => s.timestamp >= debut);
    if (fin)      sessions = sessions.filter(s => s.timestamp <= fin + 'T23:59:59');
    if (username) sessions = sessions.filter(s => s.username === username);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/seed  — crée l'admin initial (à appeler une seule fois)
router.post('/seed', async (req, res) => {
  try {
    const snapshot = await db.collection('utilisateurs').limit(1).get();
    if (!snapshot.empty) {
      return res.status(409).json({ error: 'Base déjà initialisée' });
    }

    const utilisateurs = [
      { username: 'admin',      nom: 'Admin Système',    role: 'directeur',      password: 'Admin@2026!' },
      { username: 'manager',    nom: 'Konan Jacqueline', role: 'manager',        password: 'Manager@2026!' },
      { username: 'reception',  nom: 'Sekongo Marie',    role: 'receptionniste', password: 'Reception@2026!' },
    ];

    const batch = db.batch();
    for (const u of utilisateurs) {
      const ref = db.collection('utilisateurs').doc();
      const passwordHash = await bcrypt.hash(u.password, 10);
      batch.set(ref, {
        username: u.username,
        nom: u.nom,
        role: u.role,
        passwordHash,
        actif: true,
        createdAt: new Date().toISOString(),
        lastLogin: null
      });
    }
    await batch.commit();

    res.json({ message: 'Utilisateurs créés', count: utilisateurs.length });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
