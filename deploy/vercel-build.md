# Vercel deploy shape

The Vercel project `neurotidy` is deployed with two files (`vercel.json`, `package.json`) and a build command that downloads this repo's `main` tarball and exposes `dist/` as the output directory (see package.json "build" in the deploy files).

Release procedure: `node src/build.mjs` → `node src/checks/audit.mjs --dist --fail-on warning` → commit + push `dist/` → trigger a Vercel production deploy (deploy tool or dashboard "Redeploy") → `node src/checks/audit.mjs --origin https://neurotidy.co` → `node src/indexnow.mjs`.

## Short typeable paths (2026-08-30)

TikTok bios under 1,000 followers cannot carry a clickable link, so the bio text names a short path that a person can type. The deploy shell's `vercel.json` carries the redirects (the shell's vercel.json is the one Vercel reads; `dist/vercel.json` is not):

- `/tt` → `/go/tt.html` (TikTok bio, `utm_source=tiktok&utm_medium=bio`)
- `/ig` → `/go/ig.html`
- `/cards` → `/go/cards.html`
- `/deck` → `/go/reset.html`

Test started 2026-08-30 with the TikTok bio "free ADHD task cards → neurotidy.co/tt"; read `/go/tt.html` pageviews in the weekly funnel report.
