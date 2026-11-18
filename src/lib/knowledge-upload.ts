import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { embedTexts } from "./rag";
import { savePublicUpload } from "./uploads";
import { chunkKnowledgeText, extractDocumentText } from "./document-text";
import type { InboundMedia } from "./media";

export const DOCUMENT_TITLE_PREFIX = "[documento]";

export async function ingestUploadedDocument(params: {
  media: InboundMedia;
  category?: string;
  title?: string;
}) {
  const filename = params.media.filename?.trim() || "documento";
  const text = await extractDocumentText(params.media);
  if (text.length < 40) {
    throw new Error("No pude leer texto útil de ese archivo. Probá PDF, Word o TXT.");
  }

  const stored = await savePublicUpload(params.media);
  const title = `${DOCUMENT_TITLE_PREFIX} ${params.title?.trim() || filename}`;
  const chunks = chunkKnowledgeText(text);
  if (!chunks.length) throw new Error("El archivo no tiene texto suficiente para indexar");

  const embeddings = await embedTexts(chunks);
  const created = [];
  for (let i = 0; i < chunks.length; i++) {
    const row = await prisma.knowledgeChunk.create({
      data: {
        pageUrl: stored.url,
        title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
        contentChunk: chunks[i],
        embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : null,
        category: params.category?.trim() || "Documentos",
      },
    });
    created.push(row);
  }

  return {
    url: stored.url,
    filename: stored.filename,
    title,
    chunks: created.length,
    preview: chunks[0].slice(0, 280),
  };
}

export async function deleteUploadedDocument(pageUrl: string) {
  if (!pageUrl.startsWith("/uploads/")) {
    throw new Error("Solo se pueden quitar documentos subidos");
  }
  const filename = path.basename(pageUrl);
  if (!filename || filename.includes("..")) {
    throw new Error("Documento inválido");
  }
  const result = await prisma.knowledgeChunk.deleteMany({ where: { pageUrl } });
  try {
    await unlink(path.join(process.cwd(), "public", "uploads", filename));
  } catch {
    /* el archivo puede no estar */
  }
  return result.count;
}

export function isUploadedDocument(chunk: { title?: string | null; pageUrl?: string | null }) {
  return Boolean(chunk.title?.startsWith(DOCUMENT_TITLE_PREFIX) || chunk.pageUrl?.startsWith("/uploads/"));
}
