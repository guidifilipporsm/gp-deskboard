// Prova della pagina in un vero Chromium (Playwright), senza display:
// la porta seriale viene simulata e la scrittura NON parte mai.
// Se Playwright non e' installato, il test viene saltato.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join, extname, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { immagine, completo } from "./file-finti.mjs";
import { MESSAGGI } from "../js/controlli.js";

const RADICE = fileURLToPath(new URL("..", import.meta.url));

async function caricaPlaywright() {
  try {
    return await import("playwright");
  } catch {
    try {
      const globale = execSync("npm root -g", { encoding: "utf8" }).trim();
      return await import(pathToFileURL(join(globale, "playwright", "index.mjs")).href);
    } catch {
      return null;
    }
  }
}

const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
let server, indirizzo, browser, playwright;
const richiesteFallite = [];

before(async () => {
  playwright = await caricaPlaywright();
  server = createServer(async (req, res) => {
    const percorso = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "") || "index.html";
    try {
      const dati = await readFile(join(RADICE, percorso));
      res.writeHead(200, { "content-type": TIPI[extname(percorso)] || "application/octet-stream" });
      res.end(dati);
    } catch {
      richiesteFallite.push(req.url);
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  indirizzo = `http://127.0.0.1:${server.address().port}/`;
  if (playwright) {
    browser = await playwright.chromium.launch();
  }
});

after(async () => {
  await browser?.close();
  server?.close();
});

// Apre la pagina; "conSeriale" simula (true) o toglie (false) Web Serial.
async function apri(conSeriale, viewport = { width: 1280, height: 900 }) {
  const pagina = await browser.newPage({ viewport });
  const erroriConsole = [];
  pagina.on("console", (m) => m.type() === "error" && erroriConsole.push(m.text()));
  pagina.on("pageerror", (e) => erroriConsole.push(String(e)));
  await pagina.addInitScript((conSeriale) => {
    if (conSeriale) {
      Object.defineProperty(navigator, "serial", {
        value: { requestPort: async () => ({ getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }) }) },
      });
    } else {
      delete Navigator.prototype.serial;
    }
  }, conSeriale);
  await pagina.goto(indirizzo);
  return { pagina, erroriConsole };
}

async function scegliFile(pagina, pulsante, dati, nome) {
  const [scelta] = await Promise.all([pagina.waitForEvent("filechooser"), pagina.click(pulsante)]);
  await scelta.setFiles({ name: nome, mimeType: "application/octet-stream", buffer: Buffer.from(dati) });
}

test("pagina: browser senza Web Serial -> 'Serve Chrome o Edge su un computer'", async (t) => {
  if (!browser) return t.skip("Playwright non disponibile");
  const { pagina, erroriConsole } = await apri(false);
  assert.ok(await pagina.isVisible("text=Serve Chrome o Edge su un computer"));
  assert.ok(!(await pagina.isVisible("#pulsante-aggiorna")));
  assert.deepEqual(erroriConsole, []);
  await pagina.close();
});

test("pagina: Aggiorna -> file sbagliati rifiutati, file giusto mostra la versione", async (t) => {
  if (!browser) return t.skip("Playwright non disponibile");
  const { pagina, erroriConsole } = await apri(true);
  assert.ok(await pagina.isHidden("#avviso-browser"));
  await pagina.click("#pulsante-aggiorna");
  await pagina.waitForSelector("#stato-file:not([hidden])");

  // File completo scelto con Aggiorna
  await scegliFile(pagina, "#pulsante-file", completo(), "gp-databoard-1.0.0.factory.bin");
  await pagina.waitForSelector("#stato-errore:not([hidden])");
  assert.equal(await pagina.textContent("#testo-errore"), MESSAGGI.completoInAggiorna);

  // File di un'altra scheda
  await scegliFile(pagina, "#pulsante-altro-file", immagine({ chipId: 0 }), "altro.bin");
  await pagina.waitForFunction((m) => document.getElementById("testo-errore").textContent === m, MESSAGGI.chipSbagliato);

  // File giusto
  await scegliFile(pagina, "#pulsante-altro-file", immagine(), "gp-databoard-1.0.0.bin");
  await pagina.waitForSelector("#stato-conferma:not([hidden])");
  assert.equal(await pagina.textContent("#versione-trovata"), "1.0.0");
  assert.equal(await pagina.textContent("#nome-file"), "gp-databoard-1.0.0.bin");
  assert.ok(await pagina.isHidden("#avviso-completo"));
  assert.equal(await pagina.textContent("#pulsante-scrivi"), "Scrivi sul display");

  // Annulla torna all'inizio
  await pagina.click("#stato-conferma .annulla");
  assert.ok(await pagina.isVisible("#pulsante-aggiorna"));
  assert.deepEqual(erroriConsole, []);
  assert.deepEqual(richiesteFallite, []);
  await pagina.close();
});

test("pagina: Ripristino completo solo dopo la conferma, rifiuta il file normale", async (t) => {
  if (!browser) return t.skip("Playwright non disponibile");
  const { pagina, erroriConsole } = await apri(true);
  await pagina.click("#sezione-completo summary");
  assert.ok(await pagina.isDisabled("#pulsante-completo"));
  await pagina.check("#conferma-completo");
  assert.ok(await pagina.isEnabled("#pulsante-completo"));
  await pagina.click("#pulsante-completo");
  await pagina.waitForSelector("#stato-file:not([hidden])");

  await scegliFile(pagina, "#pulsante-file", immagine(), "gp-databoard-1.0.0.bin");
  await pagina.waitForSelector("#stato-errore:not([hidden])");
  assert.equal(await pagina.textContent("#testo-errore"), MESSAGGI.normaleInRipristino);

  await scegliFile(pagina, "#pulsante-altro-file", completo(), "gp-databoard-1.0.0.factory.bin");
  await pagina.waitForSelector("#stato-conferma:not([hidden])");
  assert.ok(await pagina.isVisible("#avviso-completo"));
  assert.equal(await pagina.textContent("#pulsante-scrivi"), "Cancella tutto e scrivi");
  assert.deepEqual(erroriConsole, []);
  await pagina.close();
});

test("pagina: da telefono si legge senza scorrimento orizzontale", async (t) => {
  if (!browser) return t.skip("Playwright non disponibile");
  const { pagina } = await apri(false, { width: 360, height: 740 });
  const larghezze = await pagina.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(larghezze[0] <= larghezze[1], `scrollWidth ${larghezze[0]} > ${larghezze[1]}`);
  await pagina.close();
});
