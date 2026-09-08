// Gövde parçalarını ortak stille birleştirip .dc.html üretir.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const ortak = readFileSync(join(dir, "_ortak.css"), "utf8");

for (const f of readdirSync(dir).filter((x) => x.endsWith(".govde.html"))) {
  const ad = f.replace(".govde.html", "");
  const govde = readFileSync(join(dir, f), "utf8");
  const out = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
  <style>
${ortak}
  </style>
</helmet>
${govde.trimEnd()}
</x-dc>
</body>
</html>
`;
  writeFileSync(join(dir, `${ad}.dc.html`), out);
  console.log(`${ad}.dc.html  ${out.length} bayt`);
}
