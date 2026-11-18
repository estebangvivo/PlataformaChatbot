import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { deleteUploadedDocument, ingestUploadedDocument } from "@/lib/knowledge-upload";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp",
];

function mimeOf(file: File) {
  const type = file.type || "application/octet-stream";
  const name = file.name.toLowerCase();
  if (type !== "application/octet-stream") return type;
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "text/html";
  return type;
}

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera 10 MB" }, { status: 400 });
  }

  const mime = mimeOf(file);
  const name = file.name.toLowerCase();
  const allowedExt = /\.(pdf|docx?|txt|md|csv|html?|png|jpe?g|webp)$/i.test(name);
  if (!ALLOWED.includes(mime) && !allowedExt) {
    return NextResponse.json({ error: "Formato no soportado. Usá PDF, Word, TXT o una imagen con texto." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const result = await ingestUploadedDocument({
      media: {
        mime,
        filename: file.name,
        dataBase64: bytes.toString("base64"),
      },
      category: String(form.get("category") ?? "").trim() || undefined,
      title: String(form.get("title") ?? "").trim() || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo indexar el documento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;
  const body = (await request.json()) as { pageUrl?: string };
  if (!body.pageUrl) return NextResponse.json({ error: "Falta el documento" }, { status: 400 });
  try {
    const deleted = await deleteUploadedDocument(body.pageUrl);
    return NextResponse.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo eliminar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
