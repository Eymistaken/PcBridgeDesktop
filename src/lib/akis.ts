import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Akan metnin ucunu soluklaştıran maske — "açığa çıkarma".
 *
 * **İstek:** *"tokenlar bir anda sertçe var oluyor… soldan sağa bir fading
 * animasyonuyla gelsin, ama token oluşmasının hızını kesmesin."*
 *
 * ✗ **Elenen yol: token başına `<span>`.** Blok her parçada `<Markdown>` ile
 * **bütün olarak** yeniden çiziliyor, yani token'ın kendi düğümü yok; üretmek
 * için ayrıştırıcıyı bölmek gerekirdi. Ayrıca bir token `**kalın**` işaretini
 * ortadan bölebiliyor ve bir koşumda binlerce olay ölçüldü.
 *
 * ✅ **Seçilen yol: imleç konumundan sürülen iki katmanlı maske.**
 * Metnin **son düğümünün ucu** bir `Range` ile ölçülüyor (DOM'a hiçbir şey
 * eklemeden) ve iki CSS değişkeni yazılıyor. Maskenin kendisi CSS'te.
 * Markdown'a hiç dokunulmuyor; eklenen tek düğüm **sarmalayıcı**, token
 * başına düğüm yok.
 *
 * **Ölçüm çerçeve başına bir kere.** Her token'da düzen okumak akışı
 * yavaşlatırdı; `requestAnimationFrame` ile bir kareye bir ölçüm düşüyor ve
 * bekleyen istek iptal ediliyor.
 *
 * ✅ Kanun engeli yok: maske **renk taşımıyor**, yalnızca opaklık. Yasak olan
 * renkli/dekoratif gradyan; nötr geçiş kullanıcının 2026-09-04
 * netleştirmesiyle serbest.
 *
 * ✅ `prefers-reduced-motion` açıkken hiç çalışmaz.
 */
export function useAkisMaskesi(
  kap: RefObject<HTMLElement | null>,
  metin: string,
  canli: boolean,
): void {
  const bekleyen = useRef<number>(null);

  useLayoutEffect(() => {
    const el = kap.current;
    if (!el) return;

    if (!canli || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.removeProperty("--akis-x");
      el.style.removeProperty("--akis-y");
      return;
    }

    if (bekleyen.current !== null) cancelAnimationFrame(bekleyen.current);
    bekleyen.current = requestAnimationFrame(() => {
      bekleyen.current = null;
      const nokta = imlec(el);
      if (!nokta) return;
      el.style.setProperty("--akis-x", `${nokta.x}px`);
      el.style.setProperty("--akis-y", `${nokta.ust}px`);
    });
  }, [kap, metin, canli]);

  // Blok bitince maske kalkmalı: bekleyen bir ölçüm son hâli soluk bırakırdı.
  useEffect(() => {
    return () => {
      if (bekleyen.current !== null) cancelAnimationFrame(bekleyen.current);
    };
  }, []);
}

/**
 * Metnin **son karakterinden sonraki** konum, kaba göre.
 *
 * `Range` daraltılınca genişliği sıfır, yüksekliği satır yüksekliği olan bir
 * dikdörtgen veriyor (WebKitGTK'da doğrulandı). `ust` son satırın tepesi:
 * maskenin ikinci katmanı ondan aşağısını hedefliyor, yani önceki satırlar
 * tam opak kalıyor.
 */
function imlec(kok: HTMLElement): { x: number; ust: number } | null {
  const yurutucu = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
  let son: Text | null = null;
  while (yurutucu.nextNode()) {
    const dugum = yurutucu.currentNode as Text;
    if (dugum.data.length > 0) son = dugum;
  }
  if (!son) return null;

  const aralik = document.createRange();
  aralik.selectNodeContents(son);
  aralik.collapse(false);
  const r = aralik.getBoundingClientRect();
  if (r.height === 0) return null;

  const kokR = kok.getBoundingClientRect();
  return { x: r.right - kokR.left, ust: r.top - kokR.top };
}
