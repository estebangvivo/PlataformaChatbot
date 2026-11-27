"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink/70">
          Este enlace está incompleto. Pedí uno nuevo desde Olvidé mi contraseña.
        </p>
        <p className="text-center text-sm">
          <Link href="/login/recuperar" className="text-moss hover:underline">
            Recuperar contraseña
          </Link>
        </p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirm }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar la clave");
      return;
    }
    router.push("/login?reset=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block text-ink/70">Nueva contraseña</span>
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
        <span className="mb-1.5 block text-ink/70">Repetir contraseña</span>
        <Input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button className="w-full" size="lg" disabled={loading}>
        {loading ? "Guardando…" : "Guardar nueva clave"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-moss hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}