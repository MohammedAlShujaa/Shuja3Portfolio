# Personal Portfolio Website and Admin Panel

Personal portfolio for **Mohammed Al-Shujaa**, final-year Information Engineering student at UNTAG Surabaya, with a database-driven admin panel for keeping the content current without editing code or redeploying.

Built on the "Neural Navy" design system: a dark navy palette, Space Grotesk and Inter and JetBrains Mono, and a faint t-SNE constellation in the hero that echoes the TripAdvisor NLP project.

## Tech stack

| Layer | Choice |
|---|---|
| Public site | HTML5, CSS3 (Grid, Flexbox, media queries), vanilla JavaScript. No frontend framework. |
| Backend | Node.js, Express |
| Database | PostgreSQL (Neon / Vercel Postgres) via the `pg` driver |
| Auth | bcrypt password hash, stateless signed cookie session (`cookie-session`) |
| Uploads | multer to `/public/uploads` (local only, see notes) |

The four public pages fetch their content from JSON routes under `/api`, so anything saved in the admin panel appears on the live site immediately.

## Project structure

```
public/              static site served by Vercel (or by Express locally)
  index.html         Home
  about.html         About
  portfolio.html     Portfolio
  contact.html       Contact
  css/style.css      the Neural Navy design system
  js/                main.js (shared) + one script per page
  img/               placeholder artwork, replace with real exports
  uploads/           images uploaded through the admin panel (local only)
server/
  app.js             builds and exports the Express app
  index.js           local entry point (npm start)
  db.js              the only module that touches the Postgres driver
  schema.sql         table definitions
  seed.js            creates the schema and inserts the real content
  auth.js            login check and the two route guards
  routes/public.js   read-only JSON + the contact form endpoint
  routes/admin.js    login and the authenticated CRUD routes
  views/             admin login, dashboard, admin.js, admin.css
api/index.js         Vercel serverless entry point
vercel.json          rewrites /api/* and /admin/* to the Express handler
```

Admin pages live in `server/views`, not in `public`, so static hosting cannot serve the dashboard to an anonymous visitor and bypass the session check.

## Setup

You need Node.js 18 or newer and a PostgreSQL database. Postgres is used for both local development and production, so what you test is what you ship.

### 1. Install

```bash
npm install
cp .env.example .env      # on Windows: copy .env.example .env
```

### 2. Get a database

Pick either option and put the connection string in `POSTGRES_URL`.

**Option A: Neon (free, no local install).** Create a free project at https://neon.tech, then copy the connection string from the dashboard. It looks like:

```
POSTGRES_URL=postgres://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

This is also what Vercel Postgres gives you, so local and production behave identically. You can use one database for both, or create a second free Neon project as a development database.

**Option B: local Postgres in Docker (no account needed).** Good for an offline demo:

```bash
docker run --name portfolio-db -e POSTGRES_USER=portfolio -e POSTGRES_PASSWORD=portfolio \
  -e POSTGRES_DB=portfolio -p 5432:5432 -d postgres:16
```

```
POSTGRES_URL=postgres://portfolio:portfolio@localhost:5432/portfolio
```

SSL is enabled automatically for remote hosts and skipped for `localhost`.

### 3. Fill in the rest of `.env`

```
ADMIN_PASSWORD=choose-a-strong-password
SESSION_SECRET=paste-a-long-random-string
PORT=3000
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env` is gitignored. Never commit it.

### 4. Seed and run

```bash
npm run seed     # creates the tables and inserts the real content
npm start        # http://localhost:3000
```

`npm run seed` drops every table first, so treat it as a reset. It also creates the single admin account (username `admin`) using `ADMIN_PASSWORD`.

Sign in at http://localhost:3000/admin.

## Admin panel

Everything under `/admin`, and every POST, PUT, and DELETE route, requires a session.

- **Profile**: hero name, headline, subheading, intro, photo, both call to action buttons, location, availability.
- **Projects**: full CRUD with category, tech tags, links, a featured toggle, sort order, and an image by URL or upload.
- **Skills**: add, edit, delete, and reorder within the four groups.
- **Updates**: the feed shown on the About page.
- **Social links**: shown in the hero, footer, and contact page.
- **Messages**: contact form submissions, with mark read/unread, delete, and an unread badge.

Auth is deliberately simple for a student project: one account, a bcrypt hash, and a signed cookie. It has no rate limiting, password reset, or two-factor. The password only ever lives in the `ADMIN_PASSWORD` environment variable, never in the repository.

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import it at https://vercel.com/new.
3. In the project's **Storage** tab, create a Postgres store and connect it. Vercel injects `POSTGRES_URL` automatically.
4. In **Settings, Environment Variables**, add `ADMIN_PASSWORD` and `SESSION_SECRET`.
5. Seed the production database once. Copy `POSTGRES_URL` from the Storage tab into your local `.env`, then run `npm run seed` from your machine against it. (Alternatively `vercel env pull .env` to fetch every variable at once.)
6. Deploy.

`vercel.json` rewrites `/api/*` and `/admin/*` to the Express handler in `api/index.js`; everything in `public/` is served by Vercel's static hosting.

Two serverless constraints are already handled in the code:

- **Sessions.** `express-session`'s default memory store resets on every invocation, which would sign the admin out constantly. This project uses a stateless signed cookie instead, so login survives across serverless invocations.
- **File uploads.** Vercel's filesystem is read only, so `multer` writing to disk cannot work in production. The upload route returns a clear error there, and pasting an image URL is the supported path. Persistent uploads on Vercel would need a blob store (Vercel Blob or S3) as a follow-up.

### Deploying to Render or Railway instead

Both run a normal long-lived Node process, so `npm start` works as is and file uploads to `/public/uploads` work until the instance restarts (their disks are also ephemeral unless you attach a volume). Set the same three environment variables, add a Postgres database from their dashboard, and run `npm run seed` once.

## Assignment requirements

| Requirement | Where |
|---|---|
| Home: photo, intro, headline with name and role, call to action | `public/index.html` |
| About: title, background and education paragraph, skills as icon rows | `public/about.html` |
| Portfolio: cards with descriptions, links, category filter | `public/portfolio.html` |
| Contact: name/email/message form, social links | `public/contact.html` |
| Navigation reaching every page, responsive | shared navbar on all four pages, hamburger under 768px |
| Mock-up | design follows the Figma blueprint; see the TODO below |

Skills are shown as grouped icon rows with names, never as percentage bars or star ratings: unverifiable numbers invite doubt rather than confidence.

## Notes and TODO

- **Replace the placeholder artwork in `public/img/`.** The profile photo and the five project thumbnails are on-theme SVG stand-ins, not real images. Swap in a real head-and-shoulders photo (640x640) and real exports: the t-SNE cluster plot, the predicted vs actual scatter, a TIMS optimization window, and the IT Inventory dashboard. Export plots on a dark background so they glow on `#0B1121`. You can change all of these from the admin panel without touching code.
- **A live demo is the biggest credibility win available.** Wrap the House Price model in Streamlit or Gradio, deploy free on Hugging Face Spaces, and paste the URL into that project's "Live demo URL" field in the admin.
- Cards with no link show "Private work, available on request" rather than a dead `#` link. If you host the TIMS thesis or journal PDF, add it as the project's live URL.
- Devicon supplies the skill icons via CDN. Tools without a Devicon glyph (NLTK, n8n, SQL, Excel, Power BI) fall back to an initials tile automatically.
- Consider renaming the NLP repository to something cleaner, such as `tripadvisor-reviews-nlp`, and update the link in the admin.
