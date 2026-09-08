import { avatarVar, hueFor, type Avatar as Tone } from "../lib/types";

interface Props {
  /** Elle seçilen hue; `null` ise addan türetilir. */
  tone: Tone;
  name: string;
  size?: number;
  /** Rengi olmayan çip — "yeni bot", "PC'de açık değil". İçe halka çizer. */
  bos?: boolean;
}

/**
 * Kimlik çipi. Hue addan türüyor (`types.ts::hueOf`), açıklık ve doygunluk
 * temadan geliyor (`--av-l` / `--av-c`).
 *
 * ⚠️ **Harf kalktı ve daire kare oldu.** Tasarımda kimlik 9px'lik düz bir
 * kare; ad her zaman yanında duruyor, o yüzden harf ikinci kez aynı şeyi
 * söylüyordu. Bununla birlikte "harfin kontrastı 360 hue'da AA geçiyor"
 * ölçümü de konusuz kaldı — çipte artık metin yok. Rengin kendisi hâlâ
 * sabit açıklıkta, yani zemine göre ağırlığı hue'dan bağımsız.
 *
 * Surat, resim, emoji yok.
 */
export default function Avatar({ tone, name, size = 9, bos }: Props) {
  return (
    <span
      className={bos ? "av av--bos" : "av"}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: bos ? undefined : avatarVar(hueFor(tone, name)),
      }}
    />
  );
}
