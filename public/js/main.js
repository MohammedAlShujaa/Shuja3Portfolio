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

  const mqMobile = window.matchMedia('(max-width: 767px)');

  // When the mobile menu is closed it sits off screen, so its links must not be
  // reachable by keyboard or announced by screen readers. `inert` handles both.
  // On desktop the menu is always visible, so it is never inert.
  const applyInert = () => {
    const closedOnMobile = mqMobile.matches && links.dataset.open !== 'true';
    links.toggleAttribute('inert', closedOnMobile);
  };

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    links.dataset.open = String(open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) (open ? lenis.stop() : lenis.start());
    applyInert();
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // Reset the menu whenever the viewport crosses the mobile breakpoint, so the
  // body scroll lock and the inert state always match the current layout.
  mqMobile.addEventListener('change', () => setOpen(false));

  applyInert();
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
  // Skip when the server already rendered the links.
  if (!list || list.children.length) return;
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

/* ------------------------------------------- section label decode */

// The small "// label" lines above section headings resolve out of binary as
// they scroll into view, like the greeting in the hero. The "// " stays put,
// spaces stay spaces, and the text is monospaced, so nothing shifts while it
// resolves. Plain JS, so it works on pages that do not load GSAP.
function decode(node) {
  const text = node.textContent;
  const fixed = text.startsWith('// ') ? 3 : 0;
  const duration = 500 + text.length * 18;
  const start = performance.now();
  const frame = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const shown = fixed + Math.floor(progress * (text.length - fixed));
    let out = text.slice(0, shown);
    for (let i = shown; i < text.length; i++) {
      out += text[i] === ' ' ? ' ' : (Math.random() < 0.5 ? '0' : '1');
    }
    node.textContent = out;
    if (progress < 1) requestAnimationFrame(frame);
    else node.textContent = text;
  };
  requestAnimationFrame(frame);
}

function initLabelDecode() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  const labels = document.querySelectorAll('.eyebrow');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      decode(entry.target);
    });
  }, { threshold: 1 });
  labels.forEach((l) => observer.observe(l));
}

/* -------------------------------------------- card hover light */

// Keeps --mx/--my on the hovered card at the pointer position, which the
// card's ::before glow is centred on (see style.css). Mouse only.
function initCardGlow() {
  if (!window.matchMedia('(hover: hover)').matches) return;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

/* --------------------------------------- description "See more" */

// Portfolio cards show three lines of their description. When the text is
// longer, a "See more" button opens it in place (and becomes "See less").
// The full text is always in the page, so screen readers read all of it, and
// without JavaScript nothing is cut. The button only appears when the text
// really overflows, which is rechecked once the web fonts load and whenever
// the layout width changes.
function initDescToggles(root = document) {
  root.querySelectorAll('[data-projects] .card__desc').forEach((desc, i) => {
    if (desc.parentElement.classList.contains('card__text')) return;

    const wrap = el('div', 'card__text');
    desc.replaceWith(wrap);
    wrap.appendChild(desc);
    desc.id = desc.id || `card-desc-${i}-${Math.random().toString(36).slice(2, 7)}`;
    desc.classList.add('is-clamped');

    const more = el('button', 'card__more', 'See more');
    more.type = 'button';
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-controls', desc.id);
    more.addEventListener('click', () => {
      const open = more.getAttribute('aria-expanded') !== 'true';
      desc.classList.toggle('is-clamped', !open);
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'See less' : 'See more';
    });
    wrap.appendChild(more);
  });
  updateDescToggles();
}

// Shows "See more" only on descriptions that are actually cut off.
function updateDescToggles() {
  document.querySelectorAll('[data-projects] .card__more').forEach((more) => {
    if (more.getAttribute('aria-expanded') === 'true') return;
    const desc = document.getElementById(more.getAttribute('aria-controls'));
    if (!desc || !desc.offsetParent) return; // hidden by the filter: check later
    more.hidden = desc.scrollHeight <= desc.clientHeight + 1;
  });
}

function initDescToggleUpdates() {
  if (!document.querySelector('[data-projects]')) return;
  if (document.fonts) document.fonts.ready.then(updateDescToggles);
  let last = window.innerWidth;
  let timer;
  window.addEventListener('resize', () => {
    if (window.innerWidth === last) return;
    last = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(updateDescToggles, 150);
  });
}

/* ---------------------------------------------------- card tilt */

// A hovered card leans a few degrees away from the pointer and lifts, as if
// pressed where the mouse is. Uses GSAP, which the pages with cards (Home and
// Portfolio) load; elsewhere, on touch screens, and for reduced motion, cards
// keep the plain CSS hover lift.
//
// While a card tilts it carries .is-tilting, which drops the CSS transition on
// transform (it would drag every GSAP frame behind) and lets GSAP do the lift.
// Once the card has settled after the pointer leaves, its inline transform and
// the class are removed, so other animations (scroll reveals, the Portfolio
// filter) always start from a clean card.
const TILT_MAX = 4; // degrees at the card's edges
const tilts = new Map();

function tiltFor(card) {
  if (!tilts.has(card)) {
    gsap.set(card, { transformPerspective: 900 });
    const to = (prop) => gsap.quickTo(card, prop, { duration: 0.5, ease: 'power3.out' });
    tilts.set(card, { rx: to('rotationX'), ry: to('rotationY'), y: to('y'), settle: null });
    card.classList.add('is-tilting');
  }
  return tilts.get(card);
}

function clearTilt(card) {
  const t = tilts.get(card);
  if (!t) return;
  if (t.settle) t.settle.kill();
  gsap.killTweensOf(card, 'rotationX,rotationY,y');
  gsap.set(card, { clearProps: 'transform' });
  card.classList.remove('is-tilting');
  tilts.delete(card);
}

// Called by portfolio.js before the filter moves cards, so a card that is
// still settling never fights the filter animation.
function resetCardTilts() {
  [...tilts.keys()].forEach(clearTilt);
}

function initCardTilt() {
  if (!window.gsap) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card || card.closest('.is-flipping')) return;
    const t = tiltFor(card);
    if (t.settle) { t.settle.kill(); t.settle = null; }
    const r = card.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5; // -0.5 (left) to 0.5 (right)
    const ny = (e.clientY - r.top) / r.height - 0.5; // -0.5 (top) to 0.5 (bottom)
    t.ry(nx * 2 * TILT_MAX);
    t.rx(-ny * 2 * TILT_MAX);
    t.y(-4);
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card || card.contains(e.relatedTarget)) return;
    const t = tilts.get(card);
    if (!t) return;
    t.rx(0);
    t.ry(0);
    t.y(0);
    t.settle = gsap.delayedCall(0.6, () => clearTilt(card));
  });
}

/* ------------------------------------------------- smooth scroll */

// Lenis (vendored in /vendor/lenis/) smooths mouse-wheel and trackpad
// scrolling; touch screens keep native scrolling. On the homepage GSAP's
// ticker drives it and keeps ScrollTrigger in step with the smoothed position;
// elsewhere Lenis runs its own animation frame loop. Off for reduced motion.
let lenis = null;

function initSmoothScroll() {
  if (!window.Lenis) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const withScrollTrigger = window.gsap && window.ScrollTrigger;
  lenis = new Lenis({ autoRaf: !withScrollTrigger });
  if (withScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

/* ------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initNav();
  initFooter();
  initReveals();
  initCardGlow();
  initCardTilt();
  initDescToggles();
  initDescToggleUpdates();
  initLabelDecode();
});
