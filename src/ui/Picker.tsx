import { useEffect, useRef, useState } from "react";

import { IconCheck } from "./Icon";

export interface Secenek {
  value: string;
  label: string;
  /** Sağda duran ikincil bilgi — bağlam uzunluğu, "görme" gibi. */
  note?: string;
}

interface Props {
  id?: string;
  value: string;
  options: Secenek[];
  placeholder: string;
  /** Etiket ve seçenekler tek aralıklı yazıyla — model ve araç adları için. */
  mono?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (value: string) => void;
}

/**
 * Arayüzün kendi açılır listesi.
 *
 * **Neden yerel `<select>` değil:** GTK'nın kendi açılır listesi tasarımın
 * dışında duruyor — köşeli, kendi renkleri, kendi yazı tipi. Nötr Kabuk'ta
 * kabuk renksiz ve köşeler üç değerden biri; işletim sisteminin çizdiği bir
 * kutu bunların hiçbirine uymuyordu.
 *
 * Renk yok: seçim yükselen yüzeyle anlatılıyor. Liste `--field` üstünde,
 * seçili satır `--surface`'a çıkıyor. `--surface-2` kullanılmıyor —
 * `--text-muted` orada 4.07:1 ile AA'nın altında ve `note` o renkte.
 */
export default function Picker({
  id,
  value,
  options,
  placeholder,
  mono,
  disabled,
  ariaLabel,
  onChange,
}: Props) {
  const [acik, setAcik] = useState(false);
  const kok = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acik) return;
    function tikla(e: MouseEvent) {
      if (!kok.current?.contains(e.target as Node)) setAcik(false);
    }
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") setAcik(false);
    }
    document.addEventListener("mousedown", tikla);
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("mousedown", tikla);
      document.removeEventListener("keydown", tus);
    };
  }, [acik]);

  const secili = options.find((o) => o.value === value);

  return (
    <div className="picker" ref={kok}>
      <button
        type="button"
        id={id}
        className="picker__dugme"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-label={ariaLabel}
        onClick={() => setAcik((a) => !a)}
      >
        <span className={secili ? (mono ? "mono" : undefined) : "muted"}>
          {secili?.label ?? placeholder}
        </span>
        <div style={{ flexGrow: 1 }} />
        {secili?.note && <span className="picker__not">{secili.note}</span>}
        <IconChevron acik={acik} />
      </button>

      {acik && (
        <div className="picker__pop" role="listbox" aria-label={ariaLabel}>
          {options.length === 0 && <span className="picker__bos">{placeholder}</span>}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className="picker__sec"
              onClick={() => {
                onChange(o.value);
                setAcik(false);
              }}
            >
              <span className="picker__tik">
                {o.value === value && <IconCheck size={13} color="currentColor" strokeWidth={2} />}
              </span>
              <span className={mono ? "mono picker__ad" : "picker__ad"}>{o.label}</span>
              {o.note && <span className="picker__not">{o.note}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconChevron({ acik }: { acik: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ flex: "none", transform: acik ? "rotate(180deg)" : undefined }}
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
