import { interpretUserMedia, type InboundMedia } from "./media";

const MIN_USEFUL = 80;

function decodeText(buffer: Buffer) {
  const utf8 = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const replacement = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacement > utf8.length * 0.05) return buffer.toString("latin1");
  return utf8;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractPdfLiterals(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const pieces: string[] = [];
  const paren = [...raw.matchAll(/\((?:\\.|[^\\)]){3,}\)/g)];
  for (const match of paren) {
    const inner = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\t/g, " ")
      .replace(/\\(.)/g, "$1");
    if (/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/.test(inner)) pieces.push(inner);
  }
  return pieces.join(" ").replace(/[ \t]+/g, " ").trim();
}

async function extractPdf(buffer: Buffer) {
  try {
    const loaded = (await import("pdf-parse/lib/pdf-parse.js").catch(() => import("pdf-parse"))) as {
      default?: (b: Buffer) => Promise<{ text?: string }>;
    };
    const parse = loaded.default ?? (loaded as unknown as (b: Buffer) => Promise<{ text?: string }>);
    const parsed = await parse(buffer);
    if (parsed.text && parsed.text.trim().length >= MIN_USEFUL) return parsed.text;
  } catch {
    /* fallback */
  }
  return extractPdfLiterals(buffer);
}

async function extractDocx(buffer: Buffer) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  } catch {
    return "";
  }
}

export function chunkKnowledgeText(text: string, size = 900, overlap = 120) {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return clean.length > 40 ? [clean] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(clean.length, i + size);
    const slice = clean.slice(i, end);
    const lastBreak = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(". "));
    if (lastBreak > size * 0.45) end = i + lastBreak + 1;
    const part = clean.slice(i, end).trim();
    if (part.length > 40) chunks.push(part);
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks;
}

export async function extractDocumentText(media: InboundMedia) {
  const buffer = Buffer.from(media.dataBase64, "base64");
  const mime = (media.mime || "").toLowerCase();
  const name = (media.filename || "").toLowerCase();
  let text = "";

  if (mime.startsWith("text/") || /\.(txt|md|csv|html?)$/.test(name)) {
    text = decodeText(buffer);
    if (mime.includes("html") || name.endsWith(".html") || name.endsWith(".htm")) text = stripHtml(text);
  } else if (mime === "application/pdf" || name.endsWith(".pdf")) {
    text = await extractPdf(buffer);
  } else if (
    mime.includes("wordprocessingml") ||
    mime === "application/msword" ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    text = await extractDocx(buffer);
  }

  text = text.replace(/\u0000/g, " ").replace(/[ \t]+\n/g, "\n").trim();

  if (text.length < MIN_USEFUL && (mime.startsWith("image/") || mime === "application/pdf")) {
    const interpreted = await interpretUserMedia(media);
    if (interpreted.text?.trim()) text = [text, interpreted.text.trim()].filter(Boolean).join("\n\n");
  }

  return text.trim();
}
