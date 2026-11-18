import ExcelJS from "exceljs";
import { prisma } from "./db";
import { CONTACT_ROLES, EMPTY_PROFILE, readProfile, type ContactProfile } from "./personality";
import { normalizeText } from "./utils";

export const CONTACT_COLUMNS = [
  { key: "telefono", header: "telefono", required: true },
  { key: "nombre", header: "nombre", required: false },
  { key: "apellido", header: "apellido", required: false },
  { key: "nombre_mostrar", header: "nombre_mostrar", required: false },
  { key: "localidad", header: "localidad", required: false },
  { key: "matricula", header: "matricula", required: false },
  { key: "rol", header: "rol", required: false },
  { key: "email", header: "email", required: false },
  { key: "intereses", header: "intereses", required: false },
  { key: "notas", header: "notas", required: false },
] as const;

export type ContactRow = {
  telefono: string;
  nombre: string;
  apellido: string;
  nombre_mostrar: string;
  localidad: string;
  matricula: string;
  rol: string;
  email: string;
  intereses: string;
  notas: string;
};

const EXAMPLE_PHONE = "5493530000000";

const ROLE_ALIASES: Record<string, (typeof CONTACT_ROLES)[number]> = {
  matriculado: "matriculado",
  matriculada: "matriculado",
  arquitecto: "arquitecto",
  arquitecta: "arquitecto",
  arq: "arquitecto",
  estudiante: "estudiante",
  publico: "publico",
  publica: "publico",
  vecino: "publico",
  vecina: "publico",
};

function cellText(value: ExcelJS.CellValue | undefined) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  if (typeof value === "boolean") return value ? "si" : "";
  if (typeof value === "string") return value.trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("hyperlink" in value) {
      const hyper = value as ExcelJS.CellHyperlinkValue;
      return String(hyper.text ?? hyper.hyperlink ?? "").trim();
    }
  }
  return String(value).trim();
}

export function headerKey(value: string) {
  return normalizeText(value).replace(/\s+/g, "_");
}

export function normalizeWhatsAppPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 8) return null;
  if (digits.startsWith("549") && digits.length >= 12) return digits;
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length >= 11) {
    return `549${digits.slice(2)}`;
  }
  if (digits.startsWith("9") && digits.length >= 11) return `54${digits}`;
  if (digits.length === 10 || digits.length === 11) return `549${digits.replace(/^0/, "")}`;
  if (digits.length >= 12) return digits;
  return `549${digits}`;
}

function mapRole(raw: string) {
  const key = normalizeText(raw);
  if (!key) return undefined;
  return ROLE_ALIASES[key] ?? (CONTACT_ROLES as readonly string[]).find((role) => role === key);
}

function splitList(raw: string) {
  return raw
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayName(row: ContactRow) {
  return row.nombre_mostrar.trim() || [row.nombre, row.apellido].filter(Boolean).join(" ").trim();
}

export async function buildContactsWorkbook(includeExisting = true) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Regional 5";
  const sheet = workbook.addWorksheet("Contactos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = CONTACT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.key === "notas" || col.key === "intereses" ? 28 : col.key === "telefono" ? 18 : 16,
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFF7F1EA" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF542460" } };
  header.alignment = { vertical: "middle" };

  sheet.addRow({
    telefono: EXAMPLE_PHONE,
    nombre: "Ana",
    apellido: "Ejemplo",
    nombre_mostrar: "Ana Ejemplo",
    localidad: "Villa María",
    matricula: "12345",
    rol: "matriculado",
    email: "ana@ejemplo.com",
    intereses: "tramites, cursos",
    notas: "Fila de ejemplo: borrala o dejala, no se importa",
  });

  if (includeExisting) {
    const rows = await prisma.conversation.findMany({
      orderBy: { userName: "asc" },
      select: { whatsappPhone: true, userName: true, contactProfile: true },
    });
    for (const row of rows) {
      const profile = readProfile(row.contactProfile);
      sheet.addRow({
        telefono: row.whatsappPhone,
        nombre: profile.firstName ?? "",
        apellido: profile.lastName ?? "",
        nombre_mostrar: row.userName ?? "",
        localidad: profile.locality ?? "",
        matricula: profile.matricula ?? "",
        rol: profile.role ?? "",
        email: profile.email ?? "",
        intereses: (profile.interests ?? []).join(", "),
        notas: profile.observations ?? "",
      });
    }
  }

  const help = workbook.addWorksheet("Instrucciones");
  help.getColumn(1).width = 92;
  help.addRows([
    ["Plantilla de contactos · Colegio de Arquitectos Regional 5"],
    [""],
    ["1. Completá este archivo y volvelo a subir en Personas → Importar Excel."],
    ["2. El teléfono es obligatorio. Usá 54 + 9 + código de área + número, sin 0 y sin 15."],
    ["   Ejemplo Villa María: 5493534123456"],
    ["3. Formateá la columna telefono como texto para que Excel no se coma dígitos."],
    ["4. rol puede ser: matriculado, arquitecto, estudiante o publico."],
    ["5. intereses: separados por coma."],
    ["6. Si el teléfono ya existe, se actualiza la ficha (no se borra el chat)."],
    ["7. La fila de ejemplo (5493530000000) no se importa."],
    ["8. Podés agregar filas nuevas abajo de las existentes."],
  ]);
  help.getRow(1).font = { bold: true, size: 14 };

  return workbook;
}

