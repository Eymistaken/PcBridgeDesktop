import type { ReactNode } from "react";

interface Props {
  /** Soldaki mono büyük harf etiket. Oluk 104px — kısa tutulur. */
  et: string;
  /** Etiketin rengi durumdan geliyorsa (bekleyen soru, açık izin). */
  ton?: string;
  /** Giriş devinimi — yalnızca sonradan eklenen içerikte. */
  yeni?: boolean;
  children: ReactNode;
}

/**
 * Bir kıta: solda rol/bölüm etiketi, sağda içerik.
 *
 * Tasarımın imzası olan ızgara. Sekiz ekranın hepsi bunu kullanıyor —
 * sohbet dökümü, session açılışı, sistem paneli, ilk açılış — ve o yüzden
 * **tek yerde** duruyor. Üç dosyada üç kopyası vardı; bu depoda kopyalanan
 * bir yardımcı er geç ayrışıyor (`yukseklik.ts` aynı sebeple toplanmıştı).
 */
export default function Oluk({ et, ton, yeni, children }: Props) {
  return (
    <div className="oluk" data-yeni={yeni || undefined}>
      <span className="oluk__et" style={ton ? { color: ton } : undefined}>
        {et}
      </span>
      <div className="oluk__ic">{children}</div>
    </div>
  );
}
