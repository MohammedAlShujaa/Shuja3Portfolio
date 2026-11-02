'use strict';

/**
 * Server-side rendering for the public pages.
 *
 * The pages fetch their content from the API with JavaScript, which means the
 * raw HTML a crawler receives is nearly empty (just "Loading ..." placeholders),
 * and Google treats that as a Soft 404. This module injects the real content
 * into the HTML before it is sent, so crawlers and link-preview bots see the
 * actual text. The client JavaScript still runs on top and powers the category
 * filter, the mobile menu, and so on; it simply re-renders the same content.
 *
 * Injection is done by replacing the unique placeholder strings each template
 * already contains. The replacement value is always passed through a function so
 * that a "$" inside rendered content is never treated as a special replacement
 * token.
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const templateCache = {};

// The home template lives at home.html, not index.html, so that Vercel does not
// serve it as a static directory index and bypass server-side rendering.
const TEMPLATE_FILE = { index: 'home', about: 'about', portfolio: 'portfolio', contact: 'contact', modeling: 'modeling', 'modeling-id': 'modeling' };

function template(name) {
  if (!templateCache[name]) {
    const file = TEMPLATE_FILE[name] || name;
    const html = fs.readFileSync(path.join(publicDir, `${file}.html`), 'utf8');
    templateCache[name] = name === 'modeling-id' ? toIndonesian(html) : html;
  }
  return templateCache[name];
}

const esc = (s) =>
  String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Replace the first occurrence; a function value avoids "$" being treated as a
// special replacement pattern.
const put = (html, find, value) => html.replace(find, () => value);

const splitTags = (t) =>
  String(t || '').split(',').map((x) => x.trim()).filter(Boolean);

const CATEGORY_CLASS = {
  'Machine Learning': 'pill--ml',
  'NLP & Data': 'pill--nlp',
  'Web Development': 'pill--web'
};

/* ------------------------------------------------------- fragments */

function projectCardHtml(p, compact) {
  const cls = CATEGORY_CLASS[p.category] || 'pill--ml';
  const description = compact && p.description.length > 160
    ? `${p.description.slice(0, 157)}...`
    : p.description;

  const thumb = p.thumbnail_url
    ? `<img class="card__thumb" src="${esc(p.thumbnail_url)}" alt="${esc(p.title)} preview" loading="lazy">`
    : '';

  const chips = splitTags(p.tech_tags);
  const chipsHtml = chips.length
    ? `<ul class="chips">${chips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';

  const links = [];
  if (p.github_url) links.push(`<a href="${esc(p.github_url)}" target="_blank" rel="noopener noreferrer">GitHub</a>`);
  if (p.live_url) links.push(`<a href="${esc(p.live_url)}" target="_blank" rel="noopener noreferrer">Live demo</a>`);
  const linksHtml = links.length
    ? `<div class="card__links">${links.join('')}</div>`
    : '<p class="card__note">Private work, available on request</p>';

  const featured = p.featured ? '<span class="pill pill--featured">Featured</span>' : '';

  return `<article class="card is-visible" data-category="${esc(p.category)}">${thumb}` +
    `<div class="card__body"><div class="card__meta">` +
    `<span class="pill ${cls}">${esc(p.category)}</span>${featured}</div>` +
    `<h3 class="card__title">${esc(p.title)}</h3>` +
    `<p class="card__desc">${esc(description)}</p>${chipsHtml}${linksHtml}</div></article>`;
}

function featuredHtml(projects) {
  let list = projects.filter((p) => p.featured);
  if (list.length < 3) {
    const ids = new Set(list.map((p) => p.id));
    list = list.concat(projects.filter((p) => !ids.has(p.id)).slice(0, 3 - list.length));
  }
  return list.slice(0, 3).map((p) => projectCardHtml(p, true)).join('');
}

function statsHtml(projectCount) {
  const stats = [
    [String(projectCount), 'projects shipped'],
    ['90+', 'students taught'],
    ['3', 'languages spoken']
  ];
  return stats.map(([v, l]) => `<li><strong>${esc(v)}</strong> ${esc(l)}</li>`).join('');
}

function subheadingHtml(text) {
  const kw = 'machine learning';
  const i = String(text || '').toLowerCase().indexOf(kw);
  if (i === -1) return esc(text);
  return esc(text.slice(0, i)) +
    `<span class="grad">${esc(text.slice(i, i + kw.length))}</span>` +
    esc(text.slice(i + kw.length));
}

function heroSocialsHtml(socials) {
  return socials
    .filter((s) => s.platform !== 'Email')
    .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.platform)}</a></li>`)
    .join('');
}

