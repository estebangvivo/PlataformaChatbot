"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type DeskNotify = {
  agentUserId: string;
  conversationId: string;
  title: string;
  body: string;
  kind?: "assign" | "message";
};

export function DeskAlerts() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    async function start() {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (cancelled) return;
      const myId = data.user?.id as string | undefined;
      if (!myId) return;

      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }

      source = new EventSource("/api/events");
      if (cancelled) {
        source.close();
        return;
      }
      source.onmessage = (event) => {
        const parsed = JSON.parse(event.data) as { type?: string; payload?: DeskNotify };
        if (parsed.type !== "desk.notify" || !parsed.payload) return;
        const payload = parsed.payload;
        if (payload.agentUserId !== myId) return;

        const viewingSameChat = isViewingConversation(payload.conversationId);
        if (payload.kind === "message" && viewingSameChat) return;

        toast(payload.title, {
          description: payload.body,
          duration: payload.kind === "assign" ? 14_000 : 8_000,
          action: {
            label: "Abrir",
            onClick: () => router.push(`/inbox?id=${payload.conversationId}`),
          },
        });

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          if (payload.kind === "message" && !document.hidden) return;
          const notice = new Notification(payload.title, {
            body: payload.body,
            tag: `${payload.kind}-${payload.conversationId}`,
          });
          notice.onclick = () => {
            window.focus();
            router.push(`/inbox?id=${payload.conversationId}`);
            notice.close();
          };
        }
      };
    }

    void start();
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [router]);

  return null;
}

function isViewingConversation(conversationId: string) {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.pathname.includes("/inbox") && url.searchParams.get("id") === conversationId;
}
