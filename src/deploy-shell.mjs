// deploy-shell.mjs — deploy the Vercel shell in deploy/shell/ to production through the Vercel API.
//   node --env-file=<business-os .env> src/deploy-shell.mjs [--dry]
// The shell is four files (vercel.json, middleware.js, package.json, README.md). Its build downloads this repo's
// main tarball and serves dist/, so content changes only need a redeploy; this script is for shell changes
// (redirects, headers, middleware). Until 2026-10-05 the shell existed only inside Vercel.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHELL = path.join(HERE, "..", "deploy", "shell");
const TEAM = process.env.NEUROTIDY_VERCEL_TEAM || "team_fpaWQjDIMTtPiedILOXw4B2f";
const PROJECT = process.env.NEUROTIDY_VERCEL_PROJECT || "prj_aY53aoUClUW4l9u8mcMqb7OtnD5A";
const TOKEN = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
const FILES = ["vercel.json", "middleware.js", "package.json", "README.md"];

JSON.parse(readFileSync(path.join(SHELL, "vercel.json"), "utf8")); // fail fast on a broken vercel.json
const files = FILES.map((f) => { const data = readFileSync(path.join(SHELL, f)); return { file: f, data, sha: createHash("sha1").update(data).digest("hex"), size: data.length }; });
if (process.argv.includes("--dry")) { console.log(JSON.stringify(files.map(({ file, sha, size }) => ({ file, sha, size })))); process.exit(0); }
if (!TOKEN) { console.error("VERCEL_TOKEN missing"); process.exit(2); }
const H = { Authorization: `Bearer ${TOKEN}` };

for (const f of files) {
  const r = await fetch(`https://api.vercel.com/v2/files?teamId=${TEAM}`, { method: "POST", headers: { ...H, "Content-Type": "application/octet-stream", "x-vercel-digest": f.sha, "Content-Length": String(f.size) }, body: f.data });
  if (!r.ok) { console.error(`upload ${f.file}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); process.exit(1); }
}
const r = await fetch(`https://api.vercel.com/v13/deployments?teamId=${TEAM}&forceNew=1`, {
  method: "POST", headers: { ...H, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "neurotidy", project: PROJECT, target: "production", files: files.map(({ file, sha, size }) => ({ file, sha, size })) }),
});
const d = await r.json();
if (!d.id) { console.error(`deploy: HTTP ${r.status} ${JSON.stringify(d).slice(0, 300)}`); process.exit(1); }
console.log(`deployment ${d.id} ${d.readyState}`);
for (let i = 0; i < 90; i++) {
  await new Promise((s) => setTimeout(s, 5000));
  const s = await (await fetch(`https://api.vercel.com/v13/deployments/${d.id}?teamId=${TEAM}`, { headers: H })).json();
  if (["READY", "ERROR", "CANCELED"].includes(s.readyState)) { console.log(`final ${s.readyState} ${(s.alias || []).join(",")}`); process.exit(s.readyState === "READY" ? 0 : 1); }
}
console.error("timed out waiting for READY"); process.exit(1);
