import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { importContactRows, parseContactsWorkbook } from "@/lib/contact-import";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo Excel" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera 8 MB" }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xlsm")) {
    return NextResponse.json({ error: "Usá la plantilla .xlsx" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseContactsWorkbook(buffer);
    if (!rows.length) {
      return NextResponse.json({ error: "El Excel no tiene filas para importar" }, { status: 400 });
    }
    const result = await importContactRows(rows);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo leer el Excel";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
