'use strict';

/**
 * Builds and exports the Express app. It does not listen on a port here, so the
 * same app object works both locally (server/index.js) and as a Vercel
 * serverless function (api/index.js).
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const db = require('./db');
const { renderPage, NEEDS } = require('./render');
const { requireAuthPage } = require('./auth');

const app = express();

app.set('trust proxy', 1);

// Security headers. A Content Security Policy limits where scripts, styles,
// fonts, images, and frames may come from, which is defence in depth on top of
// the fact that all database content is inserted as text, never as HTML. Inline
// scripts and styles are allowed because the static pages use them and cannot
// carry a per-request nonce; everything external is restricted to the CDNs the
// site actually uses (Google Fonts, Devicon) plus Supabase for images.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "connect-src 'self'"
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set. Copy .env.example to .env and add one.');
}

// A signed cookie holds the whole session. express-session's default memory store
// resets on every serverless invocation, which would sign the admin out constantly,
// so the session stays stateless instead.
app.use(cookieSession({
  name: 'shujaa_admin',
  secret: process.env.SESSION_SECRET,
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 12 * 60 * 60 * 1000
}));

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Admin pages live outside /public so that static hosting cannot serve the
// dashboard straight to an anonymous visitor, bypassing the session check.
const viewsDir = path.join(__dirname, 'views');

// Never let the browser cache the admin UI, so a redeploy (new dashboard or
// admin.js) is always picked up immediately instead of showing a stale page.
app.use('/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  next();
});

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.sendFile(path.join(viewsDir, 'login.html'));
});

app.get('/admin', requireAuthPage, (req, res) => {
  res.sendFile(path.join(viewsDir, 'dashboard.html'));
});

app.get('/admin/admin.js', requireAuthPage, (req, res) => {
  res.type('application/javascript').sendFile(path.join(viewsDir, 'admin.js'));
});

app.get('/admin/admin.css', (req, res) => {
  res.type('text/css').sendFile(path.join(viewsDir, 'admin.css'));
});

// Server-side rendering for the public pages. The content is injected into the
// HTML before it is sent so crawlers and link previews see real text instead of
// a "Loading ..." placeholder. The client JavaScript still runs on top. If the
// database is unreachable, fall through to serving the static file so the page
// still loads and the client renders it.
async function collect(names) {
  const out = {};
  await Promise.all(names.map(async (n) => {
    if (n === 'profile') out.profile = await db.getProfile();
    else if (n === 'projects') out.projects = await db.listProjects();
    else if (n === 'socials') out.socials = await db.listSocials();
    else if (n === 'skills') out.skills = await db.listSkills();
    else if (n === 'updates') out.updates = await db.listUpdates();
  }));
  return out;
}

const ssrRoute = (name) => async (req, res, next) => {
  try {
    const data = await collect(NEEDS[name]);
    res.type('html').send(renderPage(name, data));
  } catch (err) {
    console.error(`SSR failed for ${name}:`, err.message);
    next();
  }
};

app.get('/', ssrRoute('index'));
app.get('/about', ssrRoute('about'));
app.get('/portfolio', ssrRoute('portfolio'));
app.get('/contact', ssrRoute('contact'));

// Clean URLs: send legacy /page.html requests to the extensionless /page (301),
// so links that were already shared keep working and each page has one canonical
// address. Runs before static so the redirect wins over serving the .html file.
app.get(/.*\.html$/, (req, res) => {
  let clean = req.path.replace(/\.html$/, '');
  if (clean.endsWith('/index')) clean = clean.slice(0, -'/index'.length);
  if (clean === '') clean = '/';
  const query = req.originalUrl.slice(req.path.length);
  res.redirect(301, clean + query);
});

// Serve the static site. The extensions option lets /about resolve to about.html,
// so pages are reached without the .html extension.
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found.' });
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  if (req.path.startsWith('/api')) {
    return res.status(status).json({ error: 'Something went wrong on the server.' });
  }
  res.status(status).send('Something went wrong on the server.');
});

module.exports = app;