function footerSocialsHtml(socials) {
  return socials.map((s) => {
    const ext = s.url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<li><a href="${esc(s.url)}"${ext}>${esc(s.platform)}</a></li>`;
  }).join('');
}

const GROUP_ORDER = ['Machine Learning & AI', 'Data & Analytics', 'Web & Apps', 'Foundations & Tools'];

function monogram(name) {
  return name.split(/[\s&/-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function skillsHtml(skills) {
  const groups = new Map();
  skills.forEach((s) => {
    if (!groups.has(s.group_name)) groups.set(s.group_name, []);
    groups.get(s.group_name).push(s);
  });
  const names = [
    ...GROUP_ORDER.filter((g) => groups.has(g)),
    ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g))
  ];
  return names.map((name) => {
    const items = groups.get(name).map((s) => {
      const icon = s.icon
        ? `<span class="skill__icon ${esc(s.icon)}" aria-hidden="true"></span>`
        : `<span class="skill__monogram" aria-hidden="true">${esc(monogram(s.name))}</span>`;
      return `<li class="skill">${icon}<span class="skill__name">${esc(s.name)}</span></li>`;
    }).join('');
    return `<div class="skill-group"><h3 class="skill-group__label">${esc(name)}</h3>` +
      `<ul class="skill-row">${items}</ul></div>`;
  }).join('');
}

function updatesHtml(updates) {
  return updates.slice(0, 4).map((u) => {
    const date = new Date(u.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const meta = u.tag ? `${date} · ${u.tag}` : date;
    return `<li class="update-item"><p class="update-item__meta">${esc(meta)}</p>` +
      `<h3 class="card__title">${esc(u.title)}</h3><p>${esc(u.body)}</p></li>`;
  }).join('');
}

function contactListHtml(socials, profile) {
  let html = socials.map((s) => {
    const disp = s.url.replace(/^mailto:/, '').replace(/^https?:\/\//, '');
    const ext = s.url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<li><div><p class="contact-list__label">${esc(s.platform)}</p>` +
      `<a class="contact-list__value" href="${esc(s.url)}"${ext}>${esc(disp)}</a></div></li>`;
  }).join('');
  if (profile && profile.location) {
    html += `<li><div><p class="contact-list__label">Location</p>` +
      `<p class="contact-list__value">${esc(profile.location)}</p></div></li>`;
  }
  return html;
}

/* --------------------------------------------------- page injectors */

// The hero name, with its last word (the surname) wrapped so it shows in crimson.
function nameHtml(headline) {
  const text = String(headline || '').trim();
  const cut = text.lastIndexOf(' ');
  if (cut === -1) return esc(text);
  return `${esc(text.slice(0, cut))} <span class="hero__name-accent">${esc(text.slice(cut + 1))}</span>`;
}

// The hero buttons, including the CV button, which only appears once a resume
// link is set so it is never a dead button.
function heroCtasHtml(profile) {
  const primary = `<a class="btn btn--primary" href="${esc(profile.cta_primary_href || '/portfolio')}" data-cta-primary>` +
    `${esc(profile.cta_primary_label || 'View My Projects')}</a>`;
  const secondary = `<a class="btn btn--secondary" href="${esc(profile.cta_secondary_href || '/contact')}" data-cta-secondary>` +
    `${esc(profile.cta_secondary_label || 'Get in Touch')}</a>`;
  const cv = profile.resume_url
    ? `<a class="btn btn--ghost" href="${esc(profile.resume_url)}" target="_blank" rel="noopener noreferrer" data-cta-cv>Shujaa CV</a>`
    : '';
  return primary + secondary + cv;
}

