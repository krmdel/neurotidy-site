// Logs AI and search crawler visits so we can measure whether the engines actually fetch us.
// Static files produce no request logs on Vercel, so this middleware is the only visibility we have.
// It never changes the response: it logs one JSON line and lets the request continue.
// User-agent list vendored from github.com/ai-robots-txt/ai.robots.txt (see lib/distribution/seo/ai-bots.json).
export const config = {
  matcher: ["/((?!_vercel|favicon.ico|.*\\.(?:css|js|png|jpg|jpeg|svg|webp|ico|woff|woff2|xml)$).*)"],
};

const BOTS = /(ApifyWebsiteContentCrawler|AI2Bot-DeepResearchEval|GoogleAgent-URLContext|GeistHaus-PageFetcher|Google-CloudVertexBot|MyCentralAIScraperBot|VelenPublicWebCrawler|Gemini-Deep-Research|meta-externalfetcher|Meta-ExternalFetcher|facebookexternalhit|GoogleAgent-Mariner|ISSCyberRiskCrawler|YandexAdditionalBot|Cloudflare-AutoRAG|meta-externalagent|Meta-ExternalAgent|Applebot-Extended|AzureAI-SearchBot|Factset_spyderbot|Google-Gemini-CLI|Google-NotebookLM|GoogleOther-Image|GoogleOther-Video|amazon-QBusiness|Aranet-SearchBot|Claude-SearchBot|Poggio-Citations|Querit-SearchBot|YandexAdditional|FriendlyCrawler|Google-Extended|Google-Firebase|meta-webindexer|Perplexity-User|SBIntuitionsBot|SemrushBot-OCOB|Webzio-Extended|webzio-extended|AmazonBuyForMe|Amzn-SearchBot|ChatGLM-Spider|CloudVertexBot|FirecrawlAgent|MistralAI-User|SemrushBot-SWA|amazon-kendra|atlassian-bot|DuckAssistBot|KunatoCrawler|OAI-SearchBot|PerplexityBot|Reflectionbot|AddSearchBot|Ai2Bot-Dolma|anthropic-ai|ChatGPT-User|ExaSearchBot|Google-Agent|ImagesiftBot|kagi-fetcher|KlaviyoAIBot|QualifiedBot|TikTokSpider|Channel3Bot|Claude-User|CragCrawler|DeepSeekBot|FacebookBot|GoogleOther|ICC-Crawler|imageSpider|BingPreview|DuckDuckBot|AgentTimes|AIWebIndex|bedrockbot|Bytespider|Claude-Web|Crawlspace|EchoboxBot|Manus-User|NotebookLM|TerraCotta|ZanistaBot|Amazonbot|Amzn-User|Brightbot|ClaudeBot|cohere-ai|Kimi-User|LinkupBot|omgilibot|QueritBot|Shap-User|TavilyBot|TongyiBot|TwinAgent|Googlebot|aiHitBot|ApifyBot|Applebot|Bravebot|BuddyBot|Cotoyogi|LinerBot|NagetBot|PanguBot|PetalBot|PhindBot|QuillBot|Thinkbot|Timpibot|YiyanBot|Andibot|Diffbot|HenkBot|iAskBot|NovaAct|ShapBot|WARDBot|WRTNBot|bingbot|AI2Bot|Awario|ExaBot|GPTBot|omgili|YouBot|CCBot|UseAI|wpbot)/i;

export default function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  // Our own daily audit fetches every page with a GPTBot UA tagged "neurotidy-audit"; it is not a crawler visit.
  if (ua.includes("neurotidy-audit")) return;
  const hit = ua.match(BOTS);
  if (hit) {
    console.log(
      "BOTHIT " +
        JSON.stringify({
          bot: hit[1],
          path: new URL(request.url).pathname,
          ts: new Date().toISOString(),
          ua: ua.slice(0, 140),
        }),
    );
  }
}
