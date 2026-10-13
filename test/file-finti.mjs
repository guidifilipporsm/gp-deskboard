// Costruisce file .bin FINTI per i test: hanno solo la struttura che la pagina
// controlla (non sono firmware veri e non vanno mai scritti su un display).

// Intestazione di un'immagine ESP (24 byte) + un po' di contenuto.
export function immagine({ dimensione = 200 * 1024, magic = 0xe9, chipId = 9, firma = "GPDESKBOARD-FW 1.0.0" } = {}) {
  const dati = new Uint8Array(dimensione);
  for (let i = 24; i < dimensione; i++) dati[i] = (i * 31 + 7) & 0xff; // contenuto qualunque
  dati[0] = magic;
  dati[1] = 4; // numero di segmenti
  dati[12] = chipId & 0xff;
  dati[13] = (chipId >> 8) & 0xff;
  if (firma && dimensione > 0x200) {
    const testo = new TextEncoder().encode(firma);
    dati.set(testo, 0x100);
    dati[0x100 + testo.length] = 0; // fine stringa (come in C)
  }
  return dati;
}

// File "completo" (factory): bootloader a 0x0, partizioni a 0x8000, programma a 0x10000.
export function completo({ dimensioneProgramma = 200 * 1024, chipBootloader = 9, chipProgramma = 9, firma } = {}) {
  const programma = immagine({ dimensione: dimensioneProgramma, chipId: chipProgramma, firma });
  const dati = new Uint8Array(0x10000 + programma.length).fill(0xff);
  dati.set(immagine({ dimensione: 0x5000, chipId: chipBootloader, firma: null }), 0x0);
  dati[0x8000] = 0xaa; // tabella delle partizioni
  dati[0x8001] = 0x50;
  dati.set(programma, 0x10000);
  return dati;
}
