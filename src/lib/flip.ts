import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Liste yeniden sıralanınca satırlar zıplamasın — FLIP.
 *
 * **Sorun:** kenar çubuğunda arama kutusuna yazmak listeyi anında
 * zıplatıyordu; bir bot silinince de kalanlar bir karede yukarı atlıyordu.
 * Satırların kendisi değişmiyor, yalnızca **yerleri** değişiyor, ve o yer
 * değişimi hiç anlatılmıyordu.
 *
 * **Yöntem:** her çizimden sonra `[data-flip]` taşıyan çocukların yeni
 * konumu okunuyor; bir öncekinden farklıysa öğe önce **eski yerine** ters
 * `transform` ile konup sonra sıfıra geçiriliyor. Düzen tek seferde
 * yapılıyor, kayan şey yalnızca boya — layout animasyonu değil.
 *
 * ⛔ **View Transition API kullanılmadı.** WebKitGTK 4.1'de `startViewTransition`
 * **var** (bu depoda ölçüldü, varsayılmadı) ama bütün belgeyi anlık
 * görüntülüyor; canlı token akışı ve xterm tuvali sürerken bedeli belirsiz.
 * FLIP yalnızca bu listeye dokunuyor.
 *
 * ✅ `prefers-reduced-motion` açıkken hiç çalışmaz — konumlar yine
 * kaydedilir (kip kapanırsa doğru yerden devam etsin) ama kaydırma yapılmaz.
 */
export function useFlip(kap: RefObject<HTMLElement | null>): void {
  const onceki = useRef(new Map<string, number>());

  // Inspect the ordered keys on each render. A size change already moves
  // neighboring rows through layout; applying FLIP as well makes them bounce.
  useLayoutEffect(() => {
    const kok = kap.current;
    if (!kok) return;
    const azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const yeni = new Map<string, number>();
    const children = Array.from(kok.querySelectorAll<HTMLElement>("[data-flip]"));
    const oldKeys = [...onceki.current.keys()];
    const keys = children.map((child) => child.dataset.flip).filter(Boolean);
    const orderChanged = keys.length !== oldKeys.length ||
      keys.some((key, index) => key !== oldKeys[index]);

    for (const cocuk of children) {
      const anahtar = cocuk.dataset.flip;
      if (!anahtar) continue;
      const ust = cocuk.offsetTop;
      yeni.set(anahtar, ust);
      if (azalt || !orderChanged) continue;

      const eski = onceki.current.get(anahtar);
      if (eski === undefined || eski === ust) continue;

      cocuk.style.transition = "none";
      cocuk.style.transform = `translateY(${eski - ust}px)`;
      // Ters konum bir kare görünmeli; aynı karede sıfırlamak geçişi yutuyor.
      requestAnimationFrame(() => {
        cocuk.style.transition = "transform var(--dur-slow) var(--ease-inout)";
        cocuk.style.transform = "";
      });
    }

    onceki.current = yeni;

    // Keep the baseline current throughout session height transitions and
    // resizes, so the next actual reorder starts from the settled positions.
    const observer = new ResizeObserver(() => {
      onceki.current = new Map(children.flatMap((child) =>
        child.dataset.flip ? [[child.dataset.flip, child.offsetTop] as const] : [],
      ));
    });
    observer.observe(kok);
    for (const child of children) observer.observe(child);
    return () => observer.disconnect();
  });
}
