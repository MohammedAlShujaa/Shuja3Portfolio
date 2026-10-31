'use strict';

/**
 * Every route here writes to the database, so all of them sit behind requireAuthApi
 * (applied by the parent router in app.js), except login which cannot require a session.
 */

const express = require('express');
const multer = require('multer');
const db = require('../db');
const model = require('../model');
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
  // Throttle by IP so passwords cannot be brute forced.
  const rl = await db.hitRateLimit(`login:${req.ip || 'unknown'}`, 12, 900);
  if (rl.limited) {
    const mins = Math.ceil(rl.retryAfter / 60);
    return res.status(429).json({ error: `Too many sign in attempts. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.` });
  }

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

// Images are stored in the database and served at /media/<id> (see app.js), so
// uploading works the same locally and on Vercel, with nothing else to set up.
// The browser shrinks photos before sending them, so they stay small and under
// the serverless request size limit. SVG is not accepted: it can carry script.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpeg|jpg|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, GIF or WebP images are allowed.'), ok);
  }
});

const mediaUrl = (id) => `/media/${id}`;
const mediaIdOf = (url) => {
  const m = /^\/media\/(\d+)$/.exec(String(url || ''));
  return m ? Number(m[1]) : null;
};

// One image (field "image"): the profile photo, a project thumbnail, ...
router.post('/media', (req, res, next) => {
  imageUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image was received.' });
    try {
      const id = await db.insertMedia(req.file.mimetype, req.file.buffer);
      res.json({ ok: true, url: mediaUrl(id) });
    } catch (e) {
      next(e);
    }
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

// Add a photo by URL (the photo manager's upload uses /gallery/photos below).
router.post('/gallery', wrap(async (req, res) => {
  const g = galleryFrom(req.body);
  if (!g.image_url) return res.status(400).json({ error: 'An image URL is required.' });
  if (!GALLERY_CATEGORIES.includes(g.category)) return res.status(400).json({ error: 'Pick a valid category.' });
  if (!req.body.sort_order) g.sort_order = await db.nextGallerySort();
  res.status(201).json(await db.insertGalleryItem(g));
}));

// Upload a photo from the device: the browser sends a large version ("full")
// and a square thumbnail ("thumb"); both are stored, and the photo is added at
// the end of the book.
router.post('/gallery/photos', (req, res, next) => {
  imageUpload.fields([{ name: 'full', maxCount: 1 }, { name: 'thumb', maxCount: 1 }])(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const full = req.files && req.files.full && req.files.full[0];
      if (!full) return res.status(400).json({ error: 'No image was received.' });
      const thumb = req.files.thumb && req.files.thumb[0];
      const category = GALLERY_CATEGORIES.includes(req.body.category) ? req.body.category : 'Studio';

      const fullId = await db.insertMedia(full.mimetype, full.buffer);
      const thumbId = thumb ? await db.insertMedia(thumb.mimetype, thumb.buffer) : null;
      const item = await db.insertGalleryItem({
        title: String(req.body.title || '').trim().slice(0, 120),
        category,
        image_url: mediaUrl(fullId),
        thumb_url: thumbId ? mediaUrl(thumbId) : '',
        credit: '',
        featured: false,
        sort_order: await db.nextGallerySort()
      });
      res.status(201).json(item);
    } catch (e) {
      next(e);
    }
  });
});

// The book order, as a list of photo ids from first to last.
router.put('/gallery/order', wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map((v) => toInt(v, NaN)).filter(Number.isFinite) : [];
  if (!ids.length) return res.status(400).json({ error: 'No order was received.' });
  await db.reorderGallery(ids);
  res.json({ ok: true });
}));

// Makes this photo the cover (the only featured one).
router.put('/gallery/:id/cover', wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (!(await db.getGalleryItem(id))) return res.status(404).json({ error: 'Gallery item not found.' });
  await db.setGalleryCover(id);
  res.json({ ok: true });
}));

router.put('/gallery/:id', wrap(async (req, res) => {
  const g = galleryFrom(req.body);
  if (!g.image_url) return res.status(400).json({ error: 'An image URL is required.' });
  if (!GALLERY_CATEGORIES.includes(g.category)) return res.status(400).json({ error: 'Pick a valid category.' });
  const updated = await db.updateGalleryItem(toInt(req.params.id), g);
  if (!updated) return res.status(404).json({ error: 'Gallery item not found.' });
  res.json(updated);
}));

// Deleting a photo also deletes its uploaded images.
router.delete('/gallery/:id', wrap(async (req, res) => {
  const id = toInt(req.params.id);
  const item = await db.getGalleryItem(id);
  await db.deleteGalleryItem(id);
  if (item) {
    for (const url of [item.image_url, item.thumb_url]) {
      const mediaId = mediaIdOf(url);
      if (mediaId) await db.deleteMedia(mediaId);
    }
  }
  res.json({ ok: true });
}));

/* ----------------------------------------------------------- model */

// The model book's cover line, comp card and measurements (see server/model.js).
router.get('/model', wrap(async (req, res) => {
  res.json({ ...(await model.getModel()), fields: model.MEASUREMENTS });
}));

router.put('/model', wrap(async (req, res) => {
  res.json(await model.saveModel(req.body));
}));

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
