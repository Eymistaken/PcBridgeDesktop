import { useEffect, useState } from "react";

import ConnStrip from "./ui/ConnStrip";
import { IconPrompt, IconTrash } from "./ui/Icon";
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
  const [yeni, setYeni] = useState<string>();

  // İlk kuruluşta açılmasın: yalnızca sayaç ARTINCA.
  useEffect(() => {
    if (newSignal > 0) setYeni("");
  }, [newSignal]);

  const burada = view.sessions.filter((s) => panes.includes(s.name));
  const uzakta = view.sessions.filter((s) => !panes.includes(s.name));

  return (
    <>
      {yeni !== undefined && (
        <div className="side__search">
          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault();
              const ad = yeni.trim();
              if (ad) onNew(ad);
              setYeni(undefined);
            }}
          >
            <input
              autoFocus
              className="mono"
              spellCheck={false}
              value={yeni}
              placeholder={t("term.sessionName")}
              aria-label={t("term.newSessionLabel")}
              style={{ fontSize: 13 }}
              onChange={(e) => setYeni(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setYeni(undefined);
              }}
            />
          </form>
        </div>
      )}

      <div className="side__list">
        {view.sessions.length === 0 && (
          <div className="side__empty">
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("term.noSessions")}</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {t("term.noSessionsHint")}
            </span>
          </div>
        )}

        {burada.map((s) => (
          <SessionRow key={s.name} s={s} secili onOpen={onOpen} onKill={onKill} />
        ))}

        {uzakta.length > 0 && burada.length > 0 && (
          <div style={{ padding: "14px 18px 6px" }}>
            <span className="h" style={{ letterSpacing: "0.09em" }}>
              {t("term.elsewhere")}
            </span>
          </div>
        )}

        {uzakta.map((s) => (
          <SessionRow key={s.name} s={s} onOpen={onOpen} onKill={onKill} />
        ))}

        {view.raw && (
          <pre className="mono muted" style={{ padding: "8px 18px", fontSize: 11.5, whiteSpace: "pre-wrap" }}>
            {view.raw}
          </pre>
        )}
      </div>

      <ConnStrip
        title="tmux"
        sub={`${t("term.sessionCount", { n: view.sessions.length })} · ${t("term.openHere", { n: panes.length })}`}
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
      {/* Kutucuk daire DEĞİL: bakışta bot olmadığı anlaşılsın. */}
      <span className="tile" data-uzak={secili ? undefined : "1"}>
        <IconPrompt color={secili ? "var(--text)" : "var(--text-muted)"} />
      </span>
      <div className="row__body">
        <div className="row__top">
          <span
            className="mono row__name"
            style={{ fontSize: 13.5, fontWeight: secili ? 500 : 400 }}
          >
            {s.name}
          </span>
          {secili && (
            <span
              className="dot"
              style={{
                background: s.command && s.command !== "bash" ? "var(--run)" : "var(--ok)",
                alignSelf: "center",
              }}
            />
          )}
        </div>
        <span className="row__sub" style={{ fontSize: 12 }}>
          {[s.command, s.attached ? t("term.alsoOnPc") : null].filter(Boolean).join(" · ")}
        </span>
      </div>
      <button
        type="button"
        className="ib"
        style={{ width: 30, height: 30, flex: "none", alignSelf: "center" }}
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
  );
}
