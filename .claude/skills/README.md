# Project skills

Claude Code loads these automatically for anyone working in this repository.

The `gsap-*` skills are the official GSAP agent skills from
https://github.com/greensock/gsap-skills (commit aed9cfd, MIT license, copied
unchanged). Only the skills that apply to this vanilla-JS site are included; the
React and Vue/Svelte framework skills are left out.

| Skill | Covers |
|---|---|
| gsap-core | tweens, easing, stagger, `gsap.matchMedia()` and prefers-reduced-motion |
| gsap-timeline | sequencing with timelines and the position parameter |
| gsap-scrolltrigger | scroll-linked animation, scrub, pinning, batch |
| gsap-plugins | SplitText, DrawSVG, MorphSVG, Flip, ScrambleText, Observer, and the rest |
| gsap-utils | clamp, mapRange, random, distribute, and other helpers |
| gsap-performance | transforms over layout, `quickTo()`, cleanup |

To update them, copy the newer `SKILL.md` files from the upstream repository.
