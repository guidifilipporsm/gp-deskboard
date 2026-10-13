// GP DeskBoard - scrittura del firmware sul display con esptool-js.
// Copyright (c) 2026 Filippo Guidi. Tutti i diritti riservati.
//
// ESPLoader e Transport vengono passati da fuori (in pagina: esptool-js; nei test:
// versioni finte), cosi' si puo' verificare cosa viene scritto e dove senza il display.

import { INDIRIZZO_PROGRAMMA } from "./controlli.js";
import { md5Hex } from "./md5.js";

export const MODALITA_AGGIORNA = "aggiorna";
export const MODALITA_COMPLETO = "completo";

// Velocita' della seriale durante la scrittura. Con la USB nativa dell'ESP32-S3 non
// conta; con un eventuale adattatore USB-seriale 460800 e' un valore sicuro.
const VELOCITA = 460800;

// Errore con un messaggio gia' pronto per l'utente.
export class ErroreDisplay extends Error {
  constructor(messaggio, tipo, causa) {
    super(messaggio);
    this.tipo = tipo; // "connessione" | "scheda" | "scrittura"
    this.causa = causa;
  }
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// Riavvio "hard reset" come esptool.py: RTS alto (EN basso = chip fermo), poi basso.
// DTR resta basso cosi' il chip riparte con il programma e non in modalita' download.
// Con la USB nativa il display si scollega subito: eventuali errori qui sono normali.
export async function riavvia(transport) {
  try {
    await transport.setDTR(false);
    await transport.setRTS(true);
    await attendi(200);
    await transport.setRTS(false);
    await attendi(200);
  } catch {
    // Il display si e' gia' riavviato e la porta non risponde piu'.
  }
}

// Prepara l'elenco dei file da scrivere e le opzioni per esptool-js.
// "Aggiorna": SOLO il programma a 0x10000, nessuna cancellazione completa.
// "Ripristino completo": il file intero da 0x0 (dopo aver cancellato tutta la flash).
export function opzioniScrittura(modalita, dati, reportProgress) {
  const indirizzo = modalita === MODALITA_COMPLETO ? 0x0 : INDIRIZZO_PROGRAMMA;
  return {
    fileArray: [{ data: dati, address: indirizzo }],
    // "keep": esptool-js non tocca le impostazioni della flash scritte nel file.
    flashMode: "keep",
    flashFreq: "keep",
    flashSize: "keep",
    // Mai: la cancellazione completa la facciamo noi, e solo nel Ripristino completo.
    eraseAll: false,
    compress: true,
    reportProgress,
    calculateMD5Hash: md5Hex,
  };
}

// Esegue tutta la procedura. "eventi" riceve:
//   fase(testo)            -> cosa sta succedendo
//   avanzamento(percento)  -> 0..100 durante la scrittura
//   registro(riga)         -> righe tecniche di esptool-js (per il riquadro dettagli)
export async function scriviFirmware({ porta, modalita, dati, ESPLoader, Transport, eventi = {} }) {
  const fase = eventi.fase || (() => {});
  const avanzamento = eventi.avanzamento || (() => {});
  const registro = eventi.registro || (() => {});

  const terminale = {
    clean() {},
    writeLine: (riga) => registro(riga),
    write: (riga) => registro(riga),
  };

  const transport = new Transport(porta, false);
  const loader = new ESPLoader({ transport, baudrate: VELOCITA, terminal: terminale, debugLogging: false });

  try {
    fase("Collegamento al display…");
    try {
      await loader.main();
    } catch (e) {
      throw new ErroreDisplay(
        "Non riesco a parlare con il display. Scollega il cavo, tieni premuto il tasto BOOT del display " +
          "mentre lo ricolleghi, poi riprova.",
        "connessione",
        e,
      );
    }

    if (!loader.chip || loader.chip.CHIP_NAME !== "ESP32-S3") {
      throw new ErroreDisplay(
        "Il dispositivo scelto non è un GP DeskBoard. Riprova e scegli il display nell'elenco.",
        "scheda",
      );
    }

    const opzioni = opzioniScrittura(modalita, dati, (_indice, scritti, totale) => {
      avanzamento(totale > 0 ? Math.min(100, Math.round((scritti / totale) * 100)) : 0);
    });
    try {
      if (modalita === MODALITA_COMPLETO) {
        // Solo qui si cancella TUTTA la flash (anche WiFi e impostazioni).
        fase("Cancello la memoria del display (può richiedere fino a un minuto)…");
        await loader.eraseFlash();
      }
      fase("Scrittura in corso: non scollegare il display…");
      avanzamento(0);
      await loader.writeFlash(opzioni);
    } catch (e) {
      throw new ErroreDisplay(
        "La scrittura si è interrotta. Non preoccuparti: il display non si rompe. " +
          "Ricollega il cavo e ripeti l'aggiornamento.",
        "scrittura",
        e,
      );
    }
    avanzamento(100);

    fase("Riavvio del display…");
    await riavvia(transport);
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // Porta gia' chiusa: va bene cosi'.
    }
  }
}
