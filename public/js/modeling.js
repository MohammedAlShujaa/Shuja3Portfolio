/* Modeling page: a model book.

   Loads the photos from /api/gallery and builds the page from them:
   - the cover: the first featured photo between the two lines of the name;
   - the comp card's "Available for", from the categories actually used;
   - the book: every look, large and numbered. On wide screens, scrolling down
     pins the section and turns its pages sideways, each photo drifting a
     little inside its frame; on phones, and for reduced motion, it is a row
     to swipe;
   - the index: a contact sheet of every photo, filterable by category;
   - the booking email, from the Email link in the admin's social links.
   Any photo opens full screen, with arrow keys to move between them.

   Motion uses GSAP (vendored in /vendor/gsap/) and Lenis for smooth
   scrolling, both driven by GSAP's ticker so the pinned book stays in step. */

const CATEGORIES = ['All', 'Studio', 'Brand & Product', 'Casting', 'Editorial'];

let items = [];          // every photo from the database, in book order
let shown = [];          // the index's current filtered subset
let activeFilter = 'All';
let viewerSet = [];      // the photos the viewer steps through
let viewerIndex = 0;

const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = () => window.gsap && window.ScrollTrigger;

const make = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Could not load ${url}.`);
  return res.json();
}

// The page shows the intro only once everything is in place (see the inline
// script in modeling.html, which hides the name until then).
const revealPage = () => document.documentElement.classList.remove('mb-intro');

/* ------------------------------------------------------- cover and card */

function renderCover() {
  const cover = items.find((i) => i.featured) || items[0];
  if (!cover) return null;
  const fig = $('[data-cover]');
  const img = fig.querySelector('img');
  img.src = cover.image_url;
  img.alt = cover.title ? `${cover.title}, Mohammed Al-Shujaa` : 'Mohammed Al-Shujaa';
  fig.hidden = false;
  return fig;
}

function renderAvailable() {
  const present = CATEGORIES.slice(1).filter((c) => items.some((i) => i.category === c));
  if (present.length) $('[data-available]').textContent = present.join(', ');
}

async function renderEmail() {
  try {
    const socials = await getJSON('/api/socials');
    const email = socials.find((s) => /^mailto:/i.test(s.url || ''));
    if (email) $('[data-email]').href = email.url;
  } catch {
    // Keeps the link to the contact page.
  }
}

/* ------------------------------------------------------------ the book */

function renderBook() {
  const track = $('[data-track]');
  track.innerHTML = '';
  if (!items.length) {
    track.appendChild(make('li', 'mb-empty', 'Photos coming soon.'));
    return;
  }
  $('[data-count]').textContent = `${pad(items.length)} looks`;

  items.forEach((item, i) => {
    const li = make('li', 'mb-look');
    const title = item.title || `Look ${pad(i + 1)}`;

    const frame = make('button', 'mb-look__frame');
    frame.type = 'button';
    frame.setAttribute('aria-label', `Open look ${pad(i + 1)}, ${title}, full screen`);
    const img = make('img');
    img.src = item.image_url;
    img.alt = title;
    img.decoding = 'async';
    frame.appendChild(img);
    frame.addEventListener('click', () => openViewer(items, i));
    li.appendChild(frame);

    const cap = make('div', 'mb-look__caption');
    const no = make('span', 'mb-look__no', pad(i + 1));
    no.appendChild(make('small', null, ` / ${pad(items.length)}`));
    cap.appendChild(no);
    const text = make('div');
    text.appendChild(make('div', 'mb-look__title', title));
    text.appendChild(make('div', 'mb-look__meta', item.credit ? `${item.category}, ${item.credit}` : item.category));
    cap.appendChild(text);
    li.appendChild(cap);

    track.appendChild(li);
  });

  // In the swipe row (no pinning), the progress line follows the swipe.
  const viewport = $('.mb-book__viewport');
  const bar = $('[data-progress]');
  viewport.addEventListener('scroll', () => {
    if ($('[data-book]').classList.contains('is-pinned')) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    bar.style.transform = `scaleX(${max > 0 ? viewport.scrollLeft / max : 0})`;
  }, { passive: true });
}

/* ----------------------------------------------------------- the index */

function buildFilters() {
  const host = $('[data-filters]');
  const present = new Set(items.map((i) => i.category));
  // Only show a category if it has photos (plus "All").
  const cats = CATEGORIES.filter((c) => c === 'All' || present.has(c));
  if (cats.length <= 2) return; // nothing to filter

  cats.forEach((c) => {
    const b = make('button', 'mb-filter', c);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(c === 'All'));
    b.addEventListener('click', () => {
      activeFilter = c;
      host.querySelectorAll('.mb-filter').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderSheet();
    });
    host.appendChild(b);
  });
}

function renderSheet() {
  const sheet = $('[data-grid]');
  sheet.innerHTML = '';
  shown = activeFilter === 'All' ? items : items.filter((i) => i.category === activeFilter);

  if (!shown.length) {
    sheet.appendChild(make('p', 'mb-empty', 'Photos coming soon.'));
    return;
  }

  shown.forEach((item, i) => {
    const n = items.indexOf(item) + 1; // the same number as in the book
    const btn = make('button', 'mb-sheet__item');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Open look ${pad(n)}, ${item.title || item.category}, full screen`);

    const frame = make('div', 'mb-sheet__img');
    const img = make('img');
    img.src = item.thumb_url || item.image_url;
    img.alt = '';
    img.loading = 'lazy';
    frame.appendChild(img);
    btn.appendChild(frame);

    const label = make('div', 'mb-sheet__no');
    label.appendChild(make('b', null, pad(n)));
    label.appendChild(make('span', null, item.category));
    btn.appendChild(label);

    btn.addEventListener('click', () => openViewer(shown, i));
    sheet.appendChild(btn);
  });

  revealSheet();
}

