/* Home page: hero content, stat strip, and the featured work teaser row. */

// Highlights "machine learning" in the subheading with the cyan to violet
// gradient without ever injecting database text as HTML.
function renderSubheading(node, text) {
  node.textContent = '';
  const keyword = 'machine learning';
  const index = text.toLowerCase().indexOf(keyword);

  if (index === -1) {
    node.textContent = text;
    return;
  }

  node.appendChild(document.createTextNode(text.slice(0, index)));
  node.appendChild(el('span', 'grad', text.slice(index, index + keyword.length)));
  node.appendChild(document.createTextNode(text.slice(index + keyword.length)));
}

async function renderHero() {
  const profile = await api('/api/profile');
  if (!profile) return;

  document.querySelector('[data-hero-name]').textContent = profile.headline;
  renderSubheading(document.querySelector('[data-hero-subheading]'), profile.subheading);
  document.querySelector('[data-hero-intro]').textContent = profile.intro;

  const photo = document.querySelector('[data-hero-photo]');
  if (profile.photo_url) photo.src = profile.photo_url;
  photo.alt = `${profile.name}, profile photo`;

  const primary = document.querySelector('[data-cta-primary]');
  primary.textContent = profile.cta_primary_label || 'View My Projects';
  primary.href = profile.cta_primary_href || '/portfolio.html';

  const secondary = document.querySelector('[data-cta-secondary]');
  secondary.textContent = profile.cta_secondary_label || 'Get in Touch';
  secondary.href = profile.cta_secondary_href || '/contact.html';

  document.title = `${profile.name}, Machine Learning & Intelligent Systems Engineer`;
}

async function renderHeroSocials() {
  const list = document.querySelector('[data-hero-socials]');
  if (!list) return;
  const socials = await api('/api/socials');
  list.innerHTML = '';
  socials
    .filter((s) => s.platform !== 'Email')
    .forEach((s) => {
      const li = el('li');
      const a = el('a', null, s.platform);
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
      list.appendChild(li);
    });
}

async function renderStats() {
  const list = document.querySelector('[data-stats]');
  if (!list) return;

  const projects = await api('/api/projects');

  const stats = [
    [String(projects.length), 'projects shipped'],
    ['90+', 'students taught'],
    ['3', 'languages spoken']
  ];

  list.innerHTML = '';
  stats.forEach(([value, label]) => {
    const li = el('li');
    li.appendChild(el('strong', null, value));
    li.appendChild(document.createTextNode(` ${label}`));
    list.appendChild(li);
  });
}

async function renderFeatured() {
  const grid = document.querySelector('[data-featured]');
  if (!grid) return;

  const featured = await api('/api/projects?featured=true&limit=3');

  // Featured is capped at three cards, so top up from the full list if the
  // admin has flagged fewer than three.
  let projects = featured;
  if (projects.length < 3) {
    const all = await api('/api/projects');
    const ids = new Set(projects.map((p) => p.id));
    projects = projects.concat(all.filter((p) => !ids.has(p.id)).slice(0, 3 - projects.length));
  }

  grid.innerHTML = '';
  if (!projects.length) {
    grid.appendChild(el('p', 'state-msg', 'No projects yet.'));
    return;
  }
  projects.forEach((p) => grid.appendChild(projectCard(p, { compact: true })));
  initReveals();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([renderHero(), renderHeroSocials(), renderStats(), renderFeatured()]);
  } catch (err) {
    console.error('Could not load the home page content.', err);
  }
});
