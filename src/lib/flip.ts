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

  // Bağımlılık listesi **yok**: sıra pek çok sebeple değişebiliyor (filtre,
  // silme, özet güncellemesi). Her çizimden sonra bakmak, hangi durumun
  // sırayı bozduğunu listelemeye çalışmaktan güvenilir.
  useLayoutEffect(() => {
    const kok = kap.current;
    if (!kok) return;
    const azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const yeni = new Map<string, number>();

    for (const cocuk of Array.from(kok.querySelectorAll<HTMLElement>("[data-flip]"))) {
      const anahtar = cocuk.dataset.flip;
      if (!anahtar) continue;
      const ust = cocuk.offsetTop;
      yeni.set(anahtar, ust);
      if (azalt) continue;

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
  });
}
