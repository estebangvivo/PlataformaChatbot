"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_DEPARTMENT, departmentSelectOptions } from "@/lib/constants";

type UserRow = {
  id: string;
  email: string;
  role: string;
  fullName: string;
  isOnline: boolean;
  department: string | null;
};

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  role: "AGENT",
  department: DEFAULT_DEPARTMENT,
};

export function UsersView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    if (res.status === 403) {
      toast.error("Solo SuperAdmin puede gestionar usuarios");
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      department: user.department ?? DEFAULT_DEPARTMENT,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    if (editingId) {
      const res = await fetch(`/api/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          department: form.role === "AGENT" ? form.department : undefined,
          ...(form.password.trim() ? { password: form.password } : {}),
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Usuario actualizado");
      cancelEdit();
      load();
      return;
    }

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("No se pudo crear");
      return;
    }
    toast.success("Usuario creado");
    setForm({ ...emptyForm, role: form.role, department: form.department });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar usuario?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo eliminar");
      return;
    }
    if (editingId === id) cancelEdit();
    load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl sm:text-4xl">Usuarios</h1>
        <p className="text-ink/60">SuperAdmin y operadores del panel.</p>
      </header>
      <Card className="p-5">
        <h2 className="mb-4 font-serif text-2xl">{editingId ? "Editar usuario" : "Nuevo usuario"}</h2>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Nombre completo"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            placeholder={editingId ? "Nueva contraseña (opcional)" : "Contraseña"}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editingId}
          />
          <select
            className="h-10 rounded-xl border border-line bg-white px-3 text-sm"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="AGENT">Agente</option>
            <option value="SUPERADMIN">SuperAdmin</option>
          </select>
          {form.role === "AGENT" ? (
            <select
              className="h-10 rounded-xl border border-line bg-white px-3 text-sm"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              {departmentSelectOptions(form.department).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          ) : null}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button disabled={saving}>{editingId ? "Guardar cambios" : "Crear"}</Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={cancelEdit}>
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
              <th className="px-4 py-3">Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Área</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={`border-t border-line ${editingId === user.id ? "bg-sand/70" : ""}`}>
                <td className="px-4 py-3 font-medium">{user.fullName}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.department ?? "—"}</td>
                <td>{user.isOnline ? "Online" : "Offline"}</td>
                <td className="pr-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => startEdit(user)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(user.id)}>
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
  );
}
