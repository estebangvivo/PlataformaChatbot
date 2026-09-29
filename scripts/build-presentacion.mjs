import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "presentacion", "captures");
const pdfPath = path.join(root, "presentacion", "Mesa-atencion-Regional5.pdf");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = "http://localhost:3000";

const HIDE = `
  nextjs-portal, [data-nextjs-dialog-overlay], [data-next-badge-root],
  #__next-build-watcher { display: none !important; }
`;

async function shot(page, name, extraCss = "") {
  await page.addStyleTag({ content: HIDE + extraCss });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({
    path: path.join(outDir, name),
    type: "png",
  });
  console.log("ok", name);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ["--window-size=1440,900", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  await page.goto(`${base}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector("form");
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("p")) {
      if ((el.textContent || "").includes("SuperAdmin de prueba")) el.style.display = "none";
    }
    for (const el of document.querySelectorAll("div")) {
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.includes("bg-sand") && (el.textContent || "").includes("Regional5Admin")) {
        el.style.display = "none";
      }
    }
  });
  await shot(page, "01-login.png");

  const logged = await page.evaluate(async () => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "superadmin@regional5.local",
        password: "Regional5Admin!",
      }),
    });
    return res.ok;
  });
  if (!logged) throw new Error("No se pudo iniciar sesión");
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle2" });
  await page.waitForSelector("h1");
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "02-dashboard.png");

  await page.goto(`${base}/simulador`, { waitUntil: "networkidle2" });
  await page.waitForSelector("h1");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      (b.textContent || "").includes("Nueva conversación"),
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const composer = await page.$('input[placeholder="Escribí un mensaje…"]');
  if (composer) {
    await composer.click();
    await composer.type("Hola, ¿cuál es el horario de atención de la sede?", { delay: 12 });
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => !document.body.innerText.includes("El bot está escribiendo"),
      { timeout: 40000 },
    );
    await new Promise((r) => setTimeout(r, 1500));
    await composer.click();
    await composer.type("¿Dónde queda y cuál es el teléfono?", { delay: 12 });
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => !document.body.innerText.includes("El bot está escribiendo"),
      { timeout: 40000 },
    );
    await new Promise((r) => setTimeout(r, 1800));
  }
  await shot(page, "03-simulador.png");

  await page.goto(`${base}/inbox`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1600));
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("button, a, div, li, p")];
    const hit =
      nodes.find((el) => (el.textContent || "").includes("Prueba") && (el.textContent || "").length < 40) ||
      nodes.find((el) => (el.textContent || "").includes("Mariana") && (el.textContent || "").length < 80);
    if (hit) hit.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "04-inbox.png");

  for (const [route, file] of [
    ["/agentes", "05-agentes.png"],
    ["/conocimiento", "06-conocimiento.png"],
    ["/informes", "07-informes.png"],
  ]) {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1400));
    await shot(page, file);
  }

  const deck = await browser.newPage();
  await deck.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const html = pathToFileURL(path.join(root, "presentacion", "slides.html")).href;
  await deck.goto(html, { waitUntil: "networkidle2" });
  await deck.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 800));
  await deck.pdf({
    path: pdfPath,
    width: "1920px",
    height: "1080px",
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log("pdf", pdfPath);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