function injectHome(html, { profile, projects, socials }) {
  if (profile) {
    if (profile.photo_url) html = put(html, 'src="/img/profile-placeholder.svg"', `src="${esc(profile.photo_url)}"`);
    html = put(html, 'alt="Mohammed Al-Shujaa, profile photo"', `alt="${esc(profile.name)}, profile photo"`);
    html = put(html, 'data-hero-name>Mohammed <span class="hero__name-accent">Al-Shujaa</span></h1>',
      `data-hero-name>${nameHtml(profile.headline)}</h1>`);
    html = put(html, 'data-hero-subheading></p>', `data-hero-subheading>${subheadingHtml(profile.subheading)}</p>`);
    html = put(html, 'data-hero-intro></p>', `data-hero-intro>${esc(profile.intro)}</p>`);
    html = html.replace(/(<div class="hero__ctas">)[\s\S]*?(<\/div>)/, (m, open, close) => open + heroCtasHtml(profile) + close);
    // Tells home.js the content is already here, so it does not fetch and redraw it
    // (a redraw would also restart the hero animation).
    html = put(html, '<main id="main">', '<main id="main" data-ssr>');
  }
  html = put(html, 'data-stats></ul>', `data-stats>${statsHtml(projects.length)}</ul>`);
  html = put(html, 'data-hero-socials></ul>', `data-hero-socials>${heroSocialsHtml(socials)}</ul>`);
  html = put(html, '<p class="state-msg">Loading projects ...</p>', featuredHtml(projects));
  html = put(html, '<ul class="footer__socials"></ul>', `<ul class="footer__socials">${footerSocialsHtml(socials)}</ul>`);
  return html;
}

function injectPortfolio(html, { projects, socials }) {
  const cards = projects.map((p) => projectCardHtml(p, false)).join('');
  html = put(html, '<p class="state-msg">Loading projects ...</p>', cards);
  // Tells portfolio.js the cards are already here, so it filters them in place
  // instead of fetching and redrawing them.
  html = put(html, '<main id="main">', '<main id="main" data-ssr>');
  html = put(html, '<ul class="footer__socials"></ul>', `<ul class="footer__socials">${footerSocialsHtml(socials)}</ul>`);
  return html;
}

function injectAbout(html, { profile, skills, updates, socials }) {
  if (profile && profile.photo_url) {
    html = put(html, 'src="/img/profile-placeholder.svg"', `src="${esc(profile.photo_url)}"`);
  }
  html = put(html, '<p class="state-msg">Loading skills ...</p>', skillsHtml(skills));
  html = put(html, '<li class="state-msg">Loading updates ...</li>', updatesHtml(updates));
  html = put(html, '<ul class="footer__socials"></ul>', `<ul class="footer__socials">${footerSocialsHtml(socials)}</ul>`);
  return html;
}

function injectContact(html, { profile, socials }) {
  html = put(html, '<li class="state-msg">Loading ...</li>', contactListHtml(socials, profile));
  html = put(html, '<ul class="footer__socials"></ul>', `<ul class="footer__socials">${footerSocialsHtml(socials)}</ul>`);
  return html;
}

/* --------------------------------------------------------- modeling */

const { MEASUREMENTS, inIndonesian } = require('./model');
const GALLERY_CATEGORIES = ['Studio', 'Brand & Product', 'Casting', 'Editorial'];
const SITE = 'https://shuja3.site';

// Replaces everything between <!--model:NAME--> and <!--/model:NAME--> in the
// modeling template. The template keeps sensible defaults there, which show if
// server rendering ever falls back to the raw file.
const block = (html, name, inner) =>
  html.replace(new RegExp(`(<!--model:${name}-->)[\\s\\S]*?(<!--/model:${name}-->)`), (m, open, close) => open + inner + close);

const igUrl = (handle) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;

/* The words the server writes into the modeling page, in English and in
   Indonesian (/id/modeling). modeling.js has the same table for the words it
   writes in the browser. */
