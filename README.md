# GP DataBoard – Aggiornamenti

Pagina web per aggiornare il display **GP DataBoard** dal computer, con il cavo USB.

**Pagina:** https://guidifilipporsm.github.io/motogp-display-aggiornamenti/

Serve Chrome o Edge su un computer (usa Web Serial). Il file del firmware si scarica dal gruppo
Telegram: **non** è in questo repository né sulla pagina.

## Come funziona

- **Aggiorna** (normale): scrive il file solo all'indirizzo `0x10000` (partizione app0). WiFi,
  impostazioni (NVS a `0x9000`) e dati (`0x310000`) restano.
- **Ripristino completo** (in fondo alla pagina, con conferma): cancella tutta la flash e scrive il
  file completo (`firmware.factory.bin` di PlatformIO) da `0x0`.
- Prima di scrivere la pagina controlla il file: immagine ESP (`0xE9`), chip ESP32-S3 (chip_id 9),
  dimensione, firma `GPDATABOARD-FW <versione>`. La versione trovata viene mostrata prima di scrivere.
- Scrittura con [esptool-js](https://github.com/espressif/esptool-js) 0.6.1 (Espressif, Apache-2.0),
  incluso in `lib/`: la pagina non usa servizi esterni oltre a GitHub Pages (anche i font sono inclusi).

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html`, `css/`, `js/` | la pagina |
| `js/controlli.js` | controlli sul file prima di scrivere |
| `js/scrittura.js` | procedura di scrittura e riavvio |
| `lib/esptool-js-0.6.1/` | esptool-js (con LICENSE e NOTICE) |
| `fonts/` | Barlow e Barlow Condensed (SIL OFL 1.1) |
| `licenze/`, `THIRD_PARTY_NOTICES.md` | avvisi delle librerie del firmware |
| `test/` | test automatici (senza display) |
| `colori/` | *previsto più avanti:* JSON con i colori dei team, scaricato dal display una volta a settimana |

## Provarla

Sul computer, nella cartella del repository:

```
npx http-server -p 8080      # poi apri http://localhost:8080 in Chrome
npm test                     # test automatici (Node 20+; la prova in Chromium richiede Playwright)
```

I test usano file `.bin` finti costruiti al momento: controllano i rifiuti (magic, chip, firma,
dimensioni, file scambiati) e che in modalità Aggiorna non avvenga nessuna cancellazione completa,
anche usando il vero esptool-js.

## Licenza

© 2026 Filippo Guidi. Tutti i diritti riservati: vedi [LICENSE](LICENSE).
GP DataBoard non è affiliato a Dorna Sports.
