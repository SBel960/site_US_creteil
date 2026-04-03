# ⚽ US Créteil Futsal — Site Web Officiel

Site web complet pour le club US Créteil Futsal avec espace public et panneau d'administration.

---

## 🚀 Démarrage rapide

### 1. Prérequis
- Node.js v16+ installé sur votre machine

### 2. Installation
```bash
# Dans le dossier du projet
npm install
```

### 3. Lancer le serveur
```bash
node server.js
# ou
npm start
```

### 4. Accès
| Page | URL |
|------|-----|
| Site public | http://localhost:3000 |
| Espace Admin | http://localhost:3000/admin |

---

## 🔐 Connexion Admin par défaut

| Champ | Valeur |
|-------|--------|
| Identifiant | `admin` |
| Mot de passe | `Admin2024` |

> ⚠️ **Important** : Changez ce mot de passe dès la première connexion via Comptes Admin → Modifier.

---

## ✨ Fonctionnalités

### Site public
- 🏟️ Affichage des prochains matchs avec filtres par catégorie
- 👥 Présentation des joueurs
- 🖼️ Galerie photos avec lightbox
- 🤝 Section sponsors
- 📱 Responsive mobile

### Espace admin
- 📅 **Matchs** — Créer, modifier, supprimer des matchs avec upload d'affiches
- 👤 **Joueurs** — Gérer l'effectif (photo, poste, numéro, catégorie)
- 🖼️ **Galerie** — Uploader des photos promotionnelles (multi-upload)
- 🤝 **Sponsors** — Gérer les partenaires avec logo
- 🔒 **Comptes Admin** — Le super-admin peut créer d'autres comptes admin

---

## 📁 Structure du projet

```
site US-Creteil-Futsal/
├── server.js              # Serveur Node.js/Express
├── package.json
├── data/
│   └── data.json          # Base de données JSON
├── public/
│   ├── index.html         # Site public
│   ├── js/
│   │   └── main.js        # JS site public
│   ├── admin/
│   │   ├── index.html     # Panneau admin
│   │   └── admin.js       # JS admin
│   └── uploads/           # Photos uploadées
│       ├── matches/       # Affiches des matchs
│       ├── gallery/       # Photos galerie
│       ├── sponsors/      # Logos sponsors
│       └── players/       # Photos joueurs
└── README.md
```

---

## 🎨 Couleurs du club
- **Bleu marine** : #0B1D3A
- **Bleu royal** : #1B3D8F
- **Or/Jaune** : #F5A623
- **Blanc** : #FFFFFF
# site_US_creteil
