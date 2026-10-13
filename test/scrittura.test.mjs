// Test della scrittura senza display: si usa
//  1) un ESPLoader finto, per controllare la procedura completa;
//  2) il VERO ESPLoader di esptool-js con i comandi di basso livello sostituiti,
//     per controllare che in modalita' Aggiorna la libreria non cancelli tutta la flash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { scriviFirmware, opzioniScrittura, MODALITA_AGGIORNA, MODALITA_COMPLETO } from "../js/scrittura.js";
import { md5Hex } from "../js/md5.js";
import { immagine, completo } from "./file-finti.mjs";

// Silenzia i messaggi che esptool-js stampa al caricamento.
const logOriginale = console.log;
console.log = () => {};
const esptool = await import("../lib/esptool-js-0.6.1/esptool.js");
console.log = logOriginale;

// --- Finti -------------------------------------------------------------------

function creaFinti({ chip = "ESP32-S3", falliscoConnessione = false } = {}) {
  const chiamate = [];
  class TransportFinto {
    constructor(porta) {
      this.porta = porta;
    }
    async setDTR(v) { chiamate.push(["setDTR", v]); }
    async setRTS(v) { chiamate.push(["setRTS", v]); }
    async disconnect() { chiamate.push(["disconnect"]); }
  }
  class ESPLoaderFinto {
    constructor(opzioni) {
      this.opzioni = opzioni;
    }
    async main() {
      chiamate.push(["main"]);
      if (falliscoConnessione) throw new Error("Failed to connect with the device");
      this.chip = { CHIP_NAME: chip };
      return chip;
    }
    async eraseFlash() { chiamate.push(["eraseFlash"]); }
    async writeFlash(o) {
      chiamate.push(["writeFlash", o]);
      o.reportProgress(0, 50, 100);
      o.reportProgress(0, 100, 100);
    }
  }
  return { chiamate, ESPLoader: ESPLoaderFinto, Transport: TransportFinto };
}

// --- Procedura completa con loader finto -------------------------------------

test("Aggiorna: un solo file a 0x10000, nessuna cancellazione, riavvio e chiusura", async () => {
  const { chiamate, ESPLoader, Transport } = creaFinti();
  const dati = immagine();
  const avanzamenti = [];
  await scriviFirmware({
    porta: {}, modalita: MODALITA_AGGIORNA, dati, ESPLoader, Transport,
    eventi: { avanzamento: (p) => avanzamenti.push(p) },
  });
  const nomi = chiamate.map((c) => c[0]);
  assert.ok(!nomi.includes("eraseFlash"), "in modalita' Aggiorna non si deve cancellare la flash");
  const opzioni = chiamate.find((c) => c[0] === "writeFlash")[1];
  assert.equal(opzioni.fileArray.length, 1);
  assert.equal(opzioni.fileArray[0].address, 0x10000);
  assert.equal(opzioni.fileArray[0].data, dati);
  assert.equal(opzioni.eraseAll, false);
  assert.equal(opzioni.flashMode, "keep");
  assert.equal(opzioni.flashFreq, "keep");
  assert.equal(opzioni.flashSize, "keep");
  // Riavvio: DTR basso, poi impulso su RTS (alto -> basso).
  const segnali = chiamate.filter((c) => c[0] === "setDTR" || c[0] === "setRTS");
  assert.deepEqual(segnali, [["setDTR", false], ["setRTS", true], ["setRTS", false]]);
  assert.equal(nomi.at(-1), "disconnect");
  assert.deepEqual(avanzamenti, [0, 50, 100, 100]);
});

test("Ripristino completo: cancella tutto PRIMA, poi scrive il file intero da 0x0", async () => {
  const { chiamate, ESPLoader, Transport } = creaFinti();
  const dati = completo();
  await scriviFirmware({ porta: {}, modalita: MODALITA_COMPLETO, dati, ESPLoader, Transport });
  const nomi = chiamate.map((c) => c[0]);
  assert.ok(nomi.indexOf("eraseFlash") !== -1 && nomi.indexOf("eraseFlash") < nomi.indexOf("writeFlash"));
  const opzioni = chiamate.find((c) => c[0] === "writeFlash")[1];
  assert.equal(opzioni.fileArray.length, 1);
  assert.equal(opzioni.fileArray[0].address, 0x0);
  assert.equal(opzioni.fileArray[0].data, dati);
});

test("Connessione fallita: messaggio sul tasto BOOT, nessuna scrittura, porta chiusa", async () => {
  const { chiamate, ESPLoader, Transport } = creaFinti({ falliscoConnessione: true });
  await assert.rejects(
    scriviFirmware({ porta: {}, modalita: MODALITA_AGGIORNA, dati: immagine(), ESPLoader, Transport }),
    (e) => e.tipo === "connessione" && /BOOT/.test(e.message),
  );
  const nomi = chiamate.map((c) => c[0]);
  assert.ok(!nomi.includes("writeFlash"));
  assert.equal(nomi.at(-1), "disconnect");
});

test("Scheda diversa da ESP32-S3: rifiutata prima di scrivere", async () => {
  const { chiamate, ESPLoader, Transport } = creaFinti({ chip: "ESP32" });
  await assert.rejects(
    scriviFirmware({ porta: {}, modalita: MODALITA_AGGIORNA, dati: immagine(), ESPLoader, Transport }),
    (e) => e.tipo === "scheda",
  );
  assert.ok(!chiamate.some((c) => c[0] === "writeFlash" || c[0] === "eraseFlash"));
});

// --- VERO esptool-js 0.6.1 ----------------------------------------------------

// Crea un vero ESPLoader e sostituisce solo i comandi che parlerebbero col chip,
// registrando cosa verrebbe cancellato/scritto.
function loaderVero() {
  const transport = { getInfo: () => "finto", trace() {}, tracing: false };
  const loader = new esptool.ESPLoader({ transport, baudrate: 460800, terminal: { clean() {}, writeLine() {}, write() {} } });
  loader.IS_STUB = true; // come dopo il caricamento dello stub sul display
  // Valori del target ESP32-S3 di esptool-js (lib/targets/esp32s3.js) usati da writeFlash.
  loader.chip = { CHIP_NAME: "ESP32-S3", BOOTLOADER_FLASH_OFFSET: 0x0 };
  const reg = { cancellazioniTotali: 0, inizi: [], blocchi: 0, md5Richiesti: [] };
  let scritti = [];
  loader.eraseFlash = async () => { reg.cancellazioniTotali++; };
  loader.flashDeflBegin = async (dimensione, compressa, indirizzo) => {
    reg.inizi.push({ dimensione, indirizzo });
    scritti = [];
    return Math.ceil(compressa / loader.FLASH_WRITE_SIZE);
  };
  loader.flashDeflBlock = async (blocco) => { reg.blocchi++; scritti.push(blocco); };
  loader.flashDeflFinish = async () => {};
  loader.flashBegin = async () => { throw new Error("non previsto: scrittura non compressa"); };
  loader.flashMd5sum = async (indirizzo, dimensione) => {
    reg.md5Richiesti.push({ indirizzo, dimensione });
    // Ricostruisce i dati "arrivati" al chip e ne calcola l'MD5 come farebbe il display.
    const { inflateSync } = await import("node:zlib");
    const compressi = Buffer.concat(scritti.map((b) => Buffer.from(b)));
    return createHash("md5").update(inflateSync(compressi)).digest("hex");
  };
  return { loader, reg };
}

test("esptool-js reale, Aggiorna: nessuna cancellazione completa, regione scritta 0x10000..fine file", async () => {
  const { loader, reg } = loaderVero();
  const dati = immagine({ dimensione: 1_500_000 + 3 }); // non multiplo di 4: esptool-js aggiunge padding
  await loader.writeFlash(opzioniScrittura(MODALITA_AGGIORNA, dati));
  assert.equal(reg.cancellazioniTotali, 0, "esptool-js non deve chiamare eraseFlash");
  assert.equal(reg.inizi.length, 1);
  assert.equal(reg.inizi[0].indirizzo, 0x10000);
  const dimensione = reg.inizi[0].dimensione;
  assert.ok(dimensione <= 0x300000 + 4);
  // La regione cancellata/scritta resta sotto i dati (0x310000) e sopra l'NVS (0x9000..).
  assert.ok(0x10000 + dimensione <= 0x310000);
  // Verifica MD5 eseguita (e superata: altrimenti writeFlash avrebbe lanciato un errore).
  assert.deepEqual(reg.md5Richiesti, [{ indirizzo: 0x10000, dimensione }]);
});

test("esptool-js reale, Aggiorna: file della dimensione massima termina esattamente a 0x310000", async () => {
  const { loader, reg } = loaderVero();
  await loader.writeFlash(opzioniScrittura(MODALITA_AGGIORNA, immagine({ dimensione: 0x300000 })));
  assert.equal(reg.cancellazioniTotali, 0);
  assert.equal(0x10000 + reg.inizi[0].dimensione, 0x310000);
});

test("esptool-js reale, Ripristino: scrive da 0x0 (la cancellazione la fa scriviFirmware prima)", async () => {
  const { loader, reg } = loaderVero();
  const dati = completo();
  await loader.writeFlash(opzioniScrittura(MODALITA_COMPLETO, dati));
  assert.equal(reg.cancellazioniTotali, 0);
  assert.equal(reg.inizi[0].indirizzo, 0x0);
  assert.equal(reg.inizi[0].dimensione, dati.length);
});

test("esptool-js reale, flashMode/Freq/Size 'keep': l'intestazione del bootloader non viene toccata", async () => {
  const { loader } = loaderVero();
  const dati = completo();
  const copia = dati.slice();
  let ricevuto = null;
  loader.flashMd5sum = async () => md5Hex(copia);
  const originale = loader._updateImageFlashParams.bind(loader);
  loader._updateImageFlashParams = async (...a) => (ricevuto = await originale(...a));
  await loader.writeFlash(opzioniScrittura(MODALITA_COMPLETO, dati));
  assert.deepEqual(ricevuto.slice(0, 24), copia.slice(0, 24));
});
