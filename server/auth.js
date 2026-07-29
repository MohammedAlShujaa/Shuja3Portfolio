'use strict';

/**
 * Basic single-account auth for a student project. It is deliberately simple:
 * one admin row, a bcrypt password hash, and a signed session cookie.
 * It is not meant to stand in for real multi-user auth with rate limiting,
 * password reset, or 2FA. The password itself only ever lives in the
 * ADMIN_PASSWORD env var, never in the repository.
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

async function verifyLogin(username, password) {
  const user = await db.getAdminUser(username);
  if (!user) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

// Guard for write APIs: answers with JSON so the admin panel can react.
function requireAuthApi(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Not signed in.' });
}

// Guard for admin pages: sends the browser to the login screen.
function requireAuthPage(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

module.exports = { verifyLogin, requireAuthApi, requireAuthPage };
