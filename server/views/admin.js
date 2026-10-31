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

/* --------------------------------------- browser-side image resizing ---
   Shrinks a photo in the browser before upload, so a 15 MB original becomes a
   small web image and stays under the serverless request size limit. */

async function loadBitmap(file) {
  // imageOrientation respects the camera rotation stored in the photo's EXIF.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function resizeToLongEdge(file, maxEdge, quality) {
  const bmp = await loadBitmap(file);
  const scale = Math.min(maxEdge / Math.max(bmp.width, bmp.height), 1);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  return canvasToJpeg(canvas, quality);
}

async function makeSquareThumb(file, size, quality) {
  const bmp = await loadBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2;
  const sy = (bmp.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
  return canvasToJpeg(canvas, quality);
}

// Sends a multipart form to an admin route and returns the JSON reply.
async function postForm(path, formData) {
  const res = await fetch(`/api/admin${path}`, { method: 'POST', body: formData });
  if (res.status === 401) {
    location.href = '/admin/login';
    throw new Error('Session expired.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || 'Upload failed.');
  return body;
}

// Resizing needs the browser to read the photo; some formats (such as HEIC from
// a phone, outside Safari) it cannot, so say what to do instead.
async function readable(work) {
  try {
    return await work();
  } catch {
    const err = new Error('This photo could not be read. Please use a JPG, PNG or WebP image.');
    err.unreadable = true;
    throw err;
  }
}

// Uploads one image (shrunk in the browser first) and returns its URL, /media/<id>.
async function uploadMedia(file, maxEdge = 1600) {
  const blob = await readable(() => resizeToLongEdge(file, maxEdge, 0.85));
  const fd = new FormData();
  fd.append('image', blob, 'image.jpg');
  const { url } = await postForm('/media', fd);
  return url;
}

// Builds one labelled input from a small spec, so every editor form looks the same.
function buildField(spec) {
  // A file picker that resizes and uploads the image, then fills in the URL field
  // named by spec.target.
  if (spec.type === 'upload') {
    const wrap = el('div', 'field');
    const id = `f-${spec.name}`;
    const label = el('label', null, spec.label);
    label.htmlFor = id;

    const input = el('input');
    input.type = 'file';
    input.id = id;
    input.accept = 'image/*';

    const status = el('p', 'hint', '');
    const preview = el('img', 'thumb-preview');
    preview.hidden = true;

    input.addEventListener('change', async () => {
      if (!input.files.length) return;
      const file = input.files[0];
      status.textContent = 'Resizing and uploading, please wait ...';
      input.disabled = true;
      try {
        const url = await uploadMedia(file, spec.maxEdge || 1600);
        if (editorForm.elements[spec.target]) editorForm.elements[spec.target].value = url;
        preview.src = url;
        preview.hidden = false;
        status.textContent = 'Uploaded. Save to keep it.';
      } catch (err) {
        status.textContent = err.message;
      } finally {
        input.disabled = false;
      }
    });

    label.appendChild(input);
    wrap.appendChild(label);
    if (spec.hint) wrap.appendChild(el('p', 'hint', spec.hint));
    wrap.appendChild(status);
    wrap.appendChild(preview);
    return wrap;
  }

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
      if (f.type === 'upload') return; // a control, not a saved value
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

// Wires the "Upload from device" button on the profile form to the hidden file input.
document.querySelectorAll('[data-upload-for]').forEach((button) => {
  const target = document.getElementById(button.dataset.uploadFor);
  const fileInput = document.getElementById(`${button.dataset.uploadFor}-file`);
  button.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;
    button.disabled = true;
    button.textContent = 'Uploading ...';
    try {
      target.value = await uploadMedia(fileInput.files[0], 1200);
      syncPhotoPreview();
      toast('Photo uploaded. Save the profile to use it.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Upload from device';
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
  { name: '_thumb_upload', type: 'upload', target: 'thumbnail_url', maxEdge: 1600, label: 'Upload a thumbnail from your device', hint: 'A screenshot or image of the project. It is resized for you and fills in the field below.' },
  { name: 'thumbnail_url', label: 'Thumbnail URL', value: p.thumbnail_url, hint: 'Filled in by the upload above, or paste an image URL.' },
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

/* ----------------------------------------------------------- photos */

// The model book's photos, managed as a grid in book order: drop or pick many
// photos at once; edit title, category and credit in place (saved as you type);
// star the cover; drag or use the arrows to reorder; delete.

const GALLERY_CATEGORIES = ['Studio', 'Brand & Product', 'Casting', 'Editorial'];
const pad2 = (n) => String(n).padStart(2, '0');
let photos = [];

const photoHost = document.getElementById('gallery-list');
const photoQueue = document.getElementById('photo-queue');
const photoCategory = document.getElementById('photo-category');
GALLERY_CATEGORIES.forEach((c) => photoCategory.appendChild(Object.assign(el('option', null, c), { value: c })));

async function loadGallery() {
  photos = await get('/gallery');
  renderPhotos();
}

function renderPhotos() {
  photoHost.innerHTML = '';
  if (!photos.length) {
    photoHost.appendChild(el('p', 'muted', 'No photos yet. Drop some above to start the book.'));
    return;
  }
  photos.forEach((g, i) => photoHost.appendChild(photoTile(g, i)));
}

// Saves the order shown in `photos` (first to last).
async function saveOrder() {
  try {
    await put('/gallery/order', { ids: photos.map((p) => p.id) });
    photos.forEach((p, i) => { p.sort_order = i + 1; });
  } catch (err) {
    toast(err.message, 'error');
    await loadGallery();
  }
}

function move(index, delta) {
  const to = index + delta;
  if (to < 0 || to >= photos.length) return;
  [photos[index], photos[to]] = [photos[to], photos[index]];
  renderPhotos();
  photoHost.querySelectorAll('.photo')[to].querySelector(delta < 0 ? '[data-move="-1"]' : '[data-move="1"]').focus();
  saveOrder();
}

function photoTile(g, index) {
  const tile = el('article', 'photo');
  tile.draggable = true;
  tile.dataset.id = g.id;

  // The picture, its book number, and the cover star.
  const pic = el('div', 'photo__pic');
  const img = el('img');
  img.src = g.thumb_url || g.image_url;
  img.alt = '';
  img.loading = 'lazy';
  img.draggable = false;
  pic.appendChild(img);
  pic.appendChild(el('span', 'photo__no', pad2(index + 1)));

  const star = el('button', 'photo__star', g.featured ? '★' : '☆');
  star.type = 'button';
  star.setAttribute('aria-pressed', String(Boolean(g.featured)));
  star.setAttribute('aria-label', g.featured ? 'This is the cover' : 'Make this the cover');
  star.title = g.featured ? 'This is the cover' : 'Make this the cover';
  star.addEventListener('click', async () => {
    try {
      await put(`/gallery/${g.id}/cover`, {});
      photos.forEach((p) => { p.featured = p.id === g.id; });
      renderPhotos();
      toast('Cover changed.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  pic.appendChild(star);
  if (g.featured) pic.appendChild(el('span', 'photo__cover', 'Cover'));
  tile.appendChild(pic);

  // Title, category and credit, saved a moment after you stop typing.
  const fields = el('div', 'photo__fields');
  const status = el('span', 'photo__status', '');
  let timer;
  const save = () => {
    clearTimeout(timer);
    status.textContent = 'Saving ...';
    timer = setTimeout(async () => {
      try {
        const updated = await put(`/gallery/${g.id}`, { ...g, title: title.value.trim(), category: category.value, credit: credit.value.trim() });
        Object.assign(g, updated);
        status.textContent = 'Saved';
      } catch (err) {
        status.textContent = '';
        toast(err.message, 'error');
      }
    }, 600);
  };

  const title = el('input');
  title.type = 'text';
  title.value = g.title || '';
  title.placeholder = `Look ${pad2(index + 1)}`;
  title.setAttribute('aria-label', 'Title');
  title.addEventListener('input', save);

  const category = el('select');
  category.setAttribute('aria-label', 'Category');
  GALLERY_CATEGORIES.forEach((c) => category.appendChild(Object.assign(el('option', null, c), { value: c })));
  category.value = g.category;
  category.addEventListener('change', save);

  const credit = el('input');
  credit.type = 'text';
  credit.value = g.credit || '';
  credit.placeholder = 'Credit (optional)';
  credit.setAttribute('aria-label', 'Credit');
  credit.addEventListener('input', save);

  fields.append(title, category, credit);
  tile.appendChild(fields);

  // Move earlier or later, and delete.
  const actions = el('div', 'photo__actions');
  const left = el('button', 'icon-btn', '←');
  left.type = 'button';
  left.dataset.move = '-1';
  left.setAttribute('aria-label', 'Move earlier');
  left.disabled = index === 0;
  left.addEventListener('click', () => move(index, -1));
  const right = el('button', 'icon-btn', '→');
  right.type = 'button';
  right.dataset.move = '1';
  right.setAttribute('aria-label', 'Move later');
  right.disabled = index === photos.length - 1;
  right.addEventListener('click', () => move(index, 1));
  const remove = el('button', 'icon-btn icon-btn--danger', 'Delete');
  remove.type = 'button';
  remove.addEventListener('click', async () => {
    if (!confirmDelete(`look ${pad2(index + 1)}${g.title ? ` (${g.title})` : ''}`)) return;
    try {
      await del(`/gallery/${g.id}`);
      photos = photos.filter((p) => p.id !== g.id);
      renderPhotos();
      toast('Photo deleted.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  actions.append(left, right, status, remove);
  tile.appendChild(actions);

  // Drag to reorder (mouse; the arrows do the same on touch screens).
  tile.addEventListener('dragstart', (e) => {
    tile.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(g.id));
  });
  tile.addEventListener('dragend', () => {
    tile.classList.remove('is-dragging');
    const order = [...photoHost.querySelectorAll('.photo')].map((t) => Number(t.dataset.id));
    if (order.join() === photos.map((p) => p.id).join()) return;
    photos = order.map((id) => photos.find((p) => p.id === id));
    renderPhotos();
    saveOrder();
  });
  return tile;
}

// While dragging a photo, move it in the grid to where the pointer is.
photoHost.addEventListener('dragover', (e) => {
  const dragging = photoHost.querySelector('.is-dragging');
  if (!dragging) return;
  e.preventDefault();
  const over = e.target.closest('.photo');
  if (!over || over === dragging) return;
  const r = over.getBoundingClientRect();
  const after = e.clientX > r.left + r.width / 2;
  photoHost.insertBefore(dragging, after ? over.nextSibling : over);
});

/* ---- adding photos from the device */

// Camera file names ("IMG_2041.jpg", "DSC0013.JPG") make poor titles; others are
// tidied up and used.
function titleFromName(name) {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  if (/^(img|dsc|dscn|pxl|mvimg|photo|image|screenshot)?[\s_-]*\d+/i.test(base)) return '';
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function queueRow(file) {
  const row = el('li', 'queue__row');
  const thumb = el('img');
  thumb.alt = '';
  thumb.src = URL.createObjectURL(file);
  thumb.onload = () => URL.revokeObjectURL(thumb.src);
  const name = el('span', 'queue__name', file.name);
  const state = el('span', 'queue__state', 'Waiting');
  row.append(thumb, name, state);
  photoQueue.appendChild(row);
  return { row, state };
}

async function uploadPhoto(file, ui) {
  ui.row.dataset.state = 'busy';
  ui.state.textContent = 'Preparing ...';
  try {
    const [full, thumb] = await readable(() => Promise.all([
      resizeToLongEdge(file, 1800, 0.82),
      makeSquareThumb(file, 700, 0.8)
    ]));
    ui.state.textContent = 'Uploading ...';
    const fd = new FormData();
    fd.append('full', full, 'full.jpg');
    fd.append('thumb', thumb, 'thumb.jpg');
    fd.append('title', titleFromName(file.name));
    fd.append('category', photoCategory.value);
    const item = await postForm('/gallery/photos', fd);
    photos.push(item);
    renderPhotos();
    ui.row.dataset.state = 'done';
    ui.state.textContent = 'Added';
    setTimeout(() => ui.row.remove(), 2500);
    return true;
  } catch (err) {
    ui.row.dataset.state = 'error';
    ui.state.textContent = err.message;
    if (err.unreadable) return false;
    const retry = el('button', 'icon-btn', 'Retry');
    retry.type = 'button';
    retry.addEventListener('click', () => { retry.remove(); uploadPhoto(file, ui); });
    ui.row.appendChild(retry);
    return false;
  }
}

// One at a time, so a phone does not run out of memory resizing ten photos at once.
async function addPhotos(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (!files.length) {
    toast('Those are not image files.', 'error');
    return;
  }
  const jobs = files.map((f) => [f, queueRow(f)]);
  let added = 0;
  for (const [file, ui] of jobs) {
    if (await uploadPhoto(file, ui)) added += 1;
  }
  if (added) toast(`${added} photo${added === 1 ? '' : 's'} added to the book.`);
}

const drop = document.getElementById('photo-drop');
const photoFiles = document.getElementById('photo-files');
photoFiles.addEventListener('change', () => {
  if (photoFiles.files.length) addPhotos(photoFiles.files);
  photoFiles.value = '';
});
['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault();
  drop.classList.add('is-over');
}));
['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) addPhotos(e.dataTransfer.files);
});
// A photo dropped anywhere else on the page must not open it in the tab.
window.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });

// Adding a photo by URL (for images already hosted somewhere).
document.getElementById('add-gallery-url').addEventListener('click', () => {
  openEditor({
    title: 'Add a photo by URL',
    fields: [
      { name: 'image_url', label: 'Image URL', required: true, hint: 'A link to the full-size image.' },
      { name: 'thumb_url', label: 'Thumbnail URL (optional)', hint: 'A smaller square version. Leave empty to reuse the image.' },
      { name: 'category', label: 'Category', type: 'select', options: GALLERY_CATEGORIES, value: photoCategory.value },
      { name: 'title', label: 'Title (optional)' },
      { name: 'credit', label: 'Credit (optional)' }
    ],
    onSubmit: async (values) => {
      photos.push(await post('/gallery', values));
      renderPhotos();
      toast('Photo added.');
    }
  });
});

/* ----------------------------------------------------- model details */

const modelForm = document.getElementById('model-form');

async function loadModel() {
  const m = await get('/model');
  modelForm.elements.cover_line.value = m.cover_line || '';
  modelForm.elements.based_in.value = m.based_in || '';
  modelForm.elements.languages.value = m.languages || '';
  modelForm.elements.instagram.value = m.instagram || '';

  const grid = document.getElementById('m-measurements');
  grid.innerHTML = '';
  m.fields.forEach(({ key, label, unit }) => {
    const wrap = el('div', 'field measure');
    const lab = el('label', null, label);
    lab.htmlFor = `m-${key}`;
    const box = el('div', 'measure__box');
    const input = el('input');
    input.type = 'text';
    input.id = `m-${key}`;
    input.name = `measure_${key}`;
    input.value = (m.measurements && m.measurements[key]) || '';
    box.appendChild(input);
    if (unit) box.appendChild(el('span', 'measure__unit', unit));
    wrap.append(lab, box);
    grid.appendChild(wrap);
  });
}

modelForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = modelForm.querySelector('[data-error]');
  error.textContent = '';
  const data = { measurements: {} };
  new FormData(modelForm).forEach((value, key) => {
    if (key.startsWith('measure_')) data.measurements[key.slice(8)] = value;
    else data[key] = value;
  });
  try {
    await put('/model', data);
    await loadModel();
    toast('Saved. The model book is already showing it.');
  } catch (err) {
    error.textContent = err.message;
  }
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
      loadUpdates(), loadSocials(), loadGallery(), loadModel(), loadMessages(), refreshUnreadBadge()
    ]);
  } catch (err) {
    toast(err.message, 'error');
  }
});
