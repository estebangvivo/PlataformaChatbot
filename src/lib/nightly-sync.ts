import { ingestRegional5, readLastSync } from "./ingest";

const TZ = "America/Argentina/Cordoba";
const HOUR = Number(process.env.KNOWLEDGE_SYNC_HOUR ?? 3) || 3;
const CATCH_UP_MS = 20 * 60 * 60 * 1000;

const g = globalThis as unknown as { __r5NightlySync?: boolean };

function cordobaParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function msUntilNightlyHour(hour = HOUR) {
  const local = cordobaParts();
  const nowFake = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  let target = Date.UTC(local.year, local.month - 1, local.day, hour, 0, 0);
  if (target <= nowFake) target += 24 * 60 * 60 * 1000;
  return target - nowFake;
}

async function runNightly() {
  try {
    const result = await ingestRegional5({ source: "cron" });
    console.log("[r5] sync nocturno de conocimiento", {
      changed: result.changed,
      skipped: result.skipped,
      reason: result.reason,
      pages: result.pages,
      stored: result.stored,
      added: result.added.length,
      updated: result.updated.length,
      removed: result.removed.length,
    });
  } catch (error) {
    console.error("[r5] falló el sync nocturno", error);
  }
}

async function catchUpIfMissed() {
  const last = await readLastSync();
  if (!last?.ranAt) return;
  if (Date.now() - Date.parse(last.ranAt) < CATCH_UP_MS) return;
  console.log("[r5] se perdió la pasada nocturna, actualizando ahora");
  await runNightly();
}

export function startNightlyKnowledgeSync() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (g.__r5NightlySync) return;
  g.__r5NightlySync = true;

  const wait = msUntilNightlyHour();
  console.log(
    `[r5] sync de regional5.com.ar programado a las ${String(HOUR).padStart(2, "0")}:00 (Córdoba), en ${Math.round(wait / 60000)} min`,
  );

  void catchUpIfMissed();

  setTimeout(() => {
    void runNightly();
    setInterval(() => void runNightly(), 24 * 60 * 60 * 1000);
  }, wait);
}
