#!/usr/bin/env node
// build.mjs — renders neurotidy.co into dist/. Run from the site folder: node src/build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderArticle, renderPage, renderGuides, renderHome, renderRobots, renderSitemap, renderLegacySitemap, renderFeed, renderLlms, renderLlmsFull, GROUP_LABELS } from "./templates/render.mjs";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(SITE, "src");
const DIST = path.join(SITE, "dist");
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
// Full timestamp for sitemap lastmod. Bing reads lastmod as a freshness signal for AI answers and
// asks for ISO 8601 with a time; it only moves when the content hash moves, never on a rebuild.
const NOW = process.env.BUILD_DATE ? `${process.env.BUILD_DATE}T00:00:00Z` : new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const stampOf = (prev, modified) => prev?.modified_at || `${modified}T00:00:00Z`;
const cfg = JSON.parse(readFileSync(path.join(SRC, "site.config.json"), "utf8"));
const sources = JSON.parse(readFileSync(path.join(SRC, "content/sources.json"), "utf8"));
const datesPath = path.join(SRC, "content/dates.json");
const dates = existsSync(datesPath) ? JSON.parse(readFileSync(datesPath, "utf8")) : {};
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const fail = (m) => { console.error("BUILD ERROR:", m); process.exit(1); };

// ---- load content
const loadDir = (dir, kind) => readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => {
  const meta = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  const bodyFile = path.join(dir, f.replace(/\.json$/, ".body.html"));
  if (!existsSync(bodyFile)) fail(`${kind} ${f} has no body file`);
  const body = readFileSync(bodyFile, "utf8");
  const key = `${kind}:${meta.slug || meta.name}`;
  const h = hash(JSON.stringify({ ...meta, modified: undefined }) + body);
  const prev = dates[key];
  const same = prev && prev.hash === h;
  const modified = same ? prev.modified : TODAY;
  const modified_at = same ? stampOf(prev, modified) : NOW;
  dates[key] = { hash: h, modified, modified_at };
  return { ...meta, body, modified, modified_at };
});
const articles = loadDir(path.join(SRC, "content/articles"), "article").sort((a, b) => a.published.localeCompare(b.published) || a.slug.localeCompare(b.slug));
const pages = loadDir(path.join(SRC, "content/pages"), "page");
const byslug = Object.fromEntries(articles.map((a) => [a.slug, a]));

// ---- validate content contracts (fail the build, never ship a broken link or an unverified citation)
for (const a of articles) {
  if (!a.slug || !a.title || !a.description || !a.h1 || !a.published) fail(`article ${a.slug} missing required fields`);
  if (a.title.length > 70) fail(`article ${a.slug} title too long (${a.title.length})`);
  if (a.description.length > 160) fail(`article ${a.slug} description too long (${a.description.length})`);
  if (!GROUP_LABELS[a.group]) fail(`article ${a.slug} unknown group ${a.group}`);
  for (const r of a.related) if (!byslug[r]) fail(`article ${a.slug} related slug ${r} does not exist`);
  if (a.related.length < 3) fail(`article ${a.slug} needs >=3 related`);
  if (a.sources.length < 2) fail(`article ${a.slug} needs >=2 sources`);
  for (const s of a.sources) if (!sources[s.id]) fail(`article ${a.slug} unknown source ${s.id}`);
  const cites = [...a.body.matchAll(/class="cite" href="#source-([a-z0-9]+)"/g)].map((m) => m[1]);
  if (cites.length < 2) fail(`article ${a.slug} needs >=2 inline cites`);
  for (const c of cites) if (!a.sources.some((s) => s.id === c)) fail(`article ${a.slug} cites ${c} not in sources[]`);
  for (const m of a.body.matchAll(/href="\/articles\/([a-z0-9-]+)\.html"/g)) if (!byslug[m[1]]) fail(`article ${a.slug} links to missing article ${m[1]}`);
  if (/—/.test(a.body) || /—/.test(JSON.stringify(a))) fail(`article ${a.slug} contains an em dash`);
  if (/\bDr\.|\bMD\b|\bPhD\b/.test(a.body)) fail(`article ${a.slug} contains a credential claim`);
  if (!/^\s*<p class="lede">/.test(a.body)) fail(`article ${a.slug} body must start with the lede`);
}
const pagePaths = new Set(pages.map((p) => p.path));
for (const p of pages) {
  if (!p.path || !p.path.startsWith("/") || !p.path.endsWith("/")) fail(`page ${p.name} path must be /dir/`);
  if (/—/.test(p.body) || /—/.test(JSON.stringify(p))) fail(`page ${p.name} contains an em dash`);
  for (const m of p.body.matchAll(/href="\/articles\/([a-z0-9-]+)\.html"/g)) if (!byslug[m[1]]) fail(`page ${p.name} links to missing article ${m[1]}`);
}
for (const p of pages.concat(articles)) for (const m of p.body.matchAll(/href="(\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)?)"/g)) {
  const target = m[1];
  if (!pagePaths.has(target) && !["/guides/", "/free-adhd-task-cards/", "/about/"].includes(target)) fail(`${p.slug || p.name} links to unknown page ${target}`);
}

