"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setDevResetUrl("");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo enviar el pedido");
      return;
    }
    setMessage(data.message ?? "Listo. Revisá tu correo.");
    if (typeof data.devResetUrl === "string") setDevResetUrl(data.devResetUrl);
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
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-ink/70">{message}</p> : null}
      {devResetUrl ? (
        <p className="rounded-xl bg-sand p-3 text-xs text-ink/70">
          En desarrollo no hay SMTP.{" "}
          <a href={devResetUrl} className="font-medium text-moss underline">
            Abrir enlace para elegir clave
          </a>
        </p>
      ) : null}
      <Button className="w-full" size="lg" disabled={loading}>
        {loading ? "Enviando…" : "Enviar enlace"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-moss hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}