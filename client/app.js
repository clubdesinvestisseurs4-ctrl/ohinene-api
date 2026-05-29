/* ═══════════════════════════════════════════════════════════════════
   HOTEL OHINENE – Application principale (vanilla JS ES modules)
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Config ─────────────────────────────────────────────────────────
// À remplacer par votre URL Render en production
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : 'https://ohinene-api.onrender.com/api';

// ─── State ──────────────────────────────────────────────────────────
let notifPollInterval = null;

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

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
  if (notifPollInterval) { clearInterval(notifPollInterval); notifPollInterval = null; }
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
  sessions:    'Journal des Sessions',
};

const PAGE_ACCESS = {
  directeur:      ['dashboard', 'reception', 'chambres', 'clients', 'facturation', 'stocks', 'rapports', 'sessions'],
  manager:        ['dashboard', 'chambres', 'stocks'],
  receptionniste: ['dashboard', 'reception', 'clients', 'facturation'],
};

function showPage(name) {
  const allowedPages = PAGE_ACCESS[state.user?.role] || ['dashboard'];
  if (!allowedPages.includes(name)) name = 'dashboard';

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
    case 'sessions':    loadSessions(); break;
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

document.getElementById('btn-new-chambre').addEventListener('click', () => {
  document.getElementById('form-new-chambre').reset();
  openModal('new-chambre');
});

document.getElementById('btn-save-new-chambre').addEventListener('click', async () => {
  const numero = document.getElementById('new-chambre-numero').value;
  const etage  = document.getElementById('new-chambre-etage').value;
  const type   = document.getElementById('new-chambre-type').value;
  const prix   = document.getElementById('new-chambre-prix').value;
  if (!numero || !etage || !type || !prix) {
    toast('Tous les champs sont obligatoires', 'warning');
    return;
  }
  showLoader();
  try {
    await api('/chambres', { method: 'POST', body: JSON.stringify({ numero: Number(numero), etage: Number(etage), type, prix: Number(prix) }) });
    toast('Chambre créée avec succès', 'success');
    closeModal('new-chambre');
    await loadChambres();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
});

document.getElementById('btn-seed-chambres').addEventListener('click', async () => {
  if (!confirm('Initialiser les 15 chambres par défaut (Étage 1-3) ? Cette action ne peut être faite qu\'une seule fois.')) return;
  showLoader();
  try {
    await api('/chambres/seed', { method: 'POST' });
    toast('15 chambres initialisées avec succès', 'success');
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
    const start  = document.getElementById('filter-fact-start').value;
    const end    = document.getElementById('filter-fact-end').value;
    const statut = document.getElementById('filter-fact-statut').value;
    let path = '/factures';
    const params = new URLSearchParams();
    if (start) params.set('dateStart', start);
    if (end)   params.set('dateEnd', end);
    if (params.toString()) path += '?' + params.toString();

    const tbody = document.getElementById('factures-tbody');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--gray);padding:24px"><i class="fas fa-spinner fa-spin"></i> Chargement…</td></tr>';

    state.factures = await api(path);
    let factures = state.factures;
    if (statut) factures = factures.filter(f => f.statut === statut);

    if (!factures.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--gray);padding:24px"><i class="fas fa-receipt"></i> Aucune facture trouvée — créez-en une via "Nouvelle facture"</td></tr>';
      return;
    }
    tbody.innerHTML = factures.map(f => `
      <tr>
        <td><code style="font-size:.78rem">${f.id?.slice(-6)}</code></td>
        <td>${fmtDate(f.date)}</td>
        <td>${f.clientNom || f.clientId}</td>
        <td>${f.chambreId}</td>
        <td>${f.nuits}</td>
        <td><strong>${fmtCurrency(f.total)}</strong></td>
        <td style="color:${f.reste > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtCurrency(f.reste)}</td>
        <td>${f.modePaiement || '—'}</td>
        <td><span class="status-badge ${f.statut === 'payee' ? 'available' : 'reserved'}">${f.statut === 'payee' ? 'Payée' : 'Partielle'}</span></td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-secondary" onclick="printFacture('${f.id}')" title="Imprimer"><i class="fas fa-print"></i></button>
          ${f.statut === 'partielle' ? `<button class="btn btn-sm btn-primary" onclick="openPayFacture('${f.id}')" title="Marquer payée"><i class="fas fa-check"></i></button>` : ''}
          <button class="btn btn-sm" style="background:var(--danger);color:#fff" onclick="deleteFacture('${f.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
    const tbody = document.getElementById('factures-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--danger);padding:24px"><i class="fas fa-exclamation-triangle"></i> Erreur : ${err.message}</td></tr>`;
  } finally {
    hideLoader();
  }
}

document.getElementById('btn-filter-fact').addEventListener('click', loadFactures);

document.getElementById('btn-new-facture').addEventListener('click', async () => {
  showLoader();
  try {
    const [reservations, clients] = await Promise.all([
      api('/reservations?statut=checked-in'),
      state.clients.length ? Promise.resolve(state.clients) : api('/clients'),
    ]);
    state.clients = clients;
    const sel = document.getElementById('new-facture-resa');
    if (!reservations.length) {
      sel.innerHTML = '<option value="">Aucune réservation en cours</option>';
    } else {
      const clientMap = Object.fromEntries(clients.map(c => [c.id, `${c.nom} ${c.prenom}`]));
      sel.innerHTML = reservations.map(r =>
        `<option value="${r.id}">${r.chambreId} – ${clientMap[r.clientId] || r.clientId} (${fmtDate(r.arrivee)} → ${fmtDate(r.depart)}, ${r.nuits} nuit${r.nuits > 1 ? 's' : ''})</option>`
      ).join('');
    }
    openModal('new-facture');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
});

document.getElementById('btn-save-new-facture').addEventListener('click', async () => {
  const reservationId = document.getElementById('new-facture-resa').value;
  const modePaiement  = document.getElementById('new-facture-mode').value;
  if (!reservationId) { toast('Sélectionnez une réservation', 'warning'); return; }
  showLoader();
  try {
    await api('/factures', { method: 'POST', body: JSON.stringify({ reservationId, modePaiement }) });
    toast('Facture générée avec succès', 'success');
    closeModal('new-facture');
    await loadFactures();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
});

window.openPayFacture = id => {
  const f = state.factures.find(x => x.id === id);
  if (!f) return;
  document.getElementById('pay-facture-id').value = id;
  document.getElementById('pay-facture-info').textContent = `Reste à payer : ${fmtCurrency(f.reste)} FCA pour ${f.clientNom}`;
  openModal('pay-facture');
};

document.getElementById('btn-confirm-pay-facture').addEventListener('click', async () => {
  const id   = document.getElementById('pay-facture-id').value;
  const mode = document.getElementById('pay-facture-mode').value;
  showLoader();
  try {
    await api(`/factures/${id}`, { method: 'PATCH', body: JSON.stringify({ modePaiement: mode }) });
    toast('Facture marquée comme payée', 'success');
    closeModal('pay-facture');
    await loadFactures();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
});

window.deleteFacture = async id => {
  if (!confirm('Supprimer cette facture définitivement ?')) return;
  showLoader();
  try {
    await api(`/factures/${id}`, { method: 'DELETE' });
    toast('Facture supprimée', 'success');
    await loadFactures();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoader();
  }
};

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

// ─── Sessions ─────────────────────────────────────────────────────────
async function loadSessions() {
  showLoader();
  const tbody = document.getElementById('sessions-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:24px"><i class="fas fa-spinner fa-spin"></i> Chargement…</td></tr>';
  try {
    const debut = document.getElementById('filter-sess-start').value;
    const fin   = document.getElementById('filter-sess-end').value;
    const user  = document.getElementById('filter-sess-user').value;
    const params = new URLSearchParams();
    if (debut) params.set('debut', debut);
    if (fin)   params.set('fin', fin);
    if (user)  params.set('username', user);
    const sessions = await api('/auth/sessions?' + params.toString());

    // Compteurs
    const logins  = sessions.filter(s => s.action === 'login').length;
    const logouts = sessions.filter(s => s.action === 'logout').length;
    const users   = new Set(sessions.map(s => s.username)).size;
    document.getElementById('sess-count-login').textContent  = logins;
    document.getElementById('sess-count-logout').textContent = logouts;
    document.getElementById('sess-count-users').textContent  = users;

    // Peupler le filtre utilisateurs (la première fois)
    const selUser = document.getElementById('filter-sess-user');
    if (selUser.options.length <= 1) {
      const usernames = [...new Set(sessions.map(s => s.username))].sort();
      usernames.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = u;
        selUser.appendChild(opt);
      });
      if (user) selUser.value = user;
    }

    const tbody = document.getElementById('sessions-tbody');
    if (!sessions.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:24px">Aucune session enregistrée</td></tr>';
      return;
    }

    const roleLabel = { directeur: 'Directeur', manager: 'Manager', receptionniste: 'Réceptionniste' };
    tbody.innerHTML = sessions.map(s => {
      const isLogin = s.action === 'login';
      const dt = new Date(s.timestamp);
      const dateStr = dt.toLocaleDateString('fr-FR');
      const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `
        <tr>
          <td><strong>${dateStr}</strong> <span style="color:var(--gray)">${timeStr}</span></td>
          <td><code>${s.username}</code></td>
          <td>${s.nom || '—'}</td>
          <td><span class="status-badge ${s.role === 'directeur' ? 'occupied' : s.role === 'manager' ? 'reserved' : 'available'}">${roleLabel[s.role] || s.role}</span></td>
          <td>
            <span style="display:inline-flex;align-items:center;gap:6px;font-weight:600;color:${isLogin ? 'var(--success)' : 'var(--danger)'}">
              <i class="fas fa-${isLogin ? 'sign-in-alt' : 'sign-out-alt'}"></i>
              ${isLogin ? 'Connexion' : 'Déconnexion'}
            </span>
          </td>
          <td><code style="font-size:.78rem;color:var(--gray)">${s.ip || '—'}</code></td>
        </tr>`;
    }).join('');
  } catch (err) {
    toast(err.message, 'error');
    document.getElementById('sessions-tbody').innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:24px"><i class="fas fa-exclamation-triangle"></i> Erreur : ${err.message}</td></tr>`;
  } finally {
    hideLoader();
  }
}

document.getElementById('btn-filter-sessions').addEventListener('click', loadSessions);

// ─── Notifications (cloche) ───────────────────────────────────────────
async function pollNotifBadge() {
  if (state.user?.role !== 'directeur') return;
  try {
    const notifications = await api('/notifications');
    const unread = notifications.filter(n => !n.lu).length;
    const badge = document.getElementById('notif-badge');
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (_) {}
}

async function loadNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div class="notif-loading"><i class="fas fa-spinner fa-spin"></i> Chargement…</div>';
  try {
    const notifications = await api('/notifications');

    // Réinitialiser badge et marquer tout comme lu
    document.getElementById('notif-badge').style.display = 'none';
    api('/notifications/read', { method: 'PATCH' }).catch(() => {});

    if (!notifications.length) {
      list.innerHTML = `
        <div class="notif-empty">
          <i class="fas fa-check-circle"></i>
          Aucune activité récente
        </div>`;
      return;
    }

    const fmtDt = s => {
      const d = new Date(s);
      return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    list.innerHTML = notifications.map(n => `
      <div class="notif-item${n.lu ? '' : ' unread'}">
        <div class="notif-icon ${n.type}">
          <i class="fas fa-${n.icon}"></i>
        </div>
        <div class="notif-body">
          <div class="notif-title">${n.titre}</div>
          <div class="notif-message" title="${n.message}">${n.message}</div>
          <div class="notif-time">${fmtDt(n.createdAt)}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<div class="notif-loading" style="color:var(--danger)"><i class="fas fa-exclamation-triangle"></i> ${err.message}</div>`;
  }
}

document.getElementById('notif-btn').addEventListener('click', e => {
  e.stopPropagation();
  const panel = document.getElementById('notif-panel');
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    loadNotifications();
  } else {
    panel.classList.add('hidden');
  }
});

document.getElementById('notif-close').addEventListener('click', () => {
  document.getElementById('notif-panel').classList.add('hidden');
});

document.addEventListener('click', e => {
  const wrapper = document.querySelector('.notif-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.add('hidden');
  }
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

let lastRapport = null;

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
    lastRapport = rapport;

    // ─ Carte Factures
    document.getElementById('rapp-occupation').textContent = rapport.nombre;
    document.getElementById('rapp-occupation-detail').innerHTML = `
      <div class="kpi-item"><span>Payées</span><strong style="color:var(--success)">${rapport.parStatut?.payee || 0}</strong></div>
      <div class="kpi-item"><span>Partielles</span><strong style="color:var(--danger)">${rapport.parStatut?.partielle || 0}</strong></div>
      <div class="kpi-item"><span>Panier moyen</span><strong>${fmtCurrency(rapport.moyenne)} FCA</strong></div>`;

    // ─ Carte Revenus
    document.getElementById('rapp-revenus').textContent = fmtCurrency(rapport.total);
    document.getElementById('rapp-revenus-detail').innerHTML = Object.entries(rapport.parMode || {}).map(([m, v]) =>
      `<div class="kpi-item"><span>${m}</span><strong>${fmtCurrency(v)} FCA</strong></div>`
    ).join('') || '<p style="color:var(--gray);font-size:.85rem">Aucune donnée</p>';

    // ─ Top clients
    const sorted = [...clients].sort((a, b) => (b.depense || 0) - (a.depense || 0)).slice(0, 5);
    document.getElementById('top-clients-list').innerHTML = sorted.map((c, i) => `
      <div class="kpi-item" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--light);font-size:.87rem">
        <span><strong>#${i+1}</strong> ${c.nom} ${c.prenom}</span>
        <strong>${fmtCurrency(c.depense || 0)} FCA</strong>
      </div>`).join('') || '<p style="color:var(--gray)">Aucun client</p>';

    // ─ Tableau détail
    const tbody = document.getElementById('rapport-factures-tbody');
    if (!rapport.factures?.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:24px">Aucune facture sur cette période</td></tr>';
    } else {
      tbody.innerHTML = rapport.factures.map(f => `
        <tr>
          <td><code style="font-size:.78rem">${f.id?.slice(-6)}</code></td>
          <td>${fmtDate(f.date)}</td>
          <td>${f.clientNom || f.clientId}</td>
          <td>${f.chambreId}</td>
          <td>${f.nuits}</td>
          <td><strong>${fmtCurrency(f.total)}</strong></td>
          <td>${f.modePaiement || '—'}</td>
          <td><span class="status-badge ${f.statut === 'payee' ? 'available' : 'reserved'}">${f.statut === 'payee' ? 'Payée' : 'Partielle'}</span></td>
        </tr>`).join('');
    }

  } catch (err) {
    toast(err.message, 'error');
    const tbody = document.getElementById('rapport-factures-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:24px"><i class="fas fa-exclamation-triangle"></i> Erreur : ${err.message}</td></tr>`;
  } finally {
    hideLoader();
  }
}

document.getElementById('btn-load-rapport').addEventListener('click', fetchRapports);

document.getElementById('btn-export-csv').addEventListener('click', () => {
  if (!lastRapport?.factures?.length) {
    toast('Générez d\'abord un rapport pour exporter', 'warning');
    return;
  }
  const debut = document.getElementById('rapp-start').value;
  const fin   = document.getElementById('rapp-end').value;
  const header = 'N° Facture,Date,Client,Chambre,Nuits,Sous-total,TVA,Total,Acompte,Reste,Mode paiement,Statut';
  const rows = lastRapport.factures.map(f =>
    [f.id, f.date, `"${f.clientNom || ''}"`, f.chambreId, f.nuits, f.sousTotal, f.tva, f.total, f.acompte, f.reste, f.modePaiement, f.statut].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `rapport_ohinene_${debut}_${fin}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export CSV téléchargé', 'success');
});

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
  document.getElementById('sidebar-user-name').textContent = state.user?.nom || '—';
  document.getElementById('sidebar-user-role').textContent = state.user?.role || '';
  document.getElementById('header-date').textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Navigation : afficher uniquement les onglets autorisés selon le rôle
  const allowedPages = PAGE_ACCESS[state.user?.role] || ['dashboard'];
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.style.display = allowedPages.includes(el.dataset.page) ? 'flex' : 'none';
  });

  // Cloche notifications : directeur uniquement
  const notifWrapper = document.querySelector('.notif-wrapper');
  if (notifWrapper) notifWrapper.style.display = state.user?.role === 'directeur' ? '' : 'none';

  // Polling badge toutes les 60 secondes pour le directeur
  if (state.user?.role === 'directeur') {
    pollNotifBadge();
    if (!notifPollInterval) {
      notifPollInterval = setInterval(pollNotifBadge, 60000);
    }
  }

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
