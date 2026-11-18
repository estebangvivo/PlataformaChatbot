import { mkdir, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const framesDir = path.join(root, "presentacion", "demo-chat-frames");
const clipsDir = path.join(root, "presentacion", "demo-chat-clips");
const outPath = path.join(root, "presentacion", "Demo-chat-bot-Regional5.mp4");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const DURATIONS = [5.5, 4.2, 5.2, 4.4, 6.5, 5.2, 6.2, 6.4, 5.8, 6.8, 6.5, 7.2];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} salió con código ${code}`));
    });
  });
}

async function main() {
  await rm(framesDir, { recursive: true, force: true });
  await rm(clipsDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(clipsDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ["--window-size=1920,1080", "--hide-scrollbars", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(pathToFileURL(path.join(root, "presentacion", "demo-chat.html")).href, {
    waitUntil: "networkidle2",
  });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 800));

  const count = await page.$$eval("section.slide", (els) => els.length);
  if (count !== DURATIONS.length) {
    throw new Error(`Hay ${count} slides y ${DURATIONS.length} duraciones`);
  }

  for (let i = 0; i < count; i++) {
    const file = path.join(framesDir, `${String(i + 1).padStart(2, "0")}.png`);
    const handle = await page.$(`section.slide:nth-of-type(${i + 1})`);
    if (!handle) throw new Error(`No está la slide ${i + 1}`);
    await handle.screenshot({ path: file, type: "png" });
    console.log("frame", i + 1);
  }
  await browser.close();

  const listLines = [];
  for (let i = 0; i < count; i++) {
    const n = String(i + 1).padStart(2, "0");
    const png = path.join(framesDir, `${n}.png`);
    const clip = path.join(clipsDir, `${n}.mp4`);
    const seconds = DURATIONS[i];
    const fadeOut = Math.max(0.2, seconds - 0.4);
    await run("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-t",
      String(seconds),
      "-i",
      png,
      "-vf",
      `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=0.28,fade=t=out:st=${fadeOut}:d=0.35,format=yuv420p,fps=30`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-an",
      clip,
    ]);
    listLines.push(`file '${clip.replace(/\\/g, "/")}'`);
  }

  const listFile = path.join(clipsDir, "concat.txt");
  await writeFile(listFile, `${listLines.join("\n")}\n`, "utf8");
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    outPath,
  ]);

  await rm(clipsDir, { recursive: true, force: true });
  console.log("video", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
