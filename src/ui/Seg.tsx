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
 * Seçenek sırası — mono, büyük harf, **etkin olanın altı çizili.**
 *
 * ⚠️ Burada bir zamanlar ölçülen bir kayan parça vardı (`.seg__parca`):
 * seçili düğmenin `offsetLeft`/`offsetWidth`'i `useLayoutEffect`'te
 * okunuyor, bir `ResizeObserver` yazı tipi geç yüklenince yeniden ölçüyordu.
 * Ledger'da yüzey kademesi yok — seçim altı çizgiyle anlatılıyor — ve
 * parçanın taşıyacağı yüzey ortadan kalktı. Ölçüm makinesi de onunla
 * birlikte kalktı: taşıyacağı bir şey olmayan bir ölçüm, sessizce yanlış
 * olabilen bir ölçümdür.
 *
 * Alt çizgi `box-shadow: inset 0 -1px 0` ile çiziliyor (`app.css`), yani
 * düzeni etkilemiyor ve geçişi `color` ile aynı karede oluyor.
 */
export default function Seg<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  esit,
}: Props<T>) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel} data-esit={esit || undefined}>
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
