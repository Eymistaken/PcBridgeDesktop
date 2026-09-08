import { useEffect, useRef, useState } from "react";

import ConnStrip from "./ui/ConnStrip";
import { IconTrash } from "./ui/Icon";
import { t } from "./lib/i18n";
import type { DesktopState, TerminalsView } from "./lib/types";

interface Props {
  view: TerminalsView;
  panes: string[];
  desktop: DesktopState;
  /** Ctrl+N: değer artınca yeni oturum alanı açılır. */
  newSignal: number;
  onOpenSystem: () => void;
  /** Kilit rozeti — izni tek tıkla açar/kapatır. */
  onToggleDesktop: () => void;
  onOpen: (name: string) => void;
  onNew: (name: string) => void;
  onKill: (name: string) => void;
}

export default function TerminalSidebar({
  view,
  panes,
  desktop,
  newSignal,
  onOpenSystem,
  onToggleDesktop,
  onOpen,
  onNew,
  onKill,
}: Props) {
  const [yeni, setYeni] = useState("");
  const alan = useRef<HTMLInputElement>(null);

  // ⚠️ Satır artık **hep görünür** (tasarımda öyle); `newSignal` onu açmıyor,
  // yalnızca odaklıyor. İlk kuruluşta odak çalınmasın diye sayaç 0'ken hiçbir
  // şey yapılmıyor.
  useEffect(() => {
    if (newSignal > 0) alan.current?.focus();
  }, [newSignal]);

  const burada = view.sessions.filter((s) => panes.includes(s.name));
  const uzakta = view.sessions.filter((s) => !panes.includes(s.name));

  return (
    <>
      <div className="side__search">
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            const ad = yeni.trim();
            if (ad) onNew(ad);
            setYeni("");
          }}
        >
          <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            +
          </span>
          <input
            ref={alan}
            className="mono"
            spellCheck={false}
            value={yeni}
            placeholder={t("term.sessionName")}
            aria-label={t("term.newSessionLabel")}
            style={{ fontSize: 11.5 }}
            onChange={(e) => setYeni(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setYeni("");
                alan.current?.blur();
              }
            }}
          />
        </form>
      </div>

      <div className="side__list">
        {view.sessions.length === 0 && (
          <div className="side__empty">
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("term.noSessions")}</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {t("term.noSessionsHint")}
            </span>
          </div>
        )}

        {burada.length > 0 && (
          <span className="h">{t("term.openHere", { n: burada.length })}</span>
        )}

        {burada.map((s) => (
          <SessionRow key={s.name} s={s} secili onOpen={onOpen} onKill={onKill} />
        ))}

        {uzakta.length > 0 && burada.length > 0 && (
          <span className="h" style={{ paddingTop: 12 }}>{t("term.elsewhere")}</span>
        )}

        {uzakta.map((s) => (
          <SessionRow key={s.name} s={s} onOpen={onOpen} onKill={onKill} />
        ))}

        {view.raw && (
          <pre className="mono muted" style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>
            {view.raw}
          </pre>
        )}
      </div>

      <ConnStrip
        title={`tmux · ${t("term.sessionCount", { n: view.sessions.length })}`}
        sub={t("term.closeKeeps")}
        ok
        desktop={desktop}
        onClick={onOpenSystem}
        onToggleDesktop={onToggleDesktop}
      />
    </>
  );
}

function SessionRow({
  s,
  secili,
  onOpen,
  onKill,
}: {
  s: { name: string; command: string; workdir: string; attached: boolean };
  secili?: boolean;
  onOpen: (n: string) => void;
  onKill: (n: string) => void;
}) {
  return (
    <div
      className="row"
      role="option"
      tabIndex={0}
      aria-selected={!!secili}
      onClick={() => onOpen(s.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(s.name);
        }
      }}
    >
      {/* Çip botunkiyle aynı 9px kare; burada rengi kimlikten değil
       * **durumdan** geliyor. Burada açık olmayan oturum içi boş. */}
      <span
        className="tile"
        data-uzak={secili ? undefined : "1"}
        style={
          secili
            ? {
                background:
                  s.command && s.command !== "bash" ? "var(--run)" : "var(--ok)",
              }
            : undefined
        }
      />
      <span className="row__name row__name--mono">{s.name}</span>
      <span className="row__mark">
        {[s.command, s.attached ? t("term.alsoOnPc") : null]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <div className="row__ops">
        <button
          type="button"
          className="ib"
          style={{ width: 22, height: 22 }}
          title={t("term.kill")}
          aria-label={t("term.killNamed", { name: s.name })}
          onClick={(e) => {
            e.stopPropagation();
            onKill(s.name);
          }}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}
