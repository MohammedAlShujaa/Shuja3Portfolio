'use strict';

/**
 * Creates the schema and fills it with the real content for this portfolio.
 * Destructive: it drops every table first, so treat it as a reset.
 *
 * Run with: npm run seed
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const PROFILE = {
  name: 'Mohammed Al-Shujaa',
  headline: 'Mohammed Al-Shujaa',
  subheading: 'Fluent in Arabic, English, Indonesian, and machine learning.',
  intro:
    'I build ML and NLP systems, and explain them just as clearly. Information Engineering student at UNTAG Surabaya, Stanford-certified in supervised machine learning.',
  photo_url: '/img/profile-placeholder.svg',
  cta_primary_label: 'View My Projects',
  cta_primary_href: '/portfolio.html',
  cta_secondary_label: 'Get in Touch',
  cta_secondary_href: '/contact.html',
  location: 'Surabaya, Indonesia (remote friendly)',
  availability: 'Open to ML and software internships, freelance projects, and research collaborations.',
  resume_url: ''
};

const SOCIALS = [
  { platform: 'GitHub', url: 'https://github.com/MohammedGamil19', icon: 'github' },
  { platform: 'LinkedIn', url: 'https://www.linkedin.com/in/mohammed-al-shujaa-071042258', icon: 'linkedin' },
  { platform: 'Email', url: 'mailto:khaledmajeedsaif@gmail.com', icon: 'mail' }
];

// icon holds a Devicon class name. Tools with no Devicon glyph are left empty and
// the site falls back to a monogram tile, so no skill row ever shows a broken icon.
const SKILLS = [
  ['Machine Learning & AI', 'Python', 'devicon-python-plain'],
  ['Machine Learning & AI', 'scikit-learn', 'devicon-scikitlearn-plain'],
  ['Machine Learning & AI', 'TensorFlow', 'devicon-tensorflow-original'],
  ['Machine Learning & AI', 'NLTK', ''],
  ['Machine Learning & AI', 'n8n', ''],
  ['Data & Analytics', 'SQL', ''],
  ['Data & Analytics', 'MySQL', 'devicon-mysql-original'],
  ['Data & Analytics', 'PostgreSQL', 'devicon-postgresql-plain'],
  ['Data & Analytics', 'Pandas', 'devicon-pandas-original'],
  ['Data & Analytics', 'Excel', ''],
  ['Data & Analytics', 'Power BI', ''],
  ['Web & Apps', 'Laravel', 'devicon-laravel-original'],
  ['Web & Apps', 'PHP', 'devicon-php-plain'],
  ['Web & Apps', 'HTML', 'devicon-html5-plain'],
  ['Web & Apps', 'CSS', 'devicon-css3-plain'],
  ['Web & Apps', 'JavaScript', 'devicon-javascript-plain'],
  ['Web & Apps', 'Kotlin', 'devicon-kotlin-plain'],
  ['Foundations & Tools', 'C', 'devicon-c-plain'],
  ['Foundations & Tools', 'C++', 'devicon-cplusplus-plain'],
  ['Foundations & Tools', 'Java', 'devicon-java-plain'],
  ['Foundations & Tools', 'MATLAB', 'devicon-matlab-plain'],
  ['Foundations & Tools', 'Git', 'devicon-git-plain'],
  ['Foundations & Tools', 'Figma', 'devicon-figma-plain']
];

const PROJECTS = [
  {
    title: 'TIMS, Tank Inventory Management System',
    description:
      "My undergraduate thesis and JITCS journal project: a tank-farm inventory system built on the Thinging Machine conceptual framework, with a two-phase sender and receiver confirmation workflow over an ACID-compliant database, and a two-stage Mixed Integer Linear Programming (MILP) optimization engine for tank consolidation and allocation. Evaluated on 1,362 real transaction records and 52 daily snapshots from PT PAMIN's PAMIN 2 Tank Farm (23 tanks, 19+ palm-oil products), it returned a 28.7% mean consolidation saving and a 28.96% combined two-stage saving, solving each day in about 1.6 seconds. Research work, co-authored and supervised, not a solo product.",
    category: 'Machine Learning',
    tech_tags: 'C++, Qt, Python, PuLP, MILP, SQLite',
    thumbnail_url: '/img/project-tims.svg',
    github_url: '',
    live_url: '',
    featured: true,
    sort_order: 1
  },
  {
    title: 'TripAdvisor Hotel Reviews, NLP Analysis',
    description:
      'End-to-end NLP pipeline over hotel reviews: NLTK preprocessing, Bag-of-Words, TF-IDF, Word2Vec embeddings, and a t-SNE map of semantic relationships between words.',
    category: 'NLP & Data',
    tech_tags: 'Python, NLTK, Word2Vec, TF-IDF, t-SNE',
    thumbnail_url: '/img/project-nlp.svg',
    github_url: 'https://github.com/MohammedGamil19/NLP_Analysis-TripAdvisor-Hotel-Reviews-Dataset-',
    live_url: '',
    featured: true,
    sort_order: 2
  },
  {
    title: 'House Price Prediction',
    description:
      'Linear-regression pipeline on the California Housing dataset: preprocessing, exploratory analysis, training, and evaluation with clear visual diagnostics.',
    category: 'Machine Learning',
    tech_tags: 'Python, scikit-learn, Pandas, Matplotlib',
    thumbnail_url: '/img/project-house.svg',
    github_url: 'https://github.com/MohammedGamil19/house-price-prediction-ml',
    live_url: '',
    featured: false,
    sort_order: 3
  },
  {
    title: 'IT Inventory Management System',
    description:
      'Web-based asset-tracking system built during my software engineering internship at PT Pacific Medan Industri: Laravel and MySQL with full CRUD workflows and automated reporting. Internship work, so the repository stays private and this card links to a case study only.',
    category: 'Web Development',
    tech_tags: 'Laravel, PHP, MySQL',
    thumbnail_url: '/img/project-inventory.svg',
    github_url: '',
    live_url: '',
    featured: false,
    sort_order: 4
  },
  {
    title: 'Personal Portfolio Website',
    description:
      'This site: a responsive HTML, CSS, and JavaScript portfolio built with CSS Grid, Flexbox, and media queries, plus a Node and Express admin panel I use to keep it current. Designed in Figma first, then hand-coded.',
    category: 'Web Development',
    tech_tags: 'HTML, CSS, JavaScript, Node.js, Figma',
    thumbnail_url: '/img/project-portfolio.svg',
    github_url: '',
    live_url: '',
    featured: false,
    sort_order: 5
  }
];

const UPDATES = [
  {
    title: 'Portfolio v2 is live',
    body: 'Rebuilt the site from scratch on the Neural Navy design system: four hand-coded pages, a database-driven project gallery, and an admin panel so I can keep everything current without a redeploy.',
    date: '2026-07-16',
    tag: 'Site'
  },
  {
    title: 'TIMS thesis submitted to JITCS',
    body: 'The Tank Inventory Management System, my undergraduate thesis, is written up as a journal article covering the Thinging Machine model and the two-stage MILP optimization engine.',
    date: '2026-06-01',
    tag: 'Research'
  }
];

async function seed() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  console.log('Creating schema ...');
  await db.query(sql);

  console.log('Seeding profile ...');
  await db.query(
    `INSERT INTO profile
       (name, headline, subheading, intro, photo_url, cta_primary_label, cta_primary_href,
        cta_secondary_label, cta_secondary_href, location, availability, resume_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      PROFILE.name, PROFILE.headline, PROFILE.subheading, PROFILE.intro, PROFILE.photo_url,
      PROFILE.cta_primary_label, PROFILE.cta_primary_href,
      PROFILE.cta_secondary_label, PROFILE.cta_secondary_href,
      PROFILE.location, PROFILE.availability, PROFILE.resume_url
    ]
  );

  console.log('Seeding socials ...');
  for (const s of SOCIALS) await db.insertSocial(s);

  console.log('Seeding skills ...');
  let order = 0;
  for (const [group_name, name, icon] of SKILLS) {
    await db.insertSkill({ group_name, name, icon, sort_order: order++ });
  }

  console.log('Seeding projects ...');
  for (const p of PROJECTS) await db.insertProject(p);

  console.log('Seeding updates ...');
  for (const u of UPDATES) await db.insertUpdate(u);

  console.log('Seeding admin account ...');
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not set in .env, so the admin account cannot be created.');
  }
  const hash = bcrypt.hashSync(password, 10);
  await db.query(
    'INSERT INTO admin_user (username, password_hash) VALUES ($1, $2)',
    ['admin', hash]
  );

  console.log('Done. Sign in at /admin with username "admin" and your ADMIN_PASSWORD.');
}

// Only run when invoked directly (npm run seed), so tests can import seed()
// and drive it against their own database.
if (require.main === module) {
  seed()
    .then(() => db.pool.end())
    .catch((err) => {
      console.error('Seed failed:', err.message);
      db.pool.end();
      process.exit(1);
    });
}

module.exports = { seed, PROFILE, PROJECTS, SKILLS, SOCIALS, UPDATES };
