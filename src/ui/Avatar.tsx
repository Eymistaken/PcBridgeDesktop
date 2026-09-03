import { avatarVar, hueFor, type Avatar as Tone } from "../lib/types";

interface Props {
  /** Elle seçilen hue; `null` ise addan türetilir. */
  tone: Tone;
  name: string;
  size?: number;
}

/**
 * Kimlik rengi. Hue addan türüyor, açıklık ve doygunluk temadan geliyor.
 *
 * Harfin kontrastı **hue'dan bağımsız garanti**: `--av-l` ve `--av-c` sabit
 * olduğu için 360 hue'nun hepsinde AA geçiyor (koyu en düşük 4,62; aydınlık
 * 4,88 — hesaplandı). Surat, resim, emoji yok.
 */
export default function Avatar({ tone, name, size = 36 }: Props) {
  const harf = (name.trim()[0] ?? "?").toLocaleUpperCase("tr-TR");
  return (
    <span
      className="av"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: avatarVar(hueFor(tone, name)),
        fontSize: Math.round(size * 0.39),
      }}
    >
      {harf}
    </span>
  );
}
