/**
 * Bölme üstüne sürükleme — tek uygulama.
 *
 * İki çağıranı var: bölme başlığından tutup başka bir bölmeyle takas etmek
 * (`views/Terminals.tsx`) ve kenar çubuğundaki bir oturumu açık bir bölmenin
 * üstüne bırakmak (`TerminalSidebar.tsx`). İkisi de aynı şeyi yapıyor —
 * imleci izle, altındaki `.pane`'i bul, bırakınca haber ver — ve bu depoda
 * kopyalanan yardımcı er geç ayrışıyor (`yukseklik.ts` ve `Oluk.tsx` aynı
 * sebeple toplanmıştı).
 *
 * **HTML5 DnD kullanılmıyor:** proje sıfır bağımlılıkla yazılmış ve `pointer`
 * olayları WebKitGTK'da denetlenebilir — hayalet, hedef vurgusu ve iptal
 * hepsi bizim elimizde.
 */

/** Sürükleme başlaması için gereken en küçük hareket. */
const ESIK = 5;

export interface SuruklemeDurum {
  /** Altındaki bölmenin kimliği (`data-bolme`), yoksa `null`. */
  hedef: string | null;
  x: number;
  y: number;
}

export interface SuruklemeSecenek {
  /**
   * Sürükleyen bölmenin kendi kimliği. Verilirse kendi üstünde durmak hedef
   * sayılmaz — bir bölmeyi kendisiyle takas etmek anlamsız.
   */
  kaynakBolme?: string;
  onDegis: (d: SuruklemeDurum) => void;
  /**
   * `hedef` `null` ise kullanıcı boşluğa bıraktı.
   *
   * `suruklendi` **tıklamayı sürüklemeden ayırıyor.** `setPointerCapture`
   * sonrası `click` olayı yine geliyor, yani bir satırı sürükleyip bıraktıktan
   * sonra tıklama işi de çalışırdı — kenar çubuğunda bu "oturumu bölmede aç"
   * demek ve sürükleme sonucunu bozardı.
   */
  onBirak: (hedef: string | null, suruklendi: boolean) => void;
}

/** İmlecin altındaki bölmenin kimliği. */
function altindakiBolme(x: number, y: number): string | null {
  const el = document
    .elementsFromPoint(x, y)
    .find((e) => e.classList.contains("pane")) as HTMLElement | undefined;
  return el?.dataset.bolme ?? null;
}

/**
 * Hedef vurgusu **DOM üstünden.**
 *
 * ⚠️ React state'i değil: vurgu iki çağıranda da aynı ve biri (kenar çubuğu)
 * bölmelerin state'ine hiç sahip değil. Sürükleme geçici bir durum, kalıcı
 * bir veri değil. React kendi sanal ağacında olmayan nitelikleri diff'te
 * görmediği için silmiyor — `data-hedef` artık hiçbir bileşenin prop'u.
 */
function vurgula(hedef: string | null): void {
  for (const el of document.querySelectorAll<HTMLElement>(".pane[data-hedef]")) {
    if (el.dataset.bolme !== hedef) delete el.dataset.hedef;
  }
  if (!hedef) return;
  const el = document.querySelector<HTMLElement>(
    `.pane[data-bolme="${CSS.escape(hedef)}"]`,
  );
  if (el) el.dataset.hedef = "1";
}

/**
 * `pointerdown` üstünde çağrılır. Sol tuş değilse ya da bir düğmeden
 * başlıyorsa hiçbir şey yapmaz.
 */
export function bolmeyeSurukle(
  e: React.PointerEvent,
  { kaynakBolme, onDegis, onBirak }: SuruklemeSecenek,
): void {
  if (e.button !== 0 || (e.target as Element).closest("button, input")) return;

  const el = e.currentTarget as HTMLElement;
  // Yakalama olmadan da çalışır: imleç öğenin dışına çıkınca olaylar
  // kaybolabilir ama sürükleme bozulmaz. `try` sentetik olayların
  // (`NotFoundError`) akışı kesmesini de engelliyor — ölçüm betikleri
  // gerçek bir pointer kimliği üretemiyor.
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    /* yakalama yok; dinleyiciler yine kurulacak */
  }
  const bas = { x: e.clientX, y: e.clientY };
  let basladi = false;

  const hareket = (ev: PointerEvent) => {
    // Küçük titremeler sürükleme sayılmasın: tutamaklar aynı zamanda
    // tıklanabilir öğeler (başlık bir şerit, satır bir düğme).
    if (!basladi && Math.hypot(ev.clientX - bas.x, ev.clientY - bas.y) < ESIK)
      return;
    basladi = true;
    const uzerinde = altindakiBolme(ev.clientX, ev.clientY);
    const hedef = uzerinde && uzerinde !== kaynakBolme ? uzerinde : null;
    vurgula(hedef);
    onDegis({ hedef, x: ev.clientX, y: ev.clientY });
  };

  const birak = (ev: PointerEvent) => {
    el.releasePointerCapture(ev.pointerId);
    el.removeEventListener("pointermove", hareket);
    el.removeEventListener("pointerup", birak);
    el.removeEventListener("pointercancel", birak);
    vurgula(null);
    if (!basladi) {
      onBirak(null, false);
      return;
    }
    const uzerinde = altindakiBolme(ev.clientX, ev.clientY);
    onBirak(uzerinde && uzerinde !== kaynakBolme ? uzerinde : null, true);
  };

  el.addEventListener("pointermove", hareket);
  el.addEventListener("pointerup", birak);
  el.addEventListener("pointercancel", birak);
}
