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
  disabled?: boolean;
}

/**
 * Kenar çubuğunun dibindeki şerit. Artboard'daki üçüncü parça — masaüstü
 * izni — burada: izin **her kipte görünür** olmalı, çünkü açık bir izin
 * kullanıcı başka bir ekrandayken de sürüyor.
 */
export default function ConnStrip({ title, sub, ok, desktop, onClick, disabled }: Props) {
  return (
    <button className="side__conn" type="button" onClick={onClick} disabled={disabled}>
      <span className="dot" style={{ background: ok ? "var(--ok)" : "var(--fail)" }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 1, flexGrow: 1, minWidth: 0 }}>
        <span className="mono" style={{ fontSize: 12 }}>
          {title}
        </span>
        <span className="row__sub" style={{ fontSize: 11.5 }}>
          {sub}
        </span>
      </span>
      {desktop && <DesktopBadge d={desktop} />}
    </button>
  );
}

function DesktopBadge({ d }: { d: DesktopState }) {
  if (!d.unlocked) {
    return (
      <span className="dbadge" title={t("strip.locked")}>
        <IconLock size={15} />
      </span>
    );
  }
  return (
    <span
      className="dbadge dbadge--on"
      title={`${t("strip.unlocked")}${d.reason ? ` — ${d.reason}` : ""}`}
    >
      <IconLock size={15} color="var(--run)" open />
      <span className="mono">{sayac(d.remaining)}</span>
    </span>
  );
}

/** `mm:ss`. Bir saati aşarsa dakika — saniye o ölçekte gürültü. */
export function sayac(sn: number): string {
  if (sn >= 3600) return t("strip.minutes", { n: Math.floor(sn / 60) });
  return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, "0")}`;
}
