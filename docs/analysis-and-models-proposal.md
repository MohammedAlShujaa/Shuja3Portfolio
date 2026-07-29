# Repository Analysis, Portfolio Comparison, and Models Section Proposal

Prepared for Mohammed Al-Shujaa. Reviews the Shuja3Portfolio repository as it
stands, compares it against strong professional portfolios, and proposes a new
"Models" section. No code was changed in producing this report.

Note on scope: this document is analysis and planning only. Nothing here is
implemented yet. Implement only after you review and approve the phased plan at
the end.

---

## Part 1: Repository analysis

### 1.1 Overall verdict

The codebase is clean, consistent, and well above typical student standard. The
separation is correct: one database module (`server/db.js`) with named,
parameterized query functions, thin route files, a single Express app exported
for both local and serverless use, and a design system applied consistently.
The issues below are refinements and hardening, not signs of a weak base.

### 1.2 Code quality and maintainability

Strengths:
- `server/db.js` is the only module that touches the driver, and every query is
  parameterized. This is exactly the pattern the project set out to follow.
- Async route handlers are wrapped (`wrap()`), so errors reach the error handler
  instead of crashing the function.
- Naming and comments are consistent across files.

Points to improve:
- Duplicated shell. The navbar and footer are copied into all four HTML files in
  `public/`. Editing the menu means editing four files, which drifts over time.
  Because the project rule is "no framework," the fix is either a small
  client-side partial injection, or a light build step that stamps a shared
  header and footer into each page.
- No committed tests. The site was verified during the build, but there is no
  test script in the repository. A small smoke test committed as `npm test`
  would catch regressions before each deploy.
- No linter or formatter config (for example ESLint and Prettier). Low priority,
  but it keeps style consistent as the project grows.
- Stale comment. `server/app.js` (around lines 65 to 68) still says that on
  Vercel the `public` folder is served by static hosting and only `/api` and
  `/admin` reach the function. That was true of the first `vercel.json`, but the
  current `vercel.json` routes every request through the Express function. The
  comment should be corrected so it does not mislead a future reader. See 1.5.

### 1.3 Security review

Strengths:
- The admin password is stored only as a bcrypt hash, never in plain text.
- Every write route sits behind `requireAuthApi`, and the admin pages behind
  `requireAuthPage`. Admin views live outside `public/` so static hosting cannot
  serve the dashboard to an anonymous visitor.
- The login route returns the same message for a wrong username and a wrong
  password, so it does not reveal which field was wrong.
- Session cookies are httpOnly, `sameSite: lax`, and `secure` in production.

Findings to address, most useful first:
1. No rate limiting on the login route (`/api/admin/login`). An attacker can try
   passwords as fast as the function responds. Add a simple attempt limiter (for
   example `express-rate-limit`, or a short lockout counter). Medium priority.
2. SVG is an accepted upload type. `server/routes/admin.js` allows
   `image/svg+xml` in the multer `fileFilter`. An SVG can contain script, and
   uploads are served inline from the same origin, so a crafted SVG is a stored
   cross-site scripting vector. Uploads are disabled on Vercel, so this only
   affects local use today, but the safe fix is to drop `svg+xml` from the
   allowed types, or serve uploaded files with a `Content-Disposition:
   attachment` header and a restrictive content type. Quick win.
3. No security headers. There is no `helmet` and no Content Security Policy. A
   CSP is the single highest-value hardening step, and it becomes important for
   the Models section because embedding a live demo means allowing a specific
   external frame source. When added, the CSP must allow Google Fonts, the
   Devicon stylesheet used on the About page, and later `https://*.hf.space`.
   Medium priority.
4. No spam protection on the contact form (`/api/messages`). It validates field
   lengths and email shape, but nothing stops a bot from flooding the inbox. Add
   a hidden honeypot field and a light rate limit. Quick win to medium.
5. Cross-site request forgery. The combination of `sameSite: lax`, a JSON only
   API, and the `Content-Type: application/json` requirement gives reasonable
   protection, so this is low risk. It is listed for completeness. If you add a
   CSRF token later, do it when you add other hardening.

### 1.4 Accessibility

Strengths: a skip link, alt text on images, always visible form labels, visible
focus rings, `aria-expanded` and `aria-controls` on the menu button,
`aria-pressed` on the filter pills, an `aria-live` status on the contact form,
and a `prefers-reduced-motion` block.

Findings:
1. Off-screen mobile menu links stay focusable. When the mobile menu is closed it
   is moved off screen with a transform, but the links remain in the tab order.
   A keyboard or screen-reader user on a narrow screen can tab into links they
   cannot see. Fix by marking the closed menu `inert`, or setting the links to
   `tabindex="-1"` and `aria-hidden` when closed. Real bug, quick fix.
2. No focus trap in the open mobile overlay. Minor. When the full-screen menu is
   open, focus can leave it. Trapping focus while it is open is a nice-to-have.
3. Contrast should be confirmed with a tool. The secondary text color on the navy
   background is expected to pass AA for normal text, but it is worth confirming
   with an automated checker, especially for the smallest mono labels.

