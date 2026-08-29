// audit-core.mjs — pure checks. open-seo's issue registry (src/shared/audit-issues.ts) plus the AI-search checks it lacks.
export const ISSUES = {
  // open-seo registry (thresholds match theirs)
  "blocked-page": { severity: "critical", title: "Crawler was blocked" },
  "server-error": { severity: "critical", title: "Server error (5xx)" },
  "broken-page": { severity: "warning", title: "Page returns an error (4xx)" },
  "broken-internal-link": { severity: "critical", title: "Broken internal link" },
  "missing-title": { severity: "critical", title: "Missing title tag" },
  "title-too-long": { severity: "info", title: "Title over 60 characters" },
  "title-too-short": { severity: "info", title: "Title under 10 characters" },
  "duplicate-title": { severity: "warning", title: "Duplicate title" },
  "missing-meta-description": { severity: "warning", title: "Missing meta description" },
  "meta-description-too-long": { severity: "info", title: "Meta description over 160 characters" },
  "meta-description-too-short": { severity: "info", title: "Meta description under 70 characters" },
  "duplicate-meta-description": { severity: "warning", title: "Duplicate meta description" },
  "missing-h1": { severity: "warning", title: "Missing H1" },
  "multiple-h1": { severity: "warning", title: "Multiple H1 headings" },
  "heading-order-skip": { severity: "info", title: "Heading levels skip" },
  "thin-content": { severity: "warning", title: "Thin content (under 150 words)" },
  "images-missing-alt": { severity: "warning", title: "Images missing alt text" },
  "no-outgoing-links": { severity: "warning", title: "Page has no internal outgoing links" },
  "orphan-page": { severity: "warning", title: "Orphan page (no internal links point to it)" },
  "noindex-page": { severity: "info", title: "Page is noindex" },
  "redirect-chain": { severity: "warning", title: "Redirect chain (2+ hops)" },
  "slow-response": { severity: "info", title: "Slow server response (>1500 ms)" },
  // the checks open-seo does not have
  "canonical-missing": { severity: "warning", title: "No canonical link" },
  "canonical-host-mismatch": { severity: "critical", title: "Canonical points at a different host than the served origin" },
  "canonical-not-self": { severity: "warning", title: "Canonical is not the page's own URL" },
  "jsonld-missing": { severity: "warning", title: "No JSON-LD structured data" },
  "jsonld-invalid": { severity: "critical", title: "JSON-LD does not parse" },
  "article-schema-missing": { severity: "warning", title: "Article page without Article JSON-LD" },
  "faq-schema-missing": { severity: "info", title: "Article page without FAQPage JSON-LD" },
  "breadcrumb-missing": { severity: "info", title: "No BreadcrumbList JSON-LD" },
  "author-not-person": { severity: "warning", title: "Article author is not a Person entity" },
  "citations-too-few": { severity: "warning", title: "Article has fewer than 2 citations in JSON-LD" },
  "dates-missing": { severity: "warning", title: "Article without datePublished/dateModified" },
  "date-order": { severity: "warning", title: "dateModified is before datePublished" },
  "stale-content": { severity: "warning", title: "dateModified older than 45 days" },
  "analytics-missing": { severity: "warning", title: "Analytics tag missing" },
  "unexpected-script": { severity: "warning", title: "Script other than analytics/JSON-LD/event hook (AI crawlers do not run JS)" },
  "nonjs-visible-words-low": { severity: "warning", title: "Fewer than 150 words visible without JavaScript" },
  "internal-links-too-few": { severity: "warning", title: "Article links to fewer than 3 sibling articles" },
  "em-dash": { severity: "info", title: "Em dash in visible text (house style)" },
  "credential-claim": { severity: "critical", title: "Credential claim (Dr./MD/PhD) in visible text" },
  "sitemap-missing-page": { severity: "warning", title: "Page not listed in sitemap.xml" },
  "sitemap-url-not-200": { severity: "critical", title: "Sitemap URL does not return 200" },
  "robots-ai-ua-missing": { severity: "critical", title: "robots.txt does not explicitly allow an AI crawler" },
  "robots-sitemap-host": { severity: "warning", title: "robots.txt Sitemap line is on the wrong host" },
  "llms-missing-page": { severity: "info", title: "Page not listed in llms.txt" },
};
export const AI_UAS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "Google-Extended", "Bingbot"];

