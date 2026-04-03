/* ══════════════════════════════════════════════════════════════════════════
   US Créteil Futsal — admin.js
══════════════════════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser = null;
let token = localStorage.getItem('uscf_token') || '';
let allData = { matches: [], players: [], gallery: [], sponsors: [], admins: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const setLoading = (btnId, loading) => {
  const btn = $(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> Chargement...'
    : btn._origHTML || btn.innerHTML;
  if (!loading && !btn._origSet) { btn._origHTML = btn.innerHTML; btn._origSet = true; }
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
};
const formatDatetime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
};
const isUpcoming = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(); t.setHours(0,0,0,0);
  return d >= t;
};

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'success') {
  const el = $('toast');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(method, url, body = null, isFormData = false) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}` }
  };
  if (body) {
    if (isFormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function init() {
  if (token) {
    try {
      currentUser = await api('GET', '/api/auth/me');
      showApp();
      return;
    } catch { token = ''; localStorage.removeItem('uscf_token'); }
  }
  showLogin();
}

function showLogin() {
  $('loginScreen').classList.add('active');
  $('adminApp').classList.remove('active');
}

function showApp() {
  $('loginScreen').classList.remove('active');
  $('adminApp').classList.add('active');
  $('sidebarName').textContent = currentUser.displayName || currentUser.username;
  $('sidebarAvatar').textContent = (currentUser.displayName || currentUser.username)[0].toUpperCase();
  $('sidebarRole').textContent = currentUser.role === 'super' ? 'Super Admin' : 'Administrateur';
  if (currentUser.role !== 'super') $('adminsNavItem').style.display = 'none';
  loadAll();
}

function logout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('uscf_token');
  showLogin();
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('loginError');
  err.classList.remove('show');
  const btn = $('loginBtn');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Connexion...';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('loginUsername').value, password: $('loginPassword').value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('uscf_token', token);
    showApp();
  } catch (err_) {
    err.textContent = err_.message;
    err.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
});

// ─── Navigation ───────────────────────────────────────────────────────────────
const sectionTitles = {
  dashboard: 'Dashboard',
  matches: 'Gestion des matchs',
  players: 'Gestion des joueurs',
  gallery: 'Galerie photos',
  sponsors: 'Sponsors & partenaires',
  admins: 'Comptes administrateurs'
};

function showSection(name) {
  document.querySelectorAll('.section-page').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const sec = $(`section-${name}`);
  if (sec) sec.classList.add('active');
  document.querySelectorAll(`[data-section="${name}"]`).forEach(i => i.classList.add('active'));
  $('topbarTitle').textContent = sectionTitles[name] || name;
  if (window.innerWidth < 768) $('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', () => showSection(item.dataset.section));
});

function toggleSidebar() {
  $('sidebar').classList.toggle('open');
}

// ─── Load all data ────────────────────────────────────────────────────────────
async function loadAll() {
  try {
    const [matches, players, gallery, sponsors, admins] = await Promise.all([
      api('GET', '/api/matches'),
      api('GET', '/api/players'),
      api('GET', '/api/gallery'),
      api('GET', '/api/sponsors'),
      currentUser.role === 'super' ? api('GET', '/api/admins') : Promise.resolve([])
    ]);
    allData = { matches, players, gallery, sponsors, admins };
    updateBadges();
    renderDashboard();
    renderMatchesTable();
    renderPlayersGrid();
    renderGalleryGrid();
    renderSponsorsTable();
    if (currentUser.role === 'super') renderAdminsTable();
  } catch (e) {
    toast('Erreur lors du chargement des données', 'error');
  }
}

function updateBadges() {
  $('badgeMatchs').textContent  = allData.matches.filter(m => isUpcoming(m.date)).length;
  $('badgeJoueurs').textContent = allData.players.length;
  $('badgeGallery').textContent = allData.gallery.length;
  $('badgeSponsors').textContent= allData.sponsors.length;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  $('dashMatchs').textContent  = allData.matches.filter(m => isUpcoming(m.date)).length;
  $('dashJoueurs').textContent = allData.players.length;
  $('dashGallery').textContent = allData.gallery.length;
  $('dashSponsors').textContent= allData.sponsors.length;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function openModal(id) {
  $(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  $(id).classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.open').forEach(m => closeModal(m.id));
  }
});

// ─── Image preview ────────────────────────────────────────────────────────────
function previewImage(input, previewId, zoneId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = $(previewId);
    prev.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
  };
  reader.readAsDataURL(file);
}

// ─── MATCHES ──────────────────────────────────────────────────────────────────
function renderMatchesTable() {
  const tbody = $('matchesTbody');
  const matches = [...allData.matches].sort((a,b) => new Date(a.date) - new Date(b.date));
  if (!matches.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-table"><i class="fas fa-futbol"></i><p>Aucun match enregistré</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = matches.map(m => {
    const upcoming = isUpcoming(m.date);
    return `<tr>
      <td>${m.poster
        ? `<img src="${m.poster}" class="td-thumb" alt="">`
        : `<div class="td-thumb-placeholder"><i class="fas fa-futbol"></i></div>`}</td>
      <td><div class="td-name">${m.teamHome} <span style="color:var(--blue-mid)">vs</span> ${m.teamAway}</div></td>
      <td>${formatDate(m.date)} ${m.time ? `<span style="color:var(--gray-400);font-size:12px">à ${m.time}</span>` : ''}</td>
      <td>${m.location || '—'}</td>
      <td><span class="badge badge-blue">${m.category || 'Senior'}</span></td>
      <td><span class="badge ${upcoming ? 'badge-green' : 'badge-gray'}">${upcoming ? 'À venir' : 'Terminé'}</span></td>
      <td><div class="td-actions">
        <button class="btn btn-outline btn-sm btn-icon" onclick="editMatch('${m.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteItem('match','${m.id}','${m.teamHome} vs ${m.teamAway}')" title="Supprimer"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

function openMatchModal(mode = 'create') {
  $('matchModalTitle').textContent = mode === 'create' ? 'Nouveau match' : 'Modifier le match';
  $('matchStatusGroup').style.display = mode === 'edit' ? 'block' : 'none';
  if (mode === 'create') {
    $('matchId').value = '';
    $('matchForm').reset();
    $('matchPosterPreview').innerHTML = '';
    $('currentPosterPreview').style.display = 'none';
    const today = new Date().toISOString().split('T')[0];
    $('matchDate').value = today;
    $('matchTime').value = '20:00';
  }
}

function editMatch(id) {
  const m = allData.matches.find(x => x.id === id);
  if (!m) return;
  openMatchModal('edit');
  $('matchId').value = m.id;
  $('matchTeamHome').value = m.teamHome;
  $('matchTeamAway').value = m.teamAway;
  $('matchDate').value = m.date;
  $('matchTime').value = m.time || '20:00';
  $('matchLocation').value = m.location || '';
  $('matchCategory').value = m.category || 'Senior';
  $('matchDescription').value = m.description || '';
  $('matchStatus').value = m.status || 'upcoming';
  $('matchPosterPreview').innerHTML = '';
  $('matchPosterInput').value = '';
  if (m.poster) {
    $('currentPosterPreview').style.display = 'block';
    $('currentPosterImg').src = m.poster;
  } else {
    $('currentPosterPreview').style.display = 'none';
  }
  openModal('matchModal');
}

// Override openModal for match to reset form
document.querySelector('[onclick="openModal(\'matchModal\')"]')?.addEventListener('click', () => openMatchModal('create'));

async function saveMatch() {
  const id = $('matchId').value;
  const fd = new FormData();
  fd.append('teamHome', $('matchTeamHome').value.trim());
  fd.append('teamAway', $('matchTeamAway').value.trim());
  fd.append('date', $('matchDate').value);
  fd.append('time', $('matchTime').value);
  fd.append('location', $('matchLocation').value.trim());
  fd.append('category', $('matchCategory').value);
  fd.append('description', $('matchDescription').value.trim());
  if (id) fd.append('status', $('matchStatus').value);
  const file = $('matchPosterInput').files[0];
  if (file) fd.append('poster', file);

  if (!fd.get('teamHome') || !fd.get('teamAway') || !fd.get('date')) {
    toast('Champs obligatoires manquants', 'error'); return;
  }

  const btn = $('saveMatchBtn');
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const endpoint = id ? `/api/matches/${id}` : '/api/matches';
    const method = id ? 'PUT' : 'POST';
    const saved = await api(method, endpoint, fd, true);
    if (id) {
      const idx = allData.matches.findIndex(m => m.id === id);
      if (idx !== -1) allData.matches[idx] = saved;
    } else {
      allData.matches.push(saved);
    }
    closeModal('matchModal');
    renderMatchesTable();
    renderDashboard();
    updateBadges();
    toast(id ? 'Match modifié ✓' : 'Match créé ✓');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = origHTML;
  }
}

// ─── PLAYERS ──────────────────────────────────────────────────────────────────
function renderPlayersGrid() {
  const grid = $('playersAdminGrid');
  if (!allData.players.length) {
    grid.innerHTML = `<div class="empty-table" style="grid-column:1/-1"><i class="fas fa-users"></i><p>Aucun joueur</p></div>`;
    return;
  }
  const sorted = [...allData.players].sort((a,b) => parseInt(a.number||99) - parseInt(b.number||99));
  grid.innerHTML = sorted.map(p => `
    <div class="player-admin-card">
      <div class="player-admin-photo">
        ${p.photo
          ? `<img src="${p.photo}" alt="${p.name}">`
          : `<i class="fas fa-user" style="font-size:40px;color:var(--gray-200)"></i>`}
      </div>
      <div class="player-admin-info">
        ${p.number ? `<div class="player-admin-num">#${p.number}</div>` : ''}
        <div class="player-admin-name">${p.name}</div>
        ${p.position ? `<div style="font-size:11px;color:var(--gray-400)">${p.position}</div>` : ''}
        <span class="badge badge-blue" style="margin-top:4px;font-size:10px">${p.category||'Senior'}</span>
      </div>
      <div class="player-admin-actions">
        <button class="btn btn-outline btn-sm" onclick="editPlayer('${p.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('player','${p.id}','${p.name}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function openPlayerModal(mode = 'create') {
  $('playerModalTitle').textContent = mode === 'create' ? 'Nouveau joueur' : 'Modifier le joueur';
  if (mode === 'create') {
    $('playerId').value = '';
    $('playerForm').reset();
    $('playerPhotoPreview').innerHTML = '';
    $('currentPlayerPhotoPreview').style.display = 'none';
  }
}

function editPlayer(id) {
  const p = allData.players.find(x => x.id === id);
  if (!p) return;
  openPlayerModal('edit');
  $('playerId').value = p.id;
  $('playerName').value = p.name;
  $('playerNumber').value = p.number || '';
  $('playerPosition').value = p.position || '';
  $('playerCategory').value = p.category || 'Senior';
  $('playerBio').value = p.bio || '';
  $('playerPhotoPreview').innerHTML = '';
  $('playerPhotoInput').value = '';
  if (p.photo) {
    $('currentPlayerPhotoPreview').style.display = 'block';
    $('currentPlayerPhotoImg').src = p.photo;
  } else {
    $('currentPlayerPhotoPreview').style.display = 'none';
  }
  openModal('playerModal');
}

async function savePlayer() {
  const id = $('playerId').value;
  const fd = new FormData();
  fd.append('name', $('playerName').value.trim());
  fd.append('number', $('playerNumber').value.trim());
  fd.append('position', $('playerPosition').value);
  fd.append('category', $('playerCategory').value);
  fd.append('bio', $('playerBio').value.trim());
  const file = $('playerPhotoInput').files[0];
  if (file) fd.append('photo', file);
  if (!fd.get('name')) { toast('Le nom est requis', 'error'); return; }

  const btn = $('savePlayerBtn');
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const endpoint = id ? `/api/players/${id}` : '/api/players';
    const method = id ? 'PUT' : 'POST';
    const saved = await api(method, endpoint, fd, true);
    if (id) {
      const idx = allData.players.findIndex(p => p.id === id);
      if (idx !== -1) allData.players[idx] = saved;
    } else {
      allData.players.push(saved);
    }
    closeModal('playerModal');
    renderPlayersGrid();
    renderDashboard();
    updateBadges();
    toast(id ? 'Joueur modifié ✓' : 'Joueur ajouté ✓');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = origHTML;
  }
}

// ─── GALLERY ──────────────────────────────────────────────────────────────────
function renderGalleryGrid() {
  const grid = $('galleryAdminGrid');
  if (!allData.gallery.length) {
    grid.innerHTML = `<div class="empty-table" style="grid-column:1/-1"><i class="fas fa-images"></i><p>Aucune photo</p></div>`;
    return;
  }
  grid.innerHTML = allData.gallery.map(p => `
    <div class="gallery-admin-item">
      <img src="${p.filename}" alt="${p.caption||''}" loading="lazy">
      <div class="item-overlay">
        <button class="btn btn-danger btn-sm" onclick="deleteItem('gallery','${p.id}','cette photo')">
          <i class="fas fa-trash"></i> Supprimer
        </button>
      </div>
      ${p.caption ? `<div class="caption-bar">${p.caption}</div>` : ''}
    </div>
  `).join('');
}

async function handleGalleryUpload(input) {
  const files = [...input.files];
  if (!files.length) return;
  let success = 0;
  for (const file of files) {
    const caption = prompt(`Légende pour "${file.name}" (optionnel)`, '') || '';
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('caption', caption);
    try {
      const saved = await api('POST', '/api/gallery', fd, true);
      allData.gallery.unshift(saved);
      success++;
    } catch (e) {
      toast(`Erreur : ${file.name}`, 'error');
    }
  }
  input.value = '';
  if (success > 0) {
    renderGalleryGrid();
    renderDashboard();
    updateBadges();
    toast(`${success} photo(s) uploadée(s) ✓`);
  }
}

// ─── SPONSORS ─────────────────────────────────────────────────────────────────
function renderSponsorsTable() {
  const tbody = $('sponsorsTbody');
  if (!allData.sponsors.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-table"><i class="fas fa-handshake"></i><p>Aucun sponsor</p></div></td></tr>`;
    return;
  }
  const sorted = [...allData.sponsors].sort((a,b) => (a.order||99)-(b.order||99));
  tbody.innerHTML = sorted.map(s => `<tr>
    <td>${s.logo
      ? `<img src="${s.logo}" class="td-thumb" alt="${s.name}" style="object-fit:contain;background:var(--gray-100)">`
      : `<div class="td-thumb-placeholder"><i class="fas fa-building"></i></div>`}</td>
    <td><div class="td-name">${s.name}</div></td>
    <td>${s.website ? `<a href="${s.website}" target="_blank" style="color:var(--blue-mid)">${s.website}</a>` : '—'}</td>
    <td>${s.order || '—'}</td>
    <td><div class="td-actions">
      <button class="btn btn-outline btn-sm btn-icon" onclick="editSponsor('${s.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteItem('sponsor','${s.id}','${s.name}')" title="Supprimer"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

function editSponsor(id) {
  const s = allData.sponsors.find(x => x.id === id);
  if (!s) return;
  $('sponsorModalTitle').textContent = 'Modifier le sponsor';
  $('sponsorId').value = s.id;
  $('sponsorName').value = s.name;
  $('sponsorWebsite').value = s.website || '';
  $('sponsorOrder').value = s.order || '';
  $('sponsorLogoPreview').innerHTML = '';
  $('sponsorLogoInput').value = '';
  if (s.logo) {
    $('currentSponsorLogoPreview').style.display = 'block';
    $('currentSponsorLogoImg').src = s.logo;
  } else {
    $('currentSponsorLogoPreview').style.display = 'none';
  }
  openModal('sponsorModal');
}

async function saveSponsor() {
  const id = $('sponsorId').value;
  const fd = new FormData();
  fd.append('name', $('sponsorName').value.trim());
  fd.append('website', $('sponsorWebsite').value.trim());
  fd.append('order', $('sponsorOrder').value || '');
  const file = $('sponsorLogoInput').files[0];
  if (file) fd.append('logo', file);
  if (!fd.get('name')) { toast('Le nom est requis', 'error'); return; }

  const btn = $('saveSponsorBtn');
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const endpoint = id ? `/api/sponsors/${id}` : '/api/sponsors';
    const method = id ? 'PUT' : 'POST';
    const saved = await api(method, endpoint, fd, true);
    if (id) {
      const idx = allData.sponsors.findIndex(s => s.id === id);
      if (idx !== -1) allData.sponsors[idx] = saved;
    } else {
      allData.sponsors.push(saved);
    }
    closeModal('sponsorModal');
    renderSponsorsTable();
    renderDashboard();
    updateBadges();
    toast(id ? 'Sponsor modifié ✓' : 'Sponsor ajouté ✓');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = origHTML;
  }
}

// ─── ADMINS ───────────────────────────────────────────────────────────────────
function renderAdminsTable() {
  const tbody = $('adminsTbody');
  if (!allData.admins.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-table"><i class="fas fa-users"></i><p>Aucun admin</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = allData.admins.map(a => {
    const isMe = a.id === currentUser.id;
    return `<tr>
      <td><div class="td-name">${a.displayName || a.username}${isMe ? ' <span style="color:var(--gold);font-size:11px">(vous)</span>' : ''}</div></td>
      <td><code style="background:var(--gray-100);padding:2px 8px;border-radius:4px;font-size:13px">${a.username}</code></td>
      <td><span class="badge ${a.role === 'super' ? 'badge-super' : 'badge-admin'}">${a.role === 'super' ? '⭐ Super Admin' : 'Admin'}</span></td>
      <td>${formatDatetime(a.createdAt)}</td>
      <td><div class="td-actions">
        <button class="btn btn-outline btn-sm btn-icon" onclick="editAdminModal('${a.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
        ${!isMe ? `<button class="btn btn-danger btn-sm btn-icon" onclick="deleteItem('admin','${a.id}','${a.displayName||a.username}')" title="Supprimer"><i class="fas fa-trash"></i></button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

function openNewAdminModal() {
  $('adminModalTitle').textContent = 'Nouvel administrateur';
  $('adminEditId').value = '';
  $('adminForm').reset();
  $('adminUsername').disabled = false;
  $('pwdRequired').textContent = '*';
  $('pwdHint').textContent = '';
  $('adminPassword').required = true;
  openModal('adminModal');
}

function editAdminModal(id) {
  const a = allData.admins.find(x => x.id === id);
  if (!a) return;
  $('adminModalTitle').textContent = 'Modifier l\'admin';
  $('adminEditId').value = a.id;
  $('adminDisplayName').value = a.displayName || '';
  $('adminUsername').value = a.username;
  $('adminUsername').disabled = true;
  $('adminPassword').value = '';
  $('adminPassword').required = false;
  $('adminRole').value = a.role;
  $('pwdRequired').textContent = '';
  $('pwdHint').textContent = 'Laisser vide pour ne pas changer';
  openModal('adminModal');
}

async function saveAdmin() {
  const id = $('adminEditId').value;
  const username = $('adminUsername').value.trim();
  const password = $('adminPassword').value;
  const displayName = $('adminDisplayName').value.trim();
  const role = $('adminRole').value;

  if (!username) { toast('Identifiant requis', 'error'); return; }
  if (!id && !password) { toast('Mot de passe requis', 'error'); return; }
  if (password && password.length < 6) { toast('Mot de passe trop court (min 6 caractères)', 'error'); return; }

  const btn = $('saveAdminBtn');
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const body = { username, displayName, role };
    if (password) body.password = password;
    let saved;
    if (id) {
      saved = await api('PUT', `/api/admins/${id}`, body);
      const idx = allData.admins.findIndex(a => a.id === id);
      if (idx !== -1) allData.admins[idx] = saved;
    } else {
      saved = await api('POST', '/api/admins', body);
      allData.admins.push(saved);
    }
    closeModal('adminModal');
    renderAdminsTable();
    toast(id ? 'Admin modifié ✓' : 'Admin créé ✓');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = origHTML;
  }
}

// ─── Delete (generic) ─────────────────────────────────────────────────────────
function deleteItem(type, id, name) {
  $('confirmTitle').textContent = `Supprimer "${name}" ?`;
  $('confirmMessage').textContent = 'Cette action est irréversible. L\'élément sera définitivement supprimé.';
  openModal('confirmModal');
  $('confirmBtn').onclick = () => confirmDelete(type, id);
}

async function confirmDelete(type, id) {
  const endpoints = { match:'matches', player:'players', gallery:'gallery', sponsor:'sponsors', admin:'admins' };
  const endpoint = `/api/${endpoints[type]}/${id}`;
  try {
    await api('DELETE', endpoint);
    if (type === 'match')   { allData.matches   = allData.matches.filter(x => x.id !== id); renderMatchesTable(); }
    if (type === 'player')  { allData.players   = allData.players.filter(x => x.id !== id); renderPlayersGrid(); }
    if (type === 'gallery') { allData.gallery   = allData.gallery.filter(x => x.id !== id); renderGalleryGrid(); }
    if (type === 'sponsor') { allData.sponsors  = allData.sponsors.filter(x => x.id !== id); renderSponsorsTable(); }
    if (type === 'admin')   { allData.admins    = allData.admins.filter(x => x.id !== id); renderAdminsTable(); }
    renderDashboard();
    updateBadges();
    closeModal('confirmModal');
    toast('Supprimé avec succès ✓');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── Button wire-ups (modal open) ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Match modal "new" button
  document.querySelectorAll('[onclick*="matchModal"]').forEach(btn => {
    if (btn.getAttribute('onclick').includes('openModal')) {
      btn.addEventListener('click', () => openMatchModal('create'), { once: false });
    }
  });
  // Admin new button
  const adminNewBtn = document.querySelector('[onclick="openModal(\'adminModal\')"]');
  if (adminNewBtn) {
    adminNewBtn.removeAttribute('onclick');
    adminNewBtn.addEventListener('click', openNewAdminModal);
  }
  // Sponsor modal reset on new
  const sponsorNewBtn = document.querySelector('[onclick="openModal(\'sponsorModal\')"]');
  if (sponsorNewBtn) {
    sponsorNewBtn.addEventListener('click', () => {
      $('sponsorModalTitle').textContent = 'Nouveau sponsor';
      $('sponsorId').value = '';
      $('sponsorForm').reset();
      $('sponsorLogoPreview').innerHTML = '';
      $('currentSponsorLogoPreview').style.display = 'none';
    });
  }
  // Player modal reset on new
  const playerNewBtn = document.querySelector('[onclick="openModal(\'playerModal\')"]');
  if (playerNewBtn) {
    playerNewBtn.addEventListener('click', () => openPlayerModal('create'));
  }
});

// ─── Dashboard quick action match button ──────────────────────────────────────
document.querySelectorAll('[onclick*="matchModal"]').forEach(btn => {
  if (btn.getAttribute('onclick')?.includes('openModal')) {
    const orig = btn.getAttribute('onclick');
    btn.setAttribute('onclick', '');
    btn.addEventListener('click', () => { openMatchModal('create'); openModal('matchModal'); });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
init();
