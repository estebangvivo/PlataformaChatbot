"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ContactRound,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Route,
  Settings,
  Smartphone,
  Users,
  UserCog,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAwayPreference, usePresence } from "@/components/presence-ping";

const LINKS = [
  { href: "/dashboard", label: "Tablero", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox WhatsApp", icon: MessageCircle },
  { href: "/informes", label: "Informes", icon: ClipboardList },
  { href: "/contactos", label: "Personas", icon: ContactRound },
  { href: "/agentes", label: "Agentes", icon: UserCog },
  { href: "/enrutamiento", label: "Enrutamiento", icon: Route },
  { href: "/conocimiento", label: "Base de conocimiento", icon: BookOpen },
  { href: "/usuarios", label: "Usuarios", icon: Users, admin: true },
  { href: "/simulador", label: "Simulador WA", icon: Smartphone },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar({
  role,
  fullName,
}: {
  role: string;
  fullName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { online, setAvailable } = usePresence();

  async function logout() {
    clearAwayPreference();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-[268px] flex-col bg-pine text-sand">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-sand/50">CAPC</p>
        <p className="font-serif text-2xl leading-none">Regional 5</p>
        <p className="mt-2 text-xs text-sand/60">Mesa de atención</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {LINKS.filter((link) => !link.admin || role === "SUPERADMIN").map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "bg-white/12 text-white" : "text-sand/70 hover:bg-white/6 hover:text-sand",
              )}
            >
              <Icon size={16} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium">{fullName}</p>
        <p className="text-[11px] uppercase tracking-wider text-sand/50">{role}</p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-sand/80">
          <input
            type="checkbox"
            checked={online}
            onChange={(e) => void setAvailable(e.target.checked)}
            className="h-4 w-4 accent-moss"
          />
          Estoy online
        </label>
        <button
          onClick={logout}
          className="mt-3 flex items-center gap-2 text-sm text-sand/70 hover:text-white"
        >
          <LogOut size={14} /> Salir
        </button>
      </div>
    </aside>
  );
}
