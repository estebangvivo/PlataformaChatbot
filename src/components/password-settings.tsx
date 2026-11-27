"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password, confirm }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo cambiar la contraseña");
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    toast.success("Contraseña actualizada");
  }

  return (
    <Card className="p-6">
      <h2 className="font-serif text-2xl">Mi cuenta</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        Cambiá tu contraseña. Mínimo 8 caracteres. Un SuperAdmin también puede asignarte una
        clave nueva desde Usuarios.
      </p>
      <form onSubmit={onSubmit} className="mt-5 max-w-md space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-ink/60">Contraseña actual</span>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink/60">Nueva contraseña</span>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink/60">Repetir nueva contraseña</span>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </Card>
  );
}