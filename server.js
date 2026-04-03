const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'uscreteil-futsal-secret-key-2024';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Upload directories ───────────────────────────────────────────────────────
['matches', 'gallery', 'sponsors', 'players'].forEach(dir => {
  fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
});
fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Data helpers ─────────────────────────────────────────────────────────────
const getData = () => {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { admins: [], matches: [], gallery: [], sponsors: [], players: [] }; }
};
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ─── Multer config ────────────────────────────────────────────────────────────
const createStorage = (folder) => multer.diskStorage({
  destination: path.join(UPLOADS_DIR, folder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});
const imgFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
};

const uploadMatch   = multer({ storage: createStorage('matches'),  fileFilter: imgFilter, limits: { fileSize: 15 * 1024 * 1024 } });
const uploadGallery = multer({ storage: createStorage('gallery'),  fileFilter: imgFilter, limits: { fileSize: 15 * 1024 * 1024 } });
const uploadSponsor = multer({ storage: createStorage('sponsors'), fileFilter: imgFilter, limits: { fileSize: 5  * 1024 * 1024 } });
const uploadPlayer  = multer({ storage: createStorage('players'),  fileFilter: imgFilter, limits: { fileSize: 5  * 1024 * 1024 } });

// ─── Auth middleware ──────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

const superOnly = (req, res, next) => {
  if (req.user.role !== 'super') return res.status(403).json({ error: 'Droits super-admin requis' });
  next();
};

const deleteFile = (filePath) => {
  if (!filePath) return;
  const fullPath = path.join(__dirname, 'public', filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
};

// ─── Init data ────────────────────────────────────────────────────────────────
const initData = async () => {
  if (!fs.existsSync(DATA_FILE)) {
    const hashedPassword = await bcrypt.hash('Admin2024', 10);
    saveData({
      admins: [{
        id: uuidv4(),
        username: 'admin',
        password: hashedPassword,
        role: 'super',
        displayName: 'Super Admin',
        createdAt: new Date().toISOString()
      }],
      matches: [],
      gallery: [],
      sponsors: [],
      players: []
    });
    console.log('✅ Données initialisées.');
    console.log('👤 Compte admin par défaut: admin / Admin2024');
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  const data = getData();
  const admin = data.admins.find(a => a.username === username);
  if (!admin || !await bcrypt.compare(password, admin.password)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  const payload = { id: admin.id, username: admin.username, role: admin.role, displayName: admin.displayName };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: payload });
});

app.get('/api/auth/me', authenticate, (req, res) => res.json(req.user));

// ══════════════════════════════════════════════════════════════════════════════
//  COMPTES ADMINS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/admins', authenticate, (req, res) => {
  const data = getData();
  res.json(data.admins.map(({ password, ...a }) => a));
});

app.post('/api/admins', authenticate, superOnly, async (req, res) => {
  const { username, password, displayName, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Nom et mot de passe requis' });
  const data = getData();
  if (data.admins.find(a => a.username === username)) {
    return res.status(409).json({ error: "Nom d'utilisateur déjà pris" });
  }
  const newAdmin = {
    id: uuidv4(),
    username: username.trim(),
    password: await bcrypt.hash(password, 10),
    role: role === 'super' ? 'super' : 'admin',
    displayName: (displayName || username).trim(),
    createdAt: new Date().toISOString()
  };
  data.admins.push(newAdmin);
  saveData(data);
  const { password: _, ...adminData } = newAdmin;
  res.status(201).json(adminData);
});

app.put('/api/admins/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'super' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const data = getData();
  const index = data.admins.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Admin non trouvé' });
  const admin = data.admins[index];
  const { displayName, password, role } = req.body;
  if (displayName) admin.displayName = displayName.trim();
  if (password) admin.password = await bcrypt.hash(password, 10);
  if (role && req.user.role === 'super') admin.role = role === 'super' ? 'super' : 'admin';
  saveData(data);
  const { password: _, ...adminData } = admin;
  res.json(adminData);
});

app.delete('/api/admins/:id', authenticate, superOnly, (req, res) => {
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'Impossible de se supprimer soi-même' });
  const data = getData();
  const index = data.admins.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Admin non trouvé' });
  data.admins.splice(index, 1);
  saveData(data);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
//  MATCHS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/matches', (req, res) => {
  const data = getData();
  const sorted = data.matches.sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
  res.json(sorted);
});

app.post('/api/matches', authenticate, uploadMatch.single('poster'), (req, res) => {
  const { teamHome, teamAway, date, time, location, category, description } = req.body;
  if (!teamHome || !teamAway || !date) return res.status(400).json({ error: 'Équipes et date requis' });
  const data = getData();
  const newMatch = {
    id: uuidv4(),
    teamHome: teamHome.trim(),
    teamAway: teamAway.trim(),
    date, time: time || '20:00',
    location: (location || '').trim(),
    category: category || 'Senior',
    description: (description || '').trim(),
    poster: req.file ? `/uploads/matches/${req.file.filename}` : null,
    status: 'upcoming',
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };
  data.matches.push(newMatch);
  saveData(data);
  res.status(201).json(newMatch);
});