// ---- render
rmSync(DIST, { recursive: true, force: true });
mkdirSync(path.join(DIST, "articles"), { recursive: true });
const write = (rel, content) => { const f = path.join(DIST, rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, content); };
const entries = [];
for (const a of articles) {
  write(`articles/${a.slug}.html`, renderArticle(cfg, a, { sources, byslug, modified: a.modified }));
  entries.push({ path: `/articles/${a.slug}.html`, modified: a.modified, modified_at: a.modified_at });
}
const parentOf = (p) => (p.path.startsWith("/adhd-mess-types/") && p.path !== "/adhd-mess-types/" ? { name: "ADHD mess types", path: "/adhd-mess-types/" } : null);
for (const p of pages) {
  write(`${p.path.slice(1)}index.html`, renderPage(cfg, { ...p, parent: parentOf(p) }, { modified: p.modified }));
  entries.push({ path: p.path, modified: p.modified, modified_at: p.modified_at });
}
const guidesMod = articles.map((a) => a.modified).sort().at(-1);
const guidesModAt = articles.map((a) => a.modified_at).sort().at(-1);
write("guides/index.html", renderGuides(cfg, articles, { modified: guidesMod }));
entries.push({ path: "/guides/", modified: guidesMod, modified_at: guidesModAt });
write("index.html", renderHome(cfg, articles, pages, { modified: guidesMod }));
entries.unshift({ path: "/", modified: guidesMod, modified_at: guidesModAt });

// quiz: keep the hand-written page, normalize head to the origin, add analytics + event hook + static types block
let quiz = readFileSync(path.join(SITE, "quiz.html"), "utf8");
quiz = quiz.replace(/https:\/\/neurotidy\.co\/quiz\.html/g, `${cfg.origin}/quiz.html`).replace(/"url":"https:\/\/neurotidy\.co\/"/g, `"url":"${cfg.origin}/"`);
if (!quiz.includes(cfg.analytics_script)) quiz = quiz.replace('<link rel="stylesheet" href="/style.css">', `<link rel="stylesheet" href="/style.css">\n<script defer src="${cfg.analytics_script}"></script>`);
const types = `<section class="types" id="types" style="max-width:var(--maxw);margin:32px auto 0;padding:0 20px">
<h2>The four ADHD mess types</h2>
<p>The quiz sorts your home into one of four patterns. Each has its own page with the first card to use. All four are valid, none of them mean you are lazy.</p>
<ul class="guide-list">
<li><a href="/adhd-mess-types/doom-piler/">The Doom Piler</a><span>Every flat surface is a someday-pile of deferred decisions. First card: Doom Pile Triage.</span></li>
<li><a href="/adhd-mess-types/floordrobe-keeper/">The Floordrobe Keeper</a><span>Clothes live on the floor and the chair because putting them away is six invisible steps. First card: The 5-Minute Floordrobe.</span></li>
<li><a href="/adhd-mess-types/out-of-sight-out-of-mind/">The Out-of-Sight, Out-of-Mind</a><span>If you cannot see it, it stops existing, so everything stays out. First card: Visible Systems.</span></li>
<li><a href="/adhd-mess-types/churn-and-burn/">The Churn and Burn</a><span>Four-hour deep cleans, then nothing for three weeks. First card: The Bad-Day Floor.</span></li>
</ul>
<p><a href="/adhd-mess-types/">Read about all four types</a></p>
</section>
`;
if (!quiz.includes('id="types"')) quiz = quiz.replace("</main>", `</main>\n${types}`);
quiz = quiz.replace("</body>", `<script>document.addEventListener("click",function(e){var a=e.target.closest("[data-event]");if(a&&window.va){va("event",{name:a.getAttribute("data-event"),data:{path:location.pathname}})}});</script>\n</body>`);
quiz = quiz.replace(/—/g, ",");
write("quiz.html", quiz);
{
  const same = dates["quiz"]?.hash === hash(quiz);
  const modified = same ? dates["quiz"].modified : TODAY;
  entries.push({ path: "/quiz.html", modified, modified_at: same ? stampOf(dates["quiz"], modified) : NOW });
  dates["quiz"] = { hash: hash(quiz), modified, modified_at: entries.at(-1).modified_at };
}

// static files
write("robots.txt", renderRobots(cfg));
write("sitemap.xml", renderSitemap(cfg, entries));
write("feed.xml", renderFeed(cfg, articles));
if (cfg.legacy?.paths?.length) write("sitemap-legacy.xml", renderLegacySitemap(cfg, entries));
const llmPages = pages.map((p) => ({ ...p, llms_section: [cfg.products.free_cards_page, cfg.products.free_checklist_page, cfg.products.free_planner_page, cfg.products.home_reset_page].includes(p.path) ? "resources" : "about" }));
write("llms.txt", renderLlms(cfg, articles, llmPages));
write("llms-full.txt", renderLlmsFull(cfg, articles, pages, sources));
write("vercel.json", JSON.stringify({
  trailingSlash: true,
  headers: [
    { source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" } ] },
    { source: "/style.css", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    { source: "/(.*).pdf", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
  ],
}, null, 2) + "\n");
for (const f of ["style.css", "BingSiteAuth.xml", "d762449bf13f0503c58f46b2c9758ee4.txt"]) cpSync(path.join(SITE, f), path.join(DIST, f));
cpSync(path.join(SITE, "go"), path.join(DIST, "go"), { recursive: true });
cpSync(path.join(SRC, "assets"), DIST, { recursive: true });
writeFileSync(datesPath, JSON.stringify(dates, null, 2) + "\n");

const count = (dir) => readdirSync(dir).reduce((n, f) => n + (statSync(path.join(dir, f)).isDirectory() ? count(path.join(dir, f)) : 1), 0);
console.log(`built ${articles.length} articles, ${pages.length} pages, ${entries.length} sitemap entries, ${count(DIST)} files → dist/ (build date ${TODAY})`);
