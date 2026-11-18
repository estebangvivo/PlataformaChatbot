"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import {
  addDaysYmd,
  hmFromIso,
  rfc3339Cordoba,
  startOfWeekYmd,
  ymdFromIso,
  ymdInTz,
} from "@/lib/calendar-time";
import { cn } from "@/lib/utils";

type Status = {
  configured: boolean;
  connected: boolean;
  canConnect: boolean;
  redirectUri: string;
  maskedClientId: string | null;
  hasSecret: boolean;
  calendarId: string;
  calendarName: string;
  accountEmail: string | null;
  calendars: Array<{ id: string; summary: string; primary?: boolean }>;
};

type CalEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
  htmlLink?: string;
  colorId?: string;
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  date: string;
  startHm: string;
  endHm: string;
  endDate: string;
};

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 52;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const emptyDraft = (date: string, hour = 9): Draft => ({
  title: "",
  description: "",
  location: "",
  allDay: false,
  date,
  startHm: `${String(hour).padStart(2, "0")}:00`,
  endHm: `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:00`,
  endDate: date,
});

function eventOnDay(event: CalEvent, ymd: string) {
  const start = event.allDay ? event.start.slice(0, 10) : ymdFromIso(event.start);
  const endExclusive = event.allDay ? event.end.slice(0, 10) : ymdFromIso(event.end);
  if (event.allDay) return start <= ymd && ymd < endExclusive;
  if (start === ymd) return true;
  const endHm = hmFromIso(event.end);
  return start < ymd && (ymd < endExclusive || (ymd === endExclusive && endHm !== "00:00"));
}

function timedStyle(event: CalEvent, ymd: string) {
  const startYmd = ymdFromIso(event.start);
  const endYmd = ymdFromIso(event.end);
  const startMin = startYmd === ymd ? hmToMin(hmFromIso(event.start)) : START_HOUR * 60;
  let endMin = endYmd === ymd ? hmToMin(hmFromIso(event.end)) : END_HOUR * 60;
  if (endMin <= startMin) endMin = startMin + 30;
  const top = ((Math.max(startMin, START_HOUR * 60) - START_HOUR * 60) / 60) * HOUR_PX;
  const height = Math.max(22, ((Math.min(endMin, END_HOUR * 60) - Math.max(startMin, START_HOUR * 60)) / 60) * HOUR_PX);
  return { top, height };
}

function hmToMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function inclusiveEnd(event: CalEvent) {
  const end = event.end.slice(0, 10);
  return addDaysYmd(end, -1);
}

