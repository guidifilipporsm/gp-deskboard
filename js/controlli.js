// GP DeskBoard - controlli sul file del firmware PRIMA di scriverlo.
// Copyright (c) 2026 Filippo Guidi. Tutti i diritti riservati.
//
// Modulo senza dipendenze dal browser: viene usato dalla pagina e dai test (Node).

// Indirizzi nella flash del display (4 MB).
export const INDIRIZZO_PROGRAMMA = 0x10000; // partizione app0
export const INDIRIZZO_PARTIZIONI = 0x8000; // tabella delle partizioni
export const MAX_PROGRAMMA = 0x300000; // dimensione della partizione app0
export const MAX_COMPLETO = 0x400000; // tutta la flash: 4 MB

export const MAGIC_IMMAGINE = 0xe9; // primo byte di ogni immagine ESP
export const CHIP_ID_ESP32S3 = 9; // chip_id dell'ESP32-S3 nell'intestazione
export const OFFSET_CHIP_ID = 12; // uint16 little-endian nell'intestazione
export const FIRMA = "GPDESKBOARD-FW ";

// Messaggi mostrati all'utente: brevi e in italiano.
export const MESSAGGI = {
  vuoto: "Il file è vuoto. Scaricalo di nuovo dal gruppo Telegram.",
  nonImmagine: "Questo file non è un aggiornamento del display. Scegli il file .bin scaricato dal gruppo Telegram.",
  chipSbagliato: "Questo file è per un altro tipo di scheda, non per GP DeskBoard.",
  senzaFirma: "Questo file non è un aggiornamento di GP DeskBoard.",
  troppoGrande: "Il file è troppo grande per il display. Scaricalo di nuovo dal gruppo Telegram.",
  completoInAggiorna:
    "Questo è il file per il “Ripristino completo”, non per l'aggiornamento normale. " +
    "Usa il file di aggiornamento (quello senza “factory” nel nome), oppure il Ripristino completo in fondo alla pagina.",
  normaleInRipristino:
    "Questo è il file di aggiornamento normale, non quello per il Ripristino completo. " +
    "Usa il pulsante “Aggiorna”.",
  completoRovinato: "Il file per il ripristino completo è danneggiato o incompleto. Scaricalo di nuovo.",
};

// Legge un uint16 little-endian.
function leggiU16(dati, offset) {
  return dati[offset] | (dati[offset + 1] << 8);
}

// Vero se a "offset" inizia un'immagine ESP per ESP32-S3.
function immagineS3A(dati, offset) {
  return (
    dati.length >= offset + 24 &&
    dati[offset] === MAGIC_IMMAGINE &&
    leggiU16(dati, offset + OFFSET_CHIP_ID) === CHIP_ID_ESP32S3
  );
}

// Vero se il file sembra il "completo" (factory): bootloader a 0x0, tabella delle
// partizioni a 0x8000 (byte magici 0xAA 0x50) e programma a 0x10000.
export function sembraCompleto(dati) {
  return (
    dati.length > INDIRIZZO_PROGRAMMA + 24 &&
    dati[0] === MAGIC_IMMAGINE &&
    dati[INDIRIZZO_PARTIZIONI] === 0xaa &&
    dati[INDIRIZZO_PARTIZIONI + 1] === 0x50 &&
    dati[INDIRIZZO_PROGRAMMA] === MAGIC_IMMAGINE
  );
}

// Cerca la firma "GPDESKBOARD-FW " e restituisce la versione che la segue
// (es. "1.0.0"), oppure null se la firma non c'e'.
export function trovaVersione(dati) {
  const firma = Array.from(FIRMA, (c) => c.charCodeAt(0));
  const primo = firma[0];
  for (let i = dati.indexOf(primo); i !== -1 && i <= dati.length - firma.length; i = dati.indexOf(primo, i + 1)) {
    let uguale = true;
    for (let j = 1; j < firma.length; j++) {
      if (dati[i + j] !== firma[j]) {
        uguale = false;
        break;
      }
    }
    if (!uguale) continue;
    // La versione: cifre, lettere, punti, trattini e "+", al massimo 32 caratteri,
    // deve iniziare con una cifra.
    let versione = "";
    for (let k = i + firma.length; k < dati.length && versione.length < 32; k++) {
      const c = String.fromCharCode(dati[k]);
      if (/[0-9A-Za-z.\-+]/.test(c)) versione += c;
      else break;
    }
    if (/^[0-9]/.test(versione)) return versione;
  }
  return null;
}

// Controllo per la modalita' "Aggiorna" (solo il programma, a 0x10000).
// Restituisce { ok: true, versione } oppure { ok: false, errore }.
export function controllaAggiornamento(dati) {
  if (!dati || dati.length === 0) return { ok: false, errore: MESSAGGI.vuoto };
  if (sembraCompleto(dati)) return { ok: false, errore: MESSAGGI.completoInAggiorna };
  if (dati.length < 24 || dati[0] !== MAGIC_IMMAGINE) return { ok: false, errore: MESSAGGI.nonImmagine };
  if (leggiU16(dati, OFFSET_CHIP_ID) !== CHIP_ID_ESP32S3) return { ok: false, errore: MESSAGGI.chipSbagliato };
  if (dati.length > MAX_PROGRAMMA) return { ok: false, errore: MESSAGGI.troppoGrande };
  const versione = trovaVersione(dati);
  if (!versione) return { ok: false, errore: MESSAGGI.senzaFirma };
  return { ok: true, versione };
}

// Controllo per la modalita' "Ripristino completo" (tutto il file da 0x0).
export function controllaCompleto(dati) {
  if (!dati || dati.length === 0) return { ok: false, errore: MESSAGGI.vuoto };
  if (dati[0] !== MAGIC_IMMAGINE) return { ok: false, errore: MESSAGGI.nonImmagine };
  if (dati.length <= INDIRIZZO_PROGRAMMA) {
    // Troppo corto per contenere bootloader + programma: se e' un'immagine di
    // programma valida, e' il file normale.
    return immagineS3A(dati, 0) && trovaVersione(dati)
      ? { ok: false, errore: MESSAGGI.normaleInRipristino }
      : { ok: false, errore: MESSAGGI.completoRovinato };
  }
  if (dati[INDIRIZZO_PROGRAMMA] !== MAGIC_IMMAGINE) {
    // C'e' un'immagine a 0x0 ma non a 0x10000: e' il file del solo programma.
    return immagineS3A(dati, 0) && trovaVersione(dati)
      ? { ok: false, errore: MESSAGGI.normaleInRipristino }
      : { ok: false, errore: MESSAGGI.completoRovinato };
  }
  if (!immagineS3A(dati, 0) || !immagineS3A(dati, INDIRIZZO_PROGRAMMA)) {
    return { ok: false, errore: MESSAGGI.chipSbagliato };
  }
  if (dati.length > MAX_COMPLETO) return { ok: false, errore: MESSAGGI.troppoGrande };
  const versione = trovaVersione(dati);
  if (!versione) return { ok: false, errore: MESSAGGI.senzaFirma };
  return { ok: true, versione };
}
