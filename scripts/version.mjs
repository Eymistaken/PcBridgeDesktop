/**
 * Sürüm üç dosyada birden yazılı. Ölçüt `tauri.conf.json` — paket adını ve
 * AppImage dosya adını o belirliyor — ama üçü ayrışırsa yayın da ayrışır:
 * `v0.2.0` etiketiyle `…_0.1.0_amd64.AppImage` yüklenmesi böyle olur.
 * Bu yüzden ayrışma hata sayılıyor, uyarı değil.
 *
 * Sürümü stdout'a basar; CI onu okuyup etiket adını kuruyor.
 */
import { readFileSync } from "node:fs";

const kok = new URL("../", import.meta.url);
const oku = (p) => readFileSync(new URL(p, kok), "utf8");

const tauri = JSON.parse(oku("src-tauri/tauri.conf.json")).version;
const paket = JSON.parse(oku("package.json")).version;
const cargo = oku("src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const hepsi = { "src-tauri/tauri.conf.json": tauri, "package.json": paket, "src-tauri/Cargo.toml": cargo };
const ayri = [...new Set(Object.values(hepsi))];

if (ayri.length !== 1 || !ayri[0]) {
  console.error("Sürümler ayrışmış:");
  for (const [dosya, s] of Object.entries(hepsi)) console.error(`  ${s ?? "okunamadı"}  ${dosya}`);
  console.error("\nÜçü de aynı olmalı; ölçüt src-tauri/tauri.conf.json.");
  process.exit(1);
}

process.stdout.write(ayri[0]);