function revealSheet() {
  const nodes = document.querySelectorAll('.mb-sheet__item');
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, k) => {
      if (!e.isIntersecting) return;
      e.target.style.transitionDelay = `${(k % 6) * 60}ms`;
      e.target.classList.add('is-in');
      obs.unobserve(e.target);
    });
  }, { threshold: 0.1 });
  nodes.forEach((n) => obs.observe(n));
}

/* ------------------------------------------------------ smooth scroll */

// Lenis smooths mouse-wheel and trackpad scrolling, as on the rest of the
// site; touch screens keep native scrolling. Off for reduced motion. Paused
// while the viewer covers the page.
let lenis = null;

function initSmoothScroll() {
  if (!window.Lenis || reduceMotion()) return;
  lenis = new Lenis({ autoRaf: !hasGsap() });
  if (hasGsap()) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

/* ------------------------------------------------------------- motion */

function initMotion(coverFig) {
  if (!hasGsap()) return;
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Cover: the name rises into place and the photo uncovers upward.
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.mb-name__line', { yPercent: 40, autoAlpha: 0, duration: 1.3, stagger: 0.12 }, 0);
    if (coverFig) {
      tl.fromTo(coverFig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4 }, 0.2);
      tl.from(coverFig.querySelector('img'), { scale: 1.25, duration: 1.8 }, 0.2);
    }
    tl.from('.mb-cover__note', { autoAlpha: 0, duration: 0.8 }, 0.8);

    // Scrolling away from the cover: the two lines drift apart and the
    // photo slides up slower than the page.
    const away = { trigger: '.mb-cover', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.mb-name__line--first', { xPercent: -8, ease: 'none', scrollTrigger: away });
    gsap.to('.mb-name__line--last', { xPercent: 8, ease: 'none', scrollTrigger: away });
    if (coverFig) gsap.to(coverFig.querySelector('img'), { yPercent: 10, ease: 'none', scrollTrigger: away });
  });

  // The book turns its pages sideways while you scroll down (wide screens).
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 701px)', () => {
    const book = $('[data-book]');
    const track = $('[data-track]');
    const bar = $('[data-progress]');
    if (items.length < 2) return undefined;

    book.classList.add('is-pinned');
    const distance = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    const pages = gsap.to(track, {
      x: () => -distance(),
      ease: 'none', // required: keeps scroll and page position in step
      scrollTrigger: {
        trigger: book,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; }
      }
    });

    // Each photo drifts across its frame as its page passes.
    track.querySelectorAll('.mb-look__frame img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -6 }, {
        xPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, containerAnimation: pages, start: 'left right', end: 'right left', scrub: true }
      });
    });

    // Keyboard: tabbing to a look that is off screen turns the book to it.
    // The track moves 1px for every 1px scrolled, so scroll by its offset.
    const onFocus = (e) => {
      const look = e.target.closest('.mb-look');
      if (!look) return;
      const r = look.getBoundingClientRect();
      const gutter = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      if (r.left >= 0 && r.right <= window.innerWidth) return;
      const y = window.scrollY + (r.left - gutter);
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    };
    track.addEventListener('focusin', onFocus);

    return () => {
      track.removeEventListener('focusin', onFocus);
      book.classList.remove('is-pinned');
      bar.style.transform = '';
    };
  });

  // Images and fonts change sizes after load; recompute the scroll positions.
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* ------------------------------------------------------------- viewer */

function openViewer(set, index) {
  viewerSet = set;
  viewerIndex = index;
  updateViewer();
  $('[data-lightbox]').dataset.open = 'true';
  document.body.style.overflow = 'hidden';
  if (lenis) lenis.stop();
  $('.lb-close').focus();
}

function closeViewer() {
  $('[data-lightbox]').dataset.open = 'false';
  document.body.style.overflow = '';
  if (lenis) lenis.start();
}

function step(delta) {
  viewerIndex = (viewerIndex + delta + viewerSet.length) % viewerSet.length;
  updateViewer();
}

function updateViewer() {
  const item = viewerSet[viewerIndex];
  if (!item) return;
  const img = $('[data-lightbox] img');
  img.src = item.image_url;
  img.alt = item.title || 'Modeling photo';
  const cap = $('[data-lightbox-cap]');
  cap.innerHTML = '';
  cap.appendChild(make('span', 't', `${pad(items.indexOf(item) + 1)}  ${item.title || item.category}`));
  if (item.credit) cap.appendChild(document.createTextNode(item.credit));
}

function initViewer() {
  $('.lb-close').addEventListener('click', closeViewer);
  $('.lb-prev').addEventListener('click', () => step(-1));
  $('.lb-next').addEventListener('click', () => step(1));
  $('[data-lightbox]').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeViewer(); // click on the dark backdrop
  });
  document.addEventListener('keydown', (e) => {
    if ($('[data-lightbox]').dataset.open !== 'true') return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
}

/* --------------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', async () => {
  initSmoothScroll();
  initViewer();
  renderEmail();
  let coverFig = null;
  try {
    items = await getJSON('/api/gallery');
    coverFig = renderCover();
    renderAvailable();
    renderBook();
    buildFilters();
    renderSheet();
  } catch (err) {
    console.error(err);
    $('[data-track]').innerHTML = '';
    $('[data-track]').appendChild(make('li', 'mb-empty', 'The photos could not be loaded.'));
  }
  initMotion(coverFig);
  revealPage();
});
