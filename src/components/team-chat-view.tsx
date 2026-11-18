"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Paperclip, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MessageMedia } from "@/components/message-media";
import { cn, initials } from "@/lib/utils";
import { readFileAsMedia } from "@/lib/read-file";

type Person = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  roleName: string | null;
  isOnline: boolean;
};

type Thread = {
  id: string;
  kind: string;
  title: string;
  lastMessageAt: string;
  lastPreview: string;
  unread: number;
  members: Person[];
  other: Person | null;
};

type ChatMessage = {
  id: string;
  content: string;
  metadata?: string | null;
  createdAt: string;
  senderId: string | null;
  senderName: string;
};

export function TeamChatView() {
  const params = useSearchParams();
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [activeId, setActiveId] = useState<string | null>(params.get("id"));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [attachName, setAttachName] = useState<string | null>(null);
  const pendingMedia = useRef<{ mime: string; filename: string; dataBase64: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  async function loadMe() {
    const res = await fetch("/api/auth/me");
    const data = (await res.json()) as { user?: { id?: string } };
    setMeId(data.user?.id ?? null);
  }

  async function loadThreads() {
    const res = await fetch("/api/team-chat/threads");
    const data = (await res.json()) as { threads?: Thread[] };
    setThreads(data.threads ?? []);
  }

  async function loadPeople() {
    const res = await fetch("/api/team-chat/people");
    const data = (await res.json()) as { people?: Person[] };
    setPeople(data.people ?? []);
  }

  async function loadOne(id: string) {
    const res = await fetch(`/api/team-chat/threads/${id}`);
    const data = (await res.json()) as { thread?: Thread; messages?: ChatMessage[]; error?: string };
    if (!res.ok || !data.thread) {
      toast.error(data.error ?? "No se pudo abrir el chat");
      return;
    }
    setActive(data.thread);
    setMessages(data.messages ?? []);
    setThreads((prev) =>
      prev.map((thread) => (thread.id === id ? { ...thread, ...data.thread, unread: 0 } : thread)),
    );
  }

  useEffect(() => {
    void loadMe();
    void loadThreads();
    void loadPeople();
  }, []);

  useEffect(() => {
    const id = params.get("id");
    setActiveId(id);
    if (id) void loadOne(id);
    else {
      setActive(null);
      setMessages([]);
    }
  }, [params]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeId]);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as {
        type?: string;
        payload?: { threadId?: string; memberIds?: string[] };
      };
      if (parsed.type !== "team.chat" || !parsed.payload?.threadId) return;
      if (meId && parsed.payload.memberIds && !parsed.payload.memberIds.includes(meId)) return;
      void loadThreads();
      if (parsed.payload.threadId === activeId) void loadOne(parsed.payload.threadId);
    };
    return () => es.close();
  }, [activeId, meId]);

  function selectThread(id: string) {
    setActiveId(id);
    router.replace(`/chat?id=${id}`, { scroll: false });
  }

  async function startWith(person: Person) {
    const res = await fetch("/api/team-chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: person.id }),
    });
    const data = (await res.json()) as { threadId?: string; error?: string };
    if (!res.ok || !data.threadId) {
      toast.error(data.error ?? "No se pudo abrir el chat");
      return;
    }
    setPickerOpen(false);
    setQuery("");
    await loadThreads();
    selectThread(data.threadId);
  }

  async function send() {
    if (!activeId) return;
    const media = pendingMedia.current;
    const content = draft.trim();
    if (!content && !media) return;
    setDraft("");
    pendingMedia.current = null;
    setAttachName(null);
    const res = await fetch(`/api/team-chat/threads/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, media }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo enviar");
      setDraft(content);
      pendingMedia.current = media;
      setAttachName(media?.filename ?? null);
      return;
    }
    await loadOne(activeId);
    await loadThreads();
  }

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((person) => {
      if (!q) return true;
      return `${person.fullName} ${person.department ?? ""} ${person.roleName ?? ""}`.toLowerCase().includes(q);
    });
  }, [people, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-white/80 shadow-card">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div>
          <h1 className="font-serif text-2xl">Chat interno</h1>
          <p className="text-xs text-ink/50">Entre agentes, sin pasar por WhatsApp</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen((open) => !open)}>
          <Plus size={14} /> Nuevo chat
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(16rem,20rem)_1fr]">
        <aside
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-r border-line",
            activeId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="border-b border-line p-4">
            {pickerOpen ? (
              <div className="mb-3 space-y-2 rounded-2xl border border-line bg-sand/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Escribirle a</p>
                  <button type="button" className="text-xs text-ink/50" onClick={() => setPickerOpen(false)}>
                    Cerrar
                  </button>
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar agente…"
                  className="h-9 w-full rounded-full border border-line bg-white px-3 text-xs outline-none focus:border-moss"
                />
                <div className="max-h-48 overflow-y-auto">
                  {filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => startWith(person)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white"
                    >
                      <span className="truncate font-medium">{person.fullName}</span>
                      <span className={cn("shrink-0", person.isOnline ? "text-moss" : "text-ink/40")}>
                        {person.isOnline ? "En línea" : person.department || person.roleName || ""}
                      </span>
                    </button>
                  ))}
                  {filteredPeople.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-ink/45">No hay coincidencias.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => selectThread(thread.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left hover:bg-sand/50",
                  activeId === thread.id && "bg-sand/80",
                )}
              >
                <span
                  className={cn(
                    "relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                    thread.kind === "group" ? "bg-pine text-sand" : "bg-clay/15 text-pine",
                  )}
                >
                  {initials(thread.title)}
                  {thread.other?.isOnline ? (
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{thread.title}</span>
                    {thread.unread ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[10px] text-white">
                        {thread.unread}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-ink/50">{thread.lastPreview || "Sin mensajes"}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <section className={cn("flex min-h-0 flex-col", activeId ? "flex" : "hidden md:flex")}>
          {active ? (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
                <button
                  type="button"
                  className="text-sm text-ink/50 md:hidden"
                  onClick={() => {
                    setActiveId(null);
                    router.replace("/chat", { scroll: false });
                  }}
                >
                  ← Chats
                </button>
                <div className="min-w-0">
                  <p className="truncate font-medium">{active.title}</p>
                  <p className="truncate text-xs text-ink/50">
                    {active.kind === "group"
                      ? `${active.members.length} personas del equipo`
                      : active.other?.isOnline
                        ? "En línea"
                        : active.other?.department || "Chat directo"}
                  </p>
                </div>
              </header>
              <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-sand/30 p-4">
                {messages.map((message) => {
                  const mine = message.senderId === meId;
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          mine ? "bg-clay text-white" : "bg-white text-ink",
                        )}
                      >
                        {!mine ? (
                          <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">{message.senderName}</p>
                        ) : null}
                        <MessageMedia content={message.content} metadata={message.metadata} />
                        <p className="mt-1 text-right text-[10px] opacity-60">
                          {format(new Date(message.createdAt), "HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <footer className="shrink-0 border-t border-line bg-white p-3">
                {attachName ? <p className="mb-2 truncate text-xs text-moss">Adjunto: {attachName}</p> : null}
                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      try {
                        pendingMedia.current = await readFileAsMedia(file);
                        setAttachName(file.name);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "No se pudo leer el archivo");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Adjuntar archivo"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip size={16} />
                  </Button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                    placeholder="Escribir al equipo…"
                    className="h-11 flex-1 rounded-full border border-line px-4 text-sm outline-none focus:border-moss"
                  />
                  <Button onClick={send} disabled={!draft.trim() && !attachName}>
                    <Send size={16} /> Enviar
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-ink/50">
              <div>
                <p>Elegí un chat o escribile a alguien del equipo.</p>
                <Button type="button" className="mt-3" size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus size={14} /> Nuevo chat
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
