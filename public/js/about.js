/* About page: the skills icon rows and the updates feed, both from the database. */

const GROUP_ORDER = ['Machine Learning & AI', 'Data & Analytics', 'Web & Apps', 'Foundations & Tools'];

// Tools without a Devicon glyph get an initials tile instead, so a row never
// shows a broken icon. Initials rather than a truncation, because "Power BI"
// cut to "POW" reads as a bug, and the full name already sits under the tile.
function monogramFor(name) {
  const initials = name
    .split(/[\s&/-]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2);
  return initials.toUpperCase();
}

function skillItem(skill) {
  const li = el('li', 'skill');

  if (skill.icon) {
    const icon = el('span', 'skill__icon');
    icon.classList.add(...skill.icon.split(/\s+/));
    icon.setAttribute('aria-hidden', 'true');
    li.appendChild(icon);
  } else {
    const mono = el('span', 'skill__monogram', monogramFor(skill.name));
    mono.setAttribute('aria-hidden', 'true');
    li.appendChild(mono);
  }

  li.appendChild(el('span', 'skill__name', skill.name));
  return li;
}

async function renderSkills() {
  const host = document.querySelector('[data-skills]');
  if (!host) return;

  const skills = await api('/api/skills');
  host.innerHTML = '';

  if (!skills.length) {
    host.appendChild(el('p', 'state-msg', 'No skills listed yet.'));
    return;
  }

  const groups = new Map();
  skills.forEach((s) => {
    if (!groups.has(s.group_name)) groups.set(s.group_name, []);
    groups.get(s.group_name).push(s);
  });

  // Known groups first in the designed order, then any group the admin added later.
  const names = [
    ...GROUP_ORDER.filter((g) => groups.has(g)),
    ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g))
  ];

  names.forEach((name) => {
    const section = el('div', 'skill-group fade-up');
    section.appendChild(el('h3', 'skill-group__label', name));
    const row = el('ul', 'skill-row');
    groups.get(name).forEach((s) => row.appendChild(skillItem(s)));
    section.appendChild(row);
    host.appendChild(section);
  });

  initReveals();
}

async function renderUpdates() {
  const list = document.querySelector('[data-updates]');
  if (!list) return;

  const updates = await api('/api/updates');
  list.innerHTML = '';

  if (!updates.length) {
    list.appendChild(el('p', 'state-msg', 'No updates posted yet.'));
    return;
  }

  updates.slice(0, 4).forEach((u) => {
    const li = el('li', 'update-item fade-up');
    const date = new Date(u.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    li.appendChild(el('p', 'update-item__meta', u.tag ? `${date} · ${u.tag}` : date));
    li.appendChild(el('h3', 'card__title', u.title));
    li.appendChild(el('p', null, u.body));
    list.appendChild(li);
  });

  initReveals();
}

async function renderAboutProfile() {
  const photo = document.querySelector('[data-about-photo]');
  if (!photo) return;
  const profile = await api('/api/profile');
  if (profile && profile.photo_url) photo.src = profile.photo_url;
  if (profile) photo.alt = `${profile.name}, portrait`;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([renderSkills(), renderUpdates(), renderAboutProfile()]);
  } catch (err) {
    console.error('Could not load the about page content.', err);
  }
});