const WORDS = {
  en: {
    basedIn: 'Based in', languages: 'Languages', availableFor: 'Available for', measurements: 'Measurements',
    cover: 'Cover', look: 'Look', looks: 'looks', allInIndex: (n) => `all ${n} in the index`,
    open: (no, title) => `Open look ${no}, ${title}, full screen`, soon: 'Photos coming soon.',
    messageIg: 'Message on Instagram', sendEmail: 'Send an email',
    photoOf: 'Mohammed Al-Shujaa, male model in Surabaya',
    measure: {},
    category: {}
  },
  id: {
    basedIn: 'Domisili', languages: 'Bahasa', availableFor: 'Tersedia untuk', measurements: 'Ukuran tubuh',
    cover: 'Sampul', look: 'Look', looks: 'look', allInIndex: (n) => `semua ${n} di indeks`,
    open: (no, title) => `Buka look ${no}, ${title}, layar penuh`, soon: 'Foto segera hadir.',
    messageIg: 'Kirim pesan di Instagram', sendEmail: 'Kirim email',
    photoOf: 'Mohammed Al-Shujaa, model pria Surabaya',
    measure: {
      height: 'Tinggi', weight: 'Berat', chest: 'Dada', waist: 'Pinggang', hips: 'Pinggul',
      pants: 'Celana', size: 'Ukuran', shoes: 'Sepatu', eyes: 'Mata', hair: 'Rambut'
    },
    category: { 'Brand & Product': 'Brand & Produk' }
  }
};
const categoryName = (w, c) => w.category[c] || c;

/* The fixed text of the modeling template and its Indonesian version. The
   Indonesian page is the English template with these swapped, so the two
   pages never drift apart in layout. Each entry must match the template
   exactly once; a missing one is reported when the template is first built. */
const ID_TEMPLATE = [
  ['<html lang="en">', '<html lang="id">'],
  ['<title>Male Model in Surabaya, Indonesia | Mohammed Al-Shujaa</title>',
    '<title>Model Pria Surabaya &amp; Talent Foto Produk | Mohammed Al-Shujaa</title>'],
  ['<meta name="description" content="Mohammed Al-Shujaa, male and menswear model based in Surabaya, Indonesia (184 cm). Available for product, catalogue, brand, commercial, casting, and editorial shoots in Surabaya and East Java.">',
    '<meta name="description" content="Mohammed Al-Shujaa, model pria dan talent di Surabaya, Indonesia (tinggi 184 cm). Tersedia untuk foto produk, katalog, brand, iklan, casting, dan editorial di Surabaya dan Jawa Timur.">'],
  ['<meta name="keywords" content="male model Surabaya, menswear model Surabaya, male model Indonesia, commercial model Surabaya, catalogue model, product photography model, fashion model East Java, editorial model, casting Surabaya, freelance model Surabaya, Mohammed Al-Shujaa model">',
    '<meta name="keywords" content="model pria Surabaya, model cowok Surabaya, talent model pria Surabaya, model foto produk Surabaya, model katalog Surabaya, model fashion Jawa Timur, casting model Surabaya, model freelance Surabaya, model iklan Surabaya, model editorial, Mohammed Al-Shujaa">'],
  ['<link rel="canonical" href="https://shuja3.site/modeling">', '<link rel="canonical" href="https://shuja3.site/id/modeling">'],
  ['<meta property="og:locale" content="en_US">\n  <meta property="og:locale:alternate" content="id_ID">',
    '<meta property="og:locale" content="id_ID">\n  <meta property="og:locale:alternate" content="en_US">'],
  ['<meta property="og:title" content="Male Model in Surabaya | Mohammed Al-Shujaa">',
    '<meta property="og:title" content="Model Pria Surabaya | Mohammed Al-Shujaa">'],
  ['<meta property="og:description" content="Male and menswear model based in Surabaya, Indonesia. Product, catalogue, brand, commercial, casting, and editorial work.">',
    '<meta property="og:description" content="Model pria dan talent di Surabaya, Indonesia. Foto produk, katalog, brand, iklan, casting, dan editorial.">'],
  ['<meta property="og:url" content="https://shuja3.site/modeling">', '<meta property="og:url" content="https://shuja3.site/id/modeling">'],
  ['>Skip to the book<', '>Langsung ke portofolio<'],
  ['<nav class="mb-bar__nav" aria-label="Page">', '<nav class="mb-bar__nav" aria-label="Halaman">'],
  ['<a href="#index">Index</a>', '<a href="#index">Indeks</a>'],
  ['<a class="mb-bar__book" href="#booking">Book</a>', '<a class="mb-bar__book" href="#booking">Booking</a>'],
  ['<section class="mb-card" aria-label="Details">', '<section class="mb-card" aria-label="Detail">'],
  ['<section class="mb-book" id="book" aria-label="The book" data-book>', '<section class="mb-book" id="book" aria-label="Portofolio" data-book>'],
  ['<h2 class="mb-h2">The book</h2>', '<h2 class="mb-h2">Portofolio</h2>'],
  ['<li class="mb-empty">Loading ...</li>', '<li class="mb-empty">Memuat ...</li>'],
  ['<h2 class="mb-h2" id="mb-index-title">Index</h2>', '<h2 class="mb-h2" id="mb-index-title">Indeks</h2>'],
  ['aria-label="Filter photos by category"', 'aria-label="Saring foto menurut kategori"'],
  ['>Brands, agencies, photographers<', '>Brand, agensi, fotografer<'],
  ['>For bookings<', '>Untuk booking<'],
  ['>Message on Instagram<', '>Kirim pesan di Instagram<'],
  ['>Send an email<', '>Kirim email<'],
  ['<a href="/">Engineering portfolio</a>', '<a href="/">Portofolio engineering</a>'],
  ['aria-label="Photo viewer"', 'aria-label="Penampil foto"'],
  ['aria-label="Close"', 'aria-label="Tutup"'],
  ['aria-label="Previous photo"', 'aria-label="Foto sebelumnya"'],
  ['aria-label="Next photo"', 'aria-label="Foto berikutnya"']
];

function toIndonesian(html) {
  return ID_TEMPLATE.reduce((out, [en, id]) => {
    if (out.split(en).length !== 2) console.error(`render.js: the modeling template no longer has exactly one ${JSON.stringify(en)}.`);
    return out.replace(en, () => id);
  }, html);
}

function modelCardHtml(model, gallery, w) {
  const present = GALLERY_CATEGORIES.filter((c) => (gallery || []).some((g) => g.category === c));
  const available = (present.length ? present : GALLERY_CATEGORIES).map((c) => categoryName(w, c)).join(', ');

  const facts = [];
  if (model.based_in) facts.push([w.basedIn, esc(model.based_in)]);
  if (model.languages) facts.push([w.languages, esc(model.languages)]);
  facts.push([w.availableFor, esc(available), ' data-available']);
  if (model.instagram) {
    facts.push(['Instagram', `<a href="${esc(igUrl(model.instagram))}" target="_blank" rel="noopener noreferrer">@${esc(model.instagram)}</a>`]);
  }
  const list = facts.map(([dt, dd, attr = '']) => `<div><dt>${dt}</dt><dd${attr}>${dd}</dd></div>`).join('');

  const stats = MEASUREMENTS
    .filter(({ key }) => model.measurements && model.measurements[key])
    .map(({ key, label, unit }) => {
      const value = esc(model.measurements[key]).replace(/-/g, '&ndash;');
      return `<div><dt>${w.measure[key] || label}</dt><dd>${value}${unit ? `<small>${unit}</small>` : ''}</dd></div>`;
    })
    .join('');

  return `<dl class="mb-card__list">${list}</dl>` +
    (stats ? `<dl class="mb-stats" aria-label="${w.measurements}">${stats}</dl>` : '');
}

// The photos, rendered the same way modeling.js renders them, so crawlers and
// link previews see the book without running the page's script. The script
// then rebuilds them from the JSON embedded below and adds the interaction.
const BOOK_SIZE = 7; // keep in step with BOOK_SIZE in public/js/modeling.js
const pad2 = (n) => String(n).padStart(2, '0');

