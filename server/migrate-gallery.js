'use strict';

/**
 * Non-destructive migration: adds the `gallery` table to an existing database
 * without touching any other table or data. Safe to run against the live
 * database, unlike `npm run seed` which drops everything.
 *
 * It also inserts a few sample rows the first time, so the modeling page has
 * something to show before real photos are uploaded. Delete those from the
 * admin panel once you add your own.
 *
 * Run with: npm run migrate:gallery
 */

require('dotenv').config();
const db = require('./db');

const SAMPLES = [
  { title: 'Studio session', category: 'Studio', image_url: '/img/model-placeholder-portrait.svg', thumb_url: '/img/model-placeholder-portrait.svg', credit: 'Sample, replace in the admin panel', featured: true, sort_order: 1 },
  { title: 'Brand campaign', category: 'Brand & Product', image_url: '/img/model-placeholder-landscape.svg', thumb_url: '/img/model-placeholder-landscape.svg', credit: 'Sample, replace in the admin panel', featured: false, sort_order: 2 },
  { title: 'Casting', category: 'Casting', image_url: '/img/model-placeholder-square.svg', thumb_url: '/img/model-placeholder-square.svg', credit: 'Sample, replace in the admin panel', featured: false, sort_order: 3 },
  { title: 'Editorial', category: 'Editorial', image_url: '/img/model-placeholder-portrait.svg', thumb_url: '/img/model-placeholder-portrait.svg', credit: 'Sample, replace in the admin panel', featured: false, sort_order: 4 },
  { title: 'Studio, second look', category: 'Studio', image_url: '/img/model-placeholder-square.svg', thumb_url: '/img/model-placeholder-square.svg', credit: 'Sample, replace in the admin panel', featured: false, sort_order: 5 },
  { title: 'Editorial, second look', category: 'Editorial', image_url: '/img/model-placeholder-landscape.svg', thumb_url: '/img/model-placeholder-landscape.svg', credit: 'Sample, replace in the admin panel', featured: false, sort_order: 6 }
];

async function migrate() {
  console.log('Creating the gallery table if it does not exist ...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS gallery (
      id          SERIAL PRIMARY KEY,
      title       TEXT,
      category    TEXT NOT NULL DEFAULT 'Editorial',
      image_url   TEXT NOT NULL,
      thumb_url   TEXT,
      credit      TEXT,
      featured    BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order  INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery (sort_order, id)');

  const existing = await db.listGallery();
  if (existing.length === 0) {
    console.log('Table is empty, inserting sample rows ...');
    for (const g of SAMPLES) await db.insertGalleryItem(g);
    console.log(`Inserted ${SAMPLES.length} sample rows. Replace them from the admin panel.`);
  } else {
    console.log(`Gallery already has ${existing.length} rows, leaving them untouched.`);
  }

  console.log('Done.');
}

migrate()
  .then(() => db.pool.end())
  .catch((err) => {
    console.error('Migration failed:', err.message);
    db.pool.end();
    process.exit(1);
  });
