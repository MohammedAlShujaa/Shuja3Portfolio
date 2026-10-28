/* Portfolio project viewer. "See more" on a card lifts it out of the grid: the
   card glides to the middle of the screen and grows into a larger version of
   itself while the page behind dims, then its full description and links
   fade in. Closing (the x button, Esc, or a click on the dimmed backdrop)
   plays it in reverse, and the card lands back in its slot.

   How the morph avoids looking stretched: scaling a whole card would warp its
   text, so instead two things move and grow from the small card to the big
   one, a plain background panel (pm__surface, which has no text to warp) and
   the thumbnail (both thumbnails are 16:10, so it scales evenly). The text
   then fades in once the card has arrived.

   While open, the page behind cannot scroll or take focus (it is made inert),
   and a long description scrolls inside the card. Visitors who prefer reduced
   motion, or a page without GSAP, get the big card shown and hidden at once.
   main.js calls openProjectModal() from each card's "See more" button. */

(() => {
  const animated = () =>
    window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let modal, backdrop, surface, panel, closeBtn, thumb, body;
  let current = null; // { card, trigger }
  let busy = false;    // true while closing (and while opening, until it ends)
  let opening = null;  // the open timeline, so a close can cut it short

  function build() {
    modal = el('div', 'pm');
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pm-title');

    backdrop = el('div', 'pm__backdrop');
    surface = el('div', 'pm__surface');
    panel = el('article', 'pm__panel');
    panel.tabIndex = -1; // holds focus while the close button is still fading in

    closeBtn = el('button', 'pm__close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');

    thumb = el('img', 'pm__thumb');
    thumb.alt = '';

    body = el('div', 'pm__body');
    body.setAttribute('data-lenis-prevent', ''); // a long description scrolls here

    panel.append(closeBtn, thumb, body);
    modal.append(backdrop, surface, panel);
    document.body.appendChild(modal);

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && current) close();
    });
  }

  // Copies the card's content into the big card, with the full description.
  function fill(card) {
    const src = card.querySelector('.card__body');
    const smallThumb = card.querySelector('.card__thumb');

    thumb.hidden = !smallThumb;
    if (smallThumb) {
      thumb.src = smallThumb.currentSrc || smallThumb.src;
      thumb.alt = smallThumb.alt;
    }

    body.textContent = '';
    body.scrollTop = 0;
    const meta = src.querySelector('.card__meta');
    if (meta) body.appendChild(meta.cloneNode(true));
    const title = el('h2', 'pm__title', src.querySelector('.card__title').textContent);
    title.id = 'pm-title';
    body.appendChild(title);
    body.appendChild(el('p', 'pm__desc', src.querySelector('.card__desc').textContent));
    ['.chips', '.card__links', '.card__note'].forEach((sel) => {
      const node = src.querySelector(sel);
      if (node) body.appendChild(node.cloneNode(true));
    });
  }

  // Everything outside the viewer: no focus, no screen reader, no scrolling.
  function lockPage(on) {
    document.querySelectorAll('body > header, body > main, body > footer, .skip-link')
      .forEach((n) => n.toggleAttribute('inert', on));
    if (typeof lenis !== 'undefined' && lenis) {
      if (on) lenis.stop(); else lenis.start();
    } else {
      document.documentElement.style.overflow = on ? 'hidden' : '';
    }
  }

  const rect = (n) => n.getBoundingClientRect();
  const box = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height });

  function open(card, trigger) {
    if (current || busy) return;
    if (!modal) build();
    // A card still tilting from the hover would be measured at an angle.
    if (typeof resetCardTilts === 'function') resetCardTilts();

    current = { card, trigger };
    fill(card);
    lockPage(true);
    modal.hidden = false;

    const smallThumb = card.querySelector('.card__thumb');
    const from = rect(card);
    const to = rect(panel);
    const thumbFrom = smallThumb && !thumb.hidden ? rect(smallThumb) : null;
    const thumbTo = thumbFrom ? rect(thumb) : null;

    card.style.visibility = 'hidden'; // the card is now "in" the viewer

    if (!animated()) {
      modal.classList.add('is-open');
      closeBtn.focus({ preventScroll: true });
      return;
    }

    // The close button is invisible until it fades in, and an invisible
    // element cannot hold focus, so the panel holds it until then.
    panel.focus({ preventScroll: true });

    busy = true;
    modal.classList.add('is-morphing');
    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        modal.classList.remove('is-morphing');
        modal.classList.add('is-open');
        gsap.set(surface, { clearProps: 'all' });
        busy = false;
        opening = null;
        if (panel.contains(document.activeElement)) closeBtn.focus({ preventScroll: true });
      }
    });
    opening = tl;

    tl.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' }, 0);
    tl.fromTo(surface, box(from), { ...box(to), duration: 0.6 }, 0);
    if (thumbFrom) {
      tl.fromTo(thumb, {
        x: thumbFrom.left - thumbTo.left,
        y: thumbFrom.top - thumbTo.top,
        scale: thumbFrom.width / thumbTo.width,
        transformOrigin: '0 0'
      }, { x: 0, y: 0, scale: 1, duration: 0.6 }, 0);
    }
    tl.fromTo(body.children, { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out' }, 0.32);
    tl.fromTo(closeBtn, { autoAlpha: 0, scale: 0.6 },
      { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 0.45);
  }

  function close() {
    // Closing while it is still opening: jump the opening to its end first,
    // so Esc or a backdrop click always works straight away.
    if (opening) opening.progress(1);
    if (!current || busy) return;
    const { card, trigger } = current;
    const cardBody = card.querySelector('.card__body');

    const finish = () => {
      modal.hidden = true;
      modal.classList.remove('is-open', 'is-morphing');
      if (window.gsap) gsap.set([backdrop, surface, thumb, closeBtn, ...body.children], { clearProps: 'all' });
      card.style.visibility = '';
      lockPage(false);
      trigger.focus({ preventScroll: true });
      current = null;
      busy = false;
    };

    if (!animated()) {
      finish();
      return;
    }

    busy = true;
    const smallThumb = card.querySelector('.card__thumb');
    const from = rect(panel);
    const to = rect(card); // still laid out in the grid, just invisible
    const thumbFrom = smallThumb && !thumb.hidden ? rect(thumb) : null;
    const thumbTo = thumbFrom ? rect(smallThumb) : null;

    modal.classList.remove('is-open');
    modal.classList.add('is-morphing');
    gsap.set(surface, box(from));

    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        finish();
        // The small card's text arrives last, as the big card's left first.
        // Opacity only: hiding it would take focus away from "See more".
        gsap.from(cardBody, { opacity: 0, duration: 0.25, clearProps: 'opacity' });
      }
    });

    tl.to([...body.children, closeBtn], { autoAlpha: 0, duration: 0.18, ease: 'power1.out' }, 0);
    tl.to(surface, { ...box(to), duration: 0.5 }, 0.08);
    if (thumbFrom) {
      tl.to(thumb, {
        x: thumbTo.left - thumbFrom.left,
        y: thumbTo.top - thumbFrom.top,
        scale: thumbTo.width / thumbFrom.width,
        transformOrigin: '0 0',
        duration: 0.5
      }, 0.08);
    }
    tl.to(backdrop, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0.15);
  }

  window.openProjectModal = open;
})();
