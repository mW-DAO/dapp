import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import * as cheerio from "cheerio";

/**
 * Shared headers for all external requests to improve robustness and avoid anti-scraping
 * Using randomized User-Agents to avoid pattern detection
 */
const getCommonHeaders = (url: string) => {
  const userAgents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ];

  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
  const urlObj = new URL(url);

  return {
    "User-Agent": randomUA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    Referer: urlObj.origin,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    DNT: "1", // Do Not Track
  };
};

/**
 * Hosts that should bypass local parsing and go directly to Jina Reader
 * These usually have strong anti-bot protection or client-side rendering
 */
const JINA_DIRECT_HOSTS = ["x.com", "twitter.com", "medium.com", "mirror.xyz"];

/**
 * Extract article content using jina with local Readability fallback
 */
export async function parseArticleContent(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  const urlObj = new URL(url);
  const shouldDirectToJina = JINA_DIRECT_HOSTS.some((host) => urlObj.hostname.includes(host));

  // 1. For configured hosts, prioritize Jina Reader to bypass blocking
  if (shouldDirectToJina) {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Accept: "application/json",
          ...(process.env.JINA_API_KEY
            ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
            : {}),
        },
      });

      if (response.ok) {
        clearTimeout(timeoutId); // Clear timeout as Jina call succeeded
        const data = await response.json();

        if (!data.data) {
          throw new Error("Jina response missing data");
        }

        const htmlContent = data.data.html || data.data.content || "";
        const title = data.data.title || "Social Post";

        return {
          title,
          content: htmlContent,
        };
      }
    } catch (err) {
      console.warn("[Parser] Jina failed for direct host, falling back to local:", err);
    }
  }

  // 2. Default: Local Readability (Fetch + JSDOM)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: getCommonHeaders(url),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: ${res.statusText}`);
    }

    const html = await res.text();
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const result = reader.parse();

    if (!result) {
      throw new Error("Failed to parse article content");
    }

    return {
      title: result.title,
      content: result.content,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timeout: URL took too long to respond");
    }
    throw err;
  }
}

/**
 * Extract link metadata (preview) using Cheerio
 */
export async function getLinkPreview(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  let previewData: { title: string; description: string; image: string; url: string } | null = null;

  // 1. Try local fetch first
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: getCommonHeaders(url),
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      const getMeta = (props: string[]) => {
        for (const prop of props) {
          const value =
            $(`meta[property="${prop}"]`).attr("content") ||
            $(`meta[name="${prop}"]`).attr("content");
          if (value) return value;
        }
        return "";
      };

      const title = (getMeta(["og:title", "twitter:title"]) || $("title").text() || "").trim();
      const description = (
        getMeta(["og:description", "twitter:description", "description"]) || ""
      ).trim();
      let image = getMeta(["og:image", "twitter:image"]) || "";

      if (image && !image.startsWith("http")) {
        try {
          image = new URL(image, url).toString();
        } catch {}
      }
      // Let's enforce: Must have title AND description to be considered "good" enough to skip fallback.
      if (title && description) {
        previewData = { title, description, image, url };
      }
    }
  } catch (err) {
    console.warn("[Preview] Local fetch failed, will try fallback:", err);
  } finally {
    clearTimeout(timeoutId);
  }

  return previewData;
}
