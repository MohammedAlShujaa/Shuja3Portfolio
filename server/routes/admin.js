'use strict';

/**
 * Every route here writes to the database, so all of them sit behind requireAuthApi
 * (applied by the parent router in app.js), except login which cannot require a session.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const supabase = require('../supabase');
const { verifyLogin, requireAuthApi } = require('../auth');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const toBool = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

/* ------------------------------------------------------------------ auth */

router.post('/login', wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const ok = await verifyLogin(username, password);
  if (!ok) return res.status(401).json({ error: 'Wrong username or password.' });
  req.session.isAdmin = true;
  req.session.username = username;
  res.json({ ok: true });
}));

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ signedIn: Boolean(req.session && req.session.isAdmin) });
});

// Everything below this line needs a signed-in admin.
router.use(requireAuthApi);

/* ---------------------------------------------------------------- upload */

// Vercel's filesystem is read only, so disk uploads only work locally.
// Pasting an image URL is the supported path in production (see README).
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
const onVercel = Boolean(process.env.VERCEL);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed.'), ok);
  }
});

router.post('/upload', (req, res, next) => {
  if (onVercel) {
    return res.status(501).json({
      error: 'File upload is disabled on Vercel because the filesystem is read only. Paste an image URL instead.'
    });
  }
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    res.json({ ok: true, url: `/uploads/${req.file.filename}` });
  });
});

/* --------------------------------------------------------------- profile */

router.get('/profile', wrap(async (req, res) => res.json(await db.getProfile())));

router.put('/profile', wrap(async (req, res) => {
  const current = await db.getProfile();
  if (!current) return res.status(404).json({ error: 'Profile row not found. Run npm run seed.' });
  const b = req.body;
  const updated = await db.updateProfile({
    id: current.id,
    name: String(b.name || '').trim(),
    headline: String(b.headline || '').trim(),
    subheading: String(b.subheading || '').trim(),
    intro: String(b.intro || '').trim(),
    photo_url: String(b.photo_url || '').trim(),
    cta_primary_label: String(b.cta_primary_label || '').trim(),
    cta_primary_href: String(b.cta_primary_href || '').trim(),
    cta_secondary_label: String(b.cta_secondary_label || '').trim(),
    cta_secondary_href: String(b.cta_secondary_href || '').trim(),
    location: String(b.location || '').trim(),
    availability: String(b.availability || '').trim(),
    resume_url: String(b.resume_url || '').trim()
  });
  if (!updated.name || !updated.headline) {
    return res.status(400).json({ error: 'Name and headline cannot be empty.' });
  }
  res.json(updated);
}));

/* -------------------------------------------------------------- projects */

const projectFrom = (b) => ({
  title: String(b.title || '').trim(),
  description: String(b.description || '').trim(),
  category: String(b.category || '').trim(),
  tech_tags: String(b.tech_tags || '').trim(),
  thumbnail_url: String(b.thumbnail_url || '').trim(),
  github_url: String(b.github_url || '').trim(),
  live_url: String(b.live_url || '').trim(),
  featured: toBool(b.featured),
  sort_order: toInt(b.sort_order, 0)
});

const CATEGORIES = ['Machine Learning', 'NLP & Data', 'Web Development'];

router.get('/projects', wrap(async (req, res) => res.json(await db.listProjects())));

router.post('/projects', wrap(async (req, res) => {
  const p = projectFrom(req.body);
  if (!p.title || !p.description) return res.status(400).json({ error: 'Title and description are required.' });
  if (!CATEGORIES.includes(p.category)) return res.status(400).json({ error: 'Pick a valid category.' });
  res.status(201).json(await db.insertProject(p));
}));

router.put('/projects/:id', wrap(async (req, res) => {
  const p = projectFrom(req.body);
  if (!p.title || !p.description) return res.status(400).json({ error: 'Title and description are required.' });
  if (!CATEGORIES.includes(p.category)) return res.status(400).json({ error: 'Pick a valid category.' });
  const updated = await db.updateProject(toInt(req.params.id), p);
  if (!updated) return res.status(404).json({ error: 'Project not found.' });
  res.json(updated);
}));

router.delete('/projects/:id', wrap(async (req, res) => {
  await db.deleteProject(toInt(req.params.id));
  res.json({ ok: true });
}));

/* ----------------------------------------------------------------- skills */

const skillFrom = (b) => ({
  group_name: String(b.group_name || '').trim(),
  name: String(b.name || '').trim(),
  icon: String(b.icon || '').trim(),
  sort_order: toInt(b.sort_order, 0)
});

router.get('/skills', wrap(async (req, res) => res.json(await db.listSkills())));

router.post('/skills', wrap(async (req, res) => {
  const s = skillFrom(req.body);
  if (!s.name || !s.group_name) return res.status(400).json({ error: 'Skill name and group are required.' });
  res.status(201).json(await db.insertSkill(s));
}));

router.put('/skills/:id', wrap(async (req, res) => {
  const s = skillFrom(req.body);
  if (!s.name || !s.group_name) return res.status(400).json({ error: 'Skill name and group are required.' });
  const updated = await db.updateSkill(toInt(req.params.id), s);
  if (!updated) return res.status(404).json({ error: 'Skill not found.' });
  res.json(updated);
}));

router.delete('/skills/:id', wrap(async (req, res) => {
  await db.deleteSkill(toInt(req.params.id));
  res.json({ ok: true });
}));

/* --------------------------------------------------------------- updates */

