export function LoginShell({
  kicker = "Acceso interno",
  title,
  subtitle,
  children,
  footer,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-facet text-sand lg:flex">
        <div className="absolute inset-0 bg-blueprint opacity-25" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <p className="text-xs uppercase tracking-[0.28em] text-sand/70">Colegio de Arquitectos</p>
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-sand/80">Regional 5 · Villa María</p>
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
      <section className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-3xl border border-line bg-white/80 p-6 shadow-panel sm:p-8">
          <div className="mb-6 lg:hidden">
            <p className="text-[10px] uppercase tracking-[0.24em] text-moss">CAPC</p>
            <p className="font-serif text-2xl leading-none">Regional 5</p>
            <p className="mt-1 text-sm text-ink/55">Mesa de atención</p>
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-moss">{kicker}</p>
          <h2 className="mt-2 font-serif text-3xl">{title}</h2>
          {subtitle ? <p className="mt-2 mb-6 text-sm text-ink/60">{subtitle}</p> : <div className="mb-6" />}
          {children}
          {footer}
        </div>
      </section>
    </main>
  );
}