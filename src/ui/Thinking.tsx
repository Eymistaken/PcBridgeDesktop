import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { gecirYukseklik, olcOnce, type YukseklikIzi } from "../lib/yukseklik";
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

  // Kapalı kutuda son satırları göster: içeriği yukarı kaydır. `translateY`
  // üstünde geçiş var, o yüzden yeni token gelince satırlar zıplamıyor akıyor.
  //
  // **Ölçüm düzene bağlı, tek seferlik değil.** Bir kez ölçmek yetmiyordu:
  // ilk `useLayoutEffect`'te kap henüz sıfır genişlikteydi, `overflow-wrap`
  // yüzünden her karakter ayrı satıra düşüyordu ve `scrollHeight` 7130px
  // çıkıyordu — metin görünür alanın çok yukarısına itiliyor, kutu boş
  // görünüyordu. `ResizeObserver` genişlik oturunca ve yazı tipi yüklenince
  // yeniden ölçüyor.
  useLayoutEffect(() => {
    const kap = kaydirilan.current;
    const ic = govde.current;
    if (!kap || !ic) return;

    const olc = () => {
      if (acik) {
        ic.style.transform = "";
        delete kap.dataset.tasiyor;
        return;
      }
      const tasma = ic.scrollHeight - kap.clientHeight;
      if (tasma > 0) {
        // Taşıyor: son satırlar görünsün diye içerik yukarı kayıyor.
        kap.dataset.tasiyor = "1";
        ic.style.transform = `translateY(${-tasma}px)`;
      } else {
        // **Taşmıyorsa hiçbir şey yapma.**
        //
        // ⚠️ Eskiden kutu her zaman tam üç satırdı ve kısa bir düşünce
        // ortalanıyordu — kullanıcı bunu "tam oturaklı değil" diye bildirdi:
        // bir satırlık düşünce 60px'lik bir kutunun ortasında asılı
        // kalıyordu. Kutu artık **içeriğe kadar küçülüyor** (CSS'te sabit
        // yükseklik yerine `max-height`), o yüzden ortalayacak boşluk yok.
        delete kap.dataset.tasiyor;
        ic.style.transform = "";
      }
    };

    olc();
    const gozcu = new ResizeObserver(olc);
    gozcu.observe(ic);
    gozcu.observe(kap);
    return () => gozcu.disconnect();
  }, [metin, acik]);

  // Açıkken dibe yapış — akış sürerken okunan yer sonu olmalı.
  useEffect(() => {
    const kap = kaydirilan.current;
    if (!kap || !acik || !live) return;
    kap.scrollTop = kap.scrollHeight;
  }, [metin, acik, live]);

  /**
   * Açılıp kapanma yükseklik geçişi taşısın — kutu bir karede açılıyordu.
   *
   * ⚠️ **CSS ile yapılamıyor:** kapalı hâl sabit yükseklikte, açık hâl
   * `height: auto`. WebKitGTK 4.1'de `interpolate-size: allow-keywords` ve
   * `calc-size()` **desteklenmiyor** (gerçek motorda ölçüldü), yani `auto`
   * bir geçişin ucu olamıyor. O yüzden iki uç JS'te ölçülüp arası
   * geçiriliyor.
   *
   * **Bitince satır içi yükseklik siliniyor.** Kalsaydı akış sürerken açık
   * kutu büyümeyi bırakırdı — `auto` geri gelmeli.
   *
   * ⚠️ Aşama 10'un düzeltmesi burada bozulmuyor: kapalı hâlin sabit
   * yüksekliğine ve açık hâlin aynı ölçüdeki `min-height`'ına dokunulmadı;
   * bu kod yalnızca ikisinin **arasını** dolduruyor.
   */
  const iz = useRef<number | null>(null) as YukseklikIzi;
  useLayoutEffect(() => gecirYukseklik(iz, kaydirilan.current), [acik]);

  /**
   * Akıştaki büyüme de yumuşak.
   *
   * Kapalı kutu artık içeriğe oturuyor, yani düşünce bir satırdan üçe
   * çıkarken yükseklik iki kez zıplıyordu. `max-height` geçişi bunu
   * çözmüyor (tavan sabit, değişen şey içerik), o yüzden açılma/kapanmayla
   * **aynı yardımcı** kullanılıyor.
   *
   * Ölçü **çizimden önce** alınıyor: `useLayoutEffect` boyamadan önce
   * çalışıyor ama React DOM'u zaten güncelledi, o yüzden bir önceki
   * yüksekliği ref'te taşımak gerekiyor.
   */
  const akisIz = useRef<number | null>(null) as YukseklikIzi;
  const sonMetin = useRef(metin);
  useLayoutEffect(() => {
    const kap = kaydirilan.current;
    if (!kap) return;
    if (acik || sonMetin.current === metin) {
      sonMetin.current = metin;
      akisIz.current = kap.getBoundingClientRect().height;
      return;
    }
    sonMetin.current = metin;
    const temizle = gecirYukseklik(akisIz, kap, "var(--dur-base)");
    akisIz.current = kap.getBoundingClientRect().height;
    return temizle;
  }, [metin, acik]);

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
            // Eski yükseklik **sınıf değişmeden** okunuyor: düzen etkisi
            // çalıştığında kutu zaten yeni ölçüsünde oluyor.
            olcOnce(iz, kaydirilan.current);
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
