# GP DataBoard — componenti di terze parti

Il firmware di GP DataBoard (Copyright (c) 2026 Filippo Guidi, vedi `LICENSE`) contiene i componenti
qui sotto, ciascuno con la propria licenza. I testi completi delle licenze sono nella cartella
`licenze/`. Questo elenco va tenuto aggiornato quando cambia una libreria (versione o licenza).

| Componente | Versione | Licenza | Titolare | Testo |
|---|---|---|---|---|
| Arduino core per ESP32 (espressif/arduino-esp32) | 3.x | LGPL-2.1-or-later | Arduino Team, Espressif Systems e contributori | `licenze/LGPL-2.1.txt` |
| ESP-IDF e componenti inclusi nel core (FreeRTOS, lwIP, mbedTLS, ...) | 5.5.5 | Apache-2.0 (ESP-IDF); MIT, BSD, Apache-2.0 per i singoli componenti | Espressif Systems e rispettivi autori | licenze dei pacchetti Espressif |
| LVGL | 9.3 | MIT | LVGL Kft | `licenze/MIT_LVGL.txt` |
| bb_spi_lcd | 2.8.0 | Apache-2.0 | BitBank Software, Inc. (Larry Bank) | `licenze/Apache-2.0_bb_spi_lcd.txt` |
| bb_captouch | 1.3.2 | Apache-2.0 | BitBank Software, Inc. (Larry Bank) | `licenze/Apache-2.0_bb_captouch.txt` |
| WiFiManager | 2.0.17 | MIT | tzapu | `licenze/MIT_WiFiManager.txt` |
| ArduinoJson | 7.4 | MIT | Benoit Blanchon | `licenze/MIT_ArduinoJson.txt` |
| Font Barlow e Barlow Condensed (convertiti per LVGL) | commit e44c4b0 di google/fonts (fonts/sorgenti/PROVENIENZA.txt) | SIL OFL 1.1 | The Barlow Project Authors | `licenze/OFL-1.1_Barlow.txt` |

## LGPL 2.1: Arduino core per ESP32

Il firmware e' collegato staticamente alla libreria Arduino core per ESP32, distribuita sotto GNU
LGPL 2.1 o successiva. Come richiesto dalla LGPL:
- chi riceve il firmware puo' modificarlo per uso proprio e analizzarlo per il debug di tali modifiche;
- su richiesta all'autore vengono forniti **gratuitamente, per almeno tre anni** da ogni distribuzione,
  i file oggetto del firmware necessari a ricollegarlo con una versione modificata della libreria;
- il sorgente della libreria e' pubblico: https://github.com/espressif/arduino-esp32

## Dati e servizi

- **Previsioni meteo:** Open-Meteo (https://open-meteo.com), dati sotto licenza CC BY 4.0; citazione
  "Meteo: Open-Meteo" nella pagina Impostazioni del display. L'uso gratuito di Open-Meteo e' consentito
  solo per scopi non commerciali.
- **Dati di gara:** API pubbliche del sito MotoGP. Il progetto non e' affiliato a Dorna Sports.

## Non inclusi nel firmware

Strumenti usati solo per costruirlo, non distribuiti: PlatformIO, lv_font_conv (MIT), Python e gli
script di questo repository.
