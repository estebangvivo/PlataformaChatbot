export const CALENDAR_TZ = "America/Argentina/Cordoba";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function ymdInTz(date = new Date(), timeZone = CALENDAR_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function hmInTz(date = new Date(), timeZone = CALENDAR_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
}

export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export function weekdayIndex(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfWeekYmd(ymd: string) {
  const dow = weekdayIndex(ymd);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addDaysYmd(ymd, mondayOffset);
}

export function rfc3339Cordoba(ymd: string, hm = "00:00") {
  const [hour, minute] = hm.split(":");
  return `${ymd}T${hour}:${minute}:00-03:00`;
}

export function ymdFromIso(iso: string) {
  return ymdInTz(new Date(iso));
}

export function hmFromIso(iso: string) {
  return hmInTz(new Date(iso));
}