function rowFromCells(headerMap: Map<string, number>, row: ExcelJS.Row): ContactRow {
  const read = (key: string) => cellText(row.getCell((headerMap.get(key) ?? 0) + 1).value);
  return {
    telefono: read("telefono") || read("whatsapp") || read("celular") || read("telefono_whatsapp"),
    nombre: read("nombre") || read("nombre_de_pila"),
    apellido: read("apellido"),
    nombre_mostrar: read("nombre_mostrar") || read("nombre_completo") || read("nombre_para_mostrar"),
    localidad: read("localidad") || read("ciudad"),
    matricula: read("matricula"),
    rol: read("rol"),
    email: read("email") || read("mail"),
    intereses: read("intereses"),
    notas: read("notas") || read("observaciones"),
  };
}

export async function parseContactsWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet("Contactos") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("El Excel no tiene hojas");

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const key = headerKey(cellText(cell.value));
    if (key) headerMap.set(key, colNumber - 1);
  });
  if (![...headerMap.keys()].some((key) => key.includes("telefono") || key === "whatsapp" || key === "celular")) {
    throw new Error("Falta la columna telefono. Descargá la plantilla y usá esos encabezados.");
  }

  const rows: Array<{ line: number; row: ContactRow }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const parsed = rowFromCells(headerMap, row);
    if (CONTACT_COLUMNS.every((col) => !parsed[col.key].trim())) return;
    rows.push({ line: rowNumber, row: parsed });
  });
  return rows;
}

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ line: number; telefono: string; error: string }>;
};

export async function importContactRows(entries: Array<{ line: number; row: ContactRow }>): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { line, row } of entries) {
    const phone = normalizeWhatsAppPhone(row.telefono);
    if (!phone) {
      result.errors.push({ line, telefono: row.telefono, error: "Teléfono inválido" });
      continue;
    }
    if (phone === EXAMPLE_PHONE) {
      result.skipped += 1;
      continue;
    }

    const role = mapRole(row.rol);
    if (row.rol.trim() && !role) {
      result.errors.push({
        line,
        telefono: phone,
        error: `Rol inválido (${row.rol}). Usá matriculado, arquitecto, estudiante o publico.`,
      });
      continue;
    }

    const incoming: Partial<ContactProfile> = {
      firstName: row.nombre.trim() || undefined,
      lastName: row.apellido.trim() || undefined,
      locality: row.localidad.trim() || undefined,
      matricula: row.matricula.trim() || undefined,
      role,
      email: row.email.trim() || undefined,
      observations: row.notas.trim() || undefined,
      interests: row.intereses.trim() ? splitList(row.intereses) : undefined,
    };
    const name = displayName(row);

    try {
      const existing = await prisma.conversation.findUnique({ where: { whatsappPhone: phone } });
      if (!existing) {
        const profile: ContactProfile = {
          ...EMPTY_PROFILE,
          ...incoming,
          interests: incoming.interests ?? [],
        };
        await prisma.conversation.create({
          data: {
            whatsappPhone: phone,
            userName: name || null,
            status: "BOT",
            botEnabled: true,
            lastMessageAt: new Date(),
            contactProfile: JSON.stringify(profile),
          },
        });
        result.created += 1;
        continue;
      }

      const current = readProfile(existing.contactProfile);
      const next: ContactProfile = {
        ...current,
        firstName: incoming.firstName ?? current.firstName,
        lastName: incoming.lastName ?? current.lastName,
        locality: incoming.locality ?? current.locality,
        matricula: incoming.matricula ?? current.matricula,
        role: incoming.role ?? current.role,
        email: incoming.email ?? current.email,
        observations: incoming.observations ?? current.observations,
        interests: incoming.interests ?? current.interests,
      };
      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          userName: name || existing.userName,
          contactProfile: JSON.stringify(next),
        },
      });
      result.updated += 1;
    } catch (err) {
      result.errors.push({
        line,
        telefono: phone,
        error: err instanceof Error ? err.message : "No se pudo guardar",
      });
    }
  }

  return result;
}
