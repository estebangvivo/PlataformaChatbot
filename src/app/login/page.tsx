import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-pine text-sand lg:flex">
        <div className="absolute inset-0 bg-blueprint bg-blueprint opacity-30" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <p className="text-xs uppercase tracking-[0.28em] text-sand/70">Colegio de Arquitectos</p>
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-clay">Regional 5 · Villa María</p>
            <h1 className="mt-4 max-w-xl font-serif text-5xl leading-tight">
              Mesa de atención y chatbot institucional
            </h1>
            <p className="mt-6 max-w-md text-sand/80">
              Respuestas automáticas con la web de Regional 5, derivación a agentes humanos y un
              inbox de WhatsApp en tiempo real.
            </p>
          </div>
          <p className="text-sm text-sand/60">San Juan 1553 · Lun a Vie 8 a 13 hs</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-line bg-white/80 p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-moss">Acceso interno</p>
          <h2 className="mt-2 font-serif text-3xl">Iniciar sesión</h2>
          <p className="mt-2 mb-6 text-sm text-ink/60">
            Usá el SuperAdmin de prueba o un agente sembrado.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
          <div className="mt-6 rounded-2xl bg-sand p-4 text-xs text-ink/70">
            <p>
              <strong>SuperAdmin:</strong> superadmin@regional5.local / Regional5Admin!
            </p>
            <p className="mt-1">
              <strong>Agente:</strong> tesoreria@regional5.local / Agente123!
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