### 1.5 Performance

1. Everything is served through the serverless function. The current
   `vercel.json` rewrites every request to the Express handler, so static assets
   (CSS, JavaScript, images) also pay a function invocation and can hit a cold
   start, instead of being served from Vercel's edge cache. This was a
   deliberate trade for a correct first deploy. The faster setup serves `public/`
   as static from the edge and routes only `/api` and the `/admin` paths to the
   function, which also needs the admin view files bundled with the function.
   This is larger work and should be done carefully so admin pages keep working.
2. Render-blocking web fonts, and the Devicon stylesheet loaded from a CDN on the
   About page. Preloading the fonts, or self-hosting them, would speed first
   paint. Minor.
3. Multiple API round trips and a "Loading" flash on each page load. This ties
   directly to the SEO point below.

### 1.6 SEO

1. Content is rendered on the client. The hero name, the projects, and the skills
   are injected by JavaScript from the API, so the initial HTML contains
   placeholders. Google can render JavaScript and will index it, but indexing is
   slower and less certain, and simpler link-preview bots see empty content. The
   highest-value SEO change is to render the core content (at least the profile
   and the project list) into the HTML on the server, since the app is already
   Express. Larger work, biggest payoff.
2. No Open Graph or Twitter Card tags. When the site is shared on LinkedIn or in
   a chat, no title, description, or image preview appears. Adding these is a
   quick win and matters for a portfolio that will be shared.
3. No structured data. A `schema.org` Person block in JSON-LD helps Google
   understand who the site is about. Quick win.
4. No canonical tags. Quick win.
5. Positive: each page has a real title and meta description, `sitemap.xml` and
   `robots.txt` now exist, and the admin pages are set to `noindex`.

### 1.7 Prioritized improvement list

Quick wins (roughly under an hour each):
- Add Open Graph and Twitter Card tags to all four pages.
- Add a JSON-LD Person block.
- Add canonical tags.
- Correct the stale comment in `server/app.js`.
- Remove `svg+xml` from the accepted upload types.
- Add a honeypot field to the contact form.

Medium:
- Rate limit the login route and the contact route.
- Add `helmet` with a Content Security Policy.
- Fix the off-screen mobile menu focus issue.
- Commit a smoke test as `npm test`.

Larger:
- Server-render the core content for SEO and faster first paint.
- Split static assets from the function on Vercel for edge caching.
- Template the shared navbar and footer so they live in one place.

---

## Part 2: Comparison against professional portfolios

Benchmarks referenced: Brittany Chiang (structure and hire-me clarity), Eugene
Yan and Chip Huyen (content-first credibility for applied ML), Daniel Bourke (ML
plus teaching voice), and current 2026 guidance on ML engineer portfolios. See
Sources at the end.

| Dimension | Where the site stands | Realistic change to close the gap |
|---|---|---|
| Positioning and headline | Strong and distinctive. The trilingual greeting plus an ML focus is a real differentiator few students have. | Keep the headline naming the role clearly (name plus "Machine Learning and Intelligent Systems"), the way Brittany Chiang names a concrete role in the first line. If the live headline was shortened, restore the role words. |
| Project presentation | Good. Real cards, category filter, and genuine metrics on the TIMS thesis. | Add at least one live, runnable demo. This is the single biggest gap against professionals: recruiters engage far more with a runnable demo than with a static card. This is exactly what the Models section in Part 3 delivers. |
| Visual design | On level with the benchmarks. The dark navy system and the t-SNE hero signature read as current and technical. | Hold the discipline. Do not add more accent colors. The one signature element is enough. |
| Information architecture | Clean four-page structure with a featured set, which matches the "start here" curation the best sites use. | Consider a short case-study depth page for the flagship TIMS project, the way applied-ML portfolios expand one or two pieces. |
| Credibility signals | Strong: teaching numbers, a Stanford certificate, a real thesis and journal work. | Fill the empty `resume_url` so a downloadable resume is one click away, and link the TIMS thesis or journal PDF once hosted. Credibility markers should resolve, not sit blank. |
| Contact and conversion | Good: a working form, direct socials, an availability line. | Make the pitch specific about what you are seeking, add the resume download here too, and confirm every outbound link (GitHub, LinkedIn) resolves. |

Summary: the site already competes on design and positioning. The clearest
professional gap is proof you can ship a model people can click and run. That is
the reason the Models section is the right next investment.

---

## Part 3: Proposal for a "Models" section

### 3.1 What it is

A first-class section that presents the machine learning models you have built,
the way a designer shows case studies. Current guidance is consistent: each
entry should read as a mini case study (the task, the dataset, the approach, the
measurable result), and the strongest entries include a live, interactive demo
via Gradio or Streamlit hosted on Hugging Face Spaces.

### 3.2 Separate table, not an extension of projects (recommended)

Recommendation: add a separate `models` table rather than overloading
`projects`.

Reasons:
- Models carry fields projects do not: a task type, a dataset, structured
  metrics, a model card link, and an embedded demo. Adding these to `projects`
  would leave most project rows with empty columns and muddle the existing
  category filter.
