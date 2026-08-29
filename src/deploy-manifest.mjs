#!/usr/bin/env node
// deploy-manifest.mjs — dist/ → JSON file array for the Vercel deploy tool (base64 for binaries). Prints the count first.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(SITE, "dist");
const walk = (dir, out = []) => { for (const f of readdirSync(dir)) { const p = path.join(dir, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const bin = /\.(pdf|png|jpg|jpeg|gif|webp|ico|woff2?)$/i;
const files = walk(DIST).map((f) => { const rel = path.relative(DIST, f).split(path.sep).join("/"); return bin.test(rel) ? { file: rel, data: readFileSync(f).toString("base64"), encoding: "base64" } : { file: rel, data: readFileSync(f, "utf8") }; });
const out = process.argv[2] || path.join(SITE, "dist-manifest.json");
writeFileSync(out, JSON.stringify(files));
console.log(`${files.length} files, ${(statSync(out).size / 1024).toFixed(0)} KB manifest → ${out}`);
console.log(files.map((f) => f.file).sort().join("\n"));
