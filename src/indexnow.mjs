#!/usr/bin/env node
// indexnow.mjs — ping IndexNow (Bing + partners) for a list of URLs, or every sitemap URL by default.
//   node src/indexnow.mjs [url ...]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(path.join(SITE, "src/site.config.json"), "utf8"));
const KEY = "d762449bf13f0503c58f46b2c9758ee4";
const host = new URL(cfg.origin).host;
let urls = process.argv.slice(2);
if (!urls.length) urls = [...readFileSync(path.join(SITE, "dist/sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ host, key: KEY, keyLocation: `${cfg.origin}/${KEY}.txt`, urlList: urls }) });
console.log(`IndexNow: HTTP ${r.status} for ${urls.length} URLs (${host})`);
process.exit(r.status === 200 || r.status === 202 ? 0 : 1);
