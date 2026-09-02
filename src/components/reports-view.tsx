"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function minutesLabel(ms: number | null | undefined) {
  if (ms == null) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

type WeeklyReport = {
  weekOffset: number;
  start: string;
  end: string;
  totals: {
    newConversations: number;
    assigned: number;
    pending: number;
    takeover: number;
    released: number;
    resolved: number;
    unresolved: number;
    reopened: number;
    outOfScope: number;
    surveySent: number;
    surveyRated: number;
    surveySkipped: number;
    csat: number | null;
    surveyRate: number | null;
    avgFirstBotMs: number | null;
    avgPickupMs: number | null;
    avgHandleMs: number | null;
    closedWithHuman: number;
    closedBotOnly: number;
  };
  byAgent: Array<{
    name: string;
    received: number;
    derived: number;
    resolved: number;
    unresolved: number;
    csat: number | null;
  }>;
  byDepartment: Array<{ department: string; count: number }>;
  events: Array<{
    id: string;
    type: string;
    label: string;
    createdAt: string;
    actor: string;
    fromAgent: string | null;
    toAgent: string | null;
    department: string | null;
    intent: string | null;
    note: string | null;
    contact: string;
    conversationId: string;
  }>;
};

export function ReportsView() {
  const [week, setWeek] = useState(0);
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    fetch(`/api/reports/weekly?week=${week}`)
      .then(async (res) => {
        const raw = await res.text();
        if (!raw) throw new Error("El servidor no devolvió datos");
        const parsed = JSON.parse(raw) as WeeklyReport & { error?: string };
        if (!res.ok) throw new Error(parsed.error ?? "No se pudo cargar el informe");
        return parsed;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el informe");
      });
    return () => {
      cancelled = true;
    };
  }, [week]);

  function downloadCsv() {
    if (!data) return;
    const rows = [
      ["Fecha", "Tipo", "Contacto", "Quién actuó", "De", "Para", "Área", "Intención", "Nota"],
      ...data.events.map((event) => [
        format(new Date(event.createdAt), "dd/MM/yyyy HH:mm"),
        event.label,
        event.contact,
        event.actor,
        event.fromAgent ?? "",
        event.toAgent ?? "",
        event.department ?? "",
        event.intent ?? "",
        event.note ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-mesa-${format(new Date(data.start), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = data?.totals;
  const cards = [
    { label: "Chats nuevos", value: totals?.newConversations },
    { label: "Derivaciones", value: totals?.assigned },
    { label: "Resueltos", value: totals?.resolved },
    { label: "Sin solución", value: totals?.unresolved },
    { label: "Pendientes", value: totals?.pending },
    { label: "Fuera de tema", value: totals?.outOfScope },
    { label: "CSAT", value: totals?.csat != null ? `${totals.csat}/5` : "—" },
    { label: "Respuesta encuesta", value: totals?.surveyRate != null ? `${totals.surveyRate}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Informe semanal</h1>
          <p className="text-ink/60">
            {error
              ? error
              : data
                ? `${format(new Date(data.start), "d MMM", { locale: es })} – ${format(new Date(new Date(data.end).getTime() - 1), "d MMM yyyy", { locale: es })}`
                : "Cargando…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeek((w) => w - 1)}>
            <ChevronLeft size={14} /> Semana anterior
          </Button>
          {week !== 0 ? (
            <Button variant="outline" size="sm" onClick={() => setWeek(0)}>
              Esta semana
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={week >= 0} onClick={() => setWeek((w) => Math.min(0, w + 1))}>
            Semana siguiente <ChevronRight size={14} />
          </Button>
          <Button size="sm" onClick={downloadCsv} disabled={!data?.events.length}>
            <Download size={14} /> CSV
          </Button>
        </div>
      </header>

      {error ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
          No se pudo cargar el informe: {error}
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink/50">{card.label}</p>
            <p className="mt-1 font-serif text-3xl">{card.value ?? "—"}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">1.ª respuesta bot</p>
          <p className="mt-1 font-serif text-3xl">{minutesLabel(totals?.avgFirstBotMs)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">Espera hasta humano</p>
          <p className="mt-1 font-serif text-3xl">{minutesLabel(totals?.avgPickupMs)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">Tiempo de atención</p>
          <p className="mt-1 font-serif text-3xl">{minutesLabel(totals?.avgHandleMs)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">Encuestas</p>
          <p className="mt-1 font-serif text-3xl">
            {totals ? `${totals.surveyRated}/${totals.surveySent}` : "—"}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-serif text-2xl">Por asesor</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-sand text-left text-[11px] uppercase tracking-wide text-ink/55">
              <tr>
                <th className="px-4 py-2">Asesor</th>
                <th>Recibió</th>
                <th>Derivó</th>
                <th>Resueltos</th>
                <th>Sin sol.</th>
                <th>CSAT</th>
              </tr>
            </thead>
            <tbody>
              {(data?.byAgent ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-ink/50" colSpan={6}>
                    Todavía no hay movimientos esta semana.
                  </td>
                </tr>
              ) : (
                data?.byAgent.map((row) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{row.name}</td>
                    <td>{row.received}</td>
                    <td>{row.derived}</td>
                    <td>{row.resolved}</td>
                    <td>{row.unresolved}</td>
                    <td>{row.csat != null ? `${row.csat}/5` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        <Card className="p-4">
          <h2 className="font-serif text-2xl">Por área</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(data?.byDepartment ?? []).length === 0 ? (
              <li className="text-ink/50">Sin derivaciones con área esta semana.</li>
            ) : (
              data?.byDepartment.map((row) => (
                <li key={row.department} className="flex justify-between border-b border-line py-1.5">
                  <span>{row.department}</span>
                  <span className="font-medium">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-serif text-2xl">Detalle de movimientos</h2>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sand text-left text-[11px] uppercase tracking-wide text-ink/55">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th>Tipo</th>
                <th>Contacto</th>
                <th>Quién</th>
                <th>De → Para</th>
                <th>Área</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {(data?.events ?? []).map((event) => (
                <tr key={event.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-ink/60">
                    {format(new Date(event.createdAt), "dd/MM HH:mm")}
                  </td>
                  <td>{event.label}</td>
                  <td>
                    <Link className="text-moss hover:underline" href={`/inbox?id=${event.conversationId}`}>
                      {event.contact}
                    </Link>
                  </td>
                  <td>{event.actor}</td>
                  <td className="text-xs">
                    {event.fromAgent || event.toAgent
                      ? `${event.fromAgent ?? "—"} → ${event.toAgent ?? "—"}`
                      : "—"}
                  </td>
                  <td>{event.department ?? "—"}</td>
                  <td className="max-w-[180px] truncate text-xs" title={event.note ?? ""}>
                    {event.note || event.intent || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
