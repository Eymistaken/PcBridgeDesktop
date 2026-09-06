import { useLayoutEffect, useRef, useState } from "react";

import { gecirYukseklik, type YukseklikIzi } from "../lib/yukseklik";
import { t } from "../lib/i18n";

interface Props {
  text: string;
  /** Düşünmenin süresi; yalnızca kapanış olayı taşıyor. */
  ms?: number;
  /** Akış hâlâ sürüyor mu — kapalı kutuda son satırlar canlı kayıyor. */
  live: boolean;
  /** Sonradan eklenen turda mı — giriş devinimi buna bakıyor. */
  yeni?: boolean;
}

/** Kapalı kutuda görünen satır sayısı. */
const SATIR = 3;

/**
 * Katlanabilir düşünce kutusu.
 *
 * **Neden kapalı başlıyor:** ölçüldü, tek koşumda 4217 `thinking` olayı
 * (`local-1a066e01592-b08137`, 329 `text`'e karşılık). Ornith her yanıttan
 * önce uzun uzun düşünüyor ve blok olduğu gibi çizilince sohbet boğuluyor.
 *
 * **Kapalıyken son üç satır akıyor.** Tamamen gizlemek "bir şey oluyor mu"
 * sorusunu doğuruyordu; sabit yükseklikte bir pencereden son satırların
 * kayması hem yer kaplamıyor hem canlılığı gösteriyor. Yükseklik sabit
 * olduğu için sohbet düzeni akış sırasında oynamıyor.
 *
 * **Açıkken kendi kutusunda kaydırılıyor** (`max-height`), sohbeti ele
 * geçirmiyor.
 */
export default function Thinking({ text, ms, live, yeni }: Props) {
  const [acik, setAcik] = useState(false);
  const kaydirilan = useRef<HTMLDivElement>(null);
  const govde = useRef<HTMLDivElement>(null);

  // **Baştaki ve sondaki boşluk kırpılır.** Model düşüncesini sık sık `\n\n`
  // ile bitiriyor; kırpılmayınca kapalı kutunun üç satırının bir kısmı boş
  // kalıyor ve kutuyu açmak onu **daraltıyordu**.
  const metin = text.trim();

  // One observer owns height and scrolling. Token renders do not cancel an
  // in-flight transition; only a different natural target retargets it.
  const mode = useRef(acik);
  mode.current = acik;
  const streaming = useRef(live);
  streaming.current = live;
  const measure = useRef<() => void>(() => {});
  const iz = useRef<number | null>(null) as YukseklikIzi;
  const hasText = metin.length > 0;
  useLayoutEffect(() => {
    const kap = kaydirilan.current;
    const ic = govde.current;
    if (!kap || !ic) return;
    let target: number | undefined;
    let cleanup: (() => void) | undefined;
    const update = () => {
      const contentHeight = ic.getBoundingClientRect().height;
      const next = Math.min(contentHeight, mode.current ? window.innerHeight * 0.4 : 60);
      if (next !== target) {
        // Capture the presented height before finishing the previous transition.
        const start = kap.getBoundingClientRect().height;
        cleanup?.();
        if (target === undefined) {
          kap.style.height = `${next}px`;
        } else {
          iz.current = start;
          cleanup = gecirYukseklik(iz, kap, "var(--dur-base)", next);
        }
        target = next;
      }
      const overflow = Math.max(0, contentHeight - next);
      if (mode.current) {
        ic.style.transform = "";
        delete kap.dataset.tasiyor;
        if (streaming.current) kap.scrollTop = kap.scrollHeight;
      } else {
        kap.scrollTop = 0;
        if (overflow > 0.5) kap.dataset.tasiyor = "1";
        else delete kap.dataset.tasiyor;
        ic.style.transform = overflow > 0.5 ? `translateY(${-overflow}px)` : "";
      }
    };
    measure.current = update;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ic);
    observer.observe(kap);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      cleanup?.();
      measure.current = () => {};
    };
  }, [hasText]);
  useLayoutEffect(() => measure.current(), [acik, live]);

  // **Boş düşünce hiç çizilmez.** `toBlocks` artık metinsiz olaydan blok
  // üretmiyor, ama diskteki eski `events.jsonl` kayıtları o olayları hâlâ
  // taşıyor; bu satır eski sohbetleri de düzeltiyor. Hook'lardan sonra
  // dönülüyor: erken çıkış hook sırasını bozardı.
  if (!metin) return null;

  return (
    <div style={{ display: "flex" }}>
      <div className="dusunce" data-yeni={yeni || undefined}>
        <button
          type="button"
          className="dusunce__baslik"
          aria-expanded={acik}
          onClick={() => {
            setAcik((a) => !a);
          }}
        >
          <IconChevron acik={acik} />
          <span>
            {live
              ? t("think.live")
              : ms === undefined
                ? t("think.plain")
                : t("think.took", { s: sure(ms) })}
          </span>
        </button>

        <div
          ref={kaydirilan}
          className={acik ? "dusunce__kuyu dusunce__kuyu--acik" : "dusunce__kuyu"}
        >
          {/* `data-acik` içeriğin belirişini tetikliyor: yükseklik geçerken
            * metin de opaklık ve 4px kayma ile geliyor. Eskiden kutu açılıyor
            * ama metin bir karede sertçe beliriyordu. */}
          <div ref={govde} className="dusunce__metin" data-acik={acik || undefined}>
            {metin}
          </div>
        </div>
      </div>
    </div>
  );
}

/** `12480` → `12,5` saniye; bir dakikayı geçerse `1:23`. */
function sure(ms: number): string {
  const sn = ms / 1000;
  if (sn < 60) return sn < 10 ? sn.toFixed(1).replace(".", ",") : String(Math.round(sn));
  const dk = Math.floor(sn / 60);
  return `${dk}:${String(Math.round(sn % 60)).padStart(2, "0")}`;
}

function IconChevron({ acik }: { acik: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ transform: acik ? undefined : "rotate(-90deg)" }}
    >
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { SATIR };
