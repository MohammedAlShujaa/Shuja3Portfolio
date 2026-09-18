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

function template(name) {
  if (!templateCache[name]) {
    templateCache[name] = fs.readFileSync(path.join(publicDir, `${name}.html`), 'utf8');
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

function injectHome(html, { profile, projects, socials }) {
  if (profile) {
    if (profile.photo_url) html = put(html, 'src="/img/profile-placeholder.svg"', `src="${esc(profile.photo_url)}"`);
    html = put(html, 'data-hero-subheading></p>', `data-hero-subheading>${subheadingHtml(profile.subheading)}</p>`);
    html = put(html, 'data-hero-intro></p>', `data-hero-intro>${esc(profile.intro)}</p>`);
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

/* ------------------------------------------------------- public API */

// Which data each page needs, so routes only query what they use.
const NEEDS = {
  index: ['profile', 'projects', 'socials'],
  portfolio: ['projects', 'socials'],
  about: ['profile', 'skills', 'updates', 'socials'],
  contact: ['profile', 'socials']
};

const INJECTORS = {
  index: injectHome,
  portfolio: injectPortfolio,
  about: injectAbout,
  contact: injectContact
};

function renderPage(name, data) {
  return INJECTORS[name](template(name), data);
}

module.exports = { renderPage, NEEDS };
