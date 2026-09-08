// Artboard gövdelerini tek sayfada, canvas.json'daki çerçeve ölçüleriyle çizer.
// Yalnızca tuvali denetlemek için; tuvale girmiyor.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const ortak = readFileSync(join(dir, "_ortak.css"), "utf8");
const cv = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8"));
let out = `<!doctype html><meta charset="utf-8"><title>onizleme</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"><style>
${ortak}
body{background:#0a0a0c;padding:24px;font-family:var(--sans)}
.cerceve{margin:0 0 40px}.cerceve h2{font:500 12px var(--mono);color:#888;margin:0 0 6px}
.kutu{border:1px solid #444;overflow:hidden;position:relative;background:var(--bg)}.kutu>*{width:100%;height:100%}
</style>`;
for (const a of cv.artboards) {
  const g = readFileSync(join(dir, a.file.replace(".dc.html", ".govde.html")), "utf8");
  out += `<div class="cerceve"><h2>${a.file} — ${a.w}x${a.h}</h2><div class="kutu" data-ad="${a.file}" style="width:${a.w}px;height:${a.h}px">${g}</div></div>\n`;
}
writeFileSync(join(dir, "onizleme.html"), out);
console.log("onizleme.html hazır");
