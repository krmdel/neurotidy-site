# neurotidy.co

Source for **https://neurotidy.co**. Neurotidy makes free printable ADHD task cards, a free one-page ADHD cleaning checklist, and plain-language guides for cleaning your home with ADHD, written under the pen name Mara Ellery. It is an ADHD home-cleaning resource, not a software tool, app or supplement, and unrelated to the `neurotidy` Python package. Zero-dependency static generator.

Site: https://neurotidy.co · Free task cards: https://neurotidy.co/free-adhd-task-cards/ · Free cleaning checklist: https://neurotidy.co/free-adhd-cleaning-checklist/ · Guides: https://neurotidy.co/guides/

- `src/content/articles/*.json|*.body.html` — guides (metadata + body)
- `src/content/pages/*` — free cards, $9 deck, about, mess types
- `src/content/sources.json` — verified references (DOI-checked); every article cites only these
- `src/build.mjs` → `dist/` (pages, sitemap, llms.txt, llms-full.txt, robots, vercel.json, assets)
- `src/checks/audit.mjs` — deterministic SEO/answer-engine audit (`--dist` or `--origin URL`)
- `src/indexnow.mjs` — IndexNow ping

Build: `node src/build.mjs` · Audit: `node src/checks/audit.mjs --dist --fail-on warning` · Tests live in the business-os repo (`tests/neurotidy-seo/`).

Deploy: Vercel pulls `dist/` from this repo's `main` at build time (see `deploy/vercel-build.md`). Push `dist/` after every build.
