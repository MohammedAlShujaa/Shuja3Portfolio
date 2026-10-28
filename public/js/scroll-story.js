/* Homepage scroll story, built on GSAP + ScrollTrigger (vendored in /vendor/gsap/).

   Starts once the hero has settled (the "hero:settled" event from
   js/hero-motion.js), so it never competes with the opening sequence:
   - the statement section pins while its words light up one by one as you
     scroll, and the data field behind it (js/data-field.js) forms a neural
     network; "machine learning", the last words, light up as it completes;
   - as the stats strip arrives, the network dissolves into a scatter plot,
     and the stat numbers count up from 0;
   - as the featured projects arrive, the points settle into a dim wave, and
     the cards uncover upward from their bottom edge, in a stagger, each
     thumbnail settling from a slight zoom.

   Start states are applied straight away, so nothing visibly resets later.
   If the hero never reports in, a timeout starts the story anyway, so the
   words, numbers and cards can never stay hidden. Visitors who prefer reduced
   motion get the finished page with no animation. */

(() => {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  const root = document.documentElement;
  const field = window.dataField && window.dataField.active ? window.dataField : null;
  const statement = document.querySelector('.statement');
  const statementText = statement && statement.querySelector('.statement__text');
  const stats = document.querySelector('.stats');
  const featured = document.querySelector('[data-featured]');
  const featuredSection = featured && featured.closest('.section');
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

  // Reports a scroll stage's progress to the data field, if it is running.
  const stage = (i) => (self) => field && field.setStage(i, self.progress);

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', (context) => {
    // Start states. The statement's words start dim; each number keeps its
    // final width while it counts, so the label beside it does not shift.
    let words = [];
    if (statementText && window.SplitText && statementText.textContent.trim()) {
      // "machine learning" is painted by its gradient span, not by its words,
      // so it lights up as one unit, last.
      SplitText.create(statementText, { type: 'words', tag: 'span' }).words.forEach((w) => {
        const unit = w.closest('.grad') || w;
        if (!words.includes(unit)) words.push(unit);
      });
      gsap.set(words, { opacity: 0.12 });
    }
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

      // Created top to bottom, so each one's position accounts for the pin above it.
      if (statement) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: statement,
            start: 'top top',
            end: '+=140%',
            pin: true,
            scrub: 0.6,
            // The network is complete at 80% of the pin, with the last words.
            onUpdate: (self) => field && field.setStage(0, self.progress * 1.25),
            onRefresh: (self) => field && field.setStage(0, self.progress * 1.25)
          }
        });
        if (words.length) tl.to(words, { opacity: 1, duration: 0.6, stagger: 0.5, ease: 'none' });
        else tl.to({}, { duration: 1 }); // keeps the pin when there is no text to light up
      }

      if (stats) {
        ScrollTrigger.create({
          trigger: stats,
          start: 'top bottom',
          end: 'top 55%',
          onUpdate: stage(1),
          onRefresh: stage(1)
        });
      }
      if (featuredSection) {
        ScrollTrigger.create({
          trigger: featuredSection,
          start: 'top 35%',
          end: 'top -15%',
          onUpdate: stage(2),
          onRefresh: stage(2)
        });
      }

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
