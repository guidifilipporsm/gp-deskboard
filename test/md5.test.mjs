// Il nostro MD5 deve dare lo stesso risultato di quello di Node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { md5Hex } from "../js/md5.js";

test("MD5 uguale a node:crypto su varie lunghezze", () => {
  for (const n of [0, 1, 3, 55, 56, 57, 63, 64, 65, 1000, 65536, 1_000_003]) {
    const dati = new Uint8Array(n);
    for (let i = 0; i < n; i++) dati[i] = (i * 131 + 17) & 0xff;
    assert.equal(md5Hex(dati), createHash("md5").update(dati).digest("hex"), `lunghezza ${n}`);
  }
});

test("MD5 vettori noti (RFC 1321)", () => {
  const enc = (s) => new TextEncoder().encode(s);
  assert.equal(md5Hex(enc("")), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(md5Hex(enc("abc")), "900150983cd24fb0d6963f7d28e17f72");
});
