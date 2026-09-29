"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEPARTMENTS } from "@/lib/constants";

type Rule = {
  id: string;
  intent: string;
  department: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
};

export function RoutingView() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState({
    intent: "",
    department: "Consultas Generales y Ejercicio Profesional",
    keywords: "",
    priority: 10,
  });

  async function load() {
    const res = await fetch("/api/routing");
    const data = await res.json();
    setRules(data.rules ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) {
      toast.error("No se pudo crear la regla (¿sos SuperAdmin?)");
      return;
    }
    toast.success("Regla creada");
    setForm({ intent: "", department: form.department, keywords: "", priority: 10 });
    load();
  }

  async function toggle(rule: Rule) {
    await fetch("/api/routing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/routing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl sm:text-4xl">Enrutamiento</h1>
        <p className="max-w-2xl text-ink/60">
          Asociá intenciones y palabras clave con áreas. El bot usa estas reglas y luego asigna por
          disponibilidad u orden de turno (round robin por última asignación).
        </p>
      </header>
      <Card className="p-5">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Intención (ej. matriculacion)"
            value={form.intent}
            onChange={(e) => setForm({ ...form, intent: e.target.value })}
            required
          />
          <select
            className="h-10 rounded-xl border border-line bg-white px-3 text-sm"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <Input
            placeholder="Palabras clave, separadas por coma"
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          />
          <Input
            type="number"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
          />
          <div>
            <Button>Agregar regla</Button>
          </div>
        </form>
      </Card>
      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {rule.intent} → {rule.department}
              </p>
              <p className="text-xs text-ink/55">{rule.keywords.join(" · ")}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggle(rule)}>
                {rule.isActive ? "Activa" : "Inactiva"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(rule.id)}>
                Eliminar
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
