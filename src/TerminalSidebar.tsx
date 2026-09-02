import { useEffect, useState } from "react";

import ConnStrip from "./ui/ConnStrip";
import ModeSwitch from "./ui/ModeSwitch";
import { IconPlus, IconPrompt, IconTrash } from "./ui/Icon";
import type { DesktopState, Mode, TerminalsView } from "./lib/types";

interface Props {
  view: TerminalsView;
  panes: string[];
  mode: Mode;
  onMode: (m: Mode) => void;
  desktop: DesktopState;
  /** Ctrl+N: değer artınca yeni oturum alanı açılır. */
  newSignal: number;
  onOpenSystem: () => void;
  onOpen: (name: string) => void;
  onNew: (name: string) => void;
  onKill: (name: string) => void;
}

export default function TerminalSidebar({
  view,
  panes,
  mode,
  onMode,
  desktop,
  newSignal,
  onOpenSystem,
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
    <div className="side">
      <div className="side__head">
        <span className="side__title">pcbridge</span>
        <button
          className="ib ib--filled"
          type="button"
          title="Yeni oturum (Ctrl+N)"
          aria-label="Yeni oturum"
          onClick={() => setYeni("")}
        >
          <IconPlus />
        </button>
      </div>

      <div className="side__modes">
        <ModeSwitch mode={mode} onMode={onMode} />
      </div>

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
              placeholder="oturum-adi"
              aria-label="Yeni oturum adı"
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
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Açık oturum yok</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Artıya bas. Oturum <span className="mono">tmux</span>'ta yaşar; uygulamayı
              kapatsan da durur.
            </span>
          </div>
        )}

        {burada.map((s) => (
          <SessionRow key={s.name} s={s} secili onOpen={onOpen} onKill={onKill} />
        ))}

        {uzakta.length > 0 && burada.length > 0 && (
          <div style={{ padding: "14px 18px 6px" }}>
            <span className="h" style={{ letterSpacing: "0.09em" }}>
              PC'de açık, burada değil
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
        sub={`${view.sessions.length} oturum · ${panes.length}'i burada açık`}
        ok
        desktop={desktop}
        onClick={onOpenSystem}
      />
    </div>
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
          {[s.command, s.attached ? "PC'de de açık" : null].filter(Boolean).join(" · ")}
        </span>
      </div>
      <button
        type="button"
        className="ib"
        style={{ width: 26, height: 26, flex: "none" }}
        title="Oturumu sonlandır"
        aria-label={`${s.name} oturumunu sonlandır`}
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
