export type WorkHours = {
  days: number[];
  start: string;
  end: string;
};

const DAY_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

export const DEFAULT_HOURS: WorkHours = {
  days: [1, 2, 3, 4, 5],
  start: "08:00",
  end: "14:00",
};

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isWithinHours(hours: WorkHours, date = new Date()) {
  const local = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" }),
  );
  const day = local.getDay();
  if (!hours.days.includes(day)) return false;
  const now = local.getHours() * 60 + local.getMinutes();
  return now >= toMinutes(hours.start) && now <= toMinutes(hours.end);
}

export function describeHours(hours: WorkHours) {
  const names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const days = hours.days.map((d) => names[d]).join(", ");
  return `${days} ${hours.start}–${hours.end}`;
}

export function parseHours(raw: string): WorkHours {
  try {
    const parsed = JSON.parse(raw) as WorkHours;
    if (Array.isArray(parsed.days) && parsed.start && parsed.end) return parsed;
  } catch {
    // fallback textual, e.g. "Lunes a Viernes 08:00-14:00"
  }
  return DEFAULT_HOURS;
}

export function weekdayLabel(day: number) {
  return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][day];
}

export { DAY_MAP };
