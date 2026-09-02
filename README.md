# Chatbot Colegio de Arquitectos — Regional 5

Plataforma full-stack para el Colegio de Arquitectos de Córdoba, Regional 5: chatbot de WhatsApp con RAG sobre [regional5.com.ar](https://regional5.com.ar/colegio-arquitectos/), derivación a agentes humanos y panel de inbox en tiempo real.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Prisma + SQLite (intercambiable por PostgreSQL / Supabase)
- Auth con JWT en cookie httpOnly
- Webhook Meta Cloud API + simulador local
- RAG: OpenAI embeddings + GPT-4o-mini, con fallback léxico
- Realtime: Server-Sent Events (`/api/events`)

## Arranque local

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000)

### Usuarios de prueba

| Rol | Email | Contraseña |
| --- | --- | --- |
| SuperAdmin | superadmin@regional5.local | Regional5Admin! |
| Tesorería | tesoreria@regional5.local | Agente123! |
| Matriculación | matriculacion@regional5.local | Agente123! |
| Legales | legales@regional5.local | Agente123! |
| Tramitación | tramites@regional5.local | Agente123! |
| Consultas Generales | generales@regional5.local | Agente123! |

## Cómo probar el bot sin Meta

1. Iniciá sesión como SuperAdmin.
2. Andá a **Simulador WA**.
3. Enviá una consulta (horario, pagos, firma digital, “hablar con un agente”).
4. Mirá la conversación en **Inbox WhatsApp**.
5. Usá **Tomar control**, respondé y **Devolver al bot** o **Cerrar**.

## WhatsApp Cloud API

En Meta for Developers configurá el webhook:

- URL: `https://tu-dominio/api/webhook/whatsapp`
- Verify token: el de `WHATSAPP_VERIFY_TOKEN`

Variables en `.env`:

```
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
OPENAI_API_KEY=
AUTH_SECRET=
DATABASE_URL="file:./dev.db"
```

## Módulos

- **Inbox:** estados BOT / PENDING / HUMAN / CLOSED, toma de control humana.
- **Agentes:** área, horarios Lun–Vie 8–14 (editable) y keywords.
- **Enrutamiento:** reglas de intención → departamento + round robin por última asignación.
- **Conocimiento:** seed institucional + botón para re-scrapear el sitio.

## PostgreSQL / Supabase

1. Cambiá `provider` a `postgresql` en `prisma/schema.prisma`.
2. Poné la `DATABASE_URL` de Supabase.
3. Ejecutá `npx prisma db push && npm run db:seed`.
4. Opcional: reemplazá el hub SSE por un canal Realtime de Supabase.