const issue = (id, detail) => ({ id, severity: ISSUES[id].severity, title: ISSUES[id].title, detail });
export const visibleText = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<noscript[\s\S]*?<\/noscript>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const hostOf = (u) => { try { return new URL(u).host; } catch { return null; } };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export function analyzeHtml(html, url, ctx) {
  const issues = [];
  const origin = ctx.origin;
  const get = (re) => (html.match(re) || [])[1];
  const headHtml = html.slice(0, html.search(/<body[\s>]/) >= 0 ? html.search(/<body[\s>]/) : html.length);
  const title = get(/<title>([^<]*)<\/title>/)?.trim() ?? "";
  const description = get(/<meta name="description" content="([^"]*)"/) ?? "";
  const canonical = get(/<link rel="canonical" href="([^"]+)"/) ?? null;
  const robotsMeta = get(/<meta name="robots" content="([^"]*)"/) ?? "";
  const isArticle = /\/articles\//.test(url);
  const text = visibleText(html);
  const words = text ? text.split(" ").length : 0;

  if (!title) issues.push(issue("missing-title")); else if (title.length > 60) issues.push(issue("title-too-long", `${title.length} chars`)); else if (title.length < 10) issues.push(issue("title-too-short"));
  if (!description) issues.push(issue("missing-meta-description")); else if (description.length > 160) issues.push(issue("meta-description-too-long", `${description.length} chars`)); else if (description.length < 70) issues.push(issue("meta-description-too-short", `${description.length} chars`));
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length === 0) issues.push(issue("missing-h1")); else if (h1s.length > 1) issues.push(issue("multiple-h1", `${h1s.length} H1s`));
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { issues.push(issue("heading-order-skip", `h${levels[i - 1]} → h${levels[i]}`)); break; }
  if (words < 150) issues.push(issue("thin-content", `${words} words`));
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const noAlt = imgs.filter((t) => !/\balt=/.test(t));
  if (noAlt.length) issues.push(issue("images-missing-alt", `${noAlt.length} image(s)`));
  const links = [...html.matchAll(/<a\b[^>]*href="([^"#]+)"/g)].map((m) => m[1]);
  const internal = links.filter((h) => h.startsWith("/") || h.startsWith(origin));
  if (internal.length === 0) issues.push(issue("no-outgoing-links"));
  if (/noindex/i.test(robotsMeta)) issues.push(issue("noindex-page"));

  if (!canonical) issues.push(issue("canonical-missing"));
  else {
    if (hostOf(canonical) !== hostOf(origin)) issues.push(issue("canonical-host-mismatch", `${canonical} vs origin ${origin}`));
    else if (canonical !== url) issues.push(issue("canonical-not-self", `${canonical} on ${url}`));
  }
  const ldRaw = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let lds = [];
  if (ldRaw.length === 0) issues.push(issue("jsonld-missing"));
  for (const raw of ldRaw) { try { lds.push(JSON.parse(raw)); } catch { issues.push(issue("jsonld-invalid")); } }
  const types = lds.map((x) => x["@type"]);
  if (isArticle) {
    const art = lds.find((x) => x["@type"] === "Article");
    if (!art) issues.push(issue("article-schema-missing"));
    else {
      if (!art.author || art.author["@type"] !== "Person") issues.push(issue("author-not-person"));
      if (!Array.isArray(art.citation) || art.citation.length < 2) issues.push(issue("citations-too-few", `${art.citation?.length ?? 0}`));
      if (!art.datePublished || !art.dateModified) issues.push(issue("dates-missing"));
      else {
        if (art.dateModified < art.datePublished) issues.push(issue("date-order", `${art.datePublished} > ${art.dateModified}`));
        if (daysBetween(art.dateModified, ctx.today) > 45) issues.push(issue("stale-content", `modified ${art.dateModified}`));
      }
    }
    if (!types.includes("FAQPage")) issues.push(issue("faq-schema-missing"));
    const sib = new Set([...html.matchAll(/href="\/articles\/([a-z0-9-]+)\.html"/g)].map((m) => m[1]).filter((s) => !url.endsWith(`/articles/${s}.html`)));
    if (sib.size < 3) issues.push(issue("internal-links-too-few", `${sib.size} sibling links`));
  }
  if (lds.length && !types.includes("BreadcrumbList")) issues.push(issue("breadcrumb-missing"));
  if (!html.includes(ctx.analyticsScript)) issues.push(issue("analytics-missing"));
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  for (const s of scripts) {
    const attrs = s[1], body = s[2];
    if (/application\/ld\+json/.test(attrs)) continue;
    if (attrs.includes(ctx.analyticsScript)) continue;
    if (!/src=/.test(attrs) && (/data-event/.test(body) || url.endsWith("/quiz.html"))) continue;
    issues.push(issue("unexpected-script", attrs.trim().slice(0, 80)));
  }
  if (words < 150) issues.push(issue("nonjs-visible-words-low", `${words}`));
  if (/—/.test(text)) issues.push(issue("em-dash"));
  if (/\bDr\.|\bMD\b|\bPhD\b/.test(text)) issues.push(issue("credential-claim"));

  return { url, title, description, canonical, words, links: internal.map((h) => (h.startsWith("/") ? origin + h : h)), noindex: /noindex/i.test(robotsMeta), issues };
}

export function siteChecks(pages, { robots = "", sitemapUrls = [], llms = "", sitemapStatuses = {} }, ctx) {
  const out = [];
  const byTitle = new Map(), byDesc = new Map();
  for (const p of pages) {
    if (p.title) byTitle.set(p.title, [...(byTitle.get(p.title) || []), p.url]);
    if (p.description) byDesc.set(p.description, [...(byDesc.get(p.description) || []), p.url]);
  }
  for (const [t, urls] of byTitle) if (urls.length > 1) out.push({ ...issue("duplicate-title", `"${t}"`), pages: urls });
  for (const [d, urls] of byDesc) if (urls.length > 1) out.push({ ...issue("duplicate-meta-description", d.slice(0, 60)), pages: urls });
  const inbound = new Map(pages.map((p) => [p.url, 0]));
  for (const p of pages) for (const l of p.links || []) if (inbound.has(l) && l !== p.url) inbound.set(l, inbound.get(l) + 1);
  for (const p of pages) if (p.url !== ctx.origin + "/" && inbound.get(p.url) === 0 && !p.noindex) out.push({ ...issue("orphan-page"), pages: [p.url] });
  const sm = new Set(sitemapUrls);
  for (const p of pages) if (!p.noindex && !sm.has(p.url)) out.push({ ...issue("sitemap-missing-page"), pages: [p.url] });
  for (const [u, st] of Object.entries(sitemapStatuses)) if (st !== 200) out.push({ ...issue("sitemap-url-not-200", `HTTP ${st}`), pages: [u] });
  for (const ua of AI_UAS) if (!new RegExp(`User-agent: ${ua}\\s*\\n\\s*Allow: /`).test(robots)) out.push({ ...issue("robots-ai-ua-missing", ua) });
  const smLine = (robots.match(/Sitemap:\s*(\S+)/) || [])[1];
  if (smLine && hostOf(smLine) !== hostOf(ctx.origin)) out.push({ ...issue("robots-sitemap-host", smLine) });
  for (const p of pages) if (!p.noindex && !p.url.endsWith("/quiz.html") && !llms.includes(p.url)) out.push({ ...issue("llms-missing-page"), pages: [p.url] });
  return out;
}

export function renderReport({ target, pages, siteIssues, generated, extra = [] }) {
  const all = [...pages.flatMap((p) => p.issues.map((i) => ({ ...i, pages: [p.url] }))), ...siteIssues, ...extra];
  const count = (sev) => all.filter((i) => i.severity === sev).length;
  const lines = [`# Neurotidy SEO audit: ${target}`, "", `Generated ${generated}. Pages checked: ${pages.length}. Critical: ${count("critical")} · Warning: ${count("warning")} · Info: ${count("info")}.`, "",
    `Verdict: ${count("critical") ? "FAIL (critical)" : count("warning") ? "WARN" : "PASS"}`, ""];
  const grouped = new Map();
  for (const i of all) grouped.set(i.id, [...(grouped.get(i.id) || []), i]);
  const order = { critical: 0, warning: 1, info: 2 };
  for (const [id, items] of [...grouped.entries()].sort((a, b) => order[a[1][0].severity] - order[b[1][0].severity])) {
    lines.push(`## ${items[0].severity.toUpperCase()} · ${ISSUES[id]?.title ?? id} (${items.length})`);
    for (const it of items.slice(0, 40)) lines.push(`- ${(it.pages || []).join(", ")}${it.detail ? ` · ${it.detail}` : ""}`);
    if (items.length > 40) lines.push(`- … ${items.length - 40} more`);
    lines.push("");
  }
  if (!all.length) lines.push("No issues.");
  return { markdown: lines.join("\n"), critical: count("critical"), warning: count("warning"), info: count("info"), all };
}
