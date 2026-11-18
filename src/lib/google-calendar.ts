import { getSetting, setSetting } from "./settings";
import { CALENDAR_TZ, addDaysYmd, rfc3339Cordoba } from "./calendar-time";

const KEYS = {
  clientId: "google.calendar.clientId",
  clientSecret: "google.calendar.clientSecret",
  refreshToken: "google.calendar.refreshToken",
  accessToken: "google.calendar.accessToken",
  tokenExpiry: "google.calendar.tokenExpiry",
  calendarId: "google.calendar.calendarId",
  calendarName: "google.calendar.calendarName",
  accountEmail: "google.calendar.accountEmail",
};

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "openid",
  "email",
].join(" ");

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
  htmlLink?: string;
  colorId?: string;
};

export type CalendarListItem = {
  id: string;
  summary: string;
  primary?: boolean;
};

export type EventInput = {
  title: string;
  description?: string;
  location?: string;
  allDay?: boolean;
  start: string;
  end: string;
  colorId?: string;
};

function mask(value: string | null) {
  if (!value) return null;
  if (value.length < 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function getCalendarOAuthConfig() {
  const clientId = (await getSetting(KEYS.clientId)) || process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
  const clientSecret =
    (await getSetting(KEYS.clientSecret)) || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";
  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

export async function saveCalendarOAuthConfig(clientId: string, clientSecret?: string) {
  if (clientId.trim()) await setSetting(KEYS.clientId, clientId.trim());
  if (clientSecret?.trim()) await setSetting(KEYS.clientSecret, clientSecret.trim());
}

export async function getCalendarConnection() {
  const [cfg, refreshToken, calendarId, calendarName, accountEmail] = await Promise.all([
    getCalendarOAuthConfig(),
    getSetting(KEYS.refreshToken),
    getSetting(KEYS.calendarId),
    getSetting(KEYS.calendarName),
    getSetting(KEYS.accountEmail),
  ]);
  return {
    configured: Boolean(cfg.clientId && cfg.clientSecret),
    connected: Boolean(refreshToken),
    clientId: cfg.clientId,
    maskedClientId: mask(cfg.clientId || null),
    hasSecret: Boolean(cfg.clientSecret),
    calendarId: calendarId || "primary",
    calendarName: calendarName || "Principal",
    accountEmail,
  };
}

export function calendarRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/calendar/oauth/callback`;
}

export async function buildGoogleAuthUrl(origin: string, state: string) {
  const { clientId, clientSecret } = await getCalendarOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Falta el Client ID y el secreto de Google Calendar");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: calendarRedirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function saveTokens(data: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}) {
  if (data.access_token) {
    await setSetting(KEYS.accessToken, data.access_token);
    const expires = Date.now() + Math.max(30, (data.expires_in ?? 3600) - 60) * 1000;
    await setSetting(KEYS.tokenExpiry, String(expires));
  }
  if (data.refresh_token) await setSetting(KEYS.refreshToken, data.refresh_token);
  if (data.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(data.id_token.split(".")[1] ?? "", "base64url").toString("utf8"),
      ) as { email?: string };
      if (payload.email) await setSetting(KEYS.accountEmail, payload.email);
    } catch {
      /* ignore */
    }
  }
}

export async function exchangeGoogleCode(origin: string, code: string) {
  const { clientId, clientSecret } = await getCalendarOAuthConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: calendarRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "No se pudo completar la conexión con Google");
  }
  await saveTokens(data);
  const calendars = await listGoogleCalendars();
  const current = (await getSetting(KEYS.calendarId)) || "primary";
  const chosen =
    calendars.find((c) => c.id === current) ??
    calendars.find((c) => c.primary) ??
    calendars[0];
  if (chosen) {
    await setSetting(KEYS.calendarId, chosen.id);
    await setSetting(KEYS.calendarName, chosen.summary);
  }
  return { calendars, calendarId: chosen?.id ?? "primary" };
}

async function refreshAccessToken() {
  const { clientId, clientSecret } = await getCalendarOAuthConfig();
  const refreshToken = await getSetting(KEYS.refreshToken);
  if (!refreshToken) throw new Error("El calendario no está conectado");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error("Venció la conexión con Google. Volvé a vincular el calendario.");
  }
  await saveTokens(data);
  return data.access_token;
}

async function getAccessToken() {
  const [token, expiry] = await Promise.all([getSetting(KEYS.accessToken), getSetting(KEYS.tokenExpiry)]);
  const exp = Number(expiry ?? 0);
  if (token && exp && Date.now() < exp) return token;
  return refreshAccessToken();
}

async function calendarId() {
  return (await getSetting(KEYS.calendarId)) || "primary";
}

async function gcal<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && !retried) {
    await refreshAccessToken();
    return gcal<T>(path, init, true);
  }
  if (res.status === 204) return {} as T;
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Google Calendar respondió ${res.status}`);
  }
  return data;
}

