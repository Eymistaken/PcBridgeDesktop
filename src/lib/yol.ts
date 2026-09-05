/** Yol kısaltmaları. Sohbet başlığı ve session ekranı aynısını kullanıyor. */

/** `/home/eymistaken/Belgeler/X` → `~/Belgeler/X` */
export function kisaltEv(p: string): string {
  const m = p.match(/^\/home\/[^/]+(\/.*)?$/);
  return m ? "~" + (m[1] ?? "") : p;
}

/** `/home/x/rapor.md` → `rapor.md` */
export function dosyaAdi(yol: string): string {
  const i = yol.lastIndexOf("/");
  return i < 0 ? yol : yol.slice(i + 1);
}
