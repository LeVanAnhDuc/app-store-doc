# Ducker — the front door to an app ecosystem, editable without a deploy

> The project's display name is **Ducker**, and the GitHub repository slug is
> `web-app-ducker` to match it. Dated specs and plans under `docs/superpowers/`
> still carry the original `app-store-doc` slug in their filenames and prose —
> those are historical records and are left as written.

The public entry point to [@LeVanAnhDuc](https://github.com/LeVanAnhDuc)'s app
ecosystem: a landing page, a directory of every app, a detail page per app, and
the documentation — all driven by an admin CMS.

Docs are one content type here, not the whole product. `App`, `Feature`,
`DocPage`, `Section` and `NavNode` are peers in the schema, which is why the
ecosystem showcase lives on this site rather than in a separate app.

Every app gets its own section — what it is, how to try it, how to use it, what
it does — plus ecosystem overview pages and an OAuth integration guide. Content
is edited through the CMS, and the public pages change without a redeploy.

> **Status:** the application code is complete — 242 tests pass (26 skip without
> `DATABASE_URL_TEST`), `tsc --noEmit` is clean, and `next build` succeeds even
> with no database. Migrations, seeding and the end-to-end content roundtrip have
> all been run for real against local Postgres.
> **Never deployed.** That needs Neon, Cloudflare R2 and Vercel credentials the
> build never had. The steps are in [`docs/operations.md`](docs/operations.md).

## Features

- **Public ecosystem pages**
  - A page per app — hero, feature grid, and body sections rendered from Markdown
  - An ecosystem overview, per-app detail pages, and standalone doc pages
  - A table of contents, a search dialog, and a sidebar navigation tree
  - A draft preview route, gated by `PREVIEW_SECRET` — without the secret the
    preview is closed, not open

- **Navigation the CMS owns**
  - The whole navigation tree is content, not code: nodes are created, nested,
    reordered and translated in the admin, and the public sidebar follows
  - Reordering uses explicit order controls rather than only drag, so it works
    on a phone and with a keyboard

- **Multiple languages, honestly labelled**
  - Locales live in the database; `prebuild` generates
    `src/i18n/locales.generated.ts` from the `Locale` table, so adding a language
    is a content change
  - Locales carry an explicit order, which drives the switcher rather than
    whatever order the database returns
  - Switching language and navigating both preserve the locale in the URL
  - **Untranslated content falls back and says so** — a notice sits beside *each*
    section and feature that is showing another language, not once at the top of
    the page. Translation coverage is uneven, so a page-level notice would
    describe most of the page wrongly. Content in the requested language renders
    no notice at all
  - A translation meter in the admin shows how complete each language is

- **Admin CMS**
  - Sign in with a single administrator account. `ADMIN_PASSWORD_HASH` is a
    **bcrypt hash**, not a plaintext password
  - **Login is rate limited** — 5 attempts per 15 minutes per IP, on a sliding
    window
  - Edit apps, features, doc pages and sections, each with its own translations,
    through a Markdown editor
  - Reorder features and sections; manage locales and the navigation tree

- **Media library on Cloudflare R2**
  - Upload by dropping files, browse the library, and pick an image from an
    editor
  - **Dimensions are measured at upload time** by reading the image header. The
    reader never throws: an unusual but valid image must not break the upload, so
    `Media.width`/`height` are nullable on purpose and a size that cannot be read
    is simply absent

- **Three-state theme toggle**
  - Light, dark, or follow the system — with no colour flash on first paint

- **Mobile layout**
  - A navigation drawer for small screens, and a responsive shell shared by the
    public site and the admin

- **One door per external concern**
  - A component never imports Prisma, Auth.js or the S3 SDK. `src/server/content`
    is the only place that touches Prisma, `src/server/auth` the only place that
    knows Auth.js, `src/server/media` the only place that knows R2 — so swapping
    cache, database, storage provider or auth mechanism each touches one layer
  - **Every server action calls `requireAdmin()` on its first line.** A Server
    Action is its own HTTP endpoint, so protecting the `/admin` layout does not
    protect it

## Tech Stack

Next.js 16 · Prisma 7 · PostgreSQL (Neon) · Auth.js · next-intl · Cloudflare R2 · Vercel

Testing: Vitest (242 unit tests, 26 requiring a database) and Playwright (16 e2e).

## Running

Needs Node 20+ and npm.

```bash
npm install                # postinstall runs `prisma generate`
cp .env.example .env       # PowerShell: Copy-Item .env.example .env
npm run dev                # http://localhost:3000 → redirects to /vi
```

Without `DATABASE_URL` the site still builds but has **no content**:
`generateStaticParams` returns `[]` and every query throws at its first touch of
the database. To see real content, follow sections 1 and 5 of
[`docs/operations.md`](docs/operations.md), then set `DATABASE_URL` in `.env`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | `prebuild` generates `src/i18n/locales.generated.ts` from the `Locale` table, then `next build` |
| `npm start` | Serve the build |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest once, `--maxWorkers=1` (parallel runs are flaky on Windows) |
| `npm run typecheck` | `tsc --noEmit` — **vitest does not typecheck**, so always run this separately |
| `npm run lint` | ESLint |
| `npm run e2e` | Playwright. It starts its own server with `npm start`, so `npm run build` first |

Four commands need no credentials at all: `test:run`, `typecheck`, `lint`,
`build`. The tests that need Postgres live in `*.db.test.ts` and **skip
themselves** when `DATABASE_URL_TEST` is missing — a green suite in that state
proves nothing about the query layer. How to run them:
[`docs/operations.md`](docs/operations.md), section 7.

### Environment variables

`.env.example` lists them all. The three easiest to get wrong:

- `ADMIN_PASSWORD_HASH` is a **bcrypt hash**, not the raw password.
- Only Next loads `.env` automatically. **Prisma CLI 7 and vitest do not read
  `.env`** — for those, set the variable in the shell session itself.
- Without `PREVIEW_SECRET` the draft preview page is **closed**, not open.

Each variable explained, the commands that generate values, and how to get them
from Neon and R2: [`docs/operations.md`](docs/operations.md).

## Ecosystem

| Repo | Role |
|---|---|
| [`web-app-store`](https://github.com/LeVanAnhDuc/web-app-store) | IDMS — the sign-in gateway and app launcher. The OAuth 2.0/OIDC provider itself is not built yet |
| [`web-app-match-cv`](https://github.com/LeVanAnhDuc/web-app-match-cv) | Matching a CV against a job description |
| [`web-app-manage-gym`](https://github.com/LeVanAnhDuc/web-app-manage-gym) | Training log |
| [`web-app-AI-study-coach`](https://github.com/LeVanAnhDuc/web-app-AI-study-coach) | Study assistant |
| [`web-app-AI-workflow-automation-platform`](https://github.com/LeVanAnhDuc/web-app-AI-workflow-automation-platform) | Ducker Flow Grid — visual workflow automation |
| [`app-calculate-badminton`](https://github.com/LeVanAnhDuc/app-calculate-badminton) | Splitting badminton court costs |
| [`web-app-shorten-link`](https://github.com/LeVanAnhDuc/web-app-shorten-link) | Link shortener |

The client and API halves of IDMS, CV matching and the link shortener each live
in one repository now — they used to be split into `client-…` and `api-…` pairs.

As of 17.08.2026, no satellite app is actually wired into IDMS yet.

## Documentation

| Task | Document |
|---|---|
| **Coming back to the project — where it stands, what is owed** | **[`docs/status.md`](docs/status.md) — open this first** |
| Why things are the way they are — decisions, working method, traps already paid for | [`docs/session-log.md`](docs/session-log.md) |
| **Standing up infrastructure, deploying, running the DB-backed tests** | **[`docs/operations.md`](docs/operations.md)** |
| **Building any interface** | **[`docs/design/design-rules.md`](docs/design/design-rules.md) — mandatory** |
| The approved interface | [`docs/design/mockups/v3/index.html`](docs/design/mockups/v3/index.html) — **v3 is the one in use**; `mockups/index.html` and `v2/` are historical snapshots of older decisions |
| Architecture, data model, i18n, auth, testing | [spec 17.08](docs/superpowers/specs/2026-08-17-app-store-doc-design.md) — the original · [spec 18.08](docs/superpowers/specs/2026-08-18-ducker-navigation-tree-design.md) — **supersedes §6, §7, §8 and §9.3** of the original |
| The per-task execution plan | [`docs/superpowers/plans/2026-08-17-app-store-doc.md`](docs/superpowers/plans/2026-08-17-app-store-doc.md) |
| Conventions for changing code in this repo | [`CLAUDE.md`](CLAUDE.md) |

## Seed content is a draft

`prisma/seed.ts` was written from the public READMEs of those repos, not from
their source. The "try it in 5 minutes" parts may have the wrong port or script
name. After the first deploy, **the database is the source of truth** — edit
through the CMS, not `seed.ts`.
