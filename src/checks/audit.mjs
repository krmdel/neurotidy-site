#!/usr/bin/env node
// audit.mjs — run the deterministic audit against dist/ or a live origin.
//   node src/checks/audit.mjs --dist                       (checks ./dist against the configured origin)
//   node src/checks/audit.mjs --origin https://www.neurotidy.co [--out report.md] [--fail-on warning|critical] [--json out.json]
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeHtml, siteChecks, renderReport, ISSUES } from "./audit-core.mjs";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cfg = JSON.parse(readFileSync(path.join(SITE, "src/site.config.json"), "utf8"));
const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true) : d; };
const origin = arg("--origin") && arg("--origin") !== true ? String(arg("--origin")).replace(/\/$/, "") : cfg.origin;
const useDist = !!arg("--dist") || !arg("--origin");
const failOn = arg("--fail-on", "critical");
const today = process.env.AUDIT_DATE || new Date().toISOString().slice(0, 10);
const ctx = { origin, analyticsScript: cfg.analytics_script, today };
const UA = "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot) neurotidy-audit";

const walk = (dir, out = []) => { for (const f of readdirSync(dir)) { const p = path.join(dir, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const urlFromDist = (f, dist) => { const r = "/" + path.relative(dist, f).split(path.sep).join("/"); return origin + (r.endsWith("/index.html") ? r.slice(0, -"index.html".length) : r); };

async function fetchText(u, redirect = "follow") {
  const t0 = Date.now();
  const r = await fetch(u, { headers: { "user-agent": UA }, redirect, signal: AbortSignal.timeout(15000) });
  return { status: r.status, text: await r.text(), ms: Date.now() - t0, location: r.headers.get("location") };
}
const parseSitemap = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

let pages = [], robots = "", llms = "", sitemapUrls = [], sitemapStatuses = {}, extra = [];
if (useDist) {
  const dist = path.join(SITE, "dist");
  const files = walk(dist).filter((f) => f.endsWith(".html") && !f.includes(`${path.sep}go${path.sep}`));
  for (const f of files) pages.push(analyzeHtml(readFileSync(f, "utf8"), urlFromDist(f, dist), ctx));
  robots = readFileSync(path.join(dist, "robots.txt"), "utf8");
  llms = readFileSync(path.join(dist, "llms.txt"), "utf8");
  sitemapUrls = parseSitemap(readFileSync(path.join(dist, "sitemap.xml"), "utf8"));
  const existing = new Set(files.map((f) => urlFromDist(f, dist)));
  for (const p of pages) for (const l of p.links) { const clean = l.split("?")[0]; if (clean.startsWith(origin) && !existing.has(clean) && !/\.(pdf|png|jpg|css|txt|xml)$/.test(clean) && !clean.includes("/go/")) extra.push({ id: "broken-internal-link", severity: "critical", title: ISSUES["broken-internal-link"].title, detail: `${clean} (from ${p.url})`, pages: [p.url] }); }
} else {
  const sm = await fetchText(`${origin}/sitemap.xml`);
  sitemapUrls = parseSitemap(sm.text);
  robots = (await fetchText(`${origin}/robots.txt`)).text;
  llms = (await fetchText(`${origin}/llms.txt`)).text;
  for (const u of sitemapUrls) {
    const r = await fetchText(u, "manual");
    sitemapStatuses[u] = r.status;
    if (r.status === 200) { const p = analyzeHtml(r.text, u, ctx); if (r.ms > 1500) p.issues.push({ id: "slow-response", severity: "info", title: ISSUES["slow-response"].title, detail: `${r.ms} ms` }); pages.push(p); }
    else if (r.status >= 500) extra.push({ id: "server-error", severity: "critical", title: ISSUES["server-error"].title, pages: [u] });
    else if (r.status >= 400) extra.push({ id: r.status === 403 || r.status === 429 ? "blocked-page" : "broken-page", severity: r.status === 403 || r.status === 429 ? "critical" : "warning", title: ISSUES[r.status === 403 || r.status === 429 ? "blocked-page" : "broken-page"].title, pages: [u] });
  }
  // internal links across the live site (HEAD-ish GET, manual redirects, dedupe)
  const seen = new Set();
  for (const p of pages) for (const l of p.links) { const clean = l.split("?")[0].split("#")[0]; if (!clean.startsWith(origin) || seen.has(clean) || clean.includes("/go/")) continue; seen.add(clean); const r = await fetchText(clean, "manual"); if (r.status !== 200) extra.push({ id: "broken-internal-link", severity: "critical", title: ISSUES["broken-internal-link"].title, detail: `${clean} → HTTP ${r.status} (from ${p.url})`, pages: [p.url] }); }
  // redirect chain from the bare http apex to the origin
  try {
    const apex = origin.replace("://www.", "://");
    let u = apex.replace("https://", "http://") + "/", hops = 0;
    for (let i = 0; i < 6; i++) { const r = await fetchText(u, "manual"); if (r.status >= 300 && r.status < 400 && r.location) { hops++; u = new URL(r.location, u).href; } else break; }
    if (hops >= 2) extra.push({ id: "redirect-chain", severity: "warning", title: ISSUES["redirect-chain"].title, detail: `${hops} hops from http://${new URL(apex).host}/ to ${u}` });
  } catch { /* ignore */ }
}
const siteIssues = siteChecks(pages, { robots, sitemapUrls, llms, sitemapStatuses }, ctx);
const report = renderReport({ target: useDist ? `dist/ (as ${origin})` : origin, pages, siteIssues, generated: new Date().toISOString(), extra });
const out = arg("--out");
if (out && out !== true) { mkdirSync(path.dirname(String(out)), { recursive: true }); writeFileSync(String(out), report.markdown); }
const jsonOut = arg("--json"); if (jsonOut && jsonOut !== true) writeFileSync(String(jsonOut), JSON.stringify({ ...report, pages }, null, 2));
console.log(report.markdown.split("\n").slice(0, 6).join("\n"));
if (report.all.length) console.log(report.markdown.split("\n").slice(6).join("\n"));
const bad = failOn === "warning" ? report.critical + report.warning : report.critical;
process.exit(bad ? 1 : 0);
