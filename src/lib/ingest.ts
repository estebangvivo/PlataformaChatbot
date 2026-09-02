import { createHash } from "crypto";
import { prisma } from "./db";
import { embedTexts } from "./rag";
import { scrapeRegional5, type ScrapedPage } from "./scraper";
import { CURATED_KNOWLEDGE } from "./knowledge-seed";
import { getSetting, setSetting } from "./settings";
import { DEFAULT_DEPARTMENT } from "./constants";
import type { KnowledgeSyncResult } from "./ingest-types";

export type { KnowledgeSyncResult } from "./ingest-types";

const MIN_PAGES = 10;
const LAST_RESULT_KEY = "knowledge.lastResult";
const CONTENT_HASH_KEY = "knowledge.contentHash";

const g = globalThis as unknown as { __r5IngestLock?: boolean };

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function pageHash(page: ScrapedPage) {
  return sha(page.chunks.map((c) => c.content).slice().sort().join("\n"));
}

function contentFingerprint(pages: ScrapedPage[]) {
  const web = pages
    .filter((p) => p.chunks.length)
    .map((p) => `${p.url}\n${pageHash(p)}`)
    .sort()
    .join("\n");
  const curated = CURATED_KNOWLEDGE.map((c) => `${c.title}\n${c.contentChunk}`).join("\n");
  return sha(`${web}\n---\n${curated}`);
}

async function existingWebHashes() {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { NOT: { title: { startsWith: "[ficha]" } } },
    select: { pageUrl: true, contentChunk: true },
  });
  const grouped = new Map<string, string[]>();
  for (const chunk of chunks) {
    const list = grouped.get(chunk.pageUrl) ?? [];
    list.push(chunk.contentChunk);
    grouped.set(chunk.pageUrl, list);
  }
  const hashes = new Map<string, string>();
  for (const [url, contents] of grouped) {
    hashes.set(url, sha(contents.slice().sort().join("\n")));
  }
  return hashes;
}

function diffPages(pages: ScrapedPage[], previous: Map<string, string>) {
  const next = new Map<string, string>();
  for (const page of pages) {
    if (!page.chunks.length) continue;
    next.set(page.url, pageHash(page));
  }
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  for (const [url, hash] of next) {
    if (!previous.has(url)) added.push(url);
    else if (previous.get(url) !== hash) updated.push(url);
  }
  for (const url of previous.keys()) {
    if (!next.has(url)) removed.push(url);
  }
  return { added, removed, updated };
}

async function saveResult(result: KnowledgeSyncResult) {
  await setSetting(LAST_RESULT_KEY, JSON.stringify(result));
}

export async function readLastSync(): Promise<KnowledgeSyncResult | null> {
  const raw = await getSetting(LAST_RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KnowledgeSyncResult;
  } catch {
    return null;
  }
}

export async function ingestRegional5(opts?: { source?: "cron" | "manual"; force?: boolean }) {
  if (g.__r5IngestLock) {
    return {
      ranAt: new Date().toISOString(),
      source: opts?.source ?? "manual",
      changed: false,
      skipped: true,
      reason: "Ya hay una indexación en curso",
      stored: 0,
      pages: 0,
      errors: [],
      added: [],
      removed: [],
      updated: [],
    } satisfies KnowledgeSyncResult;
  }

  g.__r5IngestLock = true;
  const source = opts?.source ?? "manual";
  const ranAt = new Date().toISOString();

  try {
    const pages = await scrapeRegional5();
    const okPages = pages.filter((p) => p.chunks.length);
    const errors = pages.filter((p) => p.error).map((p) => `${p.url}: ${p.error}`);

    if (okPages.length < MIN_PAGES) {
      const result: KnowledgeSyncResult = {
        ranAt,
        source,
        changed: false,
        skipped: true,
        reason: `La web respondió pocas páginas (${okPages.length}). No se tocó la base para no borrar lo que ya anda.`,
        stored: await prisma.knowledgeChunk.count(),
        pages: okPages.length,
        errors,
        added: [],
        removed: [],
        updated: [],
      };
      await saveResult(result);
      return result;
    }

    const fingerprint = contentFingerprint(pages);
    const previousHash = await getSetting(CONTENT_HASH_KEY);
    const previous = await existingWebHashes();
    const { added, removed, updated } = diffPages(pages, previous);

    if (!opts?.force && fingerprint === previousHash) {
      const result: KnowledgeSyncResult = {
        ranAt,
        source,
        changed: false,
        skipped: true,
        reason: "La web no cambió",
        stored: await prisma.knowledgeChunk.count(),
        pages: okPages.length,
        errors,
        added: [],
        removed: [],
        updated: [],
      };
      await saveResult(result);
      return result;
    }

    await prisma.knowledgeChunk.deleteMany({
      where: { pageUrl: { contains: "regional5.com.ar" } },
    });

    let stored = 0;
    for (const page of pages) {
      if (!page.chunks.length) continue;
      const embeddings = await embedTexts(page.chunks.map((c) => c.content));
      for (let i = 0; i < page.chunks.length; i++) {
        await prisma.knowledgeChunk.create({
          data: {
            pageUrl: page.url,
            title: page.chunks[i].title,
            contentChunk: page.chunks[i].content,
            embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : null,
            category: categoryFromUrl(page.url),
          },
        });
        stored += 1;
      }
    }

    const curatedEmbed = await embedTexts(CURATED_KNOWLEDGE.map((c) => c.contentChunk));
    for (let i = 0; i < CURATED_KNOWLEDGE.length; i++) {
      const item = CURATED_KNOWLEDGE[i];
      await prisma.knowledgeChunk.create({
        data: {
          pageUrl: item.pageUrl,
          title: `[ficha] ${item.title}`,
          contentChunk: item.contentChunk,
          embedding: curatedEmbed[i] ? JSON.stringify(curatedEmbed[i]) : null,
          category: item.category,
        },
      });
      stored += 1;
    }

    await setSetting(CONTENT_HASH_KEY, fingerprint);

    const result: KnowledgeSyncResult = {
      ranAt,
      source,
      changed: true,
      skipped: false,
      stored,
      pages: okPages.length,
      errors,
      added,
      removed,
      updated,
    };
    await saveResult(result);
    return result;
  } finally {
    g.__r5IngestLock = false;
  }
}

function categoryFromUrl(url: string) {
  const u = url.toLowerCase();
  if (u.includes("tramitacion")) return "Tramitación";
  if (u.includes("turnos")) return "Turnos";
  if (u.includes("medios-de-pago") || u.includes("pago")) return "Tesorería";
  if (u.includes("asesoria")) return DEFAULT_DEPARTMENT;
  if (u.includes("institucion") || u.includes("resolucion")) return "Institución";
  if (u.includes("servicio") || u.includes("convenio") || u.includes("bolsa") || u.includes("jockey") || u.includes("siquiman"))
    return "Servicios";
  if (u.includes("concurso")) return "Eventos";
  if (u.includes("capacitacion") || u.includes("actividades") || u.includes("curso") || u.includes("atrim"))
    return "Capacitación";
  return "General";
}
