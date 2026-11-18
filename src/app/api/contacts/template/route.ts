import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { buildContactsWorkbook } from "@/lib/contact-import";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  const workbook = await buildContactsWorkbook(true);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="contactos-regional5.xlsx"',
    },
  });
}
