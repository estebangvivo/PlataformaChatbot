"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePresence } from "@/components/presence-ping";
import { DEFAULT_DEPARTMENT } from "@/lib/constants";
import { DEFAULT_HOURS } from "@/lib/hours";
import { cn, formatPhone } from "@/lib/utils";

type WorkHours = { days: number[]; start: string; end: string };

type Agent = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  isOnline: boolean;
  department: string;
  keywords: string[];
  workHours: WorkHours;
  hoursLabel: string;
  availableNow: boolean;
  notifyPhone: string | null;
};

type DeskRole = {
  id: string;
  name: string;
  description: string;
  agentsCount: number;
  rulesCount: number;
};

const DAY_OPTS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

const emptyAgentForm = {
  fullName: "",
  email: "",
  password: "",
  department: DEFAULT_DEPARTMENT,
  keywords: "",
  notifyPhone: "",
  workHours: { ...DEFAULT_HOURS, days: [...DEFAULT_HOURS.days] },
};

const emptyRoleForm = {
  name: "",
  description: "",
};

export function AgentsView() {
  const [tab, setTab] = useState<"agentes" | "roles">("agentes");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<DeskRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agentForm, setAgentForm] = useState(emptyAgentForm);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [editingRole, setEditingRole] = useState<DeskRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const { online, setAvailable } = usePresence();

  const departments = roles.map((role) => role.name);
  const roleOptions =
    agentForm.department && !departments.includes(agentForm.department)
      ? [agentForm.department, ...departments]
      : departments;

  async function load() {
    const [agentsRes, rolesRes, meRes] = await Promise.all([
      fetch("/api/agents"),
      fetch("/api/desk-roles"),
      fetch("/api/auth/me"),
    ]);
    const agentsData = (await agentsRes.json()) as { agents?: Agent[]; isAdmin?: boolean };
    const rolesData = (await rolesRes.json()) as { roles?: DeskRole[]; isAdmin?: boolean };
    const meData = (await meRes.json()) as { user?: { id?: string } };
    setAgents(agentsData.agents ?? []);
    setRoles(rolesData.roles ?? []);
    setIsAdmin(Boolean(agentsData.isAdmin || rolesData.isAdmin));
    setMeId(meData.user?.id ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  function startEditAgent(agent: Agent) {
    setEditingAgent(agent);
    setAgentForm({
      fullName: agent.fullName,
      email: agent.email,
      password: "",
      department: agent.department,
      keywords: agent.keywords.join(", "),
      notifyPhone: agent.notifyPhone ?? "",
      workHours: agent.workHours,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelAgent() {
    setEditingAgent(null);
    setAgentForm(emptyAgentForm);
  }

  async function saveAgent(event: FormEvent) {
    event.preventDefault();
    const department = agentForm.department;
    const keywords = agentForm.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    setSaving(true);
    if (editingAgent) {
      if (isAdmin) {
        const userRes = await fetch(`/api/users/${editingAgent.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: agentForm.fullName,
            email: agentForm.email,
            department,
            keywords,
            workHours: agentForm.workHours,
            notifyPhone: agentForm.notifyPhone,
            ...(agentForm.password.trim() ? { password: agentForm.password } : {}),
          }),
        });
        if (!userRes.ok) {
          setSaving(false);
          const data = await userRes.json().catch(() => ({}));
          toast.error(data.error ?? "No se pudo guardar el agente");
          return;
        }
      }
      const hoursRes = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAgent.id,
          department,
          keywords,
          workHours: agentForm.workHours,
          notifyPhone: agentForm.notifyPhone,
        }),
      });
      setSaving(false);
      if (!hoursRes.ok) {
        const data = await hoursRes.json().catch(() => ({}));
        toast.error(data.error ?? "No se pudo guardar el horario");
        return;
      }
      toast.success("Agente actualizado");
      cancelAgent();
      load();
      return;
    }

    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: agentForm.fullName,
        email: agentForm.email,
        password: agentForm.password,
        department,
        keywords,
        workHours: agentForm.workHours,
        notifyPhone: agentForm.notifyPhone,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo crear el agente");
      return;
    }
    toast.success("Agente creado");
    cancelAgent();
    load();
  }

  async function removeAgent(agent: Agent) {
    if (!confirm(`¿Eliminar a ${agent.fullName}? Se desasignan sus chats.`)) return;
    const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo eliminar");
      return;
    }
    if (editingAgent?.id === agent.id) cancelAgent();
    toast.success("Agente eliminado");
    load();
  }

  function startEditRole(role: DeskRole) {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
    });
  }

  function cancelRole() {
    setEditingRole(null);
    setRoleForm(emptyRoleForm);
  }

  async function saveRole(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    if (editingRole) {
      const res = await fetch(`/api/desk-roles/${editingRole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleForm),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "No se pudo guardar el rol");
        return;
      }
      toast.success("Rol actualizado");
      cancelRole();
      load();
      return;
    }
    const res = await fetch("/api/desk-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roleForm),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo crear el rol");
      return;
    }
    toast.success("Rol creado");
    cancelRole();
    load();
  }

  async function removeRole(role: DeskRole) {
    if (!confirm(`¿Eliminar el rol “${role.name}”?`)) return;
    const res = await fetch(`/api/desk-roles/${role.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo eliminar");
      return;
    }
    if (editingRole?.id === role.id) cancelRole();
    toast.success("Rol eliminado");
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl">Agentes y roles</h1>
          <p className="text-ink/60">
            El equipo de mesa y los roles de atención: Tesorería, Visador, Matriculación y los que
            agregues.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={online}
            onChange={(e) => {
              void setAvailable(e.target.checked).then(() => load());
            }}
            className="h-4 w-4 accent-pine"
          />
          Estoy online
        </label>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={tab === "agentes" ? "default" : "outline"} onClick={() => setTab("agentes")}>
          Agentes
        </Button>
        {isAdmin ? (
          <Button type="button" size="sm" variant={tab === "roles" ? "default" : "outline"} onClick={() => setTab("roles")}>
            Roles
          </Button>
        ) : null}
      </div>

      {tab === "agentes" ? (
        <div className="space-y-6">
          {isAdmin || editingAgent ? (
            <Card className="p-5">
              <h2 className="mb-4 font-serif text-2xl">{editingAgent ? "Editar agente" : "Nuevo agente"}</h2>
              <form onSubmit={saveAgent} className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-ink/70">Nombre completo</span>
                  <Input
                    placeholder="Nombre completo"
                    value={agentForm.fullName}
                    onChange={(e) => setAgentForm({ ...agentForm, fullName: e.target.value })}
                    required
                    disabled={!isAdmin && Boolean(editingAgent)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-ink/70">Email</span>
                  <Input
                    placeholder="Email"
                    type="email"
                    value={agentForm.email}
                    onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                    required
                    disabled={!isAdmin && Boolean(editingAgent)}
                  />
                </label>
                {isAdmin ? (
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-ink/70">
                      {editingAgent ? "Nueva contraseña (opcional)" : "Contraseña"}
                    </span>
                    <Input
                      placeholder={editingAgent ? "Nueva contraseña (opcional)" : "Contraseña"}
                      type="password"
                      value={agentForm.password}
                      onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
                      required={!editingAgent}
                    />
                  </label>
                ) : null}
                <label className="block text-sm">
                  <span className="mb-1.5 block text-ink/70">Rol</span>
                  <select
                    className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm"
                    value={agentForm.department}
                    onChange={(e) => setAgentForm({ ...agentForm, department: e.target.value })}
                  >
                    {roleOptions.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm text-ink/60">Días y horario</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_OPTS.map((day) => {
                      const on = agentForm.workHours.days.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          className={cn("rounded-full px-2.5 py-1 text-xs", on ? "bg-pine text-sand" : "bg-sand")}
                          onClick={() =>
                            setAgentForm({
                              ...agentForm,
                              workHours: {
                                ...agentForm.workHours,
                                days: on
                                  ? agentForm.workHours.days.filter((d) => d !== day.id)
                                  : [...agentForm.workHours.days, day.id],
                              },
                            })
                          }
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      type="time"
                      value={agentForm.workHours.start}
                      onChange={(e) =>
                        setAgentForm({ ...agentForm, workHours: { ...agentForm.workHours, start: e.target.value } })
                      }
                    />
                    <Input
                      type="time"
                      value={agentForm.workHours.end}
                      onChange={(e) =>
                        setAgentForm({ ...agentForm, workHours: { ...agentForm.workHours, end: e.target.value } })
                      }
                    />
                  </div>
                </div>
                <label className="block text-sm md:col-span-2">
                  <span className="mb-1.5 block text-ink/70">WhatsApp de aviso</span>
                  <Input
                    value={agentForm.notifyPhone}
                    onChange={(e) => setAgentForm({ ...agentForm, notifyPhone: e.target.value })}
                    placeholder="351 555 1234"
                    inputMode="tel"
                  />
                  <p className="mt-1 text-xs text-ink/50">
                    Si está offline y le derivan un chat, le avisamos a este número. No hace falta el +54.
                  </p>
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="mb-1 block text-ink/60">Palabras clave (coma)</span>
                  <Input
                    value={agentForm.keywords}
                    onChange={(e) => setAgentForm({ ...agentForm, keywords: e.target.value })}
                    placeholder="matrícula, boleta, expediente…"
                  />
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button disabled={saving}>
                    <Plus size={14} />
                    {editingAgent ? "Guardar cambios" : "Crear agente"}
                  </Button>
                  {editingAgent ? (
                    <Button type="button" variant="outline" onClick={cancelAgent}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </form>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {agents.map((agent) => (
              <Card key={agent.id} className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{agent.fullName}</p>
                    <p className="text-xs text-ink/50">{agent.email}</p>
                    <p className="mt-1 text-xs text-ink/55">{agent.department}</p>
                  </div>
                  <Badge className={agent.availableNow ? "bg-moss/15 text-pine" : "bg-mist text-ink/60"}>
                    {agent.availableNow ? "Disponible" : agent.isOnline ? "Fuera de horario" : "Offline"}
                  </Badge>
                </div>
                <p className="text-xs text-ink/50">{agent.hoursLabel}</p>
                <p className="text-xs text-ink/55">
                  {agent.notifyPhone
                    ? `Aviso WA: ${formatPhone(agent.notifyPhone)}`
                    : "Sin WhatsApp de aviso"}
                </p>
                {agent.keywords.length ? (
                  <p className="text-xs text-ink/55">{agent.keywords.join(" · ")}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {isAdmin || agent.userId === meId ? (
                    <Button size="sm" variant="outline" onClick={() => startEditAgent(agent)}>
                      <Pencil size={14} /> Editar
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <Button size="sm" variant="ghost" onClick={() => removeAgent(agent)}>
                      <Trash2 size={14} /> Quitar
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-1 font-serif text-2xl">{editingRole ? "Editar rol" : "Nuevo rol"}</h2>
            <p className="mb-4 text-sm text-ink/55">
              Estos roles son las áreas de atención (Tesorería, Visador, Asesoría en Gas…). El bot
              deriva acá y aparecen al dar de alta un agente.
            </p>
            <form onSubmit={saveRole} className="grid gap-3">
              <label className="block text-sm">
                <span className="mb-1.5 block text-ink/70">Nombre</span>
                <Input
                  placeholder="Ej. Patrimonio, Tesorería…"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-ink/70">Descripción (opcional)</span>
                <Textarea
                  placeholder="De qué se ocupa este rol en la mesa"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={saving}>{editingRole ? "Guardar rol" : "Crear rol"}</Button>
                {editingRole ? (
                  <Button type="button" variant="outline" onClick={cancelRole}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand text-left text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Rol</th>
                  <th>Agentes</th>
                  <th>Reglas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className={`border-t border-line ${editingRole?.id === role.id ? "bg-sand/70" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{role.name}</p>
                      {role.description ? <p className="text-xs text-ink/50">{role.description}</p> : null}
                    </td>
                    <td>{role.agentsCount}</td>
                    <td>{role.rulesCount}</td>
                    <td className="pr-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => startEditRole(role)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeRole(role)}>
                          Quitar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
