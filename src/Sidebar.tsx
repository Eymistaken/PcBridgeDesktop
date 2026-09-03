import { useMemo, useState } from "react";

import Avatar from "./ui/Avatar";
import ConnStrip from "./ui/ConnStrip";
import ModeSwitch from "./ui/ModeSwitch";
import { IconPencil, IconPlus, IconSearch, IconTrash } from "./ui/Icon";
import { locale, t } from "./lib/i18n";
import type { Bot, BotSummary, ConnSnapshot, DesktopState, Mode } from "./lib/types";

interface Props {
  snap: ConnSnapshot;
  mode: Mode;
  onMode: (m: Mode) => void;
  desktop: DesktopState;
  /** Şeride basınca sistem paneli — bağlantı, masaüstü izni, denetim kaydı. */
  onOpenSystem: () => void;
  /** Kilit rozeti — izni tek tıkla açar/kapatır. */
  onToggleDesktop: () => void;
  bots: Bot[];
  summaries: Record<string, BotSummary>;
  selectedId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (bot: Bot) => void;
  onDelete: (bot: Bot) => void;
  refreshing: boolean;
  connError?: string;
  /**
   * İzin yanıtı bekleyen botların kimlikleri.
   *
   * **Gerekli:** bekleyen koşum süresiz bekliyor ve soru yalnızca o botun
   * sohbetinde görünüyor. Başka bir bota bakan kullanıcı, sorulduğunu hiç
   * göremeden koşumun asılı kalmasını izlerdi.
   */
  waiting: string[];
}

export default function Sidebar({
  snap,
  mode,
  onMode,
  desktop,
  onOpenSystem,
  onToggleDesktop,
  bots,
  summaries,
  selectedId,
  onSelect,
  onNew,
  onEdit,
  onDelete,
  refreshing,
  connError,
  waiting,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const lc = locale();
    const q = query.trim().toLocaleLowerCase(lc);
    const liste = q
      ? bots.filter(
          (b) =>
            b.name.toLocaleLowerCase(lc).includes(q) ||
            b.agent.toLocaleLowerCase(lc).includes(q) ||
            b.workdir.toLocaleLowerCase(lc).includes(q),
        )
      : [...bots];
    // En son hareket eden üstte — artboard'daki sıra.
    return liste.sort((a, b) => (summaries[b.id]?.at ?? b.updatedAt) - (summaries[a.id]?.at ?? a.updatedAt));
  }, [bots, query, summaries]);

  return (
    <div className="side">
      <div className="side__head">
        <span className="side__title">pcbridge</span>
        <button className="ib ib--filled" type="button" title={t("side.newBotTitle")} aria-label={t("side.newBot")} onClick={onNew}>
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
            placeholder={t("side.search")}
            aria-label={t("side.search")}
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="side__list">
        {bots.length === 0 && (
          <div className="side__empty">
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("side.noBots")}</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {t("side.noBotsHint")}
            </span>
          </div>
        )}

        {bots.length > 0 && filtered.length === 0 && (
          <div className="side__empty">
            <span className="muted" style={{ fontSize: 12.5 }}>{t("side.noMatch", { q: query })}</span>
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
                  <span className="row__sub">
                    {waiting.includes(b.id) ? t("side.waitingPermission") : altMetin(b, s)}
                  </span>
                </div>
              </div>
              {secili && (
                <div style={{ display: "flex", gap: 2, flex: "none", alignSelf: "center" }}>
                  <button
                    type="button"
                    className="ib"
                    style={{ width: 30, height: 30 }}
                    title={t("side.edit")}
                    aria-label={t("side.editBot", { name: b.name })}
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
                    style={{ width: 30, height: 30 }}
                    title={t("side.delete")}
                    aria-label={t("side.deleteBot", { name: b.name })}
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
              ? t("side.refreshing")
              : sayilar(snap.toolCount, snap.agents.length)
        }
        ok={!connError}
        desktop={desktop}
        onClick={onOpenSystem}
        onToggleDesktop={onToggleDesktop}
      />
    </div>
  );
}

/** `33 araç · 2 ajan`. İki parça ayrı çekimleniyor. */
export function sayilar(tools: number, agents: number): string {
  return `${t("side.toolCount", { n: tools })} · ${t("side.agentCount", { n: agents })}`;
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
  if (s?.running) return t("side.running");
  if (b.jobs.length === 0) {
    // Yerel botta ajan yok; anlamlı olan model ve kaç aracı gördüğü.
    const kimlik =
      b.backend === "yerel-model"
        ? `${b.model ?? "—"} · ${t("side.nTools", { n: b.tools.length })}`
        : `${b.agent}${b.model ? " · " + b.model : ""}`;
    return `${kimlik} · ${t("side.noRuns")}`;
  }
  return t("side.runs", { n: b.jobs.length });
}

function zaman(unix: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const simdi = new Date();
  const gun = 24 * 3600 * 1000;
  const fark = simdi.getTime() - d.getTime();
  const lc = locale();
  if (d.toDateString() === simdi.toDateString()) {
    return d.toLocaleTimeString(lc, { hour: "2-digit", minute: "2-digit" });
  }
  if (fark < 2 * gun) return t("side.yesterday");
  if (fark < 7 * gun) return d.toLocaleDateString(lc, { weekday: "short" });
  return d.toLocaleDateString(lc, { day: "numeric", month: "short" });
}
