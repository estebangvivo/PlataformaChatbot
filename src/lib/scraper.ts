import * as cheerio from "cheerio";

export const START_URLS = [
  "https://regional5.com.ar/colegio-arquitectos/",
  "https://regional5.com.ar/colegio-arquitectos/tramitacion/",
  "https://regional5.com.ar/colegio-arquitectos/turnos/",
  "https://regional5.com.ar/colegio-arquitectos/capacitacion/",
  "https://regional5.com.ar/colegio-arquitectos/actividades/",
  "https://regional5.com.ar/colegio-arquitectos/asesorias/",
  "https://regional5.com.ar/colegio-arquitectos/medios-de-pago/",
  "https://regional5.com.ar/colegio-arquitectos/servicios/",
  "https://regional5.com.ar/colegio-arquitectos/institucion/",
  "https://regional5.com.ar/colegio-arquitectos/concursos/",
  "https://regional5.com.ar/colegio-arquitectos/tutoriales/",
  "https://regional5.com.ar/colegio-arquitectos/contacto/",
  "https://regional5.com.ar/colegio-arquitectos/resoluciones/",
  "https://regional5.com.ar/colegio-arquitectos/bolsa-de-trabajo-capc/",
  "https://regional5.com.ar/colegio-arquitectos/centro-recreativo-parque-siquima/",
  "https://regional5.com.ar/colegio-arquitectos/pileta-y-predio-sin-costo-en-jockey-club-villa-maria/",
];

const SKIP_EXT = /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|css|js|woff2?)(\?|$)/i;
const SKIP_PATH = /wp-admin|wp-login|xmlrpc|\/feed\/|mailto:|tel:|javascript:|comment-page|\/author\/|\/attachment\/|wp-content\/uploads/i;
const NAV_NOISE = [
  "iniciar sesión",
  "enlaces útiles",
  "matriculados",
  "iniciar sesion",
  "dejar un comentario",
  "compartir",
  "facebook",
  "instagram",
];

export type ScrapedPage = {
  url: string;
  title: string;
  chunks: Array<{ title: string; content: string }>;
  error?: string;
};

function normalizeUrl(href: string, base: string) {
  try {
    const url = new URL(href, base);
    if (!url.hostname.replace(/^www\./, "").includes("regional5.com.ar")) return null;
    url.hash = "";
    url.search = "";
    if (SKIP_EXT.test(url.pathname) || SKIP_PATH.test(url.href)) return null;
    if (!url.pathname.includes("/colegio-arquitectos")) return null;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${path}/`;
  } catch {
    return null;
  }
}

function isNavNoise(text: string) {
  const n = text.toLowerCase();
  if (n.length < 20) return true;
  return NAV_NOISE.some((item) => n === item || n.startsWith(item));
}

function chunkText(text: string, size = 750, overlap = 100) {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return clean.length > 60 ? [clean] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const slice = clean.slice(i, i + size).trim();
    if (slice.length > 70) chunks.push(slice);
    i += size - overlap;
  }
  return chunks;
}

function extractMain(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, form, svg").remove();
  const title = $("title").first().text().replace(/\s+/g, " ").trim();

  const blocks: string[] = [];
  const seen = new Set<string>();
  $("h1, h2, h3, h4, p, li, .elementor-widget-text-editor, .elementor-heading-title").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t || isNavNoise(t) || seen.has(t)) return;
    seen.add(t);
    blocks.push(t);
  });

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const label = $(el).text().replace(/\s+/g, " ").trim();
    const href = normalizeUrl($(el).attr("href") ?? "", pageUrl);
    if (!href || !label || label.length < 8 || label.length > 90) return;
    if (/ver mas|leer mas|click/i.test(label)) {
      links.push(`${label}: ${href}`);
    }
  });

  let text = blocks.join("\n");
  if (links.length) text += `\nEnlaces relacionados: ${links.slice(0, 12).join(" · ")}`;
  return { title, text };
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "CAPC-R5-Bot/1.0 (base de conocimiento institucional)",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
}

function collectLinks(html: string, base: string) {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = normalizeUrl($(el).attr("href") ?? "", base);
    if (href) links.push(href);
  });
  return links;
}

export async function crawlRegional5(maxPages = 70): Promise<ScrapedPage[]> {
  const queue = [...START_URLS];
  const seen = new Set<string>();
  const pages: ScrapedPage[] = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      const { html, finalUrl } = await fetchHtml(url);
      for (const link of collectLinks(html, finalUrl || url)) {
        if (!seen.has(link) && !queue.includes(link)) queue.push(link);
      }
      const { title, text } = extractMain(html, url);
      const chunks = chunkText(text).map((content, index) => ({
        title: `${title || url}${index ? ` (${index + 1})` : ""}`,
        content,
      }));
      pages.push({ url: finalUrl || url, title, chunks });
    } catch (error) {
      pages.push({
        url,
        title: url,
        chunks: [],
        error: error instanceof Error ? error.message : "Error de scraping",
      });
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  return pages;
}

export async function scrapeRegional5() {
  return crawlRegional5(70);
}
