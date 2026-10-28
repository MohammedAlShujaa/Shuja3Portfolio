/* Homepage scroll story, built on GSAP + ScrollTrigger (vendored in /vendor/gsap/).

   Starts once the hero has settled (the "hero:settled" event from
   js/hero-motion.js), so it never competes with the opening sequence:
   - the stat numbers count up from 0 when the strip is in view;
   - the featured project cards uncover upward from their bottom edge, in a
     stagger, as they scroll into view, each thumbnail settling from a slight
     zoom.

   Start states are applied straight away, so nothing visibly resets later.
   If the hero never reports in, a timeout starts the story anyway, so the
   numbers and cards can never stay hidden. Visitors who prefer reduced motion
   get the finished page with no animation. */

(() => {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const root = document.documentElement;
  const stats = document.querySelector('.stats');
  const cards = gsap.utils.toArray('[data-featured] .card');
  const thumbs = cards.map((c) => c.querySelector('.card__thumb')).filter(Boolean);

  // "90+" counts 0 to 90 and keeps its "+". Anything that is not a number is left alone.
  const counts = gsap.utils.toArray('[data-stats] strong')
    .map((el) => {
      const m = el.textContent.trim().match(/^(\d+)(.*)$/);
      return m && { el, to: Number(m[1]), suffix: m[2] };
    })
    .filter(Boolean);

  const HIDDEN = 'inset(100% 0% 0% 0% round 14px)';
  const SHOWN = 'inset(0% 0% 0% 0% round 14px)';

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', (context) => {
    // Start states. Each number keeps its final width while it counts, so the
    // label beside it does not shift as digits are added.
    counts.forEach((c) => {
      gsap.set(c.el, { display: 'inline-block', minWidth: c.el.offsetWidth, textAlign: 'right' });
      gsap.set(c.el, { textContent: `0${c.suffix}` });
    });
    gsap.set(cards, { clipPath: HIDDEN });
    gsap.set(thumbs, { scale: 1.12 });

    let started = false;
    context.add('start', () => {
      if (started) return;
      started = true;

      if (stats && counts.length) {
        ScrollTrigger.create({
          trigger: stats,
          start: 'top bottom', // as soon as any of the strip is on screen
          once: true,
          onEnter: () => {
            counts.forEach((c, i) => {
              const n = { v: 0 };
              gsap.to(n, {
                v: c.to,
                duration: 1.4,
                delay: i * 0.12,
                ease: 'power2.out',
                onUpdate: () => { c.el.textContent = `${Math.round(n.v)}${c.suffix}`; },
                onComplete: () => gsap.set(c.el, { clearProps: 'display,minWidth,textAlign' })
              });
            });
          }
        });
      }

      ScrollTrigger.batch(cards, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, {
            clipPath: SHOWN,
            duration: 1,
            ease: 'expo.out',
            stagger: 0.12,
            // The clip would also cut off the card's hover shadow, so drop it once shown.
            onComplete: () => gsap.set(batch, { clearProps: 'clipPath' })
          });
          gsap.to(batch.map((c) => c.querySelector('.card__thumb')).filter(Boolean), {
            scale: 1,
            duration: 1.4,
            ease: 'expo.out',
            stagger: 0.12
          });
        }
      });
    });

    if (root.dataset.heroSettled) {
      context.start();
    } else {
      const onSettled = () => context.start();
      document.addEventListener('hero:settled', onSettled, { once: true });
      const fallback = setTimeout(() => context.start(), 4000);
      return () => {
        document.removeEventListener('hero:settled', onSettled);
        clearTimeout(fallback);
      };
    }
  });
})();