app.put('/api/matches/:id', authenticate, uploadMatch.single('poster'), (req, res) => {
  const data = getData();
  const index = data.matches.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Match non trouvé' });
  const match = data.matches[index];
  if (req.file) {
    deleteFile(match.poster);
    match.poster = `/uploads/matches/${req.file.filename}`;
  }
  const fields = ['teamHome', 'teamAway', 'date', 'time', 'location', 'category', 'description', 'status'];
  fields.forEach(f => { if (req.body[f] !== undefined) match[f] = req.body[f]; });
  match.updatedAt = new Date().toISOString();
  saveData(data);
  res.json(match);
});

app.delete('/api/matches/:id', authenticate, (req, res) => {
  const data = getData();
  const index = data.matches.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Match non trouvé' });
  deleteFile(data.matches[index].poster);
  data.matches.splice(index, 1);
  saveData(data);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
//  GALERIE
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/gallery', (req, res) => {
  const data = getData();
  res.json(data.gallery.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));
});

app.post('/api/gallery', authenticate, uploadGallery.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune photo fournie' });
  const data = getData();
  const newPhoto = {
    id: uuidv4(),
    filename: `/uploads/gallery/${req.file.filename}`,
    caption: (req.body.caption || '').trim(),
    uploadedBy: req.user.id,
    uploadedAt: new Date().toISOString()
  };
  data.gallery.push(newPhoto);
  saveData(data);
  res.status(201).json(newPhoto);
});

app.delete('/api/gallery/:id', authenticate, (req, res) => {
  const data = getData();
  const index = data.gallery.findIndex(g => g.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Photo non trouvée' });
  deleteFile(data.gallery[index].filename);
  data.gallery.splice(index, 1);
  saveData(data);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
//  SPONSORS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/sponsors', (req, res) => {
  const data = getData();
  res.json(data.sponsors.sort((a, b) => (a.order || 99) - (b.order || 99)));
});

app.post('/api/sponsors', authenticate, uploadSponsor.single('logo'), (req, res) => {
  const { name, website, order } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom du sponsor requis' });
  const data = getData();
  const newSponsor = {
    id: uuidv4(),
    name: name.trim(),
    logo: req.file ? `/uploads/sponsors/${req.file.filename}` : null,
    website: (website || '').trim(),
    order: parseInt(order) || (data.sponsors.length + 1),
    createdAt: new Date().toISOString()
  };
  data.sponsors.push(newSponsor);
  saveData(data);
  res.status(201).json(newSponsor);
});

app.put('/api/sponsors/:id', authenticate, uploadSponsor.single('logo'), (req, res) => {
  const data = getData();
  const index = data.sponsors.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Sponsor non trouvé' });
  const sponsor = data.sponsors[index];
  if (req.file) {
    deleteFile(sponsor.logo);
    sponsor.logo = `/uploads/sponsors/${req.file.filename}`;
  }
  if (req.body.name)    sponsor.name    = req.body.name.trim();
  if (req.body.website !== undefined) sponsor.website = req.body.website.trim();
  if (req.body.order   !== undefined) sponsor.order   = parseInt(req.body.order);
  saveData(data);
  res.json(sponsor);
});

app.delete('/api/sponsors/:id', authenticate, (req, res) => {
  const data = getData();
  const index = data.sponsors.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Sponsor non trouvé' });
  deleteFile(data.sponsors[index].logo);
  data.sponsors.splice(index, 1);
  saveData(data);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
//  JOUEURS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/players', (req, res) => {
  const data = getData();
  res.json(data.players.sort((a, b) => parseInt(a.number || 99) - parseInt(b.number || 99)));
});

app.post('/api/players', authenticate, uploadPlayer.single('photo'), (req, res) => {
  const { name, number, position, category, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const data = getData();
  const newPlayer = {
    id: uuidv4(),
    name: name.trim(),
    number: (number || '').trim(),
    position: (position || '').trim(),
    category: category || 'Senior',
    bio: (bio || '').trim(),
    photo: req.file ? `/uploads/players/${req.file.filename}` : null,
    createdAt: new Date().toISOString()
  };
  data.players.push(newPlayer);
  saveData(data);
  res.status(201).json(newPlayer);
});

app.put('/api/players/:id', authenticate, uploadPlayer.single('photo'), (req, res) => {
  const data = getData();
  const index = data.players.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Joueur non trouvé' });
  const player = data.players[index];
  if (req.file) {
    deleteFile(player.photo);
    player.photo = `/uploads/players/${req.file.filename}`;
  }
  ['name', 'number', 'position', 'category', 'bio'].forEach(f => {
    if (req.body[f] !== undefined) player[f] = req.body[f];
  });
  player.updatedAt = new Date().toISOString();
  saveData(data);
  res.json(player);
});

app.delete('/api/players/:id', authenticate, (req, res) => {
  const data = getData();
  const index = data.players.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Joueur non trouvé' });
  deleteFile(data.players[index].photo);
  data.players.splice(index, 1);
  saveData(data);
  res.json({ success: true });
});

// ─── Start server ─────────────────────────────────────────────────────────────
initData().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 US Créteil Futsal — Serveur démarré`);
    console.log(`   Site public : http://localhost:${PORT}`);
    console.log(`   Admin       : http://localhost:${PORT}/admin`);
    console.log(`   Identifiants par défaut : admin / Admin2024\n`);
  });
});
