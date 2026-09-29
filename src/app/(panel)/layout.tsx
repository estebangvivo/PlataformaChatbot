import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { PresenceProvider } from "@/components/presence-ping";
import { DeskAlerts } from "@/components/desk-alerts";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen max-h-dvh flex-col overflow-hidden bg-paper lg:flex-row">
      <PresenceProvider>
        <DeskAlerts />
        <Sidebar role={user.role} fullName={user.fullName} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </PresenceProvider>
    </div>
  );
}
