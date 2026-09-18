'use strict';

/**
 * Non-destructive migration: adds the `rate_limit` table used to throttle login
 * attempts and contact-form submissions. Safe to run against the live database.
 *
 * A database-backed counter is used instead of an in-memory one because Vercel
 * is serverless: each request can hit a fresh instance, so in-memory counters
 * reset constantly and give almost no protection. A shared table works across
 * every instance.
 *
 * Run with: npm run migrate:security
 */

require('dotenv').config();
const db = require('./db');

async function migrate() {
  console.log('Creating the rate_limit table if it does not exist ...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS rate_limit (
      key          TEXT PRIMARY KEY,
      count        INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log('Done.');
}

migrate()
  .then(() => db.pool.end())
  .catch((err) => {
    console.error('Migration failed:', err.message);
    db.pool.end();
    process.exit(1);
  });
