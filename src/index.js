export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "CartWise", version: "1.0.0", searchConfigured: Boolean(env.SERPAPI_API_KEY) });
    }

    if (url.pathname === "/api/search") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const query = (url.searchParams.get("q") || "").trim();
      const location = (url.searchParams.get("location") || "").trim();
      if (query.length < 2) return json({ error: "Enter at least 2 characters to search." }, 400);
      if (query.length > 120) return json({ error: "Search is too long." }, 400);
      if (!env.SERPAPI_API_KEY) return json({ error: "Live product search is not configured yet. Add the SERPAPI_API_KEY secret to the CartWise Worker." }, 503);

      const params = new URLSearchParams({
        engine: "google_shopping",
        q: query,
        api_key: env.SERPAPI_API_KEY,
        num: "20"
      });
      if (location) params.set("location", location);

      try {
        const response = await fetch("https://serpapi.com/search.json?" + params.toString());
        const data = await response.json();
        if (!response.ok || data.error) {
          return json({ error: data.error || "The product search provider could not complete this search." }, 502);
        }
        const products = (data.shopping_results || []).slice(0, 20).map((item, index) => ({
          id: String(item.product_id || item.position || index),
          title: item.title || "Grocery item",
          price: typeof item.extracted_price === "number" ? item.extracted_price : parsePrice(item.price),
          priceText: item.price || "",
          merchant: item.source || item.seller || "Retailer",
          link: safeUrl(item.link),
          thumbnail: safeImage(item.thumbnail),
          rating: item.rating || null,
          reviews: item.reviews || null,
          delivery: item.delivery || "",
          productId: item.product_id || ""
        })).filter(item => item.title);
        return json({ products, searchedFor: query, count: products.length });
      } catch {
        return json({ error: "Product search is temporarily unavailable. Please try again." }, 502);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

function parsePrice(value) {
  if (!value) return null;
  const match = String(value).replace(/,/g, "").match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}
function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
}
function safeImage(value) {
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) ? u.toString() : ""; } catch { return ""; }
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
