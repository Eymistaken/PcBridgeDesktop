import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { t } from "../lib/i18n";

interface Props {
  text: string;
  /** Düşünmenin süresi; yalnızca kapanış olayı taşıyor. */
  ms?: number;
  /** Akış hâlâ sürüyor mu — kapalı kutuda son satırlar canlı kayıyor. */
  live: boolean;
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
export default function Thinking({ text, ms, live }: Props) {
  const [acik, setAcik] = useState(false);
  const kaydirilan = useRef<HTMLDivElement>(null);
  const govde = useRef<HTMLDivElement>(null);

  // Kapalı kutuda son satırları göster: içeriği yukarı kaydır. `translateY`
  // üstünde geçiş var, o yüzden yeni token gelince satırlar zıplamıyor akıyor.
  useLayoutEffect(() => {
    const kap = kaydirilan.current;
    const ic = govde.current;
    if (!kap || !ic || acik) return;
    const tasma = Math.max(0, ic.scrollHeight - kap.clientHeight);
    ic.style.transform = `translateY(${-tasma}px)`;
  }, [text, acik]);

  // Açıkken dibe yapış — akış sürerken okunan yer sonu olmalı.
  useEffect(() => {
    const kap = kaydirilan.current;
    if (!kap || !acik || !live) return;
    kap.scrollTop = kap.scrollHeight;
  }, [text, acik, live]);

  return (
    <div style={{ display: "flex" }}>
      <div className="dusunce">
        <button
          type="button"
          className="dusunce__baslik"
          aria-expanded={acik}
          onClick={() => setAcik((a) => !a)}
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
          <div ref={govde} className="dusunce__metin">
            {text}
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