- A separate table mirrors the pattern already in the codebase exactly (its own
  `/api/models` route, its own admin tab, its own page), which keeps each concern
  clean and the code easy to follow.
- The two can still cross-link: a model can reference the related project, and a
  project card can link to its model demo.

### 3.3 Proposed schema

```sql
CREATE TABLE models (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  task           TEXT NOT NULL,          -- for example: Text classification, Regression, NLP
  description    TEXT NOT NULL,          -- one short case-study paragraph
  dataset        TEXT,                   -- dataset name and size
  metrics        TEXT,                   -- for example: F1 0.91, Accuracy 0.93 (see note)
  tech_tags      TEXT,                   -- comma separated, same convention as projects
  model_card_url TEXT,                   -- link to a model card or notebook
  demo_url       TEXT,                   -- Hugging Face Space URL, https://<user>-<space>.hf.space
  repo_url       TEXT,                   -- source repository
  thumbnail_url  TEXT,                   -- image by URL, same as projects
  featured       BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order     INTEGER NOT NULL DEFAULT 0
);
```

Note on metrics: a plain `metrics TEXT` keeps the first version simple and
matches the `tech_tags` convention. If you later want per-metric chips or
sorting, upgrade `metrics` to `JSONB` holding key and value pairs. Start simple.

Do not seed invented numbers. The seed should either leave metrics blank or use
your real, verified values. Provide the real model details when we implement.

### 3.4 db.js functions (follow the existing pattern)

Mirror the project functions exactly, all parameterized:
`listModels`, `listFeaturedModels(limit)`, `getModel(id)`, `insertModel(m)`,
`updateModel(id, m)`, `deleteModel(id)`. No route code touches the driver.

### 3.5 Public route and page

- Route: `GET /api/models` in `server/routes/public.js`, plus a
  `?featured=true&limit=` variant, matching the projects route.
- Page: a new `public/models.html`, added to the shared navigation as "Models",
  which makes the site five pages. Alternatively the models can be a section on
  the Portfolio page. A dedicated page is recommended, because the interactive
  demos deserve their own space and it reads as a stronger ML signal.
- Card: thumbnail, a task pill, the name, the short description, metric chips,
  and links (model card, repository). A "Launch demo" control expands the live
  demo.

### 3.6 Embedding a live demo safely on Vercel

You cannot host a Python model on Vercel, because the runtime is serverless and
read only. The correct approach is to host the model as a public Hugging Face
Space (Gradio or Streamlit) and embed it:

```html
<iframe
  src="https://<your-user>-<your-space>.hf.space"
  title="Live demo of <model name>"
  loading="lazy"
  width="100%" height="520"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
</iframe>
```

Recommendations:
- Load the iframe only when the visitor clicks "Launch demo," not on page load.
  A Hugging Face Space is heavy and can cold start, so loading one per card up
  front would hurt performance badly. Lazy loading on click keeps the page fast.
- The Space must be public to embed.
- If a Content Security Policy is added (see Part 1), its `frame-src` must
  include `https://*.hf.space`.

### 3.7 Admin CRUD

Add a "Models" tab to the dashboard that reuses the existing editor dialog
pattern, with fields for every column above, a featured toggle, sort order, and
an image by URL or upload. This matches how projects, skills, updates, and
socials already work, so it is low risk.

### 3.8 Content rules

All text English. No em dashes. Do not invent model names, datasets, or metrics.
Ask the owner for real values before seeding.

---

## Phased implementation plan

Each phase is independently testable and deployable. Do not start until the plan
is approved, and provide the real model details before Phase 1.

- Phase 0, confirm scope: a dedicated `models.html` page versus a section on the
  Portfolio page, and the list of real models with real metrics and Space URLs.
- Phase 1, backend: add the `models` table to the schema, extend the seed with
  real content, add the `db.js` functions, and add the public `/api/models`
  route. No visible UI change yet, so nothing can break for visitors.
- Phase 2, admin: add the Models tab and its CRUD, reusing the editor dialog.
- Phase 3, public: add `models.html`, add "Models" to the shared navigation,
  build the card, and wire the click-to-load Hugging Face iframe.
- Phase 4, polish and SEO: add the Models page to `sitemap.xml`, and take the
  quick SEO wins from Part 1 (Open Graph, JSON-LD, canonical) at the same time.

Deploy and check after each phase.

---

## Sources

- [Machine Learning Engineer Portfolio Playbook, Interview Kickstart](https://interviewkickstart.com/blogs/articles/machine-learning-engineer-portfolio)
- [Ultimate Guide to AI Engineering Portfolios, DataExpert](https://www.dataexpert.io/blog/ultimate-guide-ai-engineering-portfolios)
- [Machine Learning Engineer Portfolio Website, Free Template and Examples 2026, Magic Self](https://www.magic-self.dev/examples/machine-learning-engineer)
- [Embed your Space in another website, Hugging Face documentation](https://huggingface.co/docs/hub/en/spaces-embed)
- [Gradio Spaces, Hugging Face documentation](https://huggingface.co/docs/hub/en/spaces-sdks-gradio)
