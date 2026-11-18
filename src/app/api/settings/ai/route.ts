import { NextResponse } from "next/server";
import { isAdminUser, requireApiAdmin, requireApiUser } from "@/lib/auth";
import {
  AI_PROVIDERS,
  getAiConfig,
  publicAiStatus,
  saveAiConfig,
  testAiConnection,
  type AiProviderId,
} from "@/lib/ai-providers";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const cfg = await getAiConfig();
  return NextResponse.json({
    ...publicAiStatus(cfg),
    canEdit: isAdminUser(user),
  });
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;

  const body = (await request.json()) as {
    provider?: string;
    model?: string;
    apiKey?: string;
    test?: boolean;
  };

  const provider = (body.provider ?? "none") as AiProviderId;
  if (!AI_PROVIDERS.some((p) => p.id === provider)) {
    return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
  }

  await saveAiConfig({
    provider,
    model: body.model,
    apiKey: body.apiKey,
  });

  if (body.test && provider !== "none") {
    try {
      const result = await testAiConnection();
      const cfg = await getAiConfig();
      return NextResponse.json({ ...publicAiStatus(cfg), test: result, canEdit: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo conectar";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const cfg = await getAiConfig();
  return NextResponse.json({ ...publicAiStatus(cfg), canEdit: true });
}
