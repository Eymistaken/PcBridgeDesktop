import { useState } from "react";

import { IconPlus, IconPrompt, IconTrash } from "./ui/Icon";
import type { TerminalsView } from "./lib/types";

interface Props {
  view: TerminalsView;
  panes: string[];
  onOpen: (name: string) => void;
  onNew: (name: string) => void;
  onKill: (name: string) => void;
}

export default function TerminalSidebar({ view, panes, onOpen, onNew, onKill }: Props) {
  const [yeni, setYeni] = useState<string>();

  const burada = view.sessions.filter((s) => panes.includes(s.name));
  const uzakta = view.sessions.filter((s) => !panes.includes(s.name));

  return (
    <div className="side">
      <div className="side__head">
        <span className="side__title">Terminaller</span>
        <button
          className="ib ib--filled"
          type="button"
          title="Yeni oturum"
          aria-label="Yeni oturum"
          onClick={() => setYeni("")}
        >
          <IconPlus />
        </button>
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

      <div className="side__conn" style={{ cursor: "default" }}>
        <span className="dot" style={{ background: "var(--ok)" }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 1, flexGrow: 1, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 12 }}>
            tmux
          </span>
          <span className="row__sub" style={{ fontSize: 11.5 }}>
            {view.sessions.length} oturum · {panes.length}'i burada açık
          </span>
        </span>
      </div>
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
