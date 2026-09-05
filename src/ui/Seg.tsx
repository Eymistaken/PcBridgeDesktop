import { useLayoutEffect, useRef, useState } from "react";

export interface SegSecenek<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface Props<T extends string> {
  value: T;
  options: SegSecenek<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
  /** Seçenekler eşit genişlikte dursun (form alanlarında daha oturaklı). */
  esit?: boolean;
}

/**
 * Segmentli seçim — **kayan parçalı.**
 *
 * ⚠️ Eskiden `.seg` yalnızca `aria-pressed` ile yüzey takas ediyordu: seçim
 * bir karede öteki düğmeye **ışınlanıyordu**. `ModeSwitch`'in kayan parçası
 * zaten doğru hissi veriyordu ve kullanıcının "iyi olanın örneği" dediği
 * şeydi; aynı desen buraya taşındı.
 *
 * Parçanın yeri **ölçülüyor**, hesaplanmıyor: seçenekler farklı genişlikte
 * olabiliyor (`Sorarak çalış` ile `Serbest` aynı değil) ve yüzde hesabı
 * yalnızca eşit genişlikte doğru olurdu.
 */
export default function Seg<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  esit,
}: Props<T>) {
  const kap = useRef<HTMLDivElement>(null);
  const [parca, setParca] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = kap.current;
    if (!el) return;
    const olc = () => {
      const secili = el.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!secili) return setParca(null);
      setParca({ x: secili.offsetLeft, w: secili.offsetWidth });
    };
    olc();
    // Yazı tipi geç yüklenirse ya da pencere daralırsa parça kaymalı.
    const gozcu = new ResizeObserver(olc);
    gozcu.observe(el);
    return () => gozcu.disconnect();
  }, [value, options]);

  return (
    <div
      className="seg"
      role="group"
      aria-label={ariaLabel}
      ref={kap}
      data-esit={esit || undefined}
    >
      {parca && (
        <span
          className="seg__parca"
          aria-hidden="true"
          style={{ transform: `translateX(${parca.x - 3}px)`, width: parca.w }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
