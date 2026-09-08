import { useEffect, useRef, useState } from "react";

/**
 * Yerinde adlandırma alanı — bölme başlığı, kenar çubuğu satırı, alan sekmesi.
 *
 * ⚠️ **Üç kopyası olacaktı ve toplandı.** İki kopya bir süre yan yana durdu;
 * gerekçe "kapları farklı, tek bileşene indirmek sınıf adını prop'a çevirmek
 * olurdu" idi — `sinif` prop'u tam olarak onu yapıyor ve bu depoda kopyalanan
 * yardımcı er geç ayrışıyor (`Oluk`, `yukseklik.ts` aynı sebeple toplanmıştı).
 *
 * Toplanınca bir sarkıntı da kapandı: kenar çubuğu kopyası yalnızca `onClick`'i
 * durduruyordu, oysa satırın sürüklemesi `pointerdown`'da başlıyor — alanın
 * içinde metin seçmek satırı sürüklemeye başlatıyordu.
 *
 * Davranış: Enter kaydeder, Escape iptal eder, odak kaybı kaydeder, **boş
 * bırakmak siler** (çağıran boş dizgeyi silme olarak yorumluyor).
 */
export default function InlineAd({
  deger,
  sinif,
  ipucu,
  etiket,
  onBitti,
  onIptal,
}: {
  deger: string;
  /** Kabın kendi sınıfı; `mono` her zaman ekleniyor. */
  sinif: string;
  /** Alan boşken görünen — yani ad silinirse yerine geçecek olan. */
  ipucu: string;
  /** `aria-label`; ekran okuyucu neyin adlandırıldığını söylemeli. */
  etiket: string;
  onBitti: (v: string) => void;
  onIptal: () => void;
}) {
  const [v, setV] = useState(deger);
  const alan = useRef<HTMLInputElement>(null);

  useEffect(() => {
    alan.current?.select();
  }, []);

  return (
    <input
      ref={alan}
      className={`${sinif} mono`}
      value={v}
      spellCheck={false}
      autoFocus
      placeholder={ipucu}
      aria-label={etiket}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // Global kısayol dinleyicisi `window`'da: burada yazılan her tuş
        // oraya da düşerdi.
        e.stopPropagation();
        if (e.key === "Enter") onBitti(v);
        else if (e.key === "Escape") onIptal();
      }}
      onBlur={() => onBitti(v)}
    />
  );
}
