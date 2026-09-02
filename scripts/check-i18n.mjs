/**
 * İki sözlük aynı anahtar kümesini taşımalı.
 *
 * Eksik anahtar sessizce İngilizceye düşüyor — yani gözle bakınca çeviri
 * "çalışıyor" görünür ve arada Türkçe kipte İngilizce bir cümle kalır.
 * Bu yüzden yapı bunu kendisi denetliyor.
 */
import { readFileSync } from "node:fs";

const kaynak = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");

function anahtarlar(ad) {
  const bas = kaynak.indexOf(`const ${ad}: Record<string, string> = {`);
  if (bas < 0) throw new Error(`sözlük bulunamadı: ${ad}`);
  const son = kaynak.indexOf("\n};", bas);
  const govde = kaynak.slice(bas, son);
  return new Set([...govde.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));
}

const en = anahtarlar("en");
const tr = anahtarlar("tr");

const trEksik = [...en].filter((k) => !tr.has(k));
const enEksik = [...tr].filter((k) => !en.has(k));

if (trEksik.length || enEksik.length) {
  if (trEksik.length) console.error(`tr'de eksik (${trEksik.length}): ${trEksik.join(", ")}`);
  if (enEksik.length) console.error(`en'de eksik (${enEksik.length}): ${enEksik.join(", ")}`);
  process.exit(1);
}

console.log(`i18n: ${en.size} anahtar, iki sözlük de tam.`);
