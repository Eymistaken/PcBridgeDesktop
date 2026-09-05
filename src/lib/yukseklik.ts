/**
 * Yükseklik geçişi — **JS ölçümüyle**, çünkü CSS yapamıyor.
 *
 * ⚠️ WebKitGTK 4.1'de `interpolate-size: allow-keywords` ve `calc-size()`
 * **desteklenmiyor** (gerçek motorda ölçüldü, CLAUDE.md "Devinim — Aşama 12").
 * Yani `height: auto` bir geçişin ucu olamıyor: kapalı hâl sabit px, açık hâl
 * `auto` olduğunda arayı CSS geçiremiyor.
 *
 * Desen `Thinking.tsx`'te kanıtlanmıştı ve üç yerde birden gerekiyor
 * (düşünce kutusu, besteci, kenar çubuğundaki katlanır session listesi);
 * üç kopya er geç ayrışırdı.
 *
 * Sıra:
 *   1. **Değişiklikten önce** eski yüksekliği ölç (`olcOnce`).
 *   2. Değişiklik olsun (React yeni sınıfı/içeriği yazsın).
 *   3. `useLayoutEffect` içinde yeni yüksekliği ölç, eskisini geri yaz,
 *      yeniden akış zorla, geçişi aç, yenisini yaz.
 *   4. Bitince satır içi yükseklik **silinir** — `auto` geri gelmeli, yoksa
 *      akış sürerken kutu büyümeyi bırakır.
 */

/**
 * Hareket azaltılmış mı.
 *
 * ⚠️ **JS ile kurulan devinim CSS'in `@media` bloğuna yakalanmıyor.** Buradaki
 * geçişler satır içi `style.transition` ile kuruluyor ve `app.css`'teki genel
 * `prefers-reduced-motion` kuralı (`transition-duration: 0.01ms !important`)
 * onları da kısaltıyor ama `!important` satır içiyle yarışıyor. Açıkça
 * sorulup atlanmaları daha dürüst.
 *
 * GTK'da bu ayar `gtk-enable-animations`'tan geliyor (CLAUDE.md, Aşama 12).
 */
function azaltilmis(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Bir sonraki düzen etkisinde geçirilecek "önceki yükseklik" kutusu. */
export type YukseklikIzi = { current: number | null };

/**
 * Değişiklikten **önce** çağrılır; ölçüyü ize koyar.
 *
 * Sınıf değişmeden okunuyor: düzen etkisi çalıştığında öğe zaten yeni
 * ölçüsünde oluyor ve iki uç birbirine karışıyor.
 */
export function olcOnce(iz: YukseklikIzi, el: HTMLElement | null): void {
  iz.current = el?.getBoundingClientRect().height ?? null;
}

/**
 * Değişiklikten **sonra**, `useLayoutEffect` içinde çağrılır.
 *
 * Dönen fonksiyon temizlik: etkinin `return`'ü olarak verilmeli.
 */
export function gecirYukseklik(
  iz: YukseklikIzi,
  el: HTMLElement | null,
  sure: string = "var(--dur-slow)",
): (() => void) | undefined {
  const bas = iz.current;
  iz.current = null;
  if (!el || bas === null || azaltilmis()) return;

  const son = el.getBoundingClientRect().height;
  // Bir pikselden küçük fark bir devinim değil; boşuna geçiş kurmayalım.
  if (Math.abs(son - bas) < 1) return;

  el.style.height = `${bas}px`;
  void el.offsetHeight; // yeniden akış: iki uç ayrı karelerde olmalı
  el.style.transition = `height ${sure} var(--ease-inout)`;
  el.style.height = `${son}px`;

  const bitir = () => {
    el.style.height = "";
    el.style.transition = "";
    el.removeEventListener("transitionend", bitir);
    window.clearTimeout(guvenlik);
  };
  el.addEventListener("transitionend", bitir);
  // `transitionend` gelmezse (kesilen geçiş, sıfır süre, hareket azaltılmış
  // sistem) öğe satır içi yükseklikte kilitli kalırdı.
  const guvenlik = window.setTimeout(bitir, 600);
  return bitir;
}

/**
 * İçeriği değişen bir öğeyi yeni yüksekliğine **yumuşakça** taşır.
 *
 * `gecirYukseklik`'ten farkı: burada tetikleyen bir kullanıcı eylemi yok,
 * ölçüm her çizimde yapılıyor. Besteci böyle büyüyor.
 */
export function yukseklikAyarla(
  el: HTMLTextAreaElement | null,
  tavan: number,
  gecisli: boolean,
): number {
  if (!el) return 0;
  const onceki = el.style.height;
  // ⚠️ Ölçüm için `height: 0` yazmak gerekiyor (aksi hâlde `scrollHeight`
  // küçülmeyi göstermiyor) ama o değer **geçirilmemeli**: kutu önce sıfıra
  // inip sonra açılırdı. Geçiş ölçüm boyunca kapalı.
  el.style.transition = "none";
  el.style.height = "0px";
  const hedef = Math.min(el.scrollHeight, tavan);
  el.style.height = onceki || `${hedef}px`;
  void el.offsetHeight;
  el.style.transition = gecisli && !azaltilmis() ? "" : "none";
  el.style.height = `${hedef}px`;
  // ⚠️ **Ölçüyü döndürmek şart.** Çağıran bunu sonradan `el.scrollHeight` ile
  // okuyamaz: yükseklik geçiş hâlindeyken `scrollHeight` **ara değeri**
  // veriyor ve okuyan bir kare geriden gelir. Ölçüldü: iki satıra geçilince
  // 36 okunuyordu (bir önceki hâl), üç satırda 56. Kutunun "çok satır"
  // kararı bu yüzden hep bir tuş geriden alınıyordu.
  return hedef;
}