function coverHtml(gallery, w) {
  const cover = gallery.find((g) => g.featured) || gallery[0];
  if (!cover) return null;
  const alt = cover.title ? `${cover.title}, ${w.photoOf}` : w.photoOf;
  const plate = [cover.title || w.cover, categoryName(w, cover.category), cover.credit].filter(Boolean)
    .map((t) => `<span>${esc(t)}</span>`).join('');
  return `<figure class="mb-cover__photo" data-cover>
        <div class="mb-cover__frame"><img src="${esc(cover.image_url)}" alt="${esc(alt)}" fetchpriority="high"></div>
        <figcaption class="mb-cover__plate" data-plate><b>${pad2(gallery.indexOf(cover) + 1)}</b>${plate}</figcaption>
      </figure>`;
}

function bookHtml(gallery, w) {
  if (!gallery.length) return `<li class="mb-empty">${w.soon}</li>`;
  const book = gallery.slice(0, BOOK_SIZE);
  return book.map((item, i) => {
    const title = item.title || `${w.look} ${pad2(i + 1)}`;
    const category = categoryName(w, item.category);
    const meta = item.credit ? `${category}, ${item.credit}` : category;
    return `<li class="mb-look"><button class="mb-look__frame" type="button" aria-label="${esc(w.open(pad2(i + 1), title))}">` +
      `<img src="${esc(item.image_url)}" alt="${esc(`${title}, ${w.photoOf}`)}" decoding="async"></button>` +
      `<div class="mb-look__caption"><span class="mb-look__no">${pad2(i + 1)}<small> / ${pad2(book.length)}</small></span>` +
      `<div><div class="mb-look__title">${esc(title)}</div><div class="mb-look__meta">${esc(meta)}</div></div></div></li>`;
  }).join('');
}

function bookCountHtml(gallery, w) {
  if (!gallery.length) return '';
  const shown = Math.min(gallery.length, BOOK_SIZE);
  const more = gallery.length > shown ? `, <a href="#index">${w.allInIndex(gallery.length)}</a>` : '';
  return `${pad2(shown)} ${w.looks}${more}`;
}

function sheetHtml(gallery, w) {
  if (!gallery.length) return `<p class="mb-empty">${w.soon}</p>`;
  return gallery.map((item, i) =>
    `<button class="mb-sheet__item" type="button" aria-label="${esc(w.open(pad2(i + 1), item.title || categoryName(w, item.category)))}">` +
    `<div class="mb-sheet__img"><img src="${esc(item.thumb_url || item.image_url)}" alt="" loading="lazy"></div>` +
    `<div class="mb-sheet__no"><b>${pad2(i + 1)}</b><span>${esc(categoryName(w, item.category))}</span></div></button>`
  ).join('');
}

