"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearAwayPreference } from "@/components/presence-ping";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(
    process.env.NODE_ENV === "production" ? "" : "superadmin@regional5.local",
  );
  const [password, setPassword] = useState(process.env.NODE_ENV === "production" ? "" : "Regional5Admin!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resetOk = params.get("reset") === "1";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo iniciar sesión");
      return;
    }
    clearAwayPreference();
    router.push(params.get("from") || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block text-ink/70">Email</span>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-ink/70">Contraseña</span>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <div className="flex justify-end">
        <Link href="/login/recuperar" className="text-sm text-moss hover:underline">
          Olvidé mi contraseña
        </Link>
      </div>
      {resetOk ? (
        <p className="text-sm text-moss">Listo. Ya podés entrar con tu nueva clave.</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button className="w-full" size="lg" disabled={loading}>
        {loading ? "Ingresando…" : "Entrar al panel"}
      </Button>
    </form>
  );
}
