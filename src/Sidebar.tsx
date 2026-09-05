import { useLayoutEffect, useMemo, useRef, useState } from "react";

import Avatar from "./ui/Avatar";
import ConnStrip from "./ui/ConnStrip";
import { IconChevron, IconClose, IconPencil, IconPlus, IconSearch, IconTrash } from "./ui/Icon";
import { locale, t } from "./lib/i18n";
import { useCikisListesi } from "./lib/cikis";
import { useFlip } from "./lib/flip";
import { gecirYukseklik, olcOnce, type YukseklikIzi } from "./lib/yukseklik";
import type {
  Bot,
  BotSummary,
  ConnSnapshot,
  DesktopState,
  SessionSummary,
} from "./lib/types";

/** Katlanır listede doğrudan gösterilen session sayısı. */
const ACIK_SESSION = 4;

interface Props {
  snap: ConnSnapshot;
  desktop: DesktopState;
  /** Şeride basınca sistem paneli — bağlantı, masaüstü izni, denetim kaydı. */
  onOpenSystem: () => void;
  /** Kilit rozeti — izni tek tıkla açar/kapatır. */
  onToggleDesktop: () => void;
  bots: Bot[];
  summaries: Record<string, BotSummary>;
  selectedId?: string;
  /** Bota tıklamak **yeni session** açar; son session'a dönmez. */
  onSelect: (id: string) => void;
  /** Seçili botun session'ları — yalnızca açık bot için dolu. */
  sessions: SessionSummary[];
  selectedSession?: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
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
  desktop,
  onOpenSystem,
  onToggleDesktop,
  bots,
  summaries,
  selectedId,
  onSelect,
  sessions,
  selectedSession,
  onSelectSession,
  onDeleteSession,
  onEdit,
  onDelete,
  refreshing,
  connError,
  waiting,
}: Props) {
  const [query, setQuery] = useState("");

  // Silinen bot bir karede yok olmasın. **Süzülmemiş** listeye uygulanıyor:
  // filtreyle düşen satırın beklemesi, arama kutusuna yazarken her tuşta
  // takılan bir liste demek olurdu.
  const kalanlar = useCikisListesi(bots, (b) => b.id);

  // Filtre ve silme sonrası satırlar zıplamadan yerleşsin.
  const liste = useRef<HTMLDivElement>(null);
  useFlip(liste);

  const filtered = useMemo(() => {
    const lc = locale();
    const q = query.trim().toLocaleLowerCase(lc);
    const liste = q
      ? kalanlar.filter(
          ({ oge: b }) =>
            b.name.toLocaleLowerCase(lc).includes(q) ||
            b.agent.toLocaleLowerCase(lc).includes(q) ||
            b.workdir.toLocaleLowerCase(lc).includes(q) ||
            // Seçili botun session başlıkları da aranıyor: kullanıcı işin
            // adını hatırlıyor, botunkini değil.
            (b.id === selectedId &&
              sessions.some((o) => o.title.toLocaleLowerCase(lc).includes(q))),
        )
      : [...kalanlar];
    // En son hareket eden üstte — artboard'daki sıra.
    return liste.sort(
      (a, b) =>
        (summaries[b.oge.id]?.at ?? b.oge.updatedAt) - (summaries[a.oge.id]?.at ?? a.oge.updatedAt),
    );
  }, [kalanlar, query, summaries, selectedId, sessions]);

  return (
    <>
      <div className="side__search">
        <div className="field">
          <IconSearch />
          <input
            value={query}
            placeholder={t("side.sessionSearch")}
            aria-label={t("side.sessionSearch")}
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="side__list" ref={liste}>
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

        {filtered.map(({ oge: b, cikiyor }) => {
          const s = summaries[b.id];
          const secili = b.id === selectedId;
          return (
            <div key={b.id} data-flip={b.id} data-cikis={cikiyor || undefined}>
            <div
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
              <div style={{ display: "flex", gap: 2, flex: "none", alignSelf: "center" }}>
                {secili && (
                  <>
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
                  </>
                )}
                <IconChevron acik={secili} />
              </div>
            </div>

            {/* Session listesi — yalnızca açık botta. Bot satırı **yeni**
              * session açıyor; buradaki satırlar var olanı açıyor. */}
            {secili && (
              <SessionListesi
                sessions={sessions}
                selected={selectedSession}
                onSelect={onSelectSession}
                onDelete={onDeleteSession}
                onNew={() => onSelect(b.id)}
              />
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
    </>
  );
}

/**
 * Bot satırının altındaki katlanır session listesi.
 *
 * İlk dördü doğrudan, gerisi "N session daha" ile. Açılış/kapanış yüksekliği
 * `gecirYukseklik` ile geçiyor — WebKitGTK'da `height: auto` CSS'ten
 * geçirilemiyor (bkz. `lib/yukseklik.ts`).
 */
function SessionListesi({
  sessions,
  selected,
  onSelect,
  onDelete,
  onNew,
}: {
  sessions: SessionSummary[];
  selected?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [hepsi, setHepsi] = useState(false);
  const kap = useRef<HTMLDivElement>(null);
  const iz = useRef<number | null>(null) as YukseklikIzi;

  // "N daha" açılıp kapanınca liste zıplamasın.
  useLayoutEffect(() => gecirYukseklik(iz, kap.current, "var(--dur-base)"), [hepsi]);

  const gorunen = hepsi ? sessions : sessions.slice(0, ACIK_SESSION);
  const gizli = sessions.length - gorunen.length;

  return (
    <div className="oturumlist" ref={kap}>
      {gorunen.map((o) => {
        const renk = o.running
          ? "var(--run)"
          : o.status === "failed"
            ? "var(--fail)"
            : "var(--ok)";
        return (
          <div
            key={o.id}
            className="osat"
            role="option"
            tabIndex={0}
            aria-selected={o.id === selected}
            onClick={() => onSelect(o.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(o.id);
              }
            }}
          >
            <span
              className={o.running ? "dot dot--pulse" : "dot"}
              style={{ background: renk }}
            />
            <span className="osat__ad">{o.title || t("side.untitled")}</span>
            <button
              type="button"
              className="ek__sil osat__sil"
              title={t("side.deleteSession")}
              aria-label={t("side.deleteSession")}
              disabled={o.running}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(o.id);
              }}
            >
              <IconClose size={11} />
            </button>
          </div>
        );
      })}

      {gizli > 0 && (
        <button
          type="button"
          className="osat osat--eylem"
          onClick={() => {
            olcOnce(iz, kap.current);
            setHepsi(true);
          }}
        >
          <IconChevron />
          <span>{t("side.moreSessions", { n: gizli })}</span>
        </button>
      )}
      {hepsi && sessions.length > ACIK_SESSION && (
        <button
          type="button"
          className="osat osat--eylem"
          onClick={() => {
            olcOnce(iz, kap.current);
            setHepsi(false);
          }}
        >
          <IconChevron acik />
          <span>{t("home.less")}</span>
        </button>
      )}

      <button type="button" className="osat osat--eylem osat--yeni" onClick={onNew}>
        <IconPlus size={12} color="var(--text)" />
        <span>{t("side.newSession")}</span>
      </button>
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
  // Koşum sayısı **botun** değil session'ların işi; bot satırında anlamlı
  // olan kaç iş var. Hiç yoksa botun kimliği yazılıyor.
  const sayi = s?.sessionCount ?? b.sessions.length;
  if (sayi === 0) {
    // Yerel botta ajan yok; anlamlı olan model ve kaç aracı gördüğü.
    const kimlik =
      b.backend === "yerel-model"
        ? `${b.model ?? "—"} · ${t("side.nTools", { n: b.tools.length })}`
        : `${b.agent}${b.model ? " · " + b.model : ""}`;
    return `${kimlik} · ${t("side.noSessions")}`;
  }
  return t("side.sessions", { n: sayi });
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
