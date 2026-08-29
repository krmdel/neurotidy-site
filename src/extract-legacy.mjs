// One-time extraction of the 14 hand-written articles into the content model. Bodies are verbatim.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
const files = readdirSync("articles").filter(f => f.endsWith(".html"));
const groups = { "the-reset":"method","the-chair":"bedroom","adhd-dishes-pile-up":"kitchen","cup-collection":"kitchen","the-doom-box":"clutter","the-laundry":"laundry","time-blindness":"mind","the-floor":"bedroom","body-doubling":"method","cleaning-paralysis":"mind","adhd-cleaning-checklist":"method","doom-pile-vs-hoarding":"clutter","the-meds-window":"mind","messy-room":"bedroom" };
for (const f of files) {
  const slug = f.replace(/\.html$/, "");
  const html = readFileSync(`articles/${f}`, "utf8");
  const get = (re) => (html.match(re) || [])[1];
  const title = get(/<title>([^<]*)<\/title>/);
  const description = get(/<meta name="description" content="([^"]*)"/);
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const art = lds.find(x => x["@type"] === "Article"); const faqLd = lds.find(x => x["@type"] === "FAQPage");
  const h1 = get(/<h1>([\s\S]*?)<\/h1>/);
  const mainStart = html.indexOf("</h1>") + 5;
  const mainEnd = html.indexOf("<aside class=\"cta\">");
  const body = html.slice(mainStart, mainEnd).trim();
  const out = `src/content/articles/${slug}.json`;
  if (existsSync(out)) { console.log("skip existing", out); continue; }
  const meta = { slug, title, description, h1, group: groups[slug] || "method", target_query: "", published: art.datePublished, legacy_modified: art.dateModified,
    faq: faqLd.mainEntity.map(q => ({ q: q.name, a: q.acceptedAnswer.text })), related: [], sources: [] };
  writeFileSync(out, JSON.stringify(meta, null, 2) + "\n");
  writeFileSync(`src/content/articles/${slug}.body.html`, body + "\n");
  console.log("extracted", slug, "words:", body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length);
}
