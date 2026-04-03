/* ══════════════════════════════════════════════════════════════════════════
   US Créteil Futsal — main.js (site public)
══════════════════════════════════════════════════════════════════════════ */

const API = '';

// ─── Helpers ───────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const categoryBadge = (cat) => {
  const map = { 'Senior':'badge-senior','U21':'badge-u21','U17':'badge-u17','U15':'badge-u15' };
  const cls = map[cat] || 'badge-senior';
  return `<span class="badge ${cls}">${cat || 'Senior'}</span>`;
};

const isUpcoming = (dateStr) => {
  const matchDate = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  return matchDate >= today;
};

// ─── Navbar ────────────────────────────────────────────────────────────────
function toggleMenu() {
  $('#mobileMenu').classList.toggle('open');
}

// Active nav on scroll
const sections = ['matchs','equipe','galerie','sponsors'];
const navLinks = $$('.nav-link');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY + 120;
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (scrollY >= el.offsetTop && scrollY < el.offsetTop + el.offsetHeight) {
      navLinks.forEach(l => l.classList.remove('active'));
      navLinks.forEach(l => { if (l.getAttribute('href') === `#${id}`) l.classList.add('active'); });
    }
  });
});

// ─── Fetch data ────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.error('Fetch error:', url, e);
    return [];
  }
}

// ─── MATCHES ───────────────────────────────────────────────────────────────
let allMatches = [];
let activeMatchCat = 'Tous';

function renderMatches(matches, filter = 'Tous') {
  const grid = $('#matchesGrid');
  let filtered = matches.filter(m => isUpcoming(m.date));
  if (filter !== 'Tous') filtered = filtered.filter(m => m.category === filter);
  filtered.sort((a,b) => new Date(a.date) - new Date(b.date));

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-calendar-xmark"></i><p>Aucun match à venir pour le moment</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="match-card">
      <div class="match-poster">
        ${m.poster
          ? `<img src="${m.poster}" alt="Affiche ${m.teamHome} vs ${m.teamAway}" loading="lazy">`
          : `<div class="match-poster-placeholder"><i class="fas fa-futbol"></i><span>Affiche bientôt disponible</span></div>`
        }
        <div class="match-category-badge">${categoryBadge(m.category)}</div>
      </div>
      <div class="match-info">
        <div class="match-teams">
          <div class="match-team"><div class="name">${m.teamHome}</div><div class="type">Domicile</div></div>
          <div class="match-vs">VS</div>
          <div class="match-team"><div class="name">${m.teamAway}</div><div class="type">Visiteur</div></div>
        </div>
        <div class="match-meta">
          <div class="match-meta-row"><i class="fas fa-calendar"></i> ${formatDate(m.date)}</div>
          <div class="match-meta-row"><i class="fas fa-clock"></i> ${m.time || '20:00'}</div>
          ${m.location ? `<div class="match-meta-row"><i class="fas fa-location-dot"></i> ${m.location}</div>` : ''}
          ${m.description ? `<div class="match-meta-row" style="color:var(--gray-400)"><i class="fas fa-circle-info"></i> ${m.description}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function setupMatchFilters(matches) {
  const categories = [...new Set(matches.map(m => m.category).filter(Boolean))];
  const container = $('#matchFilters');
  container.innerHTML = `<button class="filter-tab active" data-cat="Tous">Tous</button>` +
    categories.map(c => `<button class="filter-tab" data-cat="${c}">${c}</button>`).join('');

  $$('.filter-tab', container).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-tab', container).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMatchCat = btn.dataset.cat;
      renderMatches(allMatches, activeMatchCat);
    });
  });
}

// ─── PLAYERS ───────────────────────────────────────────────────────────────
let allPlayers = [];
let activePlayerCat = 'Tous';

function renderPlayers(players, filter = 'Tous') {
  const grid = $('#playersGrid');
  let filtered = filter === 'Tous' ? players : players.filter(p => p.category === filter);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users-slash"></i><p>Aucun joueur enregistré pour le moment</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="player-card">
      <div class="player-photo">
        ${p.photo
          ? `<img src="${p.photo}" alt="${p.name}" loading="lazy">`
          : `<i class="fas fa-user player-photo-placeholder"></i>`
        }
      </div>
      <div class="player-info">
        ${p.number ? `<div class="player-number">${p.number}</div>` : ''}
        <div class="player-name">${p.name}</div>
        ${p.position ? `<div class="player-position">${p.position}</div>` : ''}
        ${categoryBadge(p.category)}
      </div>
    </div>
  `).join('');
}

