// GP DeskBoard - logica della pagina di aggiornamento.
// Copyright (c) 2026 Filippo Guidi. Tutti i diritti riservati.

import { ESPLoader, Transport } from "../lib/esptool-js-0.6.1/esptool.js";
import { controllaAggiornamento, controllaCompleto, MAX_COMPLETO, MESSAGGI } from "./controlli.js";
import { scriviFirmware, MODALITA_AGGIORNA, MODALITA_COMPLETO } from "./scrittura.js";

const $ = (id) => document.getElementById(id);

// Produttori USB che puo' avere il display nell'elenco del browser:
// Espressif (USB nativa dell'ESP32-S3) e i convertitori USB-seriale piu' comuni.
const FILTRI_USB = [
  { usbVendorId: 0x303a }, // Espressif
  { usbVendorId: 0x1a86 }, // WCH (CH340 / CH343)
  { usbVendorId: 0x10c4 }, // Silicon Labs (CP210x)
  { usbVendorId: 0x0403 }, // FTDI
];

const STATI = ["stato-inizio", "stato-file", "stato-conferma", "stato-scrittura", "stato-fatto", "stato-errore"];

// Situazione corrente della procedura.
const sessione = { modalita: MODALITA_AGGIORNA, porta: null, dati: null, versione: null };
let scritturaInCorso = false;

function mostra(stato) {
  for (const id of STATI) $(id).hidden = id !== stato;
}

function registro(riga) {
  const pre = $("registro");
  pre.textContent += riga.endsWith("\n") ? riga : riga + "\n";
  pre.scrollTop = pre.scrollHeight;
}

function errore(testo, { altroFile = false } = {}) {
  $("testo-errore").textContent = testo;
  $("pulsante-altro-file").hidden = !altroFile;
  mostra("stato-errore");
}

function ricomincia() {
  sessione.porta = null;
  sessione.dati = null;
  sessione.versione = null;
  sessione.modalita = MODALITA_AGGIORNA;
  mostra("stato-inizio");
  $("pulsante-aggiorna").focus();
}

function impostaAvanzamento(percento) {
  $("barra-riempimento").style.width = percento + "%";
  $("barra").setAttribute("aria-valuenow", String(percento));
  $("percentuale").textContent = percento + "%";
}

// Passo 1: scelta del display nella finestra del browser.
async function scegliDisplay(modalita) {
  sessione.modalita = modalita;
  try {
    sessione.porta = await navigator.serial.requestPort({ filters: FILTRI_USB });
  } catch (e) {
    registro("Nessun dispositivo scelto: " + (e && e.message ? e.message : e));
    errore(
      "Nessun display scelto. Se il display non compare nell'elenco, guarda “Se qualcosa non va” qui sotto.",
    );
    return;
  }
  mostra("stato-file");
  $("pulsante-file").focus();
}

// Passo 2: scelta e controllo del file.
function apriSceltaFile() {
  const input = $("scelta-file");
  input.value = "";
  input.click();
}

async function fileScelto() {
  const file = $("scelta-file").files[0];
  if (!file) return;
  // File enorme scelto per sbaglio: non serve nemmeno leggerlo.
  if (file.size > MAX_COMPLETO) {
    errore(MESSAGGI.troppoGrande, { altroFile: true });
    return;
  }
  const dati = new Uint8Array(await file.arrayBuffer());
  const esito = sessione.modalita === MODALITA_COMPLETO ? controllaCompleto(dati) : controllaAggiornamento(dati);
  registro(`File: ${file.name} (${dati.length} byte) – ${esito.ok ? "versione " + esito.versione : "rifiutato"}`);
  if (!esito.ok) {
    errore(esito.errore, { altroFile: true });
    return;
  }
  sessione.dati = dati;
  sessione.versione = esito.versione;
  $("nome-file").textContent = file.name;
  $("versione-trovata").textContent = esito.versione;
  const completo = sessione.modalita === MODALITA_COMPLETO;
  $("avviso-completo").hidden = !completo;
  $("pulsante-scrivi").textContent = completo ? "Cancella tutto e scrivi" : "Scrivi sul display";
  mostra("stato-conferma");
  $("pulsante-scrivi").focus();
}

// Passo 3: scrittura.
async function scrivi() {
  scritturaInCorso = true;
  impostaAvanzamento(0);
  mostra("stato-scrittura");
  try {
    await scriviFirmware({
      porta: sessione.porta,
      modalita: sessione.modalita,
      dati: sessione.dati,
      ESPLoader,
      Transport,
      eventi: {
        fase: (testo) => ($("fase").textContent = testo),
        avanzamento: impostaAvanzamento,
        registro,
      },
    });
    mostra("stato-fatto");
  } catch (e) {
    registro("Errore: " + (e.causa && e.causa.message ? e.causa.message : e.message));
    errore(e.tipo ? e.message : "Qualcosa è andato storto. Scollega e ricollega il display, poi riprova.");
  } finally {
    scritturaInCorso = false;
    sessione.porta = null; // per riprovare si sceglie di nuovo il display
  }
}

function avvia() {
  if (!("serial" in navigator)) {
    $("avviso-browser").hidden = false;
    $("pannello").hidden = true;
    $("pulsante-completo").hidden = true;
    return;
  }

  $("pulsante-aggiorna").addEventListener("click", () => scegliDisplay(MODALITA_AGGIORNA));
  $("pulsante-file").addEventListener("click", apriSceltaFile);
  $("pulsante-altro-file").addEventListener("click", () => {
    if (sessione.porta) {
      mostra("stato-file");
      apriSceltaFile();
    } else {
      ricomincia();
    }
  });
  $("scelta-file").addEventListener("change", fileScelto);
  $("pulsante-scrivi").addEventListener("click", scrivi);
  for (const b of document.querySelectorAll(".annulla, .ricomincia")) b.addEventListener("click", ricomincia);

  // Ripristino completo: attivo solo dopo aver spuntato la conferma.
  $("conferma-completo").addEventListener("change", (e) => {
    $("pulsante-completo").disabled = !e.target.checked;
  });
  $("pulsante-completo").addEventListener("click", () => {
    if (!$("conferma-completo").checked) return;
    $("pannello").scrollIntoView({ behavior: "smooth", block: "center" });
    scegliDisplay(MODALITA_COMPLETO);
  });

  // Avvisa se si chiude la pagina durante la scrittura.
  window.addEventListener("beforeunload", (e) => {
    if (scritturaInCorso) e.preventDefault();
  });
}

avvia();