export function AgendaView() {
  const search = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeekYmd(ymdInTz()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const today = ymdInTz();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i)), [weekStart]);

  async function loadStatus() {
    const res = await fetch("/api/calendar/status");
    const data = (await res.json()) as Status;
    setStatus(data);
    return data;
  }

  async function loadEvents(from = weekStart) {
    const to = addDaysYmd(from, 7);
    const res = await fetch(`/api/calendar/events?from=${from}&to=${to}`);
    const data = (await res.json()) as { events?: CalEvent[]; error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "No se pudieron leer los eventos");
      setEvents([]);
      return;
    }
    setEvents(data.events ?? []);
  }

  useEffect(() => {
    const error = search.get("error");
    if (error) toast.error(error);
    if (search.get("connected") === "1") toast.success("Google Calendar conectado");
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const st = await loadStatus();
      if (!cancelled && st.connected) await loadEvents(weekStart);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function saveCredentials(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const res = await fetch("/api/calendar/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId.trim() || undefined,
        clientSecret: clientSecret.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "No se pudieron guardar las credenciales");
      return;
    }
    setClientSecret("");
    toast.success("Credenciales guardadas. Ahora conectá la cuenta de Google.");
    await loadStatus();
  }

  async function chooseCalendar(calendarId: string) {
    const res = await fetch("/api/calendar/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo cambiar el calendario");
      return;
    }
    await loadStatus();
    await loadEvents(weekStart);
    toast.success("Calendario actualizado");
  }

  async function disconnect() {
    if (!confirm("¿Desconectar Google Calendar de la mesa?")) return;
    await fetch("/api/calendar/disconnect", { method: "POST" });
    setEvents([]);
    await loadStatus();
    toast.success("Calendario desconectado");
  }

  function openCreate(ymd: string, hour?: number) {
    setDraft(emptyDraft(ymd, hour ?? 9));
  }

  function openEdit(event: CalEvent) {
    if (event.allDay) {
      const start = event.start.slice(0, 10);
      setDraft({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        allDay: true,
        date: start,
        endDate: inclusiveEnd(event),
        startHm: "09:00",
        endHm: "10:00",
      });
      return;
    }
    setDraft({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      allDay: false,
      date: ymdFromIso(event.start),
      endDate: ymdFromIso(event.end),
      startHm: hmFromIso(event.start),
      endHm: hmFromIso(event.end),
    });
  }

  async function saveEvent(event: FormEvent) {
    event.preventDefault();
    if (!draft?.title.trim()) {
      toast.error("Poné un título");
      return;
    }
    setSaving(true);
    const payload = draft.allDay
      ? {
          title: draft.title,
          description: draft.description,
          location: draft.location,
          allDay: true,
          start: draft.date,
          end: addDaysYmd(draft.endDate || draft.date, 1),
        }
      : {
          title: draft.title,
          description: draft.description,
          location: draft.location,
          allDay: false,
          start: rfc3339Cordoba(draft.date, draft.startHm),
          end: rfc3339Cordoba(draft.endDate || draft.date, draft.endHm),
        };
    const res = await fetch(draft.id ? `/api/calendar/events/${draft.id}` : "/api/calendar/events", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo guardar");
      return;
    }
    toast.success(draft.id ? "Evento actualizado en Google" : "Evento creado en Google");
    setDraft(null);
    await loadEvents(weekStart);
  }

  async function removeEvent() {
    if (!draft?.id) return;
    if (!confirm("¿Eliminar este evento de Google Calendar?")) return;
    setSaving(true);
    const res = await fetch(`/api/calendar/events/${draft.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo eliminar");
      return;
    }
    toast.success("Evento eliminado");
    setDraft(null);
    await loadEvents(weekStart);
  }

  const weekLabel = `${format(parseISO(`${weekStart}T12:00:00`), "d MMM", { locale: es })} – ${format(
    parseISO(`${addDaysYmd(weekStart, 6)}T12:00:00`),
    "d MMM yyyy",
    { locale: es },
  )}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl">Agenda</h1>
          <p className="max-w-2xl text-ink/60">
            El calendario de Google de la Regional. Lo que creés o edites acá se refleja en Google
            Calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDaysYmd(weekStart, -7))} aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" onClick={() => setWeekStart(startOfWeekYmd(today))}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDaysYmd(weekStart, 7))} aria-label="Semana siguiente">
            <ChevronRight size={16} />
          </Button>
          {status?.connected ? (
            <Button onClick={() => openCreate(today)}>
              <Plus size={14} /> Nuevo evento
            </Button>
          ) : null}
        </div>
      </header>

      {status && !status.connected ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-serif text-2xl">Conectar Google Calendar</h2>
            <p className="mt-1 text-sm text-ink/60">
              Un administrador vincula la cuenta de Google de la Regional. Después todo el equipo
              puede ver y editar la agenda.
            </p>
          </div>
          {status.canConnect ? (
            <>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/70">
                <li>
                  En{" "}
                  <a className="text-moss underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                    Google Cloud
                  </a>{" "}
                  creá un OAuth Client ID (aplicación web) y habilitá la API de Google Calendar.
                </li>
                <li>
                  URI de redirección:{" "}
                  <code className="rounded bg-sand px-1.5 py-0.5 text-xs">{status.redirectUri}</code>
                </li>
                <li>Pegá el Client ID y el secreto, guardá y conectá la cuenta.</li>
              </ol>
              <form onSubmit={saveCredentials} className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-ink/70">Client ID</span>
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder={status.maskedClientId ?? "xxxx.apps.googleusercontent.com"}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-ink/70">Client secret</span>
                  <Input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={status.hasSecret ? "•••• ya guardado" : "GOCSPX-…"}
                  />
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button type="submit" variant="outline" disabled={saving}>
                    {saving ? "Guardando…" : "Guardar credenciales"}
                  </Button>
                  <Button
                    type="button"
                    disabled={saving || (!status.configured && !clientId)}
                    onClick={async () => {
                      if (clientId.trim() || clientSecret.trim()) {
                        const res = await fetch("/api/calendar/status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            clientId: clientId.trim() || undefined,
                            clientSecret: clientSecret.trim() || undefined,
                          }),
                        });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          toast.error(data.error ?? "No se pudieron guardar las credenciales");
                          return;
                        }
                      }
                      window.location.href = "/api/calendar/oauth/start";
                    }}
                  >
                    Conectar con Google
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <p className="text-sm text-ink/60">Pedile a un administrador que vincule el calendario.</p>
          )}
        </Card>
      ) : null}

      {status?.connected ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink/65">
          <p>
            <span className="font-medium text-ink">{status.calendarName}</span>
            {status.accountEmail ? ` · ${status.accountEmail}` : ""}
          </p>
          {status.canConnect && status.calendars.length > 1 ? (
            <select
              className="h-9 rounded-xl border border-line bg-white px-3 text-sm"
              value={status.calendarId}
              onChange={(e) => void chooseCalendar(e.target.value)}
            >
              {status.calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary}
                </option>
              ))}
            </select>
          ) : null}
          {status.canConnect ? (
            <Button size="sm" variant="ghost" onClick={() => void disconnect()}>
              Desconectar
            </Button>
          ) : null}
          <p className="ml-auto font-medium capitalize text-ink">{weekLabel}</p>
        </div>
      ) : (
        <p className="text-sm font-medium capitalize text-ink/70">{weekLabel}</p>
      )}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-line bg-sand/60">
          <div />
          {days.map((day) => {
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                onClick={() => status?.connected && openCreate(day)}
                className={cn("border-l border-line px-2 py-3 text-center", isToday && "bg-moss/10")}
              >
                <p className="text-[10px] uppercase tracking-wide text-ink/50">
                  {format(parseISO(`${day}T12:00:00`), "EEE", { locale: es })}
                </p>
                <p className={cn("font-serif text-xl", isToday && "text-pine")}>
                  {format(parseISO(`${day}T12:00:00`), "d")}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-line">
          <div className="px-1 py-2 text-[10px] uppercase tracking-wide text-ink/40">Día</div>
          {days.map((day) => (
            <div key={day} className="min-h-[44px] space-y-1 border-l border-line p-1">
              {events.filter((event) => event.allDay && eventOnDay(event, day)).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openEdit(event)}
                  className="block w-full truncate rounded-md bg-clay px-1.5 py-0.5 text-left text-[11px] text-white"
                >
                  {event.title}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="relative overflow-auto">
          <div
            className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
            style={{ height: HOURS.length * HOUR_PX }}
          >
            <div>
              {HOURS.map((hour) => (
                <div key={hour} className="border-b border-line/70 pr-1 text-right text-[10px] text-ink/40" style={{ height: HOUR_PX }}>
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {days.map((day) => (
              <div key={day} className="relative border-l border-line">
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    className="absolute left-0 right-0 border-b border-line/70 hover:bg-moss/5"
                    style={{ top: (hour - START_HOUR) * HOUR_PX, height: HOUR_PX }}
                    onClick={() => status?.connected && openCreate(day, hour)}
                    aria-label={`Crear evento el ${day} a las ${hour}:00`}
                  />
                ))}
                {events
                  .filter((event) => !event.allDay && eventOnDay(event, day))
                  .map((event) => {
                    const style = timedStyle(event, day);
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => openEdit(event)}
                        className="absolute left-1 right-1 z-10 overflow-hidden rounded-lg bg-pine px-1.5 py-1 text-left text-[11px] leading-tight text-sand shadow-sm"
                        style={{ top: style.top, height: style.height }}
                      >
                        <span className="block truncate font-medium">{event.title}</span>
                        {style.height > 32 ? (
                          <span className="block text-sand/70">
                            {hmFromIso(event.start)}–{hmFromIso(event.end)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
        {loading ? <p className="p-3 text-sm text-ink/50">Cargando agenda…</p> : null}
      </Card>

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setDraft(null)}>
          <Card className="w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-2xl">{draft.id ? "Editar evento" : "Nuevo evento"}</h2>
            <p className="mb-4 text-sm text-ink/55">Se guarda directo en Google Calendar.</p>
            <form onSubmit={saveEvent} className="grid gap-3">
              <label className="block text-sm">
                <span className="mb-1.5 block text-ink/70">Título</span>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-pine"
                  checked={draft.allDay}
                  onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })}
                />
                Todo el día
              </label>
              {draft.allDay ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-ink/70">Desde</span>
                    <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-ink/70">Hasta</span>
                    <Input
                      type="date"
                      value={draft.endDate}
                      onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2 block text-sm">
                    <span className="mb-1.5 block text-ink/70">Día</span>
                    <Input
                      type="date"
                      value={draft.date}
                      onChange={(e) => setDraft({ ...draft, date: e.target.value, endDate: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-ink/70">Inicio</span>
                    <Input type="time" value={draft.startHm} onChange={(e) => setDraft({ ...draft, startHm: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-ink/70">Fin</span>
                    <Input type="time" value={draft.endHm} onChange={(e) => setDraft({ ...draft, endHm: e.target.value })} />
                  </label>
                </div>
              )}
              <label className="block text-sm">
                <span className="mb-1.5 block text-ink/70">Lugar</span>
                <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-ink/70">Notas</span>
                <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={saving}>{saving ? "Guardando…" : "Guardar en Google"}</Button>
                {draft.id ? (
                  <Button type="button" variant="danger" disabled={saving} onClick={() => void removeEvent()}>
                    Eliminar
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
