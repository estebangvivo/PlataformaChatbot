"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { CONTACT_ROLES, EMPTY_PROFILE, type ContactProfile } from "@/lib/personality";
import { cn, formatPhone, initials } from "@/lib/utils";

type Contact = {
  id: string;
  whatsappPhone: string;
  userName: string | null;
  status: string;
  lastIntent: string | null;
  lastMessageAt: string;
  messageCount?: number;
  profile: ContactProfile;
};

export function ContactsView() {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(params.get("id"));
  const [form, setForm] = useState<ContactProfile>(EMPTY_PROFILE);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(q = query) {
    const res = await fetch(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const data = await res.json();
    setContacts(data.contacts ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const active = useMemo(
    () => contacts.find((c) => c.id === activeId) ?? contacts[0] ?? null,
    [contacts, activeId],
  );

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id);
  }, [active, activeId]);

  useEffect(() => {
    if (!active) return;
    setDisplayName(active.userName ?? "");
    setForm({ ...EMPTY_PROFILE, ...active.profile });
  }, [active?.id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    setSaving(true);
    const res = await fetch(`/api/contacts/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: displayName,
        profile: {
          firstName: form.firstName?.trim() || undefined,
          lastName: form.lastName?.trim() || undefined,
          locality: form.locality?.trim() || undefined,
          matricula: form.matricula?.trim() || undefined,
          role: form.role || undefined,
          email: form.email?.trim() || undefined,
          observations: form.observations?.trim() || undefined,
          interests: form.interests,
        },
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Contacto actualizado");
    await load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">Personas</h1>
          <p className="max-w-2xl text-ink/60">
            Datos que el bot va aprendiendo de quienes escriben. Podés completarlos o corregirlos
            a mano; el bot los usa en los próximos mensajes.
          </p>
        </div>
        <p className="text-sm text-ink/50">{contacts.length} contactos</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-3">
            <Input
              placeholder="Buscar nombre, teléfono, matrícula…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(query)}
            />
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => load(query)}>
              Buscar
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setActiveId(contact.id)}
                className={cn(
                  "flex w-full gap-3 border-b border-line px-4 py-3 text-left hover:bg-sand/60",
                  active?.id === contact.id && "bg-sand",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pine text-xs text-sand">
                  {initials(contact.userName || contact.profile.firstName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {contact.userName || contact.profile.firstName || "Sin nombre"}
                    </p>
                    <StatusBadge status={contact.status} />
                  </div>
                  <p className="truncate text-xs text-ink/50">{formatPhone(contact.whatsappPhone)}</p>
                </div>
              </button>
            ))}
            {contacts.length === 0 ? (
              <p className="p-4 text-sm text-ink/50">Todavía no hay personas. Usá el simulador o WhatsApp.</p>
            ) : null}
          </div>
        </Card>

        {active ? (
          <Card className="p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-moss">Ficha</p>
                <h2 className="font-serif text-2xl">{active.userName || "Sin nombre"}</h2>
                <p className="text-sm text-ink/50">{formatPhone(active.whatsappPhone)}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/inbox?id=${active.id}`}>
                  <MessageCircle size={14} /> Ver en inbox
                </Link>
              </Button>
            </div>

            <form onSubmit={onSave} className="grid gap-3 md:grid-cols-2">
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-ink/60">Nombre para mostrar</span>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Nombre</span>
                <Input
                  value={form.firstName ?? ""}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Apellido</span>
                <Input
                  value={form.lastName ?? ""}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Localidad</span>
                <Input
                  value={form.locality ?? ""}
                  onChange={(e) => setForm({ ...form, locality: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Matrícula</span>
                <Input
                  value={form.matricula ?? ""}
                  onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Rol</span>
                <select
                  className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm"
                  value={form.role ?? ""}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="">Sin definir</option>
                  {CONTACT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/60">Email</span>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-ink/60">Intereses (coma)</span>
                <Input
                  value={(form.interests ?? []).join(", ")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      interests: e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-ink/60">Notas del agente</span>
                <Textarea
                  value={form.observations ?? ""}
                  onChange={(e) => setForm({ ...form, observations: e.target.value })}
                  placeholder="Algo que el bot no debería olvidar, o un comentario interno…"
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <Button disabled={saving}>{saving ? "Guardando…" : "Guardar ficha"}</Button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
