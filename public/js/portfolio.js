/* Portfolio page: renders every project from the database and filters them
   by category in the browser, with no page reload. */

let allProjects = [];
let activeFilter = 'All';

function applyFilter() {
  const grid = document.querySelector('[data-projects]');
  const empty = document.querySelector('[data-empty]');

  const shown =
    activeFilter === 'All'
      ? allProjects
      : allProjects.filter((p) => p.category === activeFilter);

  grid.innerHTML = '';
  shown.forEach((p) => grid.appendChild(projectCard(p)));

  empty.hidden = shown.length > 0;
  initReveals();
}

function initFilters() {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      activeFilter = pill.dataset.filter;
      pills.forEach((p) => p.setAttribute('aria-pressed', String(p === pill)));
      applyFilter();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('[data-projects]');
  try {
    allProjects = await api('/api/projects');
    initFilters();

    // Deep links from the home page teaser, for example portfolio.html?category=NLP%20%26%20Data
    const wanted = new URLSearchParams(location.search).get('category');
    const match = wanted && document.querySelector(`.filter-pill[data-filter="${CSS.escape(wanted)}"]`);
    if (match) match.click();
    else applyFilter();
  } catch (err) {
    console.error('Could not load projects.', err);
    grid.innerHTML = '';
    grid.appendChild(el('p', 'state-msg', 'Projects could not be loaded. Please refresh the page.'));
  }
});
