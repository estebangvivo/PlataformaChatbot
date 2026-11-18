import { Suspense } from "react";
import { AgendaView } from "@/components/agenda-view";

export default function AgendaPage() {
  return (
    <Suspense>
      <AgendaView />
    </Suspense>
  );
}