function setupPlayerFilters(players) {
  const categories = [...new Set(players.map(p => p.category).filter(Boolean))];
  const container = $('#playerFilters');
  container.innerHTML = `<button class="filter-tab active" data-cat="Tous">Tous</button>` +
    categories.map(c => `<button class="filter-tab" data-cat="${c}">${c}</button>`).join('');

  $$('.filter-tab', container).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-tab', container).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePlayerCat = btn.dataset.cat;
      renderPlayers(allPlayers, activePlayerCat);
    });
  });
}

// ─── GALLERY ───────────────────────────────────────────────────────────────
function renderGallery(photos) {
  const grid = $('#galleryGrid');
  if (!photos.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-images"></i><p>La galerie sera bientôt disponible</p></div>`;
    return;
  }
  grid.innerHTML = photos.map(p => `
    <div class="gallery-item" onclick="openLightbox('${p.filename}', '${(p.caption || '').replace(/'/g,"\\'")}')">
      <img src="${p.filename}" alt="${p.caption || 'Photo du club'}" loading="lazy">
      <div class="gallery-overlay">${p.caption ? `<div class="gallery-caption">${p.caption}</div>` : ''}</div>
    </div>
  `).join('');
}

// ─── SPONSORS ──────────────────────────────────────────────────────────────
function renderSponsors(sponsors) {
  const grid = $('#sponsorsGrid');
  if (!sponsors.length) {
    grid.innerHTML = `<div class="empty-state" style="color:rgba(255,255,255,.3);grid-column:1/-1"><i class="fas fa-handshake-slash"></i><p>Aucun sponsor pour le moment</p></div>`;
    return;
  }
  grid.innerHTML = sponsors.map(s => `
    <${s.website ? `a href="${s.website}" target="_blank" rel="noopener"` : 'div'} class="sponsor-card">
      ${s.logo
        ? `<img src="${s.logo}" alt="${s.name}">`
        : `<div class="sponsor-name">${s.name}</div>`
      }
    </${s.website ? 'a' : 'div'}>
  `).join('');
}

// ─── LIGHTBOX ──────────────────────────────────────────────────────────────
function openLightbox(src, caption) {
  const lb = $('#lightbox');
  $('#lightboxImg').src = src;
  $('#lightboxCaption').textContent = caption || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(e) {
  if (e && e.target !== e.currentTarget && !e.target.closest('.lightbox-close')) return;
  $('#lightbox').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ─── STATS ─────────────────────────────────────────────────────────────────
function animateCounter(el, target) {
  let current = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

// ─── INIT ──────────────────────────────────────────────────────────────────
async function init() {
  const [matches, players, gallery, sponsors] = await Promise.all([
    fetchJSON('/api/matches'),
    fetchJSON('/api/players'),
    fetchJSON('/api/gallery'),
    fetchJSON('/api/sponsors')
  ]);

  allMatches = matches;
  allPlayers = players;

  // Render everything
  setupMatchFilters(matches);
  renderMatches(matches, 'Tous');
  setupPlayerFilters(players);
  renderPlayers(players, 'Tous');
  renderGallery(gallery);
  renderSponsors(sponsors);

  // Animate stats
  const upcomingCount = matches.filter(m => isUpcoming(m.date)).length;
  animateCounter($('#statMatchs'), upcomingCount);
  animateCounter($('#statJoueurs'), players.length);
  animateCounter($('#statSponsors'), sponsors.length);
}

init();
