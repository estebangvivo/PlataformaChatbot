"use client";

import { useEffect, useState } from "react";
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

export function KnowledgeView() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<KnowledgeSyncResult | null>(null);
  const [nextInMs, setNextInMs] = useState<number | null>(null);

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
          <h1 className="font-serif text-4xl">Base de conocimiento</h1>
          <p className="max-w-2xl text-ink/60">
            Fragmentos de regional5.com.ar. Las fichas institucionales (horario, turnos, firma
            digital) tienen prioridad sobre el rastreo de la web. Todas las noches, a las 3:00
            (Córdoba), el bot recorre el sitio y se actualiza solo si algo cambió.
          </p>
        </div>
        <Button onClick={ingest} disabled={loading}>
          {loading ? "Indexando…" : "Revisar ahora"}
        </Button>
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
          La app tiene que estar corriendo a esa hora (o el cron de Vercel). Si el servidor estuvo
          apagado, al volver a prenderlo recupera la pasada que se perdió.
        </p>
      </Card>

      <p className="text-sm text-ink/55">{chunks.length} fragmentos</p>
      <div className="space-y-3">
        {chunks.map((chunk) => (
          <Card key={chunk.id} className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {chunk.title?.startsWith("[ficha]") ? (
                <Badge className="bg-pine text-sand">Ficha</Badge>
              ) : (
                <Badge className="bg-sand text-pine">Web</Badge>
              )}
              {chunk.category ? <Badge className="bg-sand text-pine">{chunk.category}</Badge> : null}
              <p className="font-medium">{chunk.title?.replace(/^\[ficha\]\s*/, "")}</p>
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
