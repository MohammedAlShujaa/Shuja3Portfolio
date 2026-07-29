/* Shared behaviour for every page: navigation, footer, scroll reveals,
   and the small helpers the page scripts build on. */

/* ------------------------------------------------------------ helpers */

const api = async (path) => {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

// Everything from the database is inserted as text, never as HTML, so a stray
// angle bracket in a project description cannot become markup.
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};

const CATEGORY_CLASS = {
  'Machine Learning': 'pill--ml',
  'NLP & Data': 'pill--nlp',
  'Web Development': 'pill--web'
};

const splitTags = (tags) =>
  String(tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/* ----------------------------------------------------------- navbar */

function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    links.dataset.open = String(open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // Reset the menu when the viewport grows past the mobile breakpoint,
  // otherwise the body could stay locked at desktop width.
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
}

/* ------------------------------------------------ scroll reveals */

function initReveals() {
  const targets = document.querySelectorAll('.fade-up');
  if (!targets.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((t) => t.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((t) => observer.observe(t));
}

/* ----------------------------------------------- shared footer */

async function initFooter() {
  const list = document.querySelector('.footer__socials');
  if (!list) return;
  try {
    const socials = await api('/api/socials');
    list.innerHTML = '';
    socials.forEach((s) => {
      const li = el('li');
      const a = el('a', null, s.platform);
      a.href = s.url;
      if (!s.url.startsWith('mailto:')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      li.appendChild(a);
      list.appendChild(li);
    });
  } catch {
    list.innerHTML = '';
  }
}

/* ------------------------------------------------ project card */

function projectCard(project, { compact = false } = {}) {
  const card = el('article', 'card fade-up');
  card.dataset.category = project.category;

  if (project.thumbnail_url) {
    const img = el('img', 'card__thumb');
    img.src = project.thumbnail_url;
    img.alt = `${project.title} preview`;
    img.loading = 'lazy';
    card.appendChild(img);
  }

  const body = el('div', 'card__body');

  const meta = el('div', 'card__meta');
  const pill = el('span', `pill ${CATEGORY_CLASS[project.category] || 'pill--ml'}`, project.category);
  meta.appendChild(pill);
  if (project.featured) meta.appendChild(el('span', 'pill pill--featured', 'Featured'));
  body.appendChild(meta);

  body.appendChild(el('h3', 'card__title', project.title));

  const desc = project.description;
  body.appendChild(
    el('p', 'card__desc', compact && desc.length > 160 ? `${desc.slice(0, 157)}...` : desc)
  );

  const tags = splitTags(project.tech_tags);
  if (tags.length) {
    const chips = el('ul', 'chips');
    tags.forEach((t) => chips.appendChild(el('li', null, t)));
    body.appendChild(chips);
  }

  const links = el('div', 'card__links');
  const addLink = (href, label) => {
    const a = el('a', null, label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    links.appendChild(a);
  };
  if (project.github_url) addLink(project.github_url, 'GitHub');
  if (project.live_url) addLink(project.live_url, 'Live demo');

  if (links.children.length) {
    body.appendChild(links);
  } else {
    // No dead links: say why there is nothing to click instead of linking to "#".
    body.appendChild(el('p', 'card__note', 'Private work, available on request'));
  }

  card.appendChild(body);
  return card;
}

/* ------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initFooter();
  initReveals();
});