const updateFrom = (b) => ({
  title: String(b.title || '').trim(),
  body: String(b.body || '').trim(),
  date: String(b.date || '').trim() || new Date().toISOString().slice(0, 10),
  tag: String(b.tag || '').trim()
});

router.get('/updates', wrap(async (req, res) => res.json(await db.listUpdates())));

router.post('/updates', wrap(async (req, res) => {
  const u = updateFrom(req.body);
  if (!u.title || !u.body) return res.status(400).json({ error: 'Title and body are required.' });
  res.status(201).json(await db.insertUpdate(u));
}));

router.put('/updates/:id', wrap(async (req, res) => {
  const u = updateFrom(req.body);
  if (!u.title || !u.body) return res.status(400).json({ error: 'Title and body are required.' });
  const updated = await db.updateUpdate(toInt(req.params.id), u);
  if (!updated) return res.status(404).json({ error: 'Update not found.' });
  res.json(updated);
}));

router.delete('/updates/:id', wrap(async (req, res) => {
  await db.deleteUpdate(toInt(req.params.id));
  res.json({ ok: true });
}));

/* --------------------------------------------------------------- socials */

const socialFrom = (b) => ({
  platform: String(b.platform || '').trim(),
  url: String(b.url || '').trim(),
  icon: String(b.icon || '').trim()
});

router.get('/socials', wrap(async (req, res) => res.json(await db.listSocials())));

router.post('/socials', wrap(async (req, res) => {
  const s = socialFrom(req.body);
  if (!s.platform || !s.url) return res.status(400).json({ error: 'Platform and URL are required.' });
  res.status(201).json(await db.insertSocial(s));
}));

router.put('/socials/:id', wrap(async (req, res) => {
  const s = socialFrom(req.body);
  if (!s.platform || !s.url) return res.status(400).json({ error: 'Platform and URL are required.' });
  const updated = await db.updateSocial(toInt(req.params.id), s);
  if (!updated) return res.status(404).json({ error: 'Social link not found.' });
  res.json(updated);
}));

router.delete('/socials/:id', wrap(async (req, res) => {
  await db.deleteSocial(toInt(req.params.id));
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- gallery */

const GALLERY_CATEGORIES = ['Studio', 'Brand & Product', 'Casting', 'Editorial'];

const galleryFrom = (b) => ({
  title: String(b.title || '').trim(),
  category: String(b.category || '').trim() || 'Editorial',
  image_url: String(b.image_url || '').trim(),
  thumb_url: String(b.thumb_url || '').trim(),
  credit: String(b.credit || '').trim(),
  featured: toBool(b.featured),
  sort_order: toInt(b.sort_order, 0)
});

router.get('/gallery', wrap(async (req, res) => res.json(await db.listGallery())));

router.post('/gallery', wrap(async (req, res) => {
  const g = galleryFrom(req.body);
  if (!g.image_url) return res.status(400).json({ error: 'An image URL is required.' });
  if (!GALLERY_CATEGORIES.includes(g.category)) return res.status(400).json({ error: 'Pick a valid category.' });
  res.status(201).json(await db.insertGalleryItem(g));
}));

router.put('/gallery/:id', wrap(async (req, res) => {
  const g = galleryFrom(req.body);
  if (!g.image_url) return res.status(400).json({ error: 'An image URL is required.' });
  if (!GALLERY_CATEGORIES.includes(g.category)) return res.status(400).json({ error: 'Pick a valid category.' });
  const updated = await db.updateGalleryItem(toInt(req.params.id), g);
  if (!updated) return res.status(404).json({ error: 'Gallery item not found.' });
  res.json(updated);
}));

router.delete('/gallery/:id', wrap(async (req, res) => {
  await db.deleteGalleryItem(toInt(req.params.id));
  res.json({ ok: true });
}));

// Receives the already-resized full and thumbnail images from the browser and
// forwards them to Supabase Storage. The browser shrinks the photo first, so the
// payload stays small and works within the serverless request size limit, and
// the huge original never has to travel over the network.
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpeg|jpg|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed.'), ok);
  }
});

router.post('/gallery/upload', (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(501).json({
      error: 'Supabase storage is not set up. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then create a public bucket named "photos".'
    });
  }
  memUpload.fields([{ name: 'full', maxCount: 1 }, { name: 'thumb', maxCount: 1 }])(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const full = req.files && req.files.full && req.files.full[0];
      if (!full) return res.status(400).json({ error: 'No image was received.' });
      const thumb = req.files && req.files.thumb && req.files.thumb[0];
      const name = String(req.body.name || 'photo');

      const image_url = await supabase.uploadImage(full.buffer, full.mimetype, name);
      let thumb_url = '';
      if (thumb) thumb_url = await supabase.uploadImage(thumb.buffer, thumb.mimetype, `${name}-thumb`);

      res.json({ ok: true, image_url, thumb_url });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });
});

/* -------------------------------------------------------------- messages */

router.get('/messages', wrap(async (req, res) => res.json(await db.listMessages())));

router.get('/messages/unread-count', wrap(async (req, res) => {
  res.json({ count: await db.countUnreadMessages() });
}));

router.put('/messages/:id/read', wrap(async (req, res) => {
  const updated = await db.markMessageRead(toInt(req.params.id), toBool(req.body.is_read));
  if (!updated) return res.status(404).json({ error: 'Message not found.' });
  res.json(updated);
}));

router.delete('/messages/:id', wrap(async (req, res) => {
  await db.deleteMessage(toInt(req.params.id));
  res.json({ ok: true });
}));

module.exports = router;
