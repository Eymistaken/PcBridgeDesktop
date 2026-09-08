import { t } from "../lib/i18n";
import type { DesktopState } from "../lib/types";

interface Props {
  /** İlk satır — `127.0.0.1:8765` ya da `tmux 3.4 · 6 oturum`. */
  title: string;
  sub: string;
  /** Nokta rengi: bağlantı sağlıklı mı. */
  ok: boolean;
  /** Dikkat çeken tek satır — "1 bot seni bekliyor". Varsa alt metnin yerine. */
  uyari?: string;
  desktop?: DesktopState;
  onClick: () => void;
  /** Kilit rozetine basınca — izni açar ya da kapatır. */
  onToggleDesktop?: () => void;
  disabled?: boolean;
}

/**
 * Kenar çubuğunun dibindeki şerit: iki mono satır, üstünde bir cetvel.
 *
 * Masaüstü izni burada, çünkü açık bir izin kullanıcı başka bir ekrandayken
 * de sürüyor — her kipte görünmesi gerekiyor.
 *
 * ⚠️ Bu şerit `--text-muted` taşıyor; hover **dolguya değil metne** biniyor.
 * `--field-h` üstünde oran 4.44 ile AA'nın altına düşerdi.
 */
export default function ConnStrip({
  title,
  sub,
  ok,
  uyari,
  desktop,
  onClick,
  onToggleDesktop,
  disabled,
}: Props) {
  return (
    // **Kap düğme değil.** Kilit rozeti kendi başına bir eylem (tek tıkla
    // izni aç/kapat) ve düğme içine düğme konamaz.
    <div className="side__conn">
      <button className="side__conn__ana" type="button" onClick={onClick} disabled={disabled}>
        <span className="side__conn__st">
          <span className="dot" style={{ background: ok ? "var(--ok)" : "var(--fail)" }} />
          <span>{title}</span>
        </span>
        <span
          className="side__conn__alt"
          style={uyari ? { color: "var(--run)" } : undefined}
        >
          {uyari ?? sub}
        </span>
      </button>
      {desktop && <DesktopBadge d={desktop} onToggle={onToggleDesktop} />}
    </div>
  );
}

/**
 * Masaüstü izni rozeti — **tek tıkla açıp kapatan bir düğme.**
 *
 * Eskiden yalnızca durum gösteriyordu ve izni açmak için panele gidip süre
 * seçmek gerekiyordu. Sık yapılan şey "şimdi aç"; süre seçimi panelde duruyor.
 *
 * Tasarım bu bilgiyi alt satıra düz metin olarak yazıyor ("desktop unlocked
 * 1:24") ama orada tıklanacak bir şey yok; rozet duruyor, çünkü izni tek
 * tıkla kapatabilmek çalışan bir işlev.
 */
function DesktopBadge({ d, onToggle }: { d: DesktopState; onToggle?: () => void }) {
  const acik = d.unlocked;
  return (
    <button
      type="button"
      className={acik ? "dbadge dbadge--on" : "dbadge"}
      disabled={!onToggle}
      aria-pressed={acik}
      title={
        acik
          ? `${t("strip.unlocked")}${d.reason ? ` — ${d.reason}` : ""} · ${t("strip.clickLock")}`
          : `${t("strip.locked")} · ${t("strip.clickUnlock")}`
      }
      onClick={onToggle}
    >
      {acik ? sayac(d.remaining) : t("strip.lockedShort")}
    </button>
  );
}

/** `mm:ss`. Bir saati aşarsa dakika — saniye o ölçekte gürültü. */
export function sayac(sn: number): string {
  if (sn >= 3600) return t("strip.minutes", { n: Math.floor(sn / 60) });
  return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, "0")}`;
}
