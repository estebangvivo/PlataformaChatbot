import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import type { InboundMedia } from "./media";

function extensionFor(media: InboundMedia) {
  const fromName = media.filename?.match(/\.[a-z0-9]+$/i)?.[0];
  if (fromName) return fromName.toLowerCase();
  if (media.mime === "application/pdf") return ".pdf";
  if (media.mime.includes("wordprocessingml") || media.filename?.endsWith(".docx")) return ".docx";
  if (media.mime === "application/msword") return ".doc";
  if (media.mime === "text/plain") return ".txt";
  if (media.mime === "text/markdown") return ".md";
  if (media.mime === "text/html") return ".html";
  if (media.mime === "image/png") return ".png";
  if (media.mime === "image/jpeg") return ".jpg";
  if (media.mime === "image/webp") return ".webp";
  if (media.mime === "image/gif") return ".gif";
  if (media.mime.startsWith("audio/")) return ".ogg";
  return "";
}

export async function savePublicUpload(media: InboundMedia) {
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const base = (media.filename || "archivo").replace(/[^\w.\-áéíóúñ]+/gi, "_").slice(0, 60);
  const ext = extensionFor(media);
  const hasExt = /\.[a-z0-9]+$/i.test(base);
  const filename = `${randomBytes(6).toString("hex")}-${hasExt ? base : `${base}${ext}`}`;
  await writeFile(path.join(dir, filename), Buffer.from(media.dataBase64, "base64"));
  return {
    url: `/uploads/${filename}`,
    filename: media.filename || filename,
  };
}
