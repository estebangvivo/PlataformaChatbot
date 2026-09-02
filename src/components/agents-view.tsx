"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { departmentSelectOptions } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { usePresence } from "@/components/presence-ping";

type Agent = {
  id: string;
  fullName: string;
  email: string;
  isOnline: boolean;
  department: string;
  keywords: string[];
  workHours: { days: number[]; start: string; end: string };
  hoursLabel: string;
  availableNow: boolean;
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

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const { online, setAvailable } = usePresence();

  async function load() {
    const res = await fetch("/api/agents");
    const data = await res.json();
    setAgents(data.agents ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(agent: Agent) {
    const res = await fetch("/api/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: agent.id,
        department: agent.department,
        keywords: agent.keywords,
        workHours: agent.workHours,
      }),
    });
    if (!res.ok) {
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Agente actualizado");
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl">Agentes</h1>
          <p className="text-ink/60">Disponibilidad, áreas y palabras clave.</p>
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
      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((agent) => (
          <Card key={agent.id} className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{agent.fullName}</p>
                <p className="text-xs text-ink/50">{agent.email}</p>
              </div>
              <Badge className={agent.availableNow ? "bg-moss/15 text-pine" : "bg-mist text-ink/60"}>
                {agent.availableNow ? "Disponible" : agent.isOnline ? "Fuera de horario" : "Offline"}
              </Badge>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-ink/60">Área</span>
              <select
                className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm"
                value={agent.department}
                onChange={(e) =>
                  setAgents((prev) =>
                    prev.map((a) => (a.id === agent.id ? { ...a, department: e.target.value } : a)),
                  )
                }
              >
                {departmentSelectOptions(agent.department).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-2 text-sm text-ink/60">Días y horario</p>
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTS.map((day) => {
                  const on = agent.workHours.days.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      className={`rounded-full px-2.5 py-1 text-xs ${on ? "bg-pine text-sand" : "bg-sand"}`}
                      onClick={() =>
                        setAgents((prev) =>
                          prev.map((a) =>
                            a.id === agent.id
                              ? {
                                  ...a,
                                  workHours: {
                                    ...a.workHours,
                                    days: on
                                      ? a.workHours.days.filter((d) => d !== day.id)
                                      : [...a.workHours.days, day.id],
                                  },
                                }
                              : a,
                          ),
                        )
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
                  value={agent.workHours.start}
                  onChange={(e) =>
                    setAgents((prev) =>
                      prev.map((a) =>
                        a.id === agent.id
                          ? { ...a, workHours: { ...a.workHours, start: e.target.value } }
                          : a,
                      ),
                    )
                  }
                />
                <Input
                  type="time"
                  value={agent.workHours.end}
                  onChange={(e) =>
                    setAgents((prev) =>
                      prev.map((a) =>
                        a.id === agent.id
                          ? { ...a, workHours: { ...a.workHours, end: e.target.value } }
                          : a,
                      ),
                    )
                  }
                />
              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-ink/60">Palabras clave (coma)</span>
              <Input
                value={agent.keywords.join(", ")}
                onChange={(e) =>
                  setAgents((prev) =>
                    prev.map((a) =>
                      a.id === agent.id
                        ? {
                            ...a,
                            keywords: e.target.value
                              .split(",")
                              .map((k) => k.trim())
                              .filter(Boolean),
                          }
                        : a,
                    ),
                  )
                }
              />
            </label>
            <Button onClick={() => save(agent)}>Guardar</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
