import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { LoginShell } from "@/components/login-shell";

export default function RecuperarPage() {
  return (
    <LoginShell
      title="Olvidé mi contraseña"
      subtitle="Ingresá el email de tu cuenta. Si está registrada, te vamos a mandar un enlace para elegir una clave nueva."
    >
      <ForgotPasswordForm />
    </LoginShell>
  );
}