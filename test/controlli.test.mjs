// Test dei controlli sul file (nessun hardware necessario).
import { test } from "node:test";
import assert from "node:assert/strict";
import { controllaAggiornamento, controllaCompleto, trovaVersione, MESSAGGI } from "../js/controlli.js";
import { immagine, completo } from "./file-finti.mjs";

test("Aggiorna: file giusto -> accettato, versione letta", () => {
  assert.deepEqual(controllaAggiornamento(immagine()), { ok: true, versione: "1.0.0" });
});

test("Aggiorna: versioni con suffisso", () => {
  assert.equal(controllaAggiornamento(immagine({ firma: "GPDATABOARD-FW 1.2.10-beta1" })).versione, "1.2.10-beta1");
});

test("Aggiorna: file vuoto", () => {
  assert.equal(controllaAggiornamento(new Uint8Array(0)).errore, MESSAGGI.vuoto);
});

test("Aggiorna: primo byte diverso da 0xE9", () => {
  assert.equal(controllaAggiornamento(immagine({ magic: 0x50 })).errore, MESSAGGI.nonImmagine);
});

test("Aggiorna: file troppo corto per un'intestazione", () => {
  assert.equal(controllaAggiornamento(new Uint8Array([0xe9, 1, 2])).errore, MESSAGGI.nonImmagine);
});

test("Aggiorna: chip sbagliato (ESP32 = 0, ESP32-C3 = 5)", () => {
  assert.equal(controllaAggiornamento(immagine({ chipId: 0 })).errore, MESSAGGI.chipSbagliato);
  assert.equal(controllaAggiornamento(immagine({ chipId: 5 })).errore, MESSAGGI.chipSbagliato);
});

test("Aggiorna: chip_id letto come uint16 little-endian (0x0109 non e' 9)", () => {
  assert.equal(controllaAggiornamento(immagine({ chipId: 0x0109 })).errore, MESSAGGI.chipSbagliato);
});

test("Aggiorna: limite di dimensione 0x300000", () => {
  assert.equal(controllaAggiornamento(immagine({ dimensione: 0x300000 })).ok, true);
  assert.equal(controllaAggiornamento(immagine({ dimensione: 0x300001 })).errore, MESSAGGI.troppoGrande);
});

test("Aggiorna: senza firma GPDATABOARD-FW", () => {
  assert.equal(controllaAggiornamento(immagine({ firma: null })).errore, MESSAGGI.senzaFirma);
  // firma senza versione dopo, o con versione che non inizia con una cifra
  assert.equal(controllaAggiornamento(immagine({ firma: "GPDATABOARD-FW " })).errore, MESSAGGI.senzaFirma);
  assert.equal(controllaAggiornamento(immagine({ firma: "GPDATABOARD-FW x1" })).errore, MESSAGGI.senzaFirma);
  // firma di un altro progetto
  assert.equal(controllaAggiornamento(immagine({ firma: "ALTROPROGETTO 1.0.0" })).errore, MESSAGGI.senzaFirma);
});

test("Aggiorna: file completo scelto per errore -> spiegato, rifiutato", () => {
  assert.equal(controllaAggiornamento(completo()).errore, MESSAGGI.completoInAggiorna);
});

test("Ripristino: file completo giusto -> accettato", () => {
  assert.deepEqual(controllaCompleto(completo()), { ok: true, versione: "1.0.0" });
});

test("Ripristino: file normale scelto per errore -> spiegato, rifiutato", () => {
  assert.equal(controllaCompleto(immagine()).errore, MESSAGGI.normaleInRipristino);
  assert.equal(controllaCompleto(immagine({ dimensione: 0x8000 })).errore, MESSAGGI.normaleInRipristino);
});

test("Ripristino: magic mancante a 0x0", () => {
  const dati = completo();
  dati[0] = 0;
  assert.equal(controllaCompleto(dati).errore, MESSAGGI.nonImmagine);
});

test("Ripristino: chip sbagliato nel bootloader o nel programma", () => {
  assert.equal(controllaCompleto(completo({ chipBootloader: 0 })).errore, MESSAGGI.chipSbagliato);
  assert.equal(controllaCompleto(completo({ chipProgramma: 2 })).errore, MESSAGGI.chipSbagliato);
});

test("Ripristino: senza firma", () => {
  assert.equal(controllaCompleto(completo({ firma: null })).errore, MESSAGGI.senzaFirma);
});

test("Ripristino: limite di 4 MB", () => {
  assert.equal(controllaCompleto(completo({ dimensioneProgramma: 0x400000 - 0x10000 })).ok, true);
  assert.equal(controllaCompleto(completo({ dimensioneProgramma: 0x400000 - 0x10000 + 1 })).errore, MESSAGGI.troppoGrande);
});

test("Ripristino: file troncato (niente programma a 0x10000)", () => {
  const dati = completo().slice(0, 0x9000);
  assert.equal(controllaCompleto(dati).errore, MESSAGGI.completoRovinato);
});

test("trovaVersione: salta occorrenze parziali e trova quella buona", () => {
  const dati = new TextEncoder().encode("xxGPDATABOARD-Fxx GPDATABOARD-FW 2.3.4\0");
  assert.equal(trovaVersione(dati), "2.3.4");
});
