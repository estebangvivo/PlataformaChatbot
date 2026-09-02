"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bot, RotateCcw, Send, Smartphone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { cn, formatPhone, initials, parseJson } from "@/lib/utils";

type Message = {
  id: string;
  senderType: string;
  content: string;
  timestamp: string;
  metadata?: string | null;
};

type Conversation = {
  id: string;
  whatsappPhone: string;
  userName: string | null;
  status: string;
  botEnabled: boolean;
  lastIntent: string | null;
  surveyStatus?: string | null;
  messages: Message[];
};

const STORAGE_PHONE = "r5_sim_phone";
const STORAGE_NAME = "r5_sim_name";
const DEFAULT_PHONE = "5493534111222";
const DEFAULT_NAME = "Arq. Prueba";
const SUGGESTIONS = [
  "¿Cuál es el horario de la Regional 5?",
  "¿Cómo hago un trámite de matrícula?",
  "Quiero info de cursos y capacitaciones",
];

function randomPhone() {
  const tail = String(Math.floor(100000 + Math.random() * 900000));
  return `5493534${tail}`;
}

export function SimulatorView() {
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [name, setName] = useState(DEFAULT_NAME);
  const [text, setText] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const phoneRef = useRef(phone);
  conversationIdRef.current = conversation?.id ?? null;
  phoneRef.current = phone;

  const messages = conversation?.messages ?? [];

  const loadChat = useCallback(async (fromPhone: string) => {
    const digits = fromPhone.replace(/\D/g, "");
    if (!digits) {
      setConversation(null);
      return;
    }
    const res = await fetch(`/api/simulator?phone=${encodeURIComponent(digits)}`);
    const data = (await res.json()) as { conversation?: Conversation | null };
    setConversation(data.conversation ?? null);
  }, []);

  useEffect(() => {
    const storedPhone = localStorage.getItem(STORAGE_PHONE) || DEFAULT_PHONE;
    const storedName = localStorage.getItem(STORAGE_NAME) || DEFAULT_NAME;
    setPhone(storedPhone);
    setName(storedName);
    loadChat(storedPhone).finally(() => setReady(true));
  }, [loadChat]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_PHONE, phone.replace(/\D/g, ""));
    localStorage.setItem(STORAGE_NAME, name);
  }, [phone, name, ready]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        type: string;
        payload?: { conversationId?: string; id?: string };
      };
      if (payload.type === "heartbeat") return;
      const cid = payload.payload?.conversationId ?? payload.payload?.id;
      const current = conversationIdRef.current;
      if (current && cid && cid !== current) return;
      loadChat(phoneRef.current);
    };
    return () => es.close();
  }, [loadChat]);

  async function send(message = text) {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      toast.error("Poné un teléfono para simular el chat");
      return;
    }
    setSending(true);
    setText("");
    try {
      const res = await fetch("/api/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, name, text: trimmed }),
      });
      const raw = await res.text();
      let data: { error?: string; conversation?: Conversation } = {};
      try {
        data = raw ? (JSON.parse(raw) as { error?: string; conversation?: Conversation }) : {};
      } catch {
        toast.error("El servidor no respondió bien. Probá de nuevo.");
        setText(trimmed);
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? "Error");
        setText(trimmed);
        return;
      }
      setConversation(data.conversation ?? null);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await send();
  }

  function newChat() {
    const nextPhone = randomPhone();
    setPhone(nextPhone);
    setName("Arq. Prueba");
    setConversation(null);
    setText("");
    inputRef.current?.focus();
  }

  async function requestHuman() {
    if (!conversation || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/request-human`, { method: "POST" });
      if (!res.ok) {
        toast.error("No se pudo pedir un asesor");
        return;
      }
      await loadChat(phone);
    } finally {
      setSending(false);
    }
  }

  async function returnToBot() {
    if (!conversation) return;
    const res = await fetch(`/api/conversations/${conversation.id}/release`, { method: "POST" });
    if (!res.ok) {
      toast.error("No se pudo devolver al bot");
      return;
    }
    await loadChat(phone);
    toast.success("El bot volvió a responder");
  }

  const humanHold = conversation && conversation.status === "HUMAN";
  const lastBot = [...messages].reverse().find((m) => m.senderType === "BOT");
  const lastMeta = parseJson<{ offerHuman?: boolean }>(lastBot?.metadata, {});
  const showSurvey =
    Boolean(conversation) && conversation?.status === "CLOSED" && conversation.surveyStatus === "pending";
  const showHumanButton =
    Boolean(conversation) &&
    !humanHold &&
    !showSurvey &&
    (conversation?.lastIntent === "offer_human" || Boolean(lastMeta.offerHuman));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="shrink-0">
        <h1 className="font-serif text-4xl">Simulador WhatsApp</h1>
        <p className="max-w-2xl text-ink/60">
          Hablá acá como si fueras el matriculado. Ves las respuestas del bot y podés seguir el hilo.
          El mismo chat aparece en el Inbox.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-3xl border border-line bg-white shadow-sm lg:grid-cols-[280px_1fr]">
        <aside className="flex shrink-0 flex-col gap-4 border-b border-line p-4 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Tu identidad</p>
          <label className="text-sm">
            <span className="mb-1 block text-ink/60">Teléfono (sin +)</span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => loadChat(phone)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/60">Nombre</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button type="button" variant="outline" onClick={newChat}>
            <RotateCcw size={14} /> Nueva conversación
          </Button>
          {conversation ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/inbox?id=${conversation.id}`}>Ver en Inbox</Link>
            </Button>
          ) : null}
          <p className="mt-auto hidden text-[11px] leading-relaxed text-ink/45 lg:block">
            El mismo número reabre el mismo chat. Cambiá el teléfono o tocá “Nueva conversación”
            para probar otra persona.
          </p>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b border-line bg-pine px-4 py-3 text-sand">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-sm font-semibold">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name || "Matriculado"}</p>
              <p className="truncate text-xs text-sand/70">
                {formatPhone(phone.replace(/\D/g, "") || phone)} · Regional 5
              </p>
            </div>
            {conversation ? <StatusBadge status={conversation.status} /> : null}
          </div>

          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-blueprint p-5"
          >
            {messages.length === 0 && !sending ? (
              <div className="mx-auto max-w-md rounded-2xl bg-white/90 p-4 text-center text-sm text-ink/70 shadow-sm">
                <Smartphone className="mx-auto mb-2 text-pine" size={22} />
                <p>Escribí abajo para empezar. El bot responde en este mismo chat.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => send(hint)}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs text-ink hover:border-moss"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => {
              const mine = message.senderType === "USER";
              return (
                <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      mine && "rounded-br-md bg-[#d9fdd3] text-ink",
                      message.senderType === "BOT" && "rounded-bl-md bg-white text-ink",
                      message.senderType === "AGENT" && "rounded-bl-md bg-clay text-white",
                    )}
                  >
                    <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-60">
                      {message.senderType === "BOT" ? <Bot size={10} /> : null}
                      {mine ? "Vos" : message.senderType === "BOT" ? "Bot Regional 5" : "Agente"}
                    </p>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="mt-1 text-right text-[10px] opacity-50">
                      {format(new Date(message.timestamp), "HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              );
            })}

            {sending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm text-ink/60 shadow-sm">
                  El bot está escribiendo…
                </div>
              </div>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-line bg-white p-3">
            {humanHold ? (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">
                <span>Un agente tomó el control. El bot no responde hasta que lo devuelvas.</span>
                <Button type="button" size="sm" variant="outline" onClick={returnToBot}>
                  Devolver al bot
                </Button>
              </div>
            ) : null}
            {showSurvey ? (
              <div className="mb-2 rounded-xl bg-sand px-3 py-2">
                <p className="mb-2 text-xs text-ink/70">Calificá la atención</p>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Button
                      key={score}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={sending}
                      onClick={() => send(String(score))}
                    >
                      {score}
                    </Button>
                  ))}
                  <Button type="button" size="sm" variant="ghost" disabled={sending} onClick={() => send("no")}>
                    Ahora no
                  </Button>
                </div>
              </div>
            ) : null}
            {showHumanButton ? (
              <div className="mb-2">
                <Button type="button" size="sm" variant="outline" onClick={requestHuman} disabled={sending}>
                  <UserRound size={14} /> Solicitar agente humano
                </Button>
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribí un mensaje…"
                disabled={sending}
                className="h-11 flex-1 rounded-full border border-line px-4 text-sm outline-none focus:border-moss disabled:opacity-60"
              />
              <Button type="submit" disabled={sending || !text.trim()}>
                <Send size={16} /> Enviar
              </Button>
            </form>
          </footer>
        </section>
      </div>
    </div>
  );
}
