const { db } = require('../firebase-admin');

async function pushNotification({ type, icon, titre, message, createdBy }) {
  try {
    await db.collection('notifications').add({
      type: type || 'info',
      icon: icon || 'bell',
      titre,
      message,
      createdBy: createdBy || 'système',
      lu: false,
      createdAt: new Date().toISOString(),
    });
  } catch (_) {
    // Non bloquant — ne doit jamais faire échouer la route principale
  }
}

module.exports = { pushNotification };
