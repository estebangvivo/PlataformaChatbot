"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Provider = {
  id: string;
  label: string;
  hint?: string;
  keyUrl?: string;
  models?: Array<{ id: string; label: string }>;
};

type AiStatus = {
  provider: string;
  label: string;
  model: string;
  hasKey: boolean;
  maskedKey: string | null;
  canEdit: boolean;
  providers: Provider[];
};

export function SettingsView() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState("none");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const spec = useMemo(
    () => status?.providers.find((p) => p.id === provider),
    [status, provider],
  );

  async function load() {
    const res = await fetch("/api/settings/ai");
    const data = (await res.json()) as AiStatus;
    setStatus(data);
    setProvider(data.provider);
    setModel(data.model);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!spec?.models?.length) return;
    if (!spec.models.some((m) => m.id === model)) {
      setModel(spec.models[0].id);
    }
  }, [spec, model]);

  async function save(test: boolean) {
    if (!status?.canEdit) return;
    if (provider !== "none" && !apiKey && !status.hasKey) {
      toast.error("Pegá la API key del proveedor que elegiste");
      return;
    }
    test ? setTesting(true) : setSaving(true);
    const res = await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        model,
        apiKey: apiKey || undefined,
        test,
      }),
    });
    const data = await res.json();
    setSaving(false);
    setTesting(false);
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo guardar");
      return;
    }
    setApiKey("");
    setStatus((prev) => (prev ? { ...prev, ...data } : data));
    setProvider(data.provider);
    setModel(data.model);
    if (test) toast.success(`Conectó bien: ${data.test?.sample ?? "OK"}`);
    else toast.success("Configuración de IA guardada");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl sm:text-4xl">Configuración</h1>
        <p className="text-ink/60">Elegí el modelo de IA del chatbot e integraciones.</p>
      </header>

      <Card className="p-6">
        <h2 className="font-serif text-2xl">Inteligencia artificial</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">
          El bot puede usar Gemini, ChatGPT o Claude para seguir la conversación. La clave se
          guarda en la base (solo SuperAdmin). Si no hay IA, responde con reglas y la web
          indexada.
        </p>

        {status ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-ink/60">Proveedor</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                disabled={!status.canEdit}
                className="flex h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-moss"
              >
                {status.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            {spec?.models?.length ? (
              <label className="block text-sm">
                <span className="mb-1 block text-ink/60">Modelo</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={!status.canEdit}
                  className="flex h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-moss"
                >
                  {spec.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {provider !== "none" ? (
              <label className="block text-sm">
                <span className="mb-1 block text-ink/60">API key</span>
                <Input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={!status.canEdit}
                  placeholder={status.hasKey && status.provider === provider ? status.maskedKey ?? "••••" : "Pegá la clave"}
                />
                <p className="mt-1 text-xs text-ink/50">
                  {spec?.hint}{" "}
                  {spec?.keyUrl ? (
                    <a href={spec.keyUrl} className="text-moss underline" target="_blank" rel="noreferrer">
                      Obtener clave
                    </a>
                  ) : null}
                  {status.hasKey && status.provider === provider ? " · Ya hay una clave guardada." : null}
                </p>
              </label>
            ) : null}

            {status.canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
                {provider !== "none" ? (
                  <Button type="button" variant="outline" disabled={testing} onClick={() => void save(true)}>
                    {testing ? "Probando…" : "Probar conexión"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-ink/50">Solo SuperAdmin puede cambiar la IA.</p>
            )}
          </form>
        ) : (
          <p className="mt-4 text-sm text-ink/50">Cargando…</p>
        )}
      </Card>

      <Card className="space-y-3 p-6 text-sm leading-7 text-ink/75">
        <p>
          <strong>WhatsApp:</strong> cargá <code>WHATSAPP_ACCESS_TOKEN</code>,{" "}
          <code>WHATSAPP_PHONE_NUMBER_ID</code> y <code>WHATSAPP_VERIFY_TOKEN</code> en el{" "}
          <code>.env</code>. El webhook es <code>/api/webhook/whatsapp</code>.
        </p>
        <p>
          <strong>Base de datos:</strong> por defecto SQLite (<code>prisma/dev.db</code>). Para
          PostgreSQL/Supabase cambiá el provider en <code>prisma/schema.prisma</code> y{" "}
          <code>DATABASE_URL</code>.
        </p>
        <p>
          <strong>Conocimiento:</strong> todas las noches a las 3:00 (Córdoba) recorre
          regional5.com.ar. Si cambiás de proveedor de IA, conviene{" "}
          <strong>Revisar ahora</strong> en Base de conocimiento para regenerar embeddings.
        </p>
      </Card>
    </div>
  );
}