// JSON inside a <script> tag: "<" is escaped so no value can close the tag.
const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const absolute = (url) => (/^https?:\/\//i.test(url) ? url : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`);
const number = (v) => {
  const n = parseFloat(String(v || '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Structured data (schema.org): a profile page about a person who is a model
// in Surabaya, with height, weight and links, so search engines know what the
// page is about. Same person (@id) as on the home page.
function modelLdHtml(model, gallery, lang) {
  const cover = gallery.find((g) => g.featured) || gallery[0];
  const height = number(model.measurements.height);
  const weight = number(model.measurements.weight);
  const id = lang === 'id';
  const person = {
    '@type': 'Person',
    '@id': `${SITE}/#person`,
    name: 'Mohammed Al-Shujaa',
    alternateName: ['Mohammed Alshujaa', 'Mohammed Al Shujaa', 'Shujaa'],
    url: `${SITE}/`,
    jobTitle: id ? 'Model pria' : 'Male and menswear model',
    hasOccupation: {
      '@type': 'Occupation',
      name: id ? 'Model pria' : 'Fashion model',
      occupationLocation: { '@type': 'City', name: 'Surabaya' },
      skills: id ? 'Foto produk, katalog, brand, iklan, casting, editorial' : 'Product, catalogue, brand, commercial, casting, editorial'
    },
    description: id
      ? 'Model pria di Surabaya, Indonesia, untuk foto studio, brand dan produk, katalog, casting, dan editorial.'
      : 'Menswear model based in Surabaya, Indonesia, for studio, brand and product, catalogue, casting, and editorial work.',
    homeLocation: { '@type': 'Place', name: 'Surabaya, East Java, Indonesia' },
    sameAs: [
      model.instagram ? igUrl(model.instagram) : null,
      'https://github.com/MohammedAlShujaa',
      'https://www.linkedin.com/in/mohammed-al-shujaa-071042258'
    ].filter(Boolean)
  };
  if (cover) person.image = absolute(cover.image_url);
  if (height) person.height = { '@type': 'QuantitativeValue', value: height, unitCode: 'CMT' };
  if (weight) person.weight = { '@type': 'QuantitativeValue', value: weight, unitCode: 'KGM' };
  if (model.languages) person.knowsLanguage = model.languages.split(',').map((l) => l.trim()).filter(Boolean);

  const page = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${SITE}${id ? '/id' : ''}/modeling`,
    inLanguage: lang,
    name: id ? 'Model Pria Surabaya | Mohammed Al-Shujaa' : 'Male Model in Surabaya | Mohammed Al-Shujaa',
    keywords: id
      ? 'model pria Surabaya, model cowok Surabaya, talent model pria Surabaya, model foto produk Surabaya, model katalog Surabaya, casting model Surabaya, model freelance Surabaya'
      : 'male model Surabaya, menswear model Surabaya, male model Indonesia, commercial model Surabaya, catalogue model, product photography model, freelance model Surabaya',
    mainEntity: person
  };
  return `<script type="application/ld+json">${jsonForScript(page)}</script>`;
}

function injectModeling(html, { model, gallery = [], socials = [] }, lang = 'en') {
  const w = WORDS[lang];
  const shown = model && lang === 'id' ? inIndonesian(model) : model;
  if (shown) {
    html = block(html, 'note', esc(shown.cover_line));
    html = block(html, 'card', modelCardHtml(shown, gallery, w));
    html = block(html, 'instagram', shown.instagram
      ? `<a class="mb-btn mb-btn--solid" href="${esc(igUrl(shown.instagram))}" target="_blank" rel="noopener noreferrer">${w.messageIg}</a>`
      : '');
    html = block(html, 'ld', modelLdHtml(shown, gallery, lang));
  }

  const cover = coverHtml(gallery, w);
  if (cover) html = block(html, 'cover', cover);
  html = block(html, 'count', bookCountHtml(gallery, w));
  html = block(html, 'book', bookHtml(gallery, w));
  html = block(html, 'sheet', sheetHtml(gallery, w));

  const email = socials.find((s) => /^mailto:/i.test(s.url || ''));
  if (email) html = block(html, 'email', `<a class="mb-btn" href="${esc(email.url)}" data-email>${w.sendEmail}</a>`);

  const photos = gallery.map(({ id, title, category, credit, image_url, thumb_url, featured }) =>
    ({ id, title, category, credit, image_url, thumb_url, featured }));
  return block(html, 'data',
    `<script type="application/json" id="mb-data">${jsonForScript({ gallery: photos, email: email ? email.url : null })}</script>`);
}

/* ------------------------------------------------------- public API */

// Which data each page needs, so routes only query what they use.
const NEEDS = {
  index: ['profile', 'projects', 'socials'],
  portfolio: ['projects', 'socials'],
  about: ['profile', 'skills', 'updates', 'socials'],
  contact: ['profile', 'socials'],
  modeling: ['model', 'gallery', 'socials'],
  'modeling-id': ['model', 'gallery', 'socials']
};

const INJECTORS = {
  index: injectHome,
  portfolio: injectPortfolio,
  about: injectAbout,
  contact: injectContact,
  modeling: injectModeling,
  'modeling-id': (html, data) => injectModeling(html, data, 'id')
};

function renderPage(name, data) {
  return INJECTORS[name](template(name), data);
}

module.exports = { renderPage, NEEDS };
