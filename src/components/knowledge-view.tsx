"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeSyncResult } from "@/lib/ingest-types";

type Chunk = {
  id: string;
  pageUrl: string;
  title: string | null;
  category: string | null;
  contentChunk: string;
};

type UploadedGroup = {
  pageUrl: string;
  title: string;
  category: string | null;
  preview: string;
  chunks: number;
};

function isFicha(chunk: Chunk) {
  return Boolean(chunk.title?.startsWith("[ficha]"));
}

function isDocumento(chunk: Chunk) {
  return Boolean(chunk.title?.startsWith("[documento]") || chunk.pageUrl.startsWith("/uploads/"));
}

function displayTitle(title: string | null) {
  return (title ?? "")
    .replace(/^\[ficha\]\s*/, "")
    .replace(/^\[documento\]\s*/, "")
    .replace(/\s*\(\d+\/\d+\)\s*$/, "")
    .trim();
}

export function KnowledgeView() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<KnowledgeSyncResult | null>(null);
  const [nextInMs, setNextInMs] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    setChunks(data.chunks ?? []);
    setLastSync(data.lastSync ?? null);
    setNextInMs(typeof data.nextInMs === "number" ? data.nextInMs : null);
  }

  useEffect(() => {
    load();
  }, []);

  const documents = useMemo(() => {
    const grouped = new Map<string, UploadedGroup>();
    for (const chunk of chunks.filter(isDocumento)) {
      const current = grouped.get(chunk.pageUrl);
      if (current) {
        current.chunks += 1;
        continue;
      }
      grouped.set(chunk.pageUrl, {
        pageUrl: chunk.pageUrl,
        title: displayTitle(chunk.title) || chunk.pageUrl,
        category: chunk.category,
        preview: chunk.contentChunk,
        chunks: 1,
      });
    }
    return [...grouped.values()];
  }, [chunks]);

  const listed = useMemo(() => chunks.filter((chunk) => !isDocumento(chunk)), [chunks]);

  async function ingest() {
    setLoading(true);
    const res = await fetch("/api/ingest", { method: "POST" });
    const data = (await res.json()) as KnowledgeSyncResult & { error?: string };
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Falló el ingest");
      return;
    }
    if (data.skipped && data.reason === "La web no cambió") {
      toast.success("La web no cambió. El bot ya está al día.");
    } else if (data.skipped) {
      toast.error(data.reason ?? "No se actualizó");
    } else {
      const n = data.added.length + data.updated.length;
      toast.success(
        n ? `Actualizado: ${n} página${n === 1 ? "" : "s"} con cambios` : `Indexados ${data.stored} fragmentos`,
      );
    }
    load();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; chunks?: number; filename?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo indexar el documento");
        return;
      }
      toast.success(`Se sumó ${file.name} (${data.chunks ?? 1} fragmento${data.chunks === 1 ? "" : "s"})`);
      await load();
    } catch {
      toast.error("No se pudo subir el documento");
    } finally {
      setUploading(false);
    }
  }

  async function removeDocument(pageUrl: string) {
    setRemovingUrl(pageUrl);
    try {
      const res = await fetch("/api/knowledge/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo quitar el documento");
        return;
      }
      toast.success("Documento quitado de la base");
      await load();
    } catch {
      toast.error("No se pudo quitar el documento");
    } finally {
      setRemovingUrl(null);
    }
  }

  const nextLabel =
    nextInMs == null
      ? null
      : nextInMs < 60_000
        ? "en menos de un minuto"
        : nextInMs < 3_600_000
          ? `en ${Math.round(nextInMs / 60_000)} min`
          : `a las 03:00 (en ${Math.round(nextInMs / 3_600_000)} h)`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl">Base de conocimiento</h1>
          <p className="max-w-2xl text-ink/60">
            Fragmentos de regional5.com.ar más los documentos que subas. Las fichas institucionales y
            los PDF/Word conviven con el rastreo: al reindexar el sitio no se borran. Todas las
            noches, a las 3:00 (Córdoba), el bot recorre la web y se actualiza solo si algo cambió.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.html,.htm,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) {
                toast.error("El archivo supera 10 MB");
                return;
              }
              await uploadFile(file);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Subiendo…" : "Subir documento"}
          </Button>
          <Button onClick={ingest} disabled={loading}>
            {loading ? "Indexando…" : "Revisar ahora"}
          </Button>
        </div>
      </header>

      <Card className="p-4 text-sm text-ink/70">
        <p>
          <span className="font-medium text-ink">Rutina nocturna:</span> 03:00 hora de Córdoba.
          {nextLabel ? ` Próxima pasada ${nextLabel}.` : ""}
        </p>
        {lastSync ? (
          <p className="mt-1">
            Última revisión:{" "}
            {format(new Date(lastSync.ranAt), "d MMM yyyy HH:mm", { locale: es })}
            {lastSync.changed
              ? ` · se actualizó (${lastSync.updated.length} cambiadas, ${lastSync.added.length} nuevas)`
              : ` · ${lastSync.reason ?? "sin cambios"}`}
            {lastSync.source === "cron" ? " · automática" : " · manual"}
          </p>
        ) : (
          <p className="mt-1">Todavía no hay una pasada registrada. Podés revisar ahora o esperar a la noche.</p>
        )}
        <p className="mt-2 text-xs text-ink/50">
          PDF, Word, TXT o una imagen con texto (hasta 10 MB). El bot los usa junto con la web. La app
          tiene que estar corriendo a las 3:00 (o el cron de Vercel).
        </p>
      </Card>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-xl">Documentos subidos</h2>
          <p className="text-sm text-ink/55">
            {documents.length
              ? `${documents.length} archivo${documents.length === 1 ? "" : "s"}`
              : "Todavía no hay documentos propios"}
          </p>
        </div>
        {documents.map((doc) => (
          <Card key={doc.pageUrl} className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="bg-clay text-white">Documento</Badge>
              {doc.category ? <Badge className="bg-sand text-pine">{doc.category}</Badge> : null}
              <p className="font-medium">{doc.title}</p>
              <p className="text-xs text-ink/50">
                {doc.chunks} fragmento{doc.chunks === 1 ? "" : "s"}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <a href={doc.pageUrl} className="text-xs text-moss underline" target="_blank" rel="noreferrer">
                  Ver archivo
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removingUrl === doc.pageUrl}
                  onClick={() => removeDocument(doc.pageUrl)}
                >
                  {removingUrl === doc.pageUrl ? "Quitando…" : "Quitar"}
                </Button>
              </div>
            </div>
            <p className="text-sm text-ink/75">{doc.preview}</p>
          </Card>
        ))}
      </section>

      <p className="text-sm text-ink/55">
        {listed.length} fragmentos de fichas y web · {chunks.length} en total
      </p>
      <div className="space-y-3">
        {listed.map((chunk) => (
          <Card key={chunk.id} className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {isFicha(chunk) ? (
                <Badge className="bg-pine text-sand">Ficha</Badge>
              ) : (
                <Badge className="bg-sand text-pine">Web</Badge>
              )}
              {chunk.category ? <Badge className="bg-sand text-pine">{chunk.category}</Badge> : null}
              <p className="font-medium">{displayTitle(chunk.title)}</p>
            </div>
            <p className="text-sm text-ink/75">{chunk.contentChunk}</p>
            <a
              href={chunk.pageUrl}
              className="mt-2 inline-block text-xs text-moss underline"
              target="_blank"
              rel="noreferrer"
            >
              {chunk.pageUrl}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
