import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    BOT: "bg-moss/15 text-pine",
    PENDING: "bg-amber-100 text-amber-800",
    HUMAN: "bg-sky-100 text-sky-800",
    CLOSED: "bg-ink/10 text-ink/60",
  };
  const labels: Record<string, string> = {
    BOT: "Bot",
    PENDING: "Pendiente",
    HUMAN: "Humano",
    CLOSED: "Cerrado",
  };
  return <Badge className={map[status] ?? "bg-mist text-ink"}>{labels[status] ?? status}</Badge>;
}
