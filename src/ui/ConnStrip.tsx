import { IconLock } from "./Icon";
import { t } from "../lib/i18n";
import type { DesktopState } from "../lib/types";

interface Props {
  /** Sol taraftaki tek satır — `127.0.0.1:8765` ya da `tmux`. */
  title: string;
  sub: string;
  /** Nokta rengi: bağlantı sağlıklı mı. */
  ok: boolean;
  desktop?: DesktopState;
  onClick: () => void;
  /** Kilit rozetine basınca — izni açar ya da kapatır. */
  onToggleDesktop?: () => void;
  disabled?: boolean;
}

/**
 * Kenar çubuğunun dibindeki şerit. Artboard'daki üçüncü parça — masaüstü
 * izni — burada: izin **her kipte görünür** olmalı, çünkü açık bir izin
 * kullanıcı başka bir ekrandayken de sürüyor.
 */
export default function ConnStrip({
  title,
  sub,
  ok,
  desktop,
  onClick,
  onToggleDesktop,
  disabled,
}: Props) {
  return (
    // **Kap artık düğme değil.** Kilit rozeti kendi başına bir eylem oldu
    // (tek tıkla izni aç/kapat) ve düğme içine düğme konamaz.
    <div className="side__conn">
      <button className="side__conn__ana" type="button" onClick={onClick} disabled={disabled}>
        <span className="dot" style={{ background: ok ? "var(--ok)" : "var(--fail)" }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 1, flexGrow: 1, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 12 }}>
            {title}
          </span>
          <span className="row__sub" style={{ fontSize: 11.5 }}>
            {sub}
          </span>
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
      <IconLock size={15} color={acik ? "var(--run)" : undefined} open={acik} />
      {acik && <span className="mono">{sayac(d.remaining)}</span>}
    </button>
  );
}

/** `mm:ss`. Bir saati aşarsa dakika — saniye o ölçekte gürültü. */
export function sayac(sn: number): string {
  if (sn >= 3600) return t("strip.minutes", { n: Math.floor(sn / 60) });
  return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, "0")}`;
}
