/* Modeling gallery: loads photos from /api/gallery, renders a masonry grid,
   filters by category, and opens a full-screen lightbox with keyboard nav. */

const CATEGORIES = ['All', 'Studio', 'Brand & Product', 'Casting', 'Editorial'];

let items = [];      // every photo from the database
let shown = [];      // the currently filtered subset (drives the lightbox)
let activeFilter = 'All';
let lightboxIndex = 0;

const $ = (sel) => document.querySelector(sel);

const make = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

async function loadGallery() {
  const res = await fetch('/api/gallery', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Could not load the gallery.');
  return res.json();
}

/* ----------------------------------------------------------- filters */

function buildFilters() {
  const host = $('[data-filters]');
  const present = new Set(items.map((i) => i.category));
  // Only show a category tab if there are photos in it (plus "All").
  const cats = CATEGORIES.filter((c) => c === 'All' || present.has(c));
  if (cats.length <= 2) return; // nothing to filter, hide the bar

  cats.forEach((c) => {
    const b = make('button', 'm-filter', c);
    b.type = 'button';
    b.dataset.cat = c;
    b.setAttribute('aria-pressed', String(c === 'All'));
    b.addEventListener('click', () => {
      activeFilter = c;
      host.querySelectorAll('.m-filter').forEach((x) =>
        x.setAttribute('aria-pressed', String(x === b)));
      renderGrid();
    });
    host.appendChild(b);
  });
}

/* -------------------------------------------------------------- grid */

function renderGrid() {
  const grid = $('[data-grid]');
  grid.innerHTML = '';

  shown = activeFilter === 'All' ? items : items.filter((i) => i.category === activeFilter);

  if (!shown.length) {
    grid.appendChild(make('p', 'm-empty', 'Photos coming soon.'));
    return;
  }

  shown.forEach((item, index) => {
    const fig = make('figure', 'm-item');
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', `Open ${item.title || 'photo'}`);

    const img = make('img');
    img.src = item.thumb_url || item.image_url;
    img.alt = item.title || 'Modeling photo';
    img.loading = 'lazy';
    fig.appendChild(img);

    if (item.title || item.credit) {
      const cap = make('figcaption', 'm-item__cap');
      if (item.title) cap.appendChild(make('div', 'm-item__title', item.title));
      if (item.credit) cap.appendChild(make('div', 'm-item__meta', item.credit));
      fig.appendChild(cap);
    }

    const open = () => openLightbox(index);
    fig.addEventListener('click', open);
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    grid.appendChild(fig);
  });

  revealOnScroll();
}

function revealOnScroll() {
  const nodes = document.querySelectorAll('.m-item');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  nodes.forEach((n) => obs.observe(n));
}

/* ---------------------------------------------------------- lightbox */

function openLightbox(index) {
  lightboxIndex = index;
  updateLightbox();
  const lb = $('[data-lightbox]');
  lb.dataset.open = 'true';
  document.body.style.overflow = 'hidden';
  $('.lb-close').focus();
}

function closeLightbox() {
  $('[data-lightbox]').dataset.open = 'false';
  document.body.style.overflow = '';
}

function step(delta) {
  lightboxIndex = (lightboxIndex + delta + shown.length) % shown.length;
  updateLightbox();
}

function updateLightbox() {
  const item = shown[lightboxIndex];
  if (!item) return;
  const img = $('[data-lightbox] img');
  img.src = item.image_url;
  img.alt = item.title || 'Modeling photo';
  const cap = $('[data-lightbox-cap]');
  cap.innerHTML = '';
  if (item.title) cap.appendChild(make('span', 't', item.title));
  if (item.credit) cap.appendChild(document.createTextNode(item.credit));
}

function initLightbox() {
  $('.lb-close').addEventListener('click', closeLightbox);
  $('.lb-prev').addEventListener('click', () => step(-1));
  $('.lb-next').addEventListener('click', () => step(1));
  $('[data-lightbox]').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLightbox(); // click the dark backdrop
  });
  document.addEventListener('keydown', (e) => {
    if ($('[data-lightbox]').dataset.open !== 'true') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
}

/* ------------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', async () => {
  initLightbox();
  try {
    items = await loadGallery();
    buildFilters();
    renderGrid();
  } catch (err) {
    console.error(err);
    $('[data-grid]').appendChild(make('p', 'm-empty', 'The gallery could not be loaded.'));
  }
});
