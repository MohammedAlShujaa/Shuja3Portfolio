/* Portfolio page: filters the projects by category in the browser, with no
   page reload.

   The server renders every card (see server/render.js), so the filter shows
   and hides those cards rather than redrawing them. That keeps each card the
   same element, which lets GSAP's Flip plugin slide the remaining cards into
   their new places while the others fade out and back in. Without GSAP, or for
   visitors who prefer reduced motion, the cards simply switch at once. */

let activeFilter = 'All';

const canAnimate = () =>
  window.gsap && window.Flip && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (window.gsap && window.Flip) gsap.registerPlugin(Flip);

function applyFilter({ animate = true } = {}) {
  const grid = document.querySelector('[data-projects]');
  const empty = document.querySelector('[data-empty]');
  const cards = [...grid.querySelectorAll('.card')];
  const matches = (card) => activeFilter === 'All' || card.dataset.category === activeFilter;

  const show = () => {
    cards.forEach((card) => { card.style.display = matches(card) ? '' : 'none'; });
    empty.hidden = cards.some(matches);
  };

  if (!animate || !canAnimate()) {
    show();
    // Clear anything an earlier animated filter left behind.
    cards.forEach((card) => { card.style.opacity = ''; card.style.visibility = ''; card.style.transform = ''; });
    return;
  }

  // Flip: record where every card is, change which are shown, then animate
  // each card from its old place to its new one. While they move the cards are
  // taken out of the layout, which would collapse the grid and pull the content
  // below up underneath them, so the grid's height is animated explicitly too.
  const state = Flip.getState(cards);
  const fromHeight = grid.offsetHeight;
  show();
  const toHeight = grid.offsetHeight;
  Flip.from(state, {
    duration: 0.6,
    ease: 'power3.inOut',
    absolute: true,
    nested: true,
    // The cards' CSS hover transition on transform would drag every frame of
    // the slide behind, so switch it off while they move.
    onStart: () => grid.classList.add('is-flipping'),
    onComplete: () => grid.classList.remove('is-flipping'),
    onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.45, delay: 0.1 }),
    onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.94, duration: 0.3 })
  });
  // Locked only after Flip.from() has measured the new layout, or the cards
  // would be measured squeezed into the old height.
  gsap.fromTo(grid, { height: fromHeight }, {
    height: toHeight,
    duration: 0.6,
    ease: 'power3.inOut',
    overwrite: true,
    clearProps: 'height'
  });
}

function initFilters() {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      if (pill.dataset.filter === activeFilter) return;
      activeFilter = pill.dataset.filter;
      pills.forEach((p) => p.setAttribute('aria-pressed', String(p === pill)));
      applyFilter();
    });
  });
}

// Only used when the server could not render the cards (for example the
// database was unreachable and the raw template was served).
async function renderAll() {
  const grid = document.querySelector('[data-projects]');
  const projects = await api('/api/projects');
  grid.innerHTML = '';
  projects.forEach((p) => grid.appendChild(projectCard(p)));
  initReveals();
}

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('[data-projects]');
  try {
    if (!document.querySelector('main[data-ssr]')) await renderAll();
    initFilters();

    // Deep links from the home page teaser, for example /portfolio?category=NLP%20%26%20Data.
    // Applied without animation, since the visitor has not done anything yet.
    const wanted = new URLSearchParams(location.search).get('category');
    const match = wanted && document.querySelector(`.filter-pill[data-filter="${CSS.escape(wanted)}"]`);
    if (match) {
      activeFilter = wanted;
      document.querySelectorAll('.filter-pill').forEach((p) => p.setAttribute('aria-pressed', String(p === match)));
    }
    applyFilter({ animate: false });
  } catch (err) {
    console.error('Could not load projects.', err);
    grid.innerHTML = '';
    grid.appendChild(el('p', 'state-msg', 'Projects could not be loaded. Please refresh the page.'));
  }
});
