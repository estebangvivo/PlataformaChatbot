import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { LoginShell } from "@/components/login-shell";

export default function LoginPage() {
  return (
    <LoginShell
      title="Iniciar sesión"
      subtitle="Usá el SuperAdmin de prueba o un agente sembrado."
      footer={
        process.env.NODE_ENV !== "production" ? (
          <div className="mt-6 rounded-2xl bg-sand p-4 text-xs text-ink/70">
            <p>
              <strong>SuperAdmin:</strong> superadmin@regional5.local / Regional5Admin!
            </p>
            <p className="mt-1">
              <strong>Agente:</strong> tesoreria@regional5.local / Agente123!
            </p>
          </div>
        ) : null
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </LoginShell>
  );
}