'use strict';

/**
 * The only module in this project that talks to the Postgres driver.
 * Route code imports the named functions below and never builds SQL itself.
 * Every value reaching SQL goes through a parameter placeholder ($1, $2, ...).
 */

const { Pool } = require('pg');

if (!process.env.POSTGRES_URL) {
  throw new Error(
    'POSTGRES_URL is not set. Copy .env.example to .env and add a Postgres connection string.'
  );
}

// Neon and Vercel Postgres require SSL. A local Docker Postgres does not offer it,
// so SSL is enabled only for remote hosts.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.POSTGRES_URL);

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5
});

const query = (text, params) => pool.query(text, params);
const rows = async (text, params) => (await pool.query(text, params)).rows;
const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;

/* ------------------------------------------------- tables added later */

// Tables added after launch are created the first time they are needed, so a
// deploy never needs a manual migration step. Runs once per server instance.
let extraTables = null;
const ensureExtraTables = () => {
  if (!extraTables) {
    extraTables = pool.query(`
      CREATE TABLE IF NOT EXISTS media (
        id           SERIAL PRIMARY KEY,
        content_type TEXT NOT NULL,
        data         BYTEA NOT NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS site_settings (
        key   TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );
    `).catch((err) => {
      extraTables = null; // try again on the next call
      throw err;
    });
  }
  return extraTables;
};

/* ---------------------------------------------------------------- profile */

const getProfile = () => one('SELECT * FROM profile ORDER BY id LIMIT 1');

const updateProfile = (p) =>
  one(
    `UPDATE profile SET
       name = $1, headline = $2, subheading = $3, intro = $4, photo_url = $5,
       cta_primary_label = $6, cta_primary_href = $7,
       cta_secondary_label = $8, cta_secondary_href = $9,
       location = $10, availability = $11, resume_url = $12
     WHERE id = $13
     RETURNING *`,
    [
      p.name, p.headline, p.subheading, p.intro, p.photo_url,
      p.cta_primary_label, p.cta_primary_href,
      p.cta_secondary_label, p.cta_secondary_href,
      p.location, p.availability, p.resume_url, p.id
    ]
  );

/* ---------------------------------------------------------------- socials */

const listSocials = () => rows('SELECT * FROM socials ORDER BY id');

const insertSocial = (s) =>
  one(
    'INSERT INTO socials (platform, url, icon) VALUES ($1, $2, $3) RETURNING *',
    [s.platform, s.url, s.icon]
  );

const updateSocial = (id, s) =>
  one(
    'UPDATE socials SET platform = $1, url = $2, icon = $3 WHERE id = $4 RETURNING *',
    [s.platform, s.url, s.icon, id]
  );

const deleteSocial = (id) => query('DELETE FROM socials WHERE id = $1', [id]);

/* ----------------------------------------------------------------- skills */

const listSkills = () =>
  rows('SELECT * FROM skills ORDER BY group_name, sort_order, id');

const insertSkill = (s) =>
  one(
    `INSERT INTO skills (group_name, name, icon, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [s.group_name, s.name, s.icon, s.sort_order]
  );

const updateSkill = (id, s) =>
  one(
    `UPDATE skills SET group_name = $1, name = $2, icon = $3, sort_order = $4
     WHERE id = $5 RETURNING *`,
    [s.group_name, s.name, s.icon, s.sort_order, id]
  );

const deleteSkill = (id) => query('DELETE FROM skills WHERE id = $1', [id]);

/* --------------------------------------------------------------- projects */

const listProjects = () =>
  rows('SELECT * FROM projects ORDER BY sort_order, id');

const listFeaturedProjects = (limit) =>
  rows(
    'SELECT * FROM projects WHERE featured = TRUE ORDER BY sort_order, id LIMIT $1',
    [limit]
  );

const getProject = (id) => one('SELECT * FROM projects WHERE id = $1', [id]);

const insertProject = (p) =>
  one(
    `INSERT INTO projects
       (title, description, category, tech_tags, thumbnail_url,
        github_url, live_url, featured, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      p.title, p.description, p.category, p.tech_tags, p.thumbnail_url,
      p.github_url, p.live_url, p.featured, p.sort_order
    ]
  );

const updateProject = (id, p) =>
  one(
    `UPDATE projects SET
       title = $1, description = $2, category = $3, tech_tags = $4,
       thumbnail_url = $5, github_url = $6, live_url = $7,
       featured = $8, sort_order = $9
     WHERE id = $10
     RETURNING *`,
    [
      p.title, p.description, p.category, p.tech_tags, p.thumbnail_url,
      p.github_url, p.live_url, p.featured, p.sort_order, id
    ]
  );

const deleteProject = (id) => query('DELETE FROM projects WHERE id = $1', [id]);

/* ---------------------------------------------------------------- updates */

const listUpdates = () => rows('SELECT * FROM updates ORDER BY date DESC, id DESC');

const insertUpdate = (u) =>
  one(
    'INSERT INTO updates (title, body, date, tag) VALUES ($1, $2, $3, $4) RETURNING *',
    [u.title, u.body, u.date, u.tag]
  );

const updateUpdate = (id, u) =>
  one(
    'UPDATE updates SET title = $1, body = $2, date = $3, tag = $4 WHERE id = $5 RETURNING *',
    [u.title, u.body, u.date, u.tag, id]
  );

const deleteUpdate = (id) => query('DELETE FROM updates WHERE id = $1', [id]);

