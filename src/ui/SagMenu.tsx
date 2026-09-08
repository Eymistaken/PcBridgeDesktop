import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuOge {
  ad: string;
  /** Öncesine bir cetvel çizilir — grupları ayırıyor. */
  ayrac?: boolean;
  kapali?: boolean;
  onSec: () => void;
}

export interface MenuYer {
  x: number;
  y: number;
}

interface Props {
  yer: MenuYer;
  ogeler: MenuOge[];
  ariaLabel: string;
  /**
   * Çıkış devinimi **çağıranda** yönetiliyor (`useCikisIcerik`): menü
   * kapanınca bileşen hemen sökülürse geçişin oynayacağı bir kare kalmıyor.
   */
  cikiyor?: boolean;
  onKapat: () => void;
}

/** İmleçle menü arasındaki boşluk ve viewport kenar payı. */
const PAY = 4;
const KENAR = 8;

/**
 * Sağ tık menüsü.
 *
 * ⚠️ **Uygulamada bir yıl boyunca hiç sağ tık menüsü yoktu** — `grep
 * onContextMenu` sıfır sonuç veriyordu. `CtxMenu.tsx` bir isim tuzağı: o
 * "context window" (token bağlamı) menüsü.
 *
 * Dış tık + Escape + `useCikis` kalıbı `Picker.tsx`'ten geliyor; üçüncü bir
 * uygulama yazmak yerine aynı desen sürdürülüyor.
 *
 * **Zemin `--field`.** Menü kuyunun (bölme başlığının) üstünde yüzüyor ama
 * kuyunun bir parçası değil; kontrast tablosunda `--text` `--field` üstünde
 * 13.33, hover `--field-h` üstünde 11.43. Öğeler **ikincil metin taşımıyor**:
 * `--text-muted` `--field-h` üstünde 4.44 ile AA altında kalıyor ve kanun
 * onu orada yasaklıyor.
 */
export default function SagMenu({ yer, ogeler, ariaLabel, cikiyor, onKapat }: Props) {
  const kok = useRef<HTMLDivElement>(null);
  const [kaydir, setKaydir] = useState<MenuYer>({ x: 0, y: 0 });

  useEffect(() => {
    function tikla(e: MouseEvent) {
      if (!kok.current?.contains(e.target as Node)) onKapat();
    }
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // ⚠️ Terminal açıkken Escape tmux'a gitmeli (TUI'lerde kritik), o
        // yüzden yalnızca menü açıkken ve **burada** yakalanıyor.
        e.stopPropagation();
        onKapat();
      }
    }
    // `mousedown` değil `contextmenu` de yakalanıyor: ikinci bir sağ tık
    // eskisini kapatıp yenisini açsın.
    document.addEventListener("mousedown", tikla);
    document.addEventListener("contextmenu", tikla);
    document.addEventListener("keydown", tus, true);
    return () => {
      document.removeEventListener("mousedown", tikla);
      document.removeEventListener("contextmenu", tikla);
      document.removeEventListener("keydown", tus, true);
    };
  }, [onKapat]);

  // Viewport'a sığdırma — boyama öncesinde, yoksa menü bir kare taşmış görünür.
  useLayoutEffect(() => {
    const el = kok.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = Math.min(0, window.innerWidth - KENAR - (yer.x + PAY + r.width));
    const dy = Math.min(0, window.innerHeight - KENAR - (yer.y + PAY + r.height));
    setKaydir({ x: dx, y: dy });
  }, [yer.x, yer.y, ogeler.length]);

  return (
    <div
      ref={kok}
      className="sagmenu"
      role="menu"
      aria-label={ariaLabel}
      data-cikis={cikiyor || undefined}
      style={{ left: yer.x + PAY + kaydir.x, top: yer.y + PAY + kaydir.y }}
    >
      {ogeler.map((o, i) => (
        <button
          key={`${o.ad}-${i}`}
          type="button"
          role="menuitem"
          className="sagmenu__oge"
          data-ayrac={o.ayrac || undefined}
          disabled={o.kapali}
          onClick={() => {
            onKapat();
            o.onSec();
          }}
        >
          {o.ad}
        </button>
      ))}
    </div>
  );
}
