"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  Route,
  Settings,
  Smartphone,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAwayPreference, usePresence } from "@/components/presence-ping";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
};

const HOME: NavLink = { href: "/dashboard", label: "Tablero", icon: LayoutDashboard };

const SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Mesa",
    links: [
      { href: "/inbox", label: "Inbox WhatsApp", icon: MessageCircle },
      { href: "/chat", label: "Chat interno", icon: MessagesSquare },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/informes", label: "Informes", icon: ClipboardList },
    ],
  },
  {
    title: "Directorio",
    links: [
      { href: "/contactos", label: "Personas", icon: ContactRound },
      { href: "/agentes", label: "Agentes y roles", icon: UserCog },
      { href: "/usuarios", label: "Usuarios", icon: Users, admin: true },
    ],
  },
  {
    title: "Chatbot",
    links: [
      { href: "/enrutamiento", label: "Enrutamiento", icon: Route },
      { href: "/conocimiento", label: "Base de conocimiento", icon: BookOpen },
      { href: "/simulador", label: "Simulador WA", icon: Smartphone },
    ],
  },
  {
    title: "Sistema",
    links: [{ href: "/configuracion", label: "Configuración", icon: Settings }],
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionForPath(pathname: string) {
  return SECTIONS.find((section) => section.links.some((link) => isActivePath(pathname, link.href)))?.title ?? null;
}

export function Sidebar({
  role,
  isAdmin = false,
  fullName,
}: {
  role: string;
  isAdmin?: boolean;
  fullName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { online, setAvailable } = usePresence();
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(() => sectionForPath(pathname));

  useEffect(() => {
    setOpen(false);
    setOpenSection(sectionForPath(pathname));
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function logout() {
    clearAwayPreference();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="flex w-full shrink-0 items-center gap-3 bg-pine px-4 py-3 text-sand lg:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-sand/50">CAPC</p>
          <p className="truncate font-serif text-lg leading-tight">Regional 5</p>
        </div>
      </header>

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-ink/45 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col bg-pine text-sand shadow-xl transition-transform duration-200 lg:static lg:visible lg:z-auto lg:h-full lg:w-[268px] lg:translate-x-0 lg:shadow-none",
          open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-sand/50">CAPC</p>
            <p className="font-serif text-2xl leading-none">Regional 5</p>
            <p className="mt-2 text-xs text-sand/60">Mesa de atención</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavItem link={HOME} pathname={pathname} />
          {SECTIONS.map((section) => {
            const links = section.links.filter((link) => !link.admin || isAdmin);
            if (!links.length) return null;
            const expanded = openSection === section.title;
            const sectionActive = links.some((link) => isActivePath(pathname, link.href));
            return (
              <div key={section.title} className="pt-2">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenSection(expanded ? null : section.title)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition",
                    sectionActive ? "text-sand/80" : "text-sand/40 hover:text-sand/70",
                  )}
                >
                  {section.title}
                  <ChevronDown size={14} className={cn("shrink-0 transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded ? (
                  <div className="mt-0.5 space-y-0.5">
                    {links.map((link) => (
                      <NavItem key={link.href} link={link} pathname={pathname} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="text-[11px] uppercase tracking-wider text-sand/50">{role}</p>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-sand/80">
            <input
              type="checkbox"
              checked={online}
              onChange={(e) => void setAvailable(e.target.checked)}
              className="h-4 w-4 accent-moss"
              suppressHydrationWarning
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
    </>
  );
}

function NavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = isActivePath(pathname, link.href);
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        active ? "bg-white/12 text-white" : "text-sand/70 hover:bg-white/6 hover:text-sand",
      )}
    >
      <Icon size={16} />
      <span className="flex-1 truncate">{link.label}</span>
      {link.href === "/chat" ? <TeamChatBadge /> : null}
    </Link>
  );
}

function TeamChatBadge() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/team-chat/threads");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { unreadTotal?: number };
      if (!cancelled) setUnread(data.unreadTotal ?? 0);
    }
    void load();
    const onUpdate = () => void load();
    window.addEventListener("r5-team-chat", onUpdate);
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener("r5-team-chat", onUpdate);
      clearInterval(id);
    };
  }, []);

  if (!unread) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[10px] font-semibold text-white">
      {unread > 9 ? "9+" : unread}
    </span>
  );
}
