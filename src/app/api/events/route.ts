import { hub, type RealtimeEvent } from "@/lib/events";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const ping = setInterval(() => send({ type: "heartbeat" }), 25000);
      hub.on("event", send);
      send({ type: "heartbeat" });
      cleanup = () => {
        clearInterval(ping);
        hub.off("event", send);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
