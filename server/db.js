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
  getAdminUser
};
