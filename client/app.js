/* ═══════════════════════════════════════════════════════════════════
   HOTEL OHINENE – Application principale (vanilla JS ES modules)
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Config ─────────────────────────────────────────────────────────
// À remplacer par votre URL Render en production
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : 'https://hotel-ohinene-api.onrender.com/api';

// ─── State ──────────────────────────────────────────────────────────
const state = {
  token:        localStorage.getItem('ohinene_token') || null,
  user:         JSON.parse(localStorage.getItem('ohinene_user') || 'null'),
  currentPage:  'dashboard',
  chambres:     [],
  clients:      [],
  reservations: [],
  factures:     [],
  stocks:       [],
  dashStats:    {},
};

// ─── API helper ──────────────────────────────────────────────────────
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } });

  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Session expirée');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ─── Loader ───────────────────────────────────────────────────────────
function showLoader() { document.getElementById('loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('loader').classList.add('hidden'); }

// ─── Modal ────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(`modal-${id}`).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(`modal-${id}`).classList.add('hidden'); }

document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id.replace('modal-', ''));
  });
});

// ─── Formatters ───────────────────────────────────────────────────────
const fmtCurrency = n => Number(n || 0).toLocaleString('fr-FR');
const fmtDate     = s => s ? new Date(s).toLocaleDateString('fr-FR') : '—';
const today       = () => new Date().toISOString().split('T')[0];

// ─── Auth ─────────────────────────────────────────────────────────────
async function login(username, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  state.token = data.token;
  state.user  = data.user;
  localStorage.setItem('ohinene_token', data.token);
  localStorage.setItem('ohinene_user',  JSON.stringify(data.user));
}

function logout() {
  state.token = null;
  state.user  = null;
  localStorage.removeItem('ohinene_token');
  localStorage.removeItem('ohinene_user');
  document.getElementById('app-screen').style.display   = 'none';
  document.getElementById('login-screen').style.display = '';
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion…';
  try {
    await login(
      document.getElementById('login-username').value,
      document.getElementById('login-password').value,
    );
    initApp();
  } catch (ex) {
    err.textContent = ex.message;
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

// ─── Navigation ───────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:   'Dashboard',
  reception:   'Réception',
  chambres:    'Chambres',
  clients:     'Clients',
  facturation: 'Facturation',
  stocks:      'Stocks',
  rapports:    'Rapports',
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const navItem = document.querySelector(`[data-page="${name}"]`);
  if (navItem) navItem.classList.add('active');

  document.getElementById('page-title').textContent = PAGE_TITLES[name] || name;
  state.currentPage = name;

  switch (name) {
    case 'dashboard':   loadDashboard(); break;
    case 'reception':   loadReservations(); break;
    case 'chambres':    loadChambres(); break;
    case 'clients':     loadClients(); break;
    case 'facturation': loadFactures(); break;
    case 'stocks':      loadStocks(); break;
    case 'rapports':    loadRapports(); break;
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => showPage(item.dataset.page));
});

// ─── Dashboard ────────────────────────────────────────────────────────
async function loadDashboard() {
  showLoader();
  try {
    const [stats, chambres, reservations] = await Promise.all([
      api('/stats/dashboard'),
      api('/chambres'),
      api('/reservations'),
    ]);
    state.dashStats    = stats;
    state.chambres     = chambres;
    state.reservations = reservations;

    document.getElementById('stat-occupation').textContent = stats.occupation;
    document.getElementById('stat-clients').textContent    = stats.clientsPresents;
    document.getElementById('stat-revenue').textContent    = fmtCurrency(stats.revenusJour);
    document.getElementById('stat-alertes').textContent    = stats.alertes;

    // Notification badge
    if (stats.alertes > 0) {
      const badge = document.getElementById('notif-badge');
      badge.textContent = stats.alertes;
      badge.style.display = '';
    }

    // Room mini grid
    const grid = document.getElementById('dash-room-grid');
    grid.innerHTML = '';
    chambres.forEach(c => {
      const d = document.createElement('div');
      d.className = `room-mini ${c.statut}`;
      d.textContent = c.id;
      d.title = `${c.id} – ${c.type} (${c.statut})`;
      grid.appendChild(d);
    });

    // Arrivées / Départs
    const todayStr = today();
    renderListItems('dash-arrivees', reservations.filter(r => r.arrivee === todayStr));
    renderListItems('dash-departs',  reservations.filter(r => r.depart  === todayStr && r.statut === 'checked-in'));

  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

function renderListItems(containerId, reservations) {
  const el = document.getElementById(containerId);
  if (!reservations.length) {
    el.innerHTML = '<p style="color:var(--gray);font-size:.85rem;padding:8px 0">Aucune entrée</p>';
    return;
  }
  el.innerHTML = reservations.map(r => `
    <div class="list-item">
      <div>
        <div class="list-item-name">${r.clientNom || r.clientId}</div>
        <div class="list-item-sub">Ch. ${r.chambreId} · ${r.nuits} nuit(s)</div>
      </div>
      <span class="list-item-badge status-badge ${r.statut}">${r.statut}</span>
    </div>`).join('');
}

// ─── Chambres ─────────────────────────────────────────────────────────
async function loadChambres() {
  showLoader();
  try {
    state.chambres = await api('/chambres');
    renderChambres(state.chambres);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

function renderChambres(chambres) {
  const grid = document.getElementById('rooms-grid');
  if (!chambres.length) {
    grid.innerHTML = '<p style="color:var(--gray)">Aucune chambre trouvée.</p>';
    return;
  }
  grid.innerHTML = chambres.map(c => `
    <div class="room-card ${c.statut}" data-id="${c.id}" style="cursor:pointer">
      <div class="room-card-header">
        <span class="room-number">${c.id}</span>
        <span class="status-badge ${c.statut}">${statutLabel(c.statut)}</span>
      </div>
      <div class="room-type">${c.type} · Étage ${c.etage}</div>
      <div class="room-price">${fmtCurrency(c.prix)} FCA/nuit</div>
    </div>`).join('');

  grid.querySelectorAll('.room-card').forEach(card => {
    card.addEventListener('click', () => openChambreModal(card.dataset.id));
  });
}

function statutLabel(s) {
  return { available: 'Disponible', occupied: 'Occupée', maintenance: 'Maintenance', cleaning: 'Nettoyage', reserved: 'Réservée' }[s] || s;
}

document.getElementById('btn-filter-chambres').addEventListener('click', () => {
  const etage  = document.getElementById('filter-etage').value;
  const statut = document.getElementById('filter-statut').value;
  const type   = document.getElementById('filter-type').value;
  let filtered = state.chambres;
  if (etage)  filtered = filtered.filter(c => String(c.etage) === etage);
  if (statut) filtered = filtered.filter(c => c.statut === statut);
  if (type)   filtered = filtered.filter(c => c.type === type);
  renderChambres(filtered);
});

let currentChambreId = null;
function openChambreModal(id) {
  const chambre = state.chambres.find(c => c.id === id);
  if (!chambre) return;
  currentChambreId = id;
  document.getElementById('modal-chambre-title').textContent = `Chambre ${id} – ${chambre.type}`;
  document.getElementById('modal-chambre-body').innerHTML = `
    <div class="form-group">
      <label>Étage</label>
      <input type="text" value="Étage ${chambre.etage}" disabled>
    </div>
    <div class="form-group">
      <label>Type</label>
      <input type="text" value="${chambre.type}" disabled>
    </div>
    <div class="form-group">
      <label>Prix / nuit (FCA)</label>
      <input type="number" id="chambre-prix" value="${chambre.prix}">
    </div>
    <div class="form-group">
      <label>Statut</label>
      <select id="chambre-statut">
        ${['available','occupied','maintenance','cleaning','reserved'].map(s =>
          `<option value="${s}" ${chambre.statut === s ? 'selected' : ''}>${statutLabel(s)}</option>`
        ).join('')}
      </select>
    </div>`;
  openModal('chambre');
}

document.getElementById('btn-save-chambre').addEventListener('click', async () => {
  if (!currentChambreId) return;
  showLoader();
  try {
    const update = {
      statut: document.getElementById('chambre-statut').value,
      prix:   Number(document.getElementById('chambre-prix').value),
    };
    await api(`/chambres/${currentChambreId}`, { method: 'PUT', body: JSON.stringify(update) });
    toast('Chambre mise à jour', 'success');
    closeModal('chambre');
    await loadChambres();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
});

// ─── Réservations ─────────────────────────────────────────────────────
async function loadReservations() {
  showLoader();
  try {
    const statut = document.getElementById('filter-resa-statut').value;
    const date   = document.getElementById('filter-resa-date').value;
    let path = '/reservations';
    const params = new URLSearchParams();
    if (statut) params.set('statut', statut);
    if (date)   params.set('date', date);
    if (params.toString()) path += '?' + params.toString();

    const [reservations, clients, chambres] = await Promise.all([
      api(path),
      state.clients.length ? Promise.resolve(state.clients) : api('/clients'),
      state.chambres.length ? Promise.resolve(state.chambres) : api('/chambres'),
    ]);
    state.reservations = reservations;
    state.clients  = clients;
    state.chambres = chambres;

    const tbody = document.getElementById('reservations-tbody');
    if (!reservations.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:24px">Aucune réservation</td></tr>';
      return;
    }

    tbody.innerHTML = reservations.map(r => {
      const client = clients.find(c => c.id === r.clientId);
      return `
      <tr>
        <td><code style="font-size:.8rem">${r.id?.slice(-6)}</code></td>
        <td>${client ? `${client.nom} ${client.prenom}` : r.clientId}</td>
        <td>${r.chambreId}</td>
        <td>${fmtDate(r.arrivee)}</td>
        <td>${fmtDate(r.depart)}</td>
        <td>${r.nuits}</td>
        <td>${fmtCurrency(r.prix)}</td>
        <td><span class="status-badge ${r.statut}">${statutResaLabel(r.statut)}</span></td>
        <td class="actions-cell">
          ${r.statut === 'confirmed' ? `<button class="btn btn-sm btn-success" onclick="doCheckin('${r.id}')"><i class="fas fa-sign-in-alt"></i></button>` : ''}
          ${r.statut === 'checked-in' ? `<button class="btn btn-sm btn-warning" onclick="doCheckout('${r.id}')"><i class="fas fa-sign-out-alt"></i></button>` : ''}
          ${['confirmed','checked-in'].includes(r.statut) ? `<button class="btn btn-sm btn-danger" onclick="doAnnuler('${r.id}')"><i class="fas fa-times"></i></button>` : ''}
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

function statutResaLabel(s) {
  return { confirmed: 'Confirmée', 'checked-in': 'En cours', 'checked-out': 'Terminée', annulee: 'Annulée' }[s] || s;
}

window.doCheckin = async id => {
  if (!confirm('Confirmer le check-in ?')) return;
  showLoader();
  try {
    await api(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify({ statut: 'checked-in' }) });
    toast('Check-in effectué', 'success');
    loadReservations();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); }
};

window.doCheckout = async id => {
  if (!confirm('Confirmer le check-out ?')) return;
  showLoader();
  try {
    await api(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify({ statut: 'checked-out' }) });
    toast('Check-out effectué', 'success');
    loadReservations();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); }
};

window.doAnnuler = async id => {
  if (!confirm('Annuler cette réservation ?')) return;
  showLoader();
  try {
    await api(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify({ statut: 'annulee' }) });
    toast('Réservation annulée', 'warning');
    loadReservations();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); }
};

document.getElementById('btn-filter-resa').addEventListener('click', loadReservations);

// Ouvrir modal Nouvelle réservation
document.getElementById('btn-new-reservation').addEventListener('click', async () => {
  document.getElementById('resa-id').value = '';
  document.getElementById('modal-resa-title').textContent = 'Nouvelle réservation';
  document.getElementById('form-reservation').reset();
  // Pré-remplir dates
  const t = today();
  const t1 = new Date(); t1.setDate(t1.getDate()+1);
  document.getElementById('resa-arrivee').value = t;
  document.getElementById('resa-depart').value  = t1.toISOString().split('T')[0];
  // Charger clients et chambres disponibles
  showLoader();
  try {
    const [clients, chambres] = await Promise.all([api('/clients'), api('/chambres')]);
    state.clients = clients;
    state.chambres = chambres;
    const cs = document.getElementById('resa-client');
    cs.innerHTML = '<option value="">Sélectionner un client</option>' +
      clients.map(c => `<option value="${c.id}">${c.nom} ${c.prenom} – ${c.tel}</option>`).join('');
    const ch = document.getElementById('resa-chambre');
    ch.innerHTML = '<option value="">Sélectionner</option>' +
      chambres.filter(c => c.statut === 'available').map(c =>
        `<option value="${c.id}">${c.id} – ${c.type} (${fmtCurrency(c.prix)} FCA/nuit)</option>`
      ).join('');
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); }

  // Auto-calculer le prix
  const calcPrix = () => {
    const chambreId = document.getElementById('resa-chambre').value;
    const chambre   = state.chambres.find(c => c.id === chambreId);
    const arrivee   = document.getElementById('resa-arrivee').value;
    const depart    = document.getElementById('resa-depart').value;
    if (chambre && arrivee && depart) {
      const nuits = Math.ceil((new Date(depart) - new Date(arrivee)) / 86400000);
      if (nuits > 0) document.getElementById('resa-prix').value = chambre.prix * nuits;
    }
  };
  document.getElementById('resa-chambre').onchange = calcPrix;
  document.getElementById('resa-arrivee').onchange = calcPrix;
  document.getElementById('resa-depart').onchange  = calcPrix;

  openModal('reservation');
});

document.getElementById('btn-save-resa').addEventListener('click', async () => {
  const clientId = document.getElementById('resa-client').value;
  const chambreId = document.getElementById('resa-chambre').value;
  const arrivee  = document.getElementById('resa-arrivee').value;
  const depart   = document.getElementById('resa-depart').value;
  if (!clientId || !chambreId || !arrivee || !depart) {
    toast('Veuillez remplir tous les champs requis', 'warning'); return;
  }
  showLoader();
  try {
    await api('/reservations', {
      method: 'POST',
      body: JSON.stringify({
        clientId, chambreId, arrivee, depart,
        personnes: Number(document.getElementById('resa-personnes').value),
        prix:    Number(document.getElementById('resa-prix').value),
        acompte: Number(document.getElementById('resa-acompte').value),
      }),
    });
    toast('Réservation enregistrée', 'success');
    closeModal('reservation');
    loadReservations();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); }
});

// ─── Clients ──────────────────────────────────────────────────────────
async function loadClients(search = '') {
  showLoader();
  try {
    const path = search ? `/clients/search?q=${encodeURIComponent(search)}` : '/clients';
    state.clients = await api(path);
    renderClients(state.clients);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

function renderClients(clients) {
  const tbody = document.getElementById('clients-tbody');
  if (!clients.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:24px">Aucun client</td></tr>';
    return;
  }
  const niveauColors = { Bronze: '#cd7f32', Argent: '#c0c0c0', Or: '#ffd700', Platine: '#e5e4e2' };
  tbody.innerHTML = clients.map(c => `
    <tr>
      <td><code style="font-size:.78rem">${c.id?.slice(-5)}</code></td>
      <td><strong>${c.nom} ${c.prenom}</strong></td>
      <td>${c.tel}</td>
      <td>${c.email || '—'}</td>
      <td>${c.visites || 0}</td>
      <td>${fmtCurrency(c.depense || 0)}</td>
      <td><span style="color:${niveauColors[c.niveau]||'#666'};font-weight:700">${c.niveau || 'Bronze'}</span></td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="editClient('${c.id}')"><i class="fas fa-edit"></i></button>
      </td>
    </tr>`).join('');
}

document.getElementById('btn-search-client').addEventListener('click', () => {
  loadClients(document.getElementById('search-client').value);
});
document.getElementById('search-client').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadClients(document.getElementById('search-client').value);
});

document.getElementById('btn-new-client').addEventListener('click', () => {
  document.getElementById('client-id').value = '';
  document.getElementById('modal-client-title').textContent = 'Nouveau client';
  document.getElementById('form-client').reset();
  openModal('client');
});

window.editClient = id => {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  document.getElementById('client-id').value      = c.id;
  document.getElementById('client-nom').value     = c.nom;
  document.getElementById('client-prenom').value  = c.prenom;
  document.getElementById('client-tel').value     = c.tel;
  document.getElementById('client-email').value   = c.email || '';
  document.getElementById('client-piece').value   = c.piece || 'cni';
  document.getElementById('client-num-piece').value = c.numPiece || '';
  document.getElementById('modal-client-title').textContent = 'Modifier client';
  openModal('client');
};

document.getElementById('btn-save-client').addEventListener('click', async () => {
  const id     = document.getElementById('client-id').value;
  const nom    = document.getElementById('client-nom').value.trim();
  const prenom = document.getElementById('client-prenom').value.trim();
  const tel    = document.getElementById('client-tel').value.trim();
  if (!nom || !prenom || !tel) { toast('Nom, prénom et téléphone requis', 'warning'); return; }

  showLoader();
  try {
    const payload = {
      nom, prenom, tel,
      email: document.getElementById('client-email').value.trim(),
      piece: document.getElementById('client-piece').value,
      numPiece: document.getElementById('client-num-piece').value.trim(),
    };
    if (id) {
      await api(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Client mis à jour', 'success');
    } else {
      await api('/clients', { method: 'POST', body: JSON.stringify(payload) });
      toast('Client créé', 'success');
    }
    closeModal('client');
    loadClients();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); }
});

// ─── Facturation ──────────────────────────────────────────────────────
async function loadFactures() {
  showLoader();
  try {
    const start = document.getElementById('filter-fact-start').value;
    const end   = document.getElementById('filter-fact-end').value;
    let path = '/factures';
    const params = new URLSearchParams();
    if (start) params.set('dateStart', start);
    if (end)   params.set('dateEnd', end);
    if (params.toString()) path += '?' + params.toString();

    state.factures = await api(path);
    const tbody = document.getElementById('factures-tbody');
    if (!state.factures.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:24px">Aucune facture</td></tr>';
      return;
    }
    tbody.innerHTML = state.factures.map(f => `
      <tr>
        <td><code style="font-size:.78rem">${f.id?.slice(-6)}</code></td>
        <td>${fmtDate(f.date)}</td>
        <td>${f.clientNom || f.clientId}</td>
        <td>${f.chambreId}</td>
        <td>${f.nuits}</td>
        <td><strong>${fmtCurrency(f.total)}</strong></td>
        <td>${f.modePaiement || '—'}</td>
        <td><span class="status-badge ${f.statut === 'payee' ? 'available' : 'reserved'}">${f.statut}</span></td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-secondary" onclick="printFacture('${f.id}')" title="Imprimer"><i class="fas fa-print"></i></button>
        </td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

document.getElementById('btn-filter-fact').addEventListener('click', loadFactures);

window.printFacture = id => {
  const f = state.factures.find(x => x.id === id);
  if (!f) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <title>Facture ${f.id}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:auto}
      h1{color:#1a5f7a;text-align:center}
      .sep{border-top:2px solid #1a5f7a;margin:16px 0}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{padding:8px 12px;border:1px solid #ddd;text-align:left}
      th{background:#1a5f7a;color:#fff}
      .total{font-size:1.2rem;font-weight:700;text-align:right;color:#1a5f7a}
      .footer{text-align:center;color:#888;font-size:.85rem;margin-top:40px}
    </style></head><body>
    <h1>HÔTEL OHINENE</h1>
    <p style="text-align:center;color:#888">Restaurant & Hôtel de Qualité</p>
    <div class="sep"></div>
    <p><strong>Facture N°:</strong> ${f.id}</p>
    <p><strong>Date:</strong> ${fmtDate(f.date)}</p>
    <p><strong>Client:</strong> ${f.clientNom} – Tél: ${f.clientTel}</p>
    <div class="sep"></div>
    <table>
      <tr><th>Désignation</th><th>Détail</th></tr>
      <tr><td>Chambre ${f.chambreId} (${f.chambreType})</td><td>${fmtDate(f.arrivee)} → ${fmtDate(f.depart)}</td></tr>
      <tr><td>Prix / nuit</td><td>${fmtCurrency(f.prixUnitaire)} FCA</td></tr>
      <tr><td>Nombre de nuits</td><td>${f.nuits}</td></tr>
      <tr><td>Sous-total HT</td><td>${fmtCurrency(f.sousTotal)} FCA</td></tr>
      <tr><td>TVA (18 %)</td><td>${fmtCurrency(f.tva)} FCA</td></tr>
    </table>
    <p class="total">TOTAL: ${fmtCurrency(f.total)} FCA</p>
    <p style="text-align:right">Acompte versé: ${fmtCurrency(f.acompte)} FCA</p>
    <p style="text-align:right"><strong>RESTE À PAYER: ${fmtCurrency(f.reste)} FCA</strong></p>
    <p style="text-align:right">Mode de paiement: ${f.modePaiement}</p>
    <div class="footer"><p>Merci de votre confiance !<br>Hôtel Ohinene</p></div>
    </body></html>`);
  w.print();
};

// ─── Stocks ───────────────────────────────────────────────────────────
async function loadStocks() {
  showLoader();
  try {
    state.stocks = await api('/stocks');
    renderStocks(state.stocks);
    renderStockAlerts(state.stocks.filter(s => s.quantite < s.minimum));
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

function renderStocks(stocks) {
  const tbody = document.getElementById('stocks-tbody');
  if (!stocks.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:24px">Aucun article</td></tr>';
    return;
  }
  tbody.innerHTML = stocks.map(s => {
    const isLow = s.quantite < s.minimum;
    return `
    <tr>
      <td><strong>${s.nom}</strong></td>
      <td>${s.categorie}</td>
      <td style="color:${isLow ? 'var(--danger)' : 'var(--dark)'}"><strong>${s.quantite}</strong></td>
      <td>${s.minimum}</td>
      <td>${s.unite}</td>
      <td><span class="status-badge ${isLow ? 'occupied' : 'available'}">${isLow ? 'Bas' : 'OK'}</span></td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="editStock('${s.id}')"><i class="fas fa-edit"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function renderStockAlerts(alerts) {
  const el = document.getElementById('stock-alerts-list');
  if (!alerts.length) {
    el.innerHTML = '<p style="color:var(--success);font-size:.85rem"><i class="fas fa-check"></i> Tous les stocks sont OK</p>';
    return;
  }
  el.innerHTML = alerts.map(s => `
    <div class="alert-item">
      <span>${s.nom}</span>
      <span class="alert-qty">${s.quantite}/${s.minimum} ${s.unite}</span>
    </div>`).join('');
}

document.getElementById('btn-new-stock').addEventListener('click', () => {
  document.getElementById('stock-id').value = '';
  document.getElementById('modal-stock-title').textContent = 'Ajouter un article';
  document.getElementById('form-stock').reset();
  document.getElementById('stock-unite').value = 'pièces';
  openModal('stock');
});

window.editStock = id => {
  const s = state.stocks.find(x => x.id === id);
  if (!s) return;
  document.getElementById('stock-id').value        = s.id;
  document.getElementById('stock-nom').value       = s.nom;
  document.getElementById('stock-categorie').value = s.categorie;
  document.getElementById('stock-quantite').value  = s.quantite;
  document.getElementById('stock-minimum').value   = s.minimum;
  document.getElementById('stock-unite').value     = s.unite;
  document.getElementById('modal-stock-title').textContent = 'Modifier un article';
  openModal('stock');
};

document.getElementById('btn-save-stock').addEventListener('click', async () => {
  const id       = document.getElementById('stock-id').value;
  const nom      = document.getElementById('stock-nom').value.trim();
  const quantite = document.getElementById('stock-quantite').value;
  const minimum  = document.getElementById('stock-minimum').value;
  if (!nom || quantite === '' || minimum === '') { toast('Champs requis manquants', 'warning'); return; }

  showLoader();
  try {
    const payload = {
      nom, quantite, minimum,
      categorie: document.getElementById('stock-categorie').value,
      unite:     document.getElementById('stock-unite').value,
    };
    if (id) {
      await api(`/stocks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Stock mis à jour', 'success');
    } else {
      await api('/stocks', { method: 'POST', body: JSON.stringify(payload) });
      toast('Article ajouté', 'success');
    }
    closeModal('stock');
    loadStocks();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); }
});

// ─── Rapports ─────────────────────────────────────────────────────────
async function loadRapports() {
  // Valeurs par défaut : mois en cours
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const last  = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0];
  if (!document.getElementById('rapp-start').value) document.getElementById('rapp-start').value = first;
  if (!document.getElementById('rapp-end').value)   document.getElementById('rapp-end').value   = last;
  await fetchRapports();
}

async function fetchRapports() {
  showLoader();
  try {
    const debut = document.getElementById('rapp-start').value;
    const fin   = document.getElementById('rapp-end').value;
    const [rapport, clients] = await Promise.all([
      api(`/stats/rapport?debut=${debut}&fin=${fin}`),
      state.clients.length ? Promise.resolve(state.clients) : api('/clients'),
    ]);
    state.clients = clients;

    document.getElementById('rapp-revenus').textContent = fmtCurrency(rapport.total);
    document.getElementById('rapp-occupation').textContent = rapport.nombre + ' rés.';

    document.getElementById('rapp-revenus-detail').innerHTML = `
      <div class="kpi-list">
        <div class="kpi-item"><span>Nombre de factures</span><strong>${rapport.nombre}</strong></div>
        <div class="kpi-item"><span>Panier moyen</span><strong>${fmtCurrency(rapport.moyenne)} FCA</strong></div>
        ${Object.entries(rapport.parMode||{}).map(([m,v]) =>
          `<div class="kpi-item"><span>Mode: ${m}</span><strong>${fmtCurrency(v)} FCA</strong></div>`
        ).join('')}
      </div>`;

    // Top clients
    const sorted = [...clients].sort((a,b) => (b.depense||0)-(a.depense||0)).slice(0,5);
    document.getElementById('top-clients-list').innerHTML = sorted.map((c,i) => `
      <div class="kpi-item" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--light);font-size:.87rem">
        <span><strong>#${i+1}</strong> ${c.nom} ${c.prenom}</span>
        <strong>${fmtCurrency(c.depense||0)} FCA</strong>
      </div>`).join('') || '<p style="color:var(--gray)">Aucun client</p>';

  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

document.getElementById('btn-load-rapport').addEventListener('click', fetchRapports);

// ─── Offline detection ────────────────────────────────────────────────
window.addEventListener('online',  () => { document.body.classList.remove('offline'); toast('Connexion rétablie', 'success'); });
window.addEventListener('offline', () => { document.body.classList.add('offline');    toast('Mode hors ligne', 'warning'); });

// ─── Service Worker ───────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Nouvelle version disponible – rechargez la page', 'info', 6000);
        }
      });
    });
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────
function initApp() {
  // Mettre à jour UI avec infos utilisateur
  document.getElementById('sidebar-user-name').textContent = state.user?.nom || '—';
  document.getElementById('sidebar-user-role').textContent = state.user?.role || '';
  document.getElementById('header-date').textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'flex';
  showPage('dashboard');
}

// Auto-login si token stocké
if (state.token && state.user) {
  hideLoader();
  initApp();
} else {
  document.getElementById('login-screen').style.display = '';
  document.getElementById('app-screen').style.display   = 'none';
  hideLoader();
}
