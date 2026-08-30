# Vercel deploy shape

The Vercel project `neurotidy` is deployed with two files (`vercel.json`, `package.json`) and a build command that downloads this repo's `main` tarball and exposes `dist/` as the output directory (see package.json "build" in the deploy files).

Release procedure: `node src/build.mjs` → `node src/checks/audit.mjs --dist --fail-on warning` → commit + push `dist/` → trigger a Vercel production deploy (deploy tool or dashboard "Redeploy") → `node src/checks/audit.mjs --origin https://neurotidy.co` → `node src/indexnow.mjs`.
