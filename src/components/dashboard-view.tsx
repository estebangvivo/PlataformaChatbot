"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Stats = {
  conversations: number;
  pending: number;
  human: number;
  bot: number;
  closed: number;
  chunks: number;
  agentsOnline: number;
};

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  const cards = [
    { label: "Pendientes", value: stats?.pending ?? "—", hint: "Esperan agente" },
    { label: "En atención humana", value: stats?.human ?? "—", hint: "Bot en pausa" },
    { label: "Atendidas por bot", value: stats?.bot ?? "—", hint: "Respuesta automática" },
    { label: "Agentes online", value: stats?.agentsOnline ?? "—", hint: "Disponibles ahora" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-moss">Regional 5</p>
        <h1 className="font-serif text-4xl">Tablero de mesa</h1>
        <p className="mt-2 max-w-2xl text-ink/65">
          Vista operativa del chatbot de WhatsApp, la base de conocimiento de regional5.com.ar y la
          derivación a agentes.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-5">
            <p className="text-xs uppercase tracking-wide text-ink/50">{card.label}</p>
            <p className="mt-2 font-serif text-4xl">{card.value}</p>
            <p className="text-sm text-ink/55">{card.hint}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-serif text-2xl">Flujo de atención</h2>
          <ol className="mt-4 space-y-3 text-sm text-ink/75">
            <li>1. Entra un WhatsApp (Cloud API o simulador).</li>
            <li>2. El motor consulta la base RAG de Regional 5.</li>
            <li>3. Si hay confianza, responde el bot. Si no, pasa a Pendiente.</li>
            <li>4. Un agente toma control, escribe en vivo y puede devolver o cerrar.</li>
          </ol>
        </Card>
        <Card className="p-6">
          <h2 className="font-serif text-2xl">Base institucional</h2>
          <p className="mt-3 text-sm text-ink/70">
            Fragmentos indexados: <strong>{stats?.chunks ?? "—"}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Trámites", "Matrícula", "Aranceles", "Autoridades", "Subcentros", "Asesorías"].map(
              (tag) => (
                <Badge key={tag} className="bg-sand text-pine">
                  {tag}
                </Badge>
              ),
            )}
          </div>
          <p className="mt-4 text-sm text-ink/55">
            Conversaciones totales: {stats?.conversations ?? "—"} · Cerradas: {stats?.closed ?? "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}
