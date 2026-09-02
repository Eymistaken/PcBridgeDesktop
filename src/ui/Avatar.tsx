import { avatarVar, type Avatar as Tone } from "../lib/types";

interface Props {
  tone: Tone;
  name: string;
  size?: number;
}

/**
 * Kimlik rengi. Harf koyu zemin üstünde — altı tonun hepsi 4.6:1'in üstünde.
 * Surat, resim, emoji yok.
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
        background: avatarVar(tone),
        fontSize: Math.round(size * 0.39),
      }}
    >
      {harf}
    </span>
  );
}
