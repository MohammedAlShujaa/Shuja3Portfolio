/* Homepage hero opening sequence, built on GSAP (vendored in /vendor/gsap/).

   The constellation behind the hero echoes the t-SNE plot from the TripAdvisor
   NLP project, so the sequence plays it as clustering: every point starts in one
   mixed blob, then separates into its three colour clusters, and the links
   between neighbours draw in once they settle. The text arrives alongside:
   the trilingual greeting, the name rising letter by letter, then the rest.

   Afterwards the constellation stays alive, in three independent layers:
   - each cluster sits in a depth layer that moves at its own speed as the
     hero scrolls away (parallax, which also gives phones some motion);
   - each cluster wanders slowly on its own;
   - points near the mouse are pushed away and spring back, and the links
     between points stretch to follow them.

   Only transforms and opacity are animated, and the live layers pause while
   the hero is off screen. Visitors who prefer reduced motion get the finished
   hero with no animation at all. */

(() => {
  const root = document.documentElement;
  const reveal = () => root.classList.remove('motion-pending');

  const hero = document.querySelector('.hero');
  const loaded = window.gsap && window.ScrollTrigger && window.SplitText &&
    window.DrawSVGPlugin && window.ScrambleTextPlugin;
  if (!hero || !loaded) {
    reveal();
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, ScrambleTextPlugin);

  const q = gsap.utils.selector(hero);
  const svg = q('.hero__constellation')[0];
  const points = q('.hero__constellation circle');
  const links = q('.hero__constellation line');
  const depths = q('.hero__constellation .depth');
  const clusters = q('.hero__constellation .cluster');
  const eyebrow = q('.hero__eyebrow')[0];
  const greetings = q('[data-greet]');
  const name = q('.hero__name')[0];
  const followers = [
    ...q('.hero__subheading'),
    ...q('.hero__intro'),
    ...q('.hero__ctas > *'),
    ...q('.hero__socials')
  ];
  const photo = q('.hero__photo-wrap')[0];

  // Centre of the constellation's viewBox: where the unclustered blob starts.
  const box = svg.viewBox.baseVal;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // The opening timeline. Calls context.startLive() when it finishes.
  function intro(context) {
    // The split is kept after the animation rather than reverted: as whole
    // words, "Al-Shujaa" never breaks at its hyphen, so reverting would make
    // the name jump to a new line break on the last frame. SplitText labels
    // the heading so screen readers still read the plain name.
    SplitText.create(name, { type: 'words, chars', charsClass: 'char', mask: 'words' });
    const chars = name.querySelectorAll('.char');

    // Scrambled greetings change length while they resolve, so lock each
    // one's finished width first; otherwise the separators would jitter.
    const latin = greetings.filter((g) => g.lang !== 'ar');
    const finalText = latin.map((g) => g.textContent);
    gsap.set(greetings, { display: 'inline-block', minWidth: (i, el) => el.offsetWidth });
    gsap.set(latin, { textContent: '' });

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        gsap.set(greetings, { clearProps: 'display,minWidth' });
        context.startLive();
      }
    });

    // 1. Points fade in where they will start: one mixed blob in the middle.
    tl.from(points, {
      opacity: 0,
      duration: 0.4,
      ease: 'power1.out',
      stagger: { amount: 0.3, from: 'random' }
    }, 0);

    // 2. Clustering: each point travels from the blob to its real position.
    tl.from(points, {
      x: (i, el) => cx - el.cx.baseVal.value + gsap.utils.random(-140, 140),
      y: (i, el) => cy - el.cy.baseVal.value + gsap.utils.random(-80, 80),
      duration: 1.3,
      ease: 'power3.inOut',
      stagger: { amount: 0.25, from: 'random' }
    }, 0.15);

    // 3. Links between neighbours draw in once the clusters settle.
    tl.from(links, { drawSVG: 0, duration: 0.6, ease: 'power2.inOut', stagger: 0.06 }, 1.2);

    // Greeting: Arabic fades in (scrambling would break its joined letters);
    // English and Indonesian resolve out of binary, a nod to the ML theme.
    tl.from(eyebrow, { autoAlpha: 0, duration: 0.3 }, 0.3);
    latin.forEach((g, i) => {
      tl.to(g, {
        duration: 0.7,
        ease: 'none',
        scrambleText: { text: finalText[i], chars: '01', speed: 0.5 }
      }, 0.4 + i * 0.15);
    });

    // Name rises letter by letter from behind each word's mask.
    tl.from(chars, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.025 }, 0.45);

    tl.from(photo, { autoAlpha: 0, scale: 0.94, duration: 1, ease: 'expo.out' }, 0.5);

    tl.from(followers, { autoAlpha: 0, y: 14, duration: 0.7, stagger: 0.07 }, 0.8);
  }

  // Live constellation: parallax, drift, and the mouse push. Started once the
  // intro has finished, because the intro also moves the points.
  function live() {
    const cleanups = [];

    // Links: each end sits exactly on a point in the same cluster, so find
    // that point and make the end follow it when the point is pushed.
    const near = (a, b) => Math.abs(a - b) < 0.05;
    const ends = links.map((line) => {
      const dots = [...line.parentNode.querySelectorAll('circle')];
      const at = (x, y) => dots.find((c) => near(c.cx.baseVal.value, x) && near(c.cy.baseVal.value, y));
      const base = [line.x1, line.y1, line.x2, line.y2].map((a) => a.baseVal.value);
      return { line, base, a: at(base[0], base[1]), b: at(base[2], base[3]), last: '' };
    });
    // DrawSVG left a dash pattern sized to each link's length; a stretched link
    // would show a gap, so clear it now that the links are fully drawn.
    gsap.set(links, { clearProps: 'strokeDasharray,strokeDashoffset' });

    const syncLinks = () => {
      ends.forEach((e) => {
        const ax = e.a ? gsap.getProperty(e.a, 'x') : 0;
        const ay = e.a ? gsap.getProperty(e.a, 'y') : 0;
        const bx = e.b ? gsap.getProperty(e.b, 'x') : 0;
        const by = e.b ? gsap.getProperty(e.b, 'y') : 0;
        const key = `${ax},${ay},${bx},${by}`;
        if (key === e.last) return; // nothing moved: skip the repaint
        e.last = key;
        e.line.setAttribute('x1', e.base[0] + ax);
        e.line.setAttribute('y1', e.base[1] + ay);
        e.line.setAttribute('x2', e.base[2] + bx);
        e.line.setAttribute('y2', e.base[3] + by);
      });
    };

    // 1. Parallax: deeper layers move further as the hero scrolls away.
    depths.forEach((layer) => {
      gsap.to(layer, {
        y: Number(layer.dataset.depth) * 40,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 0, end: 'bottom top', scrub: true }
      });
    });

    // 2. Drift: each cluster wanders through a few random offsets and back.
    const drifts = clusters.map((cluster) => {
      const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } });
      for (let i = 0; i < 3; i++) {
        tl.to(cluster, {
          x: gsap.utils.random(-14, 14),
          y: gsap.utils.random(-9, 9),
          duration: gsap.utils.random(4, 7)
        });
      }
      return tl;
    });

    // 3. Push: points within RADIUS (in SVG units) of the mouse move away from
    // it, more strongly the closer they are, and spring back as it leaves.
    const RADIUS = 110;
    const PUSH = 26;
    const movers = points.map((p) => ({
      p,
      cx: p.cx.baseVal.value,
      cy: p.cy.baseVal.value,
      tx: 0,
      ty: 0,
      toX: gsap.quickTo(p, 'x', { duration: 0.8, ease: 'power3.out' }),
      toY: gsap.quickTo(p, 'y', { duration: 0.8, ease: 'power3.out' })
    }));

    const aim = (m, tx, ty) => {
      if (tx === m.tx && ty === m.ty) return;
      m.tx = tx;
      m.ty = ty;
      m.toX(tx);
      m.toY(ty);
    };

    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      // Convert the mouse position into each cluster's own coordinates, which
      // already include its drift and parallax.
      const local = new Map();
      movers.forEach((m) => {
        const g = m.p.parentNode;
        if (!local.has(g)) {
          local.set(g, new DOMPoint(e.clientX, e.clientY).matrixTransform(g.getScreenCTM().inverse()));
        }
        const pt = local.get(g);
        const dx = m.cx - pt.x;
        const dy = m.cy - pt.y;
        const d = Math.hypot(dx, dy);
        if (d >= RADIUS || d < 0.001) return aim(m, 0, 0);
        const force = (1 - d / RADIUS) ** 2 * PUSH;
        aim(m, (dx / d) * force, (dy / d) * force);
      });
    };
    const onLeave = () => movers.forEach((m) => aim(m, 0, 0));

    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    });

    // Run the drift and the link updates only while the hero is on screen.
    const setActive = (on) => {
      drifts.forEach((t) => (on ? t.resume() : t.pause()));
      gsap.ticker.remove(syncLinks);
      if (on) gsap.ticker.add(syncLinks);
    };
    ScrollTrigger.create({
      trigger: hero,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => setActive(self.isActive)
    });
    setActive(true);
    cleanups.push(() => gsap.ticker.remove(syncLinks));

    return () => cleanups.forEach((fn) => fn());
  }

  function build() {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', (context) => {
      let stopLive = null;
      context.add('startLive', () => {
        stopLive = live();
        // Lets the rest of the page (js/scroll-story.js) start its motion only
        // after the hero has finished, so the two never compete for attention.
        root.dataset.heroSettled = 'true';
        document.dispatchEvent(new CustomEvent('hero:settled'));
      });

      // If the 3s safety timeout already showed the hero (very slow network),
      // the visitor is looking at finished content: skip the intro rather than
      // yank it away, and go straight to the live constellation.
      if (root.classList.contains('motion-pending')) intro(context);
      else context.startLive();

      return () => stopLive && stopLive();
    });

    // The timeline has applied its start state, so the hero can be shown now.
    reveal();
  }

  // No need to wait for the web font: the name is split into words and letters
  // (not lines), which simply reflow if the font swaps in mid-animation.
  build();
})();
