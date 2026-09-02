import { EventEmitter } from "events";

type RealtimeEvent = {
  type:
    | "conversation.updated"
    | "message.created"
    | "conversation.assigned"
    | "desk.notify"
    | "heartbeat";
  payload?: unknown;
};

class Hub extends EventEmitter {
  emitEvent(event: RealtimeEvent) {
    this.emit("event", event);
  }
}

const globalForHub = globalThis as unknown as { r5Hub?: Hub };

export const hub = globalForHub.r5Hub ?? new Hub();
hub.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalForHub.r5Hub = hub;
}

export type DeskNotifyPayload = {
  agentUserId: string;
  conversationId: string;
  title: string;
  body: string;
  kind?: "assign" | "message";
};

export function emitDeskNotify(payload: DeskNotifyPayload, actorUserId?: string) {
  if (actorUserId && actorUserId === payload.agentUserId) return;
  hub.emitEvent({
    type: "desk.notify",
    payload: {
      ...payload,
      kind: payload.kind ?? "assign",
    },
  });
}

export type { RealtimeEvent };
