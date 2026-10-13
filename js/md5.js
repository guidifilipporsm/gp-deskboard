// GP DeskBoard - MD5 di un Uint8Array, in esadecimale minuscolo.
// Copyright (c) 2026 Filippo Guidi. Tutti i diritti riservati.
//
// Serve a esptool-js per verificare, dopo la scrittura, che i dati nella flash
// siano identici al file (algoritmo MD5, RFC 1321).

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5Hex(dati) {
  // Riempimento: 0x80, zeri, poi la lunghezza in bit (64 bit little-endian).
  const lunghezza = dati.length;
  const totale = (((lunghezza + 8) >>> 6) + 1) << 6;
  const buf = new Uint8Array(totale);
  buf.set(dati);
  buf[lunghezza] = 0x80;
  const vista = new DataView(buf.buffer);
  vista.setUint32(totale - 8, (lunghezza * 8) >>> 0, true);
  vista.setUint32(totale - 4, Math.floor(lunghezza / 0x20000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let blocco = 0; blocco < totale; blocco += 64) {
    for (let i = 0; i < 16; i++) M[i] = vista.getUint32(blocco + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  let esa = "";
  for (const parola of [a0, b0, c0, d0]) {
    for (let i = 0; i < 4; i++) esa += ((parola >>> (8 * i)) & 0xff).toString(16).padStart(2, "0");
  }
  return esa;
}