export async function listGoogleCalendars(): Promise<CalendarListItem[]> {
  const data = await gcal<{ items?: Array<{ id?: string; summary?: string; primary?: boolean }> }>(
    "/users/me/calendarList?minAccessRole=writer",
  );
  return (data.items ?? [])
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id as string,
      summary: item.summary || item.id || "Calendario",
      primary: item.primary,
    }));
}

export async function setActiveCalendar(id: string) {
  const calendars = await listGoogleCalendars();
  const chosen = calendars.find((c) => c.id === id);
  if (!chosen) throw new Error("No encontré ese calendario");
  await setSetting(KEYS.calendarId, chosen.id);
  await setSetting(KEYS.calendarName, chosen.summary);
  return chosen;
}

export async function disconnectGoogleCalendar() {
  await Promise.all([
    setSetting(KEYS.refreshToken, ""),
    setSetting(KEYS.accessToken, ""),
    setSetting(KEYS.tokenExpiry, ""),
    setSetting(KEYS.accountEmail, ""),
  ]);
}

function mapEvent(item: {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  colorId?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}): CalendarEvent | null {
  if (!item.id) return null;
  const allDay = Boolean(item.start?.date);
  const start = item.start?.dateTime || (item.start?.date ? rfc3339Cordoba(item.start.date) : "");
  const endRaw = item.end?.dateTime || item.end?.date;
  const end = item.end?.dateTime
    ? item.end.dateTime
    : item.end?.date
      ? rfc3339Cordoba(item.end.date)
      : start;
  if (!start) return null;
  return {
    id: item.id,
    title: item.summary || "(sin título)",
    description: item.description || "",
    location: item.location || "",
    allDay,
    start,
    end: endRaw ? end : start,
    htmlLink: item.htmlLink,
    colorId: item.colorId,
  };
}

export async function listGoogleEvents(fromYmd: string, toYmd: string) {
  const id = encodeURIComponent(await calendarId());
  const params = new URLSearchParams({
    timeMin: rfc3339Cordoba(fromYmd),
    timeMax: rfc3339Cordoba(toYmd),
    singleEvents: "true",
    orderBy: "startTime",
    timeZone: CALENDAR_TZ,
    maxResults: "250",
  });
  const data = await gcal<{ items?: Parameters<typeof mapEvent>[0][] }>(
    `/calendars/${id}/events?${params.toString()}`,
  );
  return (data.items ?? []).map(mapEvent).filter((event): event is CalendarEvent => Boolean(event));
}

function eventBody(input: EventInput) {
  const body: Record<string, unknown> = {
    summary: input.title.trim(),
    description: input.description?.trim() || "",
    location: input.location?.trim() || "",
  };
  if (input.colorId) body.colorId = input.colorId;
  if (input.allDay) {
    const start = input.start.slice(0, 10);
    let end = input.end.slice(0, 10);
    if (end <= start) end = addDaysYmd(start, 1);
    body.start = { date: start };
    body.end = { date: end };
  } else {
    body.start = { dateTime: input.start, timeZone: CALENDAR_TZ };
    body.end = { dateTime: input.end, timeZone: CALENDAR_TZ };
  }
  return body;
}

export async function createGoogleEvent(input: EventInput) {
  const id = encodeURIComponent(await calendarId());
  const created = await gcal<Parameters<typeof mapEvent>[0]>(`/calendars/${id}/events`, {
    method: "POST",
    body: JSON.stringify(eventBody(input)),
  });
  const mapped = mapEvent(created);
  if (!mapped) throw new Error("Google no devolvió el evento");
  return mapped;
}

export async function updateGoogleEvent(eventId: string, input: EventInput) {
  const id = encodeURIComponent(await calendarId());
  const updated = await gcal<Parameters<typeof mapEvent>[0]>(
    `/calendars/${id}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(eventBody(input)),
    },
  );
  const mapped = mapEvent(updated);
  if (!mapped) throw new Error("Google no devolvió el evento");
  return mapped;
}

export async function deleteGoogleEvent(eventId: string) {
  const id = encodeURIComponent(await calendarId());
  await gcal(`/calendars/${id}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
}
