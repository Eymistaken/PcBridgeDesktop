import { useMemo, useState } from "react";

import Avatar from "./ui/Avatar";
import ConnStrip from "./ui/ConnStrip";
import ModeSwitch from "./ui/ModeSwitch";
import { IconPencil, IconPlus, IconSearch, IconTrash } from "./ui/Icon";
import type { Bot, BotSummary, ConnSnapshot, DesktopState, Mode } from "./lib/types";

interface Props {
  snap: ConnSnapshot;
  mode: Mode;
  onMode: (m: Mode) => void;
  desktop: DesktopState;
  /** Şeride basınca sistem paneli — bağlantı, masaüstü izni, denetim kaydı. */
  onOpenSystem: () => void;
  bots: Bot[];
  summaries: Record<string, BotSummary>;
  selectedId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (bot: Bot) => void;
  onDelete: (bot: Bot) => void;
  refreshing: boolean;
  connError?: string;
}

export default function Sidebar({
  snap,
  mode,
  onMode,
  desktop,
  onOpenSystem,
  bots,
  summaries,
  selectedId,
  onSelect,
  onNew,
  onEdit,
  onDelete,
  refreshing,
  connError,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const liste = q
      ? bots.filter(
          (b) =>
            b.name.toLocaleLowerCase("tr-TR").includes(q) ||
            b.agent.toLocaleLowerCase("tr-TR").includes(q) ||
            b.workdir.toLocaleLowerCase("tr-TR").includes(q),
        )
      : [...bots];
    // En son hareket eden üstte — artboard'daki sıra.
    return liste.sort((a, b) => (summaries[b.id]?.at ?? b.updatedAt) - (summaries[a.id]?.at ?? a.updatedAt));
  }, [bots, query, summaries]);

  return (
    <div className="side">
      <div className="side__head">
        <span className="side__title">pcbridge</span>
        <button className="ib ib--filled" type="button" title="Yeni bot (Ctrl+N)" aria-label="Yeni bot" onClick={onNew}>
          <IconPlus />
        </button>
      </div>

      <div className="side__modes">
        <ModeSwitch mode={mode} onMode={onMode} />
      </div>

      <div className="side__search">
        <div className="field">
          <IconSearch />
          <input
            value={query}
            placeholder="Bot ara"
            aria-label="Bot ara"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="side__list">
        {bots.length === 0 && (
          <div className="side__empty">
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Henüz bot yok</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Sağ üstteki artıya bas. Bot bir ajan, model, effort ve dizin demek.
            </span>
          </div>
        )}

        {bots.length > 0 && filtered.length === 0 && (
          <div className="side__empty">
            <span className="muted" style={{ fontSize: 12.5 }}>“{query}” ile eşleşen bot yok.</span>
          </div>
        )}

        {filtered.map((b) => {
          const s = summaries[b.id];
          const secili = b.id === selectedId;
          return (
            <div
              key={b.id}
              className="row"
              role="option"
              tabIndex={0}
              aria-selected={secili}
              onClick={() => onSelect(b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(b.id);
                }
              }}
            >
              <Avatar tone={b.avatar} name={b.name} />
              <div className="row__body">
                <div className="row__top">
                  <span className="row__name" style={{ fontWeight: secili ? 600 : 500 }}>
                    {b.name}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      flex: "none",
                      color: s?.running ? "var(--run)" : "var(--text-muted)",
                    }}
                  >
                    {zaman(s?.at ?? b.updatedAt)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {s?.running && (
                    <span className="dot dot--pulse" style={{ background: "var(--run)" }} />
                  )}
                  <span className="row__sub">{altMetin(b, s)}</span>
                </div>
              </div>
              {secili && (
                <div style={{ display: "flex", gap: 2, flex: "none" }}>
                  <button
                    type="button"
                    className="ib"
                    style={{ width: 26, height: 26 }}
                    title="Düzenle"
                    aria-label={`${b.name} botunu düzenle`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(b);
                    }}
                  >
                    <IconPencil />
                  </button>
                  <button
                    type="button"
                    className="ib"
                    style={{ width: 26, height: 26 }}
                    title="Sil"
                    aria-label={`${b.name} botunu sil`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(b);
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConnStrip
        title={hostPort(snap.endpoint)}
        sub={
          connError
            ? connError
            : refreshing
              ? "tazeleniyor…"
              : `${snap.toolCount} araç · ${snap.agents.length} ajan`
        }
        ok={!connError}
        desktop={desktop}
        onClick={onOpenSystem}
      />
    </div>
  );
}

/** Şeritte kimlik host:port'tur — Main.dc.html'de yol gösterilmiyor. */
function hostPort(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function altMetin(b: Bot, s?: BotSummary): string {
  if (s?.line) return s.line;
  if (s?.running) return "koşum sürüyor…";
  if (b.jobs.length === 0) return `${b.agent}${b.model ? " · " + b.model : ""} · henüz koşum yok`;
  return `${b.jobs.length} koşum`;
}

function zaman(unix: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const simdi = new Date();
  const gun = 24 * 3600 * 1000;
  const fark = simdi.getTime() - d.getTime();
  if (d.toDateString() === simdi.toDateString()) {
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  if (fark < 2 * gun) return "dün";
  if (fark < 7 * gun) return d.toLocaleDateString("tr-TR", { weekday: "short" });
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
