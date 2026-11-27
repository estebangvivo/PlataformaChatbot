import { LoginShell } from "@/components/login-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function NuevaClavePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <LoginShell
      title="Nueva contraseña"
      subtitle="Elegí una clave de al menos 8 caracteres. El enlace vale una hora y se usa una sola vez."
    >
      <ResetPasswordForm token={token ?? ""} />
    </LoginShell>
  );
}