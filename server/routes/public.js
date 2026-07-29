'use strict';

/**
 * Read-only JSON the public pages fetch on load, plus the contact form endpoint.
 * Anything here is open to the world.
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.get('/profile', wrap(async (req, res) => {
  res.json(await db.getProfile());
}));

router.get('/socials', wrap(async (req, res) => {
  res.json(await db.listSocials());
}));

router.get('/skills', wrap(async (req, res) => {
  res.json(await db.listSkills());
}));

router.get('/projects', wrap(async (req, res) => {
  const { featured, limit } = req.query;
  if (featured === 'true') {
    const max = Math.min(parseInt(limit, 10) || 3, 12);
    return res.json(await db.listFeaturedProjects(max));
  }
  res.json(await db.listProjects());
}));

router.get('/updates', wrap(async (req, res) => {
  res.json(await db.listUpdates());
}));

router.get('/gallery', wrap(async (req, res) => {
  res.json(await db.listGallery());
}));

// Contact form. The three fields are validated here as well as in the browser,
// because client-side checks can always be skipped.
router.post('/messages', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const message = String(req.body.message || '').trim();

  const errors = [];
  if (name.length < 2 || name.length > 120) errors.push('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    errors.push('Please enter a valid email address.');
  }
  if (message.length < 10 || message.length > 5000) {
    errors.push('Please write a message of at least 10 characters.');
  }
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const row = await db.insertMessage({ name, email, message });
  res.status(201).json({ ok: true, id: row.id });
}));

module.exports = router;
