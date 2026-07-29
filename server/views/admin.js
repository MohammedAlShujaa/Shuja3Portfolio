/* Admin dashboard logic. Every write goes through /api/admin/*, which requires
   a signed-in session; a 401 sends the browser back to the login page. */

const CATEGORIES = ['Machine Learning', 'NLP & Data', 'Web Development'];
const SKILL_GROUPS = ['Machine Learning & AI', 'Data & Analytics', 'Web & Apps', 'Foundations & Tools'];
const PILL_CLASS = {
  'Machine Learning': 'pill--ml',
  'NLP & Data': 'pill--nlp',
  'Web Development': 'pill--web'
};

/* ---------------------------------------------------------- helpers */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};

async function api(path, options = {}) {
  const res = await fetch(`/api/admin${path}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options
  });

  if (res.status === 401) {
    location.href = '/admin/login';
    throw new Error('Session expired.');
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || `Request failed: ${res.status}`);
  return body;
}

const get = (path) => api(path);
const post = (path, data) => api(path, { method: 'POST', body: JSON.stringify(data) });
const put = (path, data) => api(path, { method: 'PUT', body: JSON.stringify(data) });
const del = (path) => api(path, { method: 'DELETE' });

let toastTimer;
function toast(message, kind = 'ok') {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.dataset.kind = kind;
  node.dataset.show = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.dataset.show = 'false'; }, 3200);
}

const fmtDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/* ------------------------------------------------------------- tabs */

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      panels.forEach((p) => {
        p.dataset.active = String(p.dataset.panel === tab.dataset.tab);
      });
    });
  });
}

/* --------------------------------------------------- editor dialog */

const dialog = document.getElementById('editor');
const editorForm = document.getElementById('editor-form');
const editorBody = document.getElementById('editor-body');
const editorTitle = document.getElementById('editor-title');
const editorError = document.getElementById('editor-error');

document.getElementById('editor-cancel').addEventListener('click', () => dialog.close('cancel'));

// Builds one labelled input from a small spec, so every editor form looks the same.
function buildField(spec) {
  const wrap = el('div', spec.type === 'checkbox' ? 'field field--check' : 'field');
  const id = `f-${spec.name}`;

  let input;
  if (spec.type === 'textarea') {
    input = el('textarea');
  } else if (spec.type === 'select') {
    input = el('select');
    (spec.options || []).forEach((opt) => {
      const o = el('option', null, opt);
      o.value = opt;
      input.appendChild(o);
    });
  } else {
    input = el('input');
    input.type = spec.type || 'text';
  }

  input.id = id;
  input.name = spec.name;
  if (spec.placeholder) input.placeholder = spec.placeholder;
  if (spec.required) input.required = true;

  if (spec.type === 'checkbox') input.checked = Boolean(spec.value);
  else input.value = spec.value === null || spec.value === undefined ? '' : spec.value;

  const label = el('label', null, spec.label);
  label.htmlFor = id;

  if (spec.type === 'checkbox') {
    wrap.appendChild(input);
    wrap.appendChild(label);
  } else {
    wrap.appendChild(label);
    wrap.appendChild(input);
  }

  if (spec.hint) wrap.appendChild(el('p', 'hint', spec.hint));
  return wrap;
}

/**
 * Opens the shared dialog and resolves with the form values, or null on cancel.
 * onSubmit receives the values and may throw to keep the dialog open with an error.
 */
function openEditor({ title, fields, onSubmit }) {
  editorTitle.textContent = title;
  editorError.textContent = '';
  editorBody.innerHTML = '';
  fields.forEach((f) => editorBody.appendChild(buildField(f)));

  const handler = async (e) => {
    e.preventDefault();
    editorError.textContent = '';

    const values = {};
    fields.forEach((f) => {
      const input = editorForm.elements[f.name];
      values[f.name] = f.type === 'checkbox' ? input.checked : input.value.trim();
    });

    const submitBtn = editorForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await onSubmit(values);
      dialog.close('saved');
    } catch (err) {
      editorError.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  };

  editorForm.addEventListener('submit', handler);
  dialog.addEventListener('close', () => editorForm.removeEventListener('submit', handler), { once: true });
  dialog.showModal();
}

const confirmDelete = (what) =>
  confirm(`Delete ${what}? This cannot be undone.`);

/* ---------------------------------------------------------- profile */

const profileForm = document.getElementById('profile-form');
let profileId = null;

function syncPhotoPreview() {
  const preview = document.getElementById('p-photo-preview');
  const url = document.getElementById('p-photo').value.trim();
  preview.hidden = !url;
  if (url) preview.src = url;
}

async function loadProfile() {
  const p = await get('/profile');
  if (!p) {
    toast('No profile row found. Run npm run seed.', 'error');
    return;
  }
  profileId = p.id;
  [
    ['p-name', 'name'], ['p-headline', 'headline'], ['p-subheading', 'subheading'],
    ['p-intro', 'intro'], ['p-photo', 'photo_url'],
    ['p-cta1-label', 'cta_primary_label'], ['p-cta1-href', 'cta_primary_href'],
    ['p-cta2-label', 'cta_secondary_label'], ['p-cta2-href', 'cta_secondary_href'],
    ['p-location', 'location'], ['p-resume', 'resume_url'], ['p-availability', 'availability']
  ].forEach(([id, key]) => {
    document.getElementById(id).value = p[key] || '';
  });
  syncPhotoPreview();
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = profileForm.querySelector('[data-error]');
  error.textContent = '';

  const data = Object.fromEntries(new FormData(profileForm).entries());
  try {
    await put('/profile', data);
    toast('Profile saved. The live site is already showing it.');
  } catch (err) {
    error.textContent = err.message;
  }
});

document.getElementById('p-photo').addEventListener('input', syncPhotoPreview);

/* ----------------------------------------------------------- upload */

async function uploadImage(file) {
  const data = new FormData();
  data.append('image', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: data });
  if (res.status === 401) {
    location.href = '/admin/login';
    throw new Error('Session expired.');
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Upload failed.');
  return body.url;
}

// Wires the "Upload an image" button on the profile form to the hidden file input.
document.querySelectorAll('[data-upload-for]').forEach((button) => {
  const target = document.getElementById(button.dataset.uploadFor);
  const fileInput = document.getElementById(`${button.dataset.uploadFor}-file`);
  button.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;
    button.disabled = true;
    try {
      target.value = await uploadImage(fileInput.files[0]);
      syncPhotoPreview();
      toast('Image uploaded. Remember to save.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
      fileInput.value = '';
    }
  });
});

/* --------------------------------------------------------- projects */

const projectFields = (p = {}) => [
  { name: 'title', label: 'Title', value: p.title, required: true },
  { name: 'description', label: 'Description', type: 'textarea', value: p.description, required: true },
  { name: 'category', label: 'Category', type: 'select', options: CATEGORIES, value: p.category || CATEGORIES[0] },
  { name: 'tech_tags', label: 'Tech tags', value: p.tech_tags, hint: 'Separate with commas, for example: Python, NLTK, t-SNE' },
  { name: 'thumbnail_url', label: 'Thumbnail URL', value: p.thumbnail_url, hint: 'Paste an image URL, or a path such as /uploads/shot.png' },
  { name: 'github_url', label: 'GitHub URL', value: p.github_url, hint: 'Leave empty if there is no public repository. Empty means no link is shown, never a dead one.' },
  { name: 'live_url', label: 'Live demo URL', value: p.live_url, hint: 'For example a Streamlit or Gradio demo on Hugging Face Spaces.' },
  { name: 'featured', label: 'Featured (shown on the home page)', type: 'checkbox', value: p.featured },
  { name: 'sort_order', label: 'Sort order', type: 'number', value: p.sort_order ?? 0 }
];

async function loadProjects() {
  const host = document.getElementById('projects-list');
  const projects = await get('/projects');
  host.innerHTML = '';

  if (!projects.length) {
    host.appendChild(el('p', 'muted', 'No projects yet. Add your first one.'));
    return;
  }

  projects.forEach((p) => {
    const card = el('div', 'card');
    const row = el('div', 'card__row');

    const left = el('div');
    const meta = el('div');
    meta.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;';
    meta.appendChild(el('span', `pill ${PILL_CLASS[p.category] || ''}`, p.category));
    if (p.featured) meta.appendChild(el('span', 'pill pill--featured', 'Featured'));
    left.appendChild(meta);
    left.appendChild(el('h3', null, p.title));
    left.appendChild(el('p', 'muted', p.description.length > 150 ? `${p.description.slice(0, 147)}...` : p.description));
    left.appendChild(el('p', 'mono', `sort ${p.sort_order} · ${p.tech_tags || 'no tags'}`));

    const right = el('div', 'btn-row');
    const edit = el('button', 'btn btn--ghost btn--sm', 'Edit');
    edit.addEventListener('click', () => {
      openEditor({
        title: 'Edit project',
        fields: projectFields(p),
        onSubmit: async (values) => {
          await put(`/projects/${p.id}`, values);
          toast('Project saved.');
          await loadProjects();
        }
      });
    });
    const remove = el('button', 'btn btn--danger btn--sm', 'Delete');
    remove.addEventListener('click', async () => {
      if (!confirmDelete(`the project "${p.title}"`)) return;
      try {
        await del(`/projects/${p.id}`);
        toast('Project deleted.');
        await loadProjects();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    right.appendChild(edit);
    right.appendChild(remove);

    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
    host.appendChild(card);
  });
}

document.getElementById('add-project').addEventListener('click', () => {
  openEditor({
    title: 'Add project',
    fields: projectFields({ sort_order: 99 }),
    onSubmit: async (values) => {
      await post('/projects', values);
      toast('Project added.');
      await loadProjects();
    }
  });
});

/* ----------------------------------------------------------- skills */

const skillFields = (s = {}) => [
  { name: 'name', label: 'Name', value: s.name, required: true },
  { name: 'group_name', label: 'Group', type: 'select', options: SKILL_GROUPS, value: s.group_name || SKILL_GROUPS[0] },
  {
    name: 'icon',
    label: 'Devicon class (optional)',
    value: s.icon,
    hint: 'For example devicon-python-plain. Leave empty to show a monogram tile instead.'
  },
  { name: 'sort_order', label: 'Sort order', type: 'number', value: s.sort_order ?? 0 }
];

async function loadSkills() {
  const host = document.getElementById('skills-list');
  const skills = await get('/skills');
  host.innerHTML = '';

  if (!skills.length) {
    host.appendChild(el('p', 'muted', 'No skills yet.'));
    return;
  }

  const groups = new Map();
  skills.forEach((s) => {
    if (!groups.has(s.group_name)) groups.set(s.group_name, []);
    groups.get(s.group_name).push(s);
  });

  const names = [
    ...SKILL_GROUPS.filter((g) => groups.has(g)),
    ...[...groups.keys()].filter((g) => !SKILL_GROUPS.includes(g))
  ];

  names.forEach((group) => {
    const block = el('div', 'card skill-group-block');
    block.appendChild(el('h3', null, group));
    const items = groups.get(group);

    items.forEach((s, index) => {
      const row = el('div', 'list-row');

      const left = el('div');
      left.appendChild(el('strong', null, s.name));
      left.appendChild(el('p', 'mono', s.icon || 'monogram fallback'));

      const right = el('div', 'btn-row');

      // Reordering swaps sort_order with the neighbour inside the same group.
      const move = async (offset) => {
        const other = items[index + offset];
        if (!other) return;
        try {
          await put(`/skills/${s.id}`, { ...s, sort_order: other.sort_order });
          await put(`/skills/${other.id}`, { ...other, sort_order: s.sort_order });
          await loadSkills();
        } catch (err) {
          toast(err.message, 'error');
        }
      };

      const up = el('button', 'btn btn--ghost btn--sm', 'Up');
      up.disabled = index === 0;
      up.addEventListener('click', () => move(-1));

      const down = el('button', 'btn btn--ghost btn--sm', 'Down');
      down.disabled = index === items.length - 1;
      down.addEventListener('click', () => move(1));

      const edit = el('button', 'btn btn--ghost btn--sm', 'Edit');
      edit.addEventListener('click', () => {
        openEditor({
          title: 'Edit skill',
          fields: skillFields(s),
          onSubmit: async (values) => {
            await put(`/skills/${s.id}`, values);
            toast('Skill saved.');
            await loadSkills();
          }
        });
      });

      const remove = el('button', 'btn btn--danger btn--sm', 'Delete');
      remove.addEventListener('click', async () => {
        if (!confirmDelete(`the skill "${s.name}"`)) return;
        try {
          await del(`/skills/${s.id}`);
          toast('Skill deleted.');
          await loadSkills();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      [up, down, edit, remove].forEach((b) => right.appendChild(b));
      row.appendChild(left);
      row.appendChild(right);
      block.appendChild(row);
    });

    host.appendChild(block);
  });
}

document.getElementById('add-skill').addEventListener('click', () => {
  openEditor({
    title: 'Add skill',
    fields: skillFields({ sort_order: 99 }),
    onSubmit: async (values) => {
      await post('/skills', values);
      toast('Skill added.');
      await loadSkills();
    }
  });
});

/* ---------------------------------------------------------- updates */

const updateFields = (u = {}) => [
  { name: 'title', label: 'Title', value: u.title, required: true },
  { name: 'body', label: 'Body', type: 'textarea', value: u.body, required: true },
  {
    name: 'date',
    label: 'Date',
    type: 'date',
    value: u.date ? String(u.date).slice(0, 10) : new Date().toISOString().slice(0, 10)
  },
  { name: 'tag', label: 'Tag', value: u.tag, hint: 'For example Site, Research, or Learning.' }
];

async function loadUpdates() {
  const host = document.getElementById('updates-list');
  const updates = await get('/updates');
  host.innerHTML = '';

  if (!updates.length) {
    host.appendChild(el('p', 'muted', 'No updates yet. Post your first one.'));
    return;
  }

  updates.forEach((u) => {
    const card = el('div', 'card');
    const row = el('div', 'card__row');

    const left = el('div');
    left.appendChild(el('p', 'mono', u.tag ? `${fmtDate(u.date)} · ${u.tag}` : fmtDate(u.date)));
    left.appendChild(el('h3', null, u.title));
    left.appendChild(el('p', 'muted', u.body));

    const right = el('div', 'btn-row');
    const edit = el('button', 'btn btn--ghost btn--sm', 'Edit');
    edit.addEventListener('click', () => {
      openEditor({
        title: 'Edit update',
        fields: updateFields(u),
        onSubmit: async (values) => {
          await put(`/updates/${u.id}`, values);
          toast('Update saved.');
          await loadUpdates();
        }
      });
    });
    const remove = el('button', 'btn btn--danger btn--sm', 'Delete');
    remove.addEventListener('click', async () => {
      if (!confirmDelete(`the update "${u.title}"`)) return;
      try {
        await del(`/updates/${u.id}`);
        toast('Update deleted.');
        await loadUpdates();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    right.appendChild(edit);
    right.appendChild(remove);

    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
    host.appendChild(card);
  });
}

document.getElementById('add-update').addEventListener('click', () => {
  openEditor({
    title: 'Add update',
    fields: updateFields(),
    onSubmit: async (values) => {
      await post('/updates', values);
      toast('Update posted.');
      await loadUpdates();
    }
  });
});

/* ---------------------------------------------------------- socials */

const socialFields = (s = {}) => [
  { name: 'platform', label: 'Platform', value: s.platform, required: true, hint: 'For example GitHub, LinkedIn, or Email.' },
  { name: 'url', label: 'URL', value: s.url, required: true, hint: 'Use mailto:you@example.com for email.' },
  { name: 'icon', label: 'Icon name (optional)', value: s.icon }
];

async function loadSocials() {
  const host = document.getElementById('socials-list');
  const socials = await get('/socials');
  host.innerHTML = '';

  if (!socials.length) {
    host.appendChild(el('p', 'muted', 'No social links yet.'));
    return;
  }

  const card = el('div', 'card');
  socials.forEach((s) => {
    const row = el('div', 'list-row');

    const left = el('div');
    left.appendChild(el('strong', null, s.platform));
    left.appendChild(el('p', 'mono', s.url));

    const right = el('div', 'btn-row');
    const edit = el('button', 'btn btn--ghost btn--sm', 'Edit');
    edit.addEventListener('click', () => {
      openEditor({
        title: 'Edit social link',
        fields: socialFields(s),
        onSubmit: async (values) => {
          await put(`/socials/${s.id}`, values);
          toast('Link saved.');
          await loadSocials();
        }
      });
    });
    const remove = el('button', 'btn btn--danger btn--sm', 'Delete');
    remove.addEventListener('click', async () => {
      if (!confirmDelete(`the ${s.platform} link`)) return;
      try {
        await del(`/socials/${s.id}`);
        toast('Link deleted.');
        await loadSocials();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    right.appendChild(edit);
    right.appendChild(remove);

    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
  });
  host.appendChild(card);
}

document.getElementById('add-social').addEventListener('click', () => {
  openEditor({
    title: 'Add social link',
    fields: socialFields(),
    onSubmit: async (values) => {
      await post('/socials', values);
      toast('Link added.');
      await loadSocials();
    }
  });
});

/* --------------------------------------------------------- messages */

async function refreshUnreadBadge() {
  const badge = document.getElementById('unread-badge');
  try {
    const { count } = await get('/messages/unread-count');
    badge.hidden = count === 0;
    badge.textContent = String(count);
  } catch {
    badge.hidden = true;
  }
}

async function loadMessages() {
  const host = document.getElementById('messages-list');
  const messages = await get('/messages');
  host.innerHTML = '';

  if (!messages.length) {
    host.appendChild(el('p', 'muted', 'No messages yet.'));
    return;
  }

  messages.forEach((m) => {
    const card = el('div', 'card');
    const row = el('div', 'card__row');

    const left = el('div');
    left.style.flex = '1';
    const head = el('div');
    head.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    head.appendChild(el('strong', null, m.name));
    if (!m.is_read) head.appendChild(el('span', 'pill pill--unread', 'New'));
    left.appendChild(head);

    const mail = el('a', 'mono', m.email);
    mail.href = `mailto:${m.email}`;
    left.appendChild(mail);
    left.appendChild(el('p', 'mono', new Date(m.created_at).toLocaleString('en-GB')));
    left.appendChild(el('p', 'msg-body', m.message));

    const right = el('div', 'btn-row');
    const toggle = el('button', 'btn btn--ghost btn--sm', m.is_read ? 'Mark unread' : 'Mark read');
    toggle.addEventListener('click', async () => {
      try {
        await put(`/messages/${m.id}/read`, { is_read: !m.is_read });
        await Promise.all([loadMessages(), refreshUnreadBadge()]);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    const remove = el('button', 'btn btn--danger btn--sm', 'Delete');
    remove.addEventListener('click', async () => {
      if (!confirmDelete(`the message from ${m.name}`)) return;
      try {
        await del(`/messages/${m.id}`);
        toast('Message deleted.');
        await Promise.all([loadMessages(), refreshUnreadBadge()]);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    right.appendChild(toggle);
    right.appendChild(remove);

    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
    host.appendChild(card);
  });
}

/* ----------------------------------------------------------- logout */

document.getElementById('logout').addEventListener('click', async () => {
  try {
    await post('/logout', {});
  } finally {
    location.href = '/admin/login';
  }
});

/* ------------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  try {
    await Promise.all([
      loadProfile(), loadProjects(), loadSkills(),
      loadUpdates(), loadSocials(), loadMessages(), refreshUnreadBadge()
    ]);
  } catch (err) {
    toast(err.message, 'error');
  }
});
