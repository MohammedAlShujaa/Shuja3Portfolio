/* Homepage hero opening sequence, built on GSAP (vendored in /vendor/gsap/).

   The constellation behind the hero echoes the t-SNE plot from the TripAdvisor
   NLP project, so the sequence plays it as clustering: every point starts in one
   mixed blob, then separates into its three colour clusters, and the links
   between neighbours draw in once they settle. The text arrives alongside:
   the trilingual greeting, the name rising letter by letter, then the rest.

   Only transforms and opacity are animated. Visitors who prefer reduced motion
   get the finished hero with no animation. */

(() => {
  const root = document.documentElement;
  const reveal = () => root.classList.remove('motion-pending');

  const hero = document.querySelector('.hero');
  const loaded = window.gsap && window.SplitText && window.DrawSVGPlugin && window.ScrambleTextPlugin;
  if (!hero || !loaded) {
    reveal();
    return;
  }

  gsap.registerPlugin(SplitText, DrawSVGPlugin, ScrambleTextPlugin);

  const q = gsap.utils.selector(hero);
  const svg = q('.hero__constellation')[0];
  const points = q('.hero__constellation circle');
  const links = q('.hero__constellation line');
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

  function build() {
    // If the 3s safety timeout already showed the hero (very slow network), the
    // visitor is looking at finished content: do not yank it away to animate it.
    if (!root.classList.contains('motion-pending')) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
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
        onComplete: () => gsap.set(greetings, { clearProps: 'display,minWidth' })
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
    });

    // The timeline has applied its start state, so the hero can be shown now.
    reveal();
  }

  // No need to wait for the web font: the name is split into words and letters
  // (not lines), which simply reflow if the font swaps in mid-animation.
  build();
})();
