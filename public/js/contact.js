/* Contact page: the three-field form and the direct contact details. */

async function renderContactInfo() {
  const list = document.querySelector('[data-contact-list]');
  const pitch = document.querySelector('[data-pitch]');

  const [profile, socials] = await Promise.all([api('/api/profile'), api('/api/socials')]);

  if (pitch && profile && profile.availability) pitch.textContent = profile.availability;

  if (!list) return;
  list.innerHTML = '';

  socials.forEach((s) => {
    const li = el('li');
    const wrap = el('div');
    wrap.appendChild(el('p', 'contact-list__label', s.platform));
    const a = el('a', 'contact-list__value', s.url.replace(/^mailto:/, '').replace(/^https?:\/\//, ''));
    a.href = s.url;
    if (!s.url.startsWith('mailto:')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    wrap.appendChild(a);
    li.appendChild(wrap);
    list.appendChild(li);
  });

  if (profile && profile.location) {
    const li = el('li');
    const wrap = el('div');
    wrap.appendChild(el('p', 'contact-list__label', 'Location'));
    wrap.appendChild(el('p', 'contact-list__value', profile.location));
    li.appendChild(wrap);
    list.appendChild(li);
  }
}

function initForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('button[type="submit"]');
  const success = document.querySelector('[data-form-success]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status';
    status.textContent = '';

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim()
    };

    if (!data.name || !data.email || !data.message) {
      status.classList.add('form-status--error');
      status.textContent = 'Please fill in every field.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending ...';

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error || 'The message could not be sent.');

      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (err) {
      status.classList.add('form-status--error');
      status.textContent = err.message;
      button.disabled = false;
      button.textContent = 'Send Message';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initForm();
  try {
    await renderContactInfo();
  } catch (err) {
    console.error('Could not load the contact details.', err);
  }
});