/* --------------------------------------------------------------- messages */

const insertMessage = (m) =>
  one(
    'INSERT INTO messages (name, email, message) VALUES ($1, $2, $3) RETURNING id',
    [m.name, m.email, m.message]
  );

const listMessages = () =>
  rows('SELECT * FROM messages ORDER BY created_at DESC, id DESC');

const countUnreadMessages = async () => {
  const row = await one('SELECT COUNT(*)::int AS count FROM messages WHERE is_read = FALSE');
  return row ? row.count : 0;
};

const markMessageRead = (id, isRead) =>
  one('UPDATE messages SET is_read = $1 WHERE id = $2 RETURNING *', [isRead, id]);

const deleteMessage = (id) => query('DELETE FROM messages WHERE id = $1', [id]);

/* ---------------------------------------------------------------- gallery */

const listGallery = () =>
  rows('SELECT * FROM gallery ORDER BY sort_order, id');

const getGalleryItem = (id) => one('SELECT * FROM gallery WHERE id = $1', [id]);

const insertGalleryItem = (g) =>
  one(
    `INSERT INTO gallery (title, category, image_url, thumb_url, credit, featured, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [g.title, g.category, g.image_url, g.thumb_url, g.credit, g.featured, g.sort_order]
  );

const updateGalleryItem = (id, g) =>
  one(
    `UPDATE gallery SET
       title = $1, category = $2, image_url = $3, thumb_url = $4,
       credit = $5, featured = $6, sort_order = $7
     WHERE id = $8 RETURNING *`,
    [g.title, g.category, g.image_url, g.thumb_url, g.credit, g.featured, g.sort_order, id]
  );

const deleteGalleryItem = (id) => query('DELETE FROM gallery WHERE id = $1', [id]);

// Book order: rewrites sort_order so the photos follow the given list of ids.
const reorderGallery = (ids) =>
  query(
    `UPDATE gallery AS g SET sort_order = v.ord
     FROM unnest($1::int[]) WITH ORDINALITY AS v(id, ord)
     WHERE g.id = v.id`,
    [ids]
  );

// The cover is the one featured photo: featuring one un-features the rest.
const setGalleryCover = (id) =>
  query('UPDATE gallery SET featured = (id = $1)', [id]);

const nextGallerySort = async () => {
  const row = await one('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM gallery');
  return row.next;
};

/* ------------------------------------------------------------- media */

// Uploaded images live in the database, so uploads work on any host (Vercel's
// filesystem is read only) with no storage service to configure.
const insertMedia = async (contentType, buffer) => {
  await ensureExtraTables();
  const row = await one('INSERT INTO media (content_type, data) VALUES ($1, $2) RETURNING id', [contentType, buffer]);
  return row.id;
};

const getMedia = async (id) => {
  await ensureExtraTables();
  return one('SELECT content_type, data FROM media WHERE id = $1', [id]);
};

const deleteMedia = async (id) => {
  await ensureExtraTables();
  return query('DELETE FROM media WHERE id = $1', [id]);
};

/* ---------------------------------------------------------- settings */

const getSetting = async (key) => {
  await ensureExtraTables();
  const row = await one('SELECT value FROM site_settings WHERE key = $1', [key]);
  return row ? row.value : null;
};

const setSetting = async (key, value) => {
  await ensureExtraTables();
  return one(
    `INSERT INTO site_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
     RETURNING value`,
    [key, JSON.stringify(value)]
  );
};

/* --------------------------------------------------------- rate limiting */

/**
 * Records one hit against a key within a rolling time window and reports whether
 * it now exceeds maxCount. The counter resets automatically once the window has
 * elapsed. Atomic, so it is safe across concurrent serverless instances.
 */
const hitRateLimit = async (key, maxCount, windowSeconds) => {
  const row = await one(
    `INSERT INTO rate_limit (key, count, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       count = CASE
         WHEN rate_limit.window_start < NOW() - make_interval(secs => $2) THEN 1
         ELSE rate_limit.count + 1 END,
       window_start = CASE
         WHEN rate_limit.window_start < NOW() - make_interval(secs => $2) THEN NOW()
         ELSE rate_limit.window_start END
     RETURNING count,
       GREATEST(EXTRACT(EPOCH FROM (window_start + make_interval(secs => $2) - NOW()))::int, 0) AS retry_after`,
    [key, windowSeconds]
  );
  return { limited: row.count > maxCount, count: row.count, retryAfter: row.retry_after };
};

/* ------------------------------------------------------------ admin_user */

const getAdminUser = (username) =>
  one('SELECT * FROM admin_user WHERE username = $1', [username]);

module.exports = {
  pool,
  query,
  getProfile,
  updateProfile,
  listSocials,
  insertSocial,
  updateSocial,
  deleteSocial,
  listSkills,
  insertSkill,
  updateSkill,
  deleteSkill,
  listProjects,
  listFeaturedProjects,
  getProject,
  insertProject,
  updateProject,
  deleteProject,
  listUpdates,
  insertUpdate,
  updateUpdate,
  deleteUpdate,
  insertMessage,
  listMessages,
  countUnreadMessages,
  markMessageRead,
  deleteMessage,
  listGallery,
  getGalleryItem,
  insertGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  reorderGallery,
  setGalleryCover,
  nextGallerySort,
  insertMedia,
  getMedia,
  deleteMedia,
  getSetting,
  setSetting,
  hitRateLimit,
  getAdminUser
};
