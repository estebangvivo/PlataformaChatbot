"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bot, ContactRound, Hand, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn, formatPhone, initials, parseJson } from "@/lib/utils";

type Message = {
  id: string;
  senderType: string;
  content: string;
  timestamp: string;
};

type Conversation = {
  id: string;
  whatsappPhone: string;
  userName: string | null;
  status: string;
  lastIntent: string | null;
  botEnabled: boolean;
  lastMessageAt: string;
  contactProfile?: string | null;
  assignedAgent: { id: string; fullName: string } | null;
  messages: Message[];
};

type Agent = {
  userId: string;
  fullName: string;
  department: string;
  isOnline: boolean;
  availableNow: boolean;
  lastAssignedAt?: string | null;
};

const FILTERS = [
  { id: "ALL", label: "Todas" },
  { id: "PENDING", label: "Pendientes" },
  { id: "BOT", label: "Bot" },
  { id: "HUMAN", label: "Humanas" },
  { id: "CLOSED", label: "Cerradas" },
];

export function InboxBoard() {
  const params = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(params.get("id"));
  const [detail, setDetail] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  async function loadList() {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data.conversations ?? []);
    setLoading(false);
  }

  async function loadOne(id: string) {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    if (data.conversation) {
      setDetail(data.conversation);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data.conversation, messages: c.messages } : c)),
      );
    }
  }

  async function loadAgents() {
    const res = await fetch("/api/agents");
    const data = await res.json();
    setAgents(data.agents ?? []);
  }

  useEffect(() => {
    loadList();
    loadAgents();
    const es = new EventSource("/api/events");
    es.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        type: string;
        payload?: { conversationId?: string; id?: string };
      };
      if (payload.type === "heartbeat") return;
      loadList();
      loadAgents();
      const cid = payload.payload?.conversationId ?? payload.payload?.id;
      if (cid) loadOne(cid);
    };
    const ping = setInterval(loadAgents, 20_000);
    return () => {
      es.close();
      clearInterval(ping);
    };
  }, []);

  const visible = useMemo(
    () => conversations.filter((c) => (filter === "ALL" ? true : c.status === filter)),
    [conversations, filter],
  );
  const selected = conversations.find((c) => c.id === activeId) ?? visible[0] ?? null;
  const active = detail && selected && detail.id === selected.id ? detail : selected;

  useEffect(() => {
    if (selected && selected.id !== activeId) setActiveId(selected.id);
  }, [selected, activeId]);

  useEffect(() => {
    if (activeId) loadOne(activeId);
    setClosing(false);
    setCloseNote("");
  }, [activeId]);

  useEffect(() => {
    stickToBottom.current = true;
  }, [activeId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, activeId]);

  async function action(path: string) {
    if (!active) return;
    const res = await fetch(`/api/conversations/${active.id}/${path}`, { method: "POST" });
    if (!res.ok) {
      toast.error("No se pudo completar la acción");
      return;
    }
    toast.success("Conversación actualizada");
    await loadOne(active.id);
    await loadList();
  }

  async function closeCase(outcome: "resolved" | "unresolved") {
    if (!active) return;
    const res = await fetch(`/api/conversations/${active.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, note: closeNote }),
    });
    if (!res.ok) {
      toast.error("No se pudo cerrar");
      return;
    }
    toast.success(outcome === "resolved" ? "Caso cerrado como resuelto" : "Caso cerrado sin solución");
    setClosing(false);
    setCloseNote("");
    await loadOne(active.id);
    await loadList();
  }

  async function assignTo(agentUserId: string) {
    if (!active) return;
    setAssigning(true);
    const res = await fetch(`/api/conversations/${active.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentUserId }),
    });
    setAssigning(false);
    if (!res.ok) {
      toast.error("No se pudo derivar");
      return;
    }
    toast.success("Chat derivado");
    await loadOne(active.id);
    await loadList();
  }

  async function send() {
    if (!active || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    const res = await fetch(`/api/conversations/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      toast.error("No se pudo enviar");
      setDraft(content);
      return;
    }
    await loadOne(active.id);
  }

  function selectConversation(id: string) {
    setActiveId(id);
    router.replace(`/inbox?id=${id}`, { scroll: false });
  }

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.fullName.localeCompare(b.fullName)),
    [agents],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-white/80 shadow-card">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div>
          <h1 className="font-serif text-2xl">Inbox</h1>
          <p className="text-xs text-ink/50">WhatsApp en tiempo real</p>
        </div>
        <AgentPresence agents={sortedAgents} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden">
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-line">
        <div className="border-b border-line p-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  filter === item.id ? "bg-pine text-sand" : "bg-sand text-ink/70",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <p className="p-4 text-sm text-ink/50">Cargando…</p> : null}
          {visible.map((item) => (
            <button
              key={item.id}
              onClick={() => selectConversation(item.id)}
              className={cn(
                "flex w-full gap-3 border-b border-line px-4 py-3 text-left hover:bg-sand/60",
                active?.id === item.id && "bg-sand",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pine text-xs text-sand">
                {initials(item.userName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{item.userName ?? "Sin nombre"}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="truncate text-xs text-ink/50">
                  {item.messages?.[0]?.content ?? "Sin mensajes"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-paper">
        {active ? (
          <>
            <header className="shrink-0 flex items-center justify-between gap-3 border-b border-line bg-white/90 px-5 py-3">
              <div>
                <p className="font-medium">{active.userName ?? "WhatsApp"}</p>
                <p className="text-xs text-ink/50">{formatPhone(active.whatsappPhone)}</p>
                {active.assignedAgent ? (
                  <p className="text-[11px] text-moss">Asesor: {active.assignedAgent.fullName}</p>
                ) : null}
                {active.lastIntent ? (
                  <p className="text-[11px] text-moss">Intención: {active.lastIntent}</p>
                ) : null}
                <ProfileChips raw={active.contactProfile} />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/contactos?id=${active.id}`}>
                    <ContactRound size={14} /> Ficha
                  </Link>
                </Button>
                <Button size="sm" onClick={() => action("takeover")}>
                  <Hand size={14} /> Tomar control
                </Button>
                <select
                  disabled={assigning || agents.length === 0}
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    e.target.value = "";
                    if (id) void assignTo(id);
                  }}
                  className="h-8 max-w-[200px] rounded-full border border-line bg-white px-2 text-xs text-ink outline-none focus:border-moss"
                >
                  <option value="">Derivar a…</option>
                  {sortedAgents.map((agent) => (
                    <option key={agent.userId} value={agent.userId}>
                      {agent.isOnline ? "● " : "○ "}
                      {agent.fullName} · {agent.department}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => action("release")}>
                  <RotateCcw size={14} /> Devolver al bot
                </Button>
                {closing ? (
                  <div className="flex w-full flex-col gap-2 rounded-2xl border border-line bg-sand/70 p-3 text-left">
                    <p className="text-xs font-medium text-ink/80">¿Cómo cerramos este caso?</p>
                    <input
                      value={closeNote}
                      onChange={(e) => setCloseNote(e.target.value)}
                      placeholder="Nota para el informe (opcional)"
                      className="h-8 rounded-full border border-line bg-white px-3 text-xs outline-none focus:border-moss"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => closeCase("resolved")}>
                        Resuelto
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => closeCase("unresolved")}>
                        Sin solución
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setClosing(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setClosing(true)}>
                    <X size={14} /> Cerrar
                  </Button>
                )}
              </div>
            </header>
            <div
              ref={scrollerRef}
              onScroll={() => {
                const el = scrollerRef.current;
                if (!el) return;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
              }}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-blueprint bg-blueprint p-5"
            >
              {(active.messages ?? []).map((message) => {
                const mine = message.senderType !== "USER";
                return (
                  <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        message.senderType === "USER" && "bg-white text-ink",
                        message.senderType === "BOT" && "bg-pine text-sand",
                        message.senderType === "AGENT" && "bg-clay text-white",
                      )}
                    >
                      <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-70">
                        {message.senderType === "BOT" ? <Bot size={10} /> : null}
                        {message.senderType === "USER" ? "WhatsApp" : message.senderType === "BOT" ? "Bot" : "Agente"}
                      </p>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="mt-1 text-[10px] opacity-60">
                        {format(new Date(message.timestamp), "HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <footer className="shrink-0 border-t border-line bg-white p-3">
              {active.status !== "HUMAN" ? (
                <p className="mb-2 text-xs text-ink/50">
                  El bot puede responder solo. Tomá el control para escribir como agente.
                </p>
              ) : null}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Escribir al matriculado…"
                  className="h-11 flex-1 rounded-full border border-line px-4 text-sm outline-none focus:border-moss"
                />
                <Button onClick={send}>
                  <Send size={16} /> Enviar
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="grid h-full place-items-center text-ink/50">
            No hay conversaciones en este filtro.
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function AgentPresence({ agents }: { agents: Agent[] }) {
  const onlineCount = agents.filter((agent) => agent.isOnline).length;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex items-center -space-x-2">
        {agents.slice(0, 7).map((agent) => (
          <div
            key={agent.userId}
            title={`${agent.fullName} · ${agent.department}${agent.isOnline ? " · en línea" : " · desconectado"}`}
            className={cn(
              "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold",
              agent.isOnline ? "bg-pine text-sand" : "bg-sand text-ink/45",
            )}
          >
            {initials(agent.fullName)}
            <span
              className={cn(
                "absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-white",
                agent.isOnline ? "bg-emerald-500" : "bg-ink/25",
              )}
            />
          </div>
        ))}
      </div>
      <p className="hidden text-xs text-ink/50 sm:block">
        {onlineCount === 0 ? "Nadie en línea" : `${onlineCount} en línea`}
      </p>
    </div>
  );
}

function ProfileChips({ raw }: { raw?: string | null }) {
  const profile = parseJson<{
    firstName?: string;
    lastName?: string;
    locality?: string;
    matricula?: string;
    role?: string;
    interests?: string[];
  }>(raw, {});
  const chips = [
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null,
    profile.role,
    profile.locality,
    profile.matricula ? `Mat. ${profile.matricula}` : null,
    ...(profile.interests ?? []).slice(0, 3),
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span key={String(chip)} className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-pine">
          {chip}
        </span>
      ))}
    </div>
  );
}
