import { useLayoutEffect, useMemo, useRef, useState } from "react";

import Avatar from "./ui/Avatar";
import ConnStrip from "./ui/ConnStrip";
import {
  IconChevron,
  IconClose,
  IconPencil,
  IconSearch,
  IconTrash,
} from "./ui/Icon";
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
  /** Listenin sonundaki "yeni bot" satırı — tasarımda başlıkta artı yok. */
  onNewBot: () => void;
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
  onNewBot,
  refreshing,
  connError,
  waiting,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const sessionPanel = useRef<HTMLDivElement>(null);
  const sessionHeight = useRef<number | null>(null);
  useLayoutEffect(
    () => gecirYukseklik(sessionHeight, sessionPanel.current, "var(--dur-base)"),
    [collapsed, selectedId],
  );

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
        (summaries[b.oge.id]?.at ?? b.oge.updatedAt) -
        (summaries[a.oge.id]?.at ?? a.oge.updatedAt),
    );
  }, [kalanlar, query, summaries, selectedId, sessions]);

  const bekleyen = waiting.length;

  return (
    <>
      {/* Arama listenin İÇİNDE: tasarımda kendi kutusu yok, altı çizili bir
       * satır ve sağında eşleşme sayısı. */}
      <div className="side__search">
        <div className="field">
          <IconSearch />
          <input
            className="mono"
            style={{ fontSize: 11 }}
            value={query}
            placeholder={t("side.sessionSearch")}
            aria-label={t("side.sessionSearch")}
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() !== "" && (
            <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {t("side.hits", { n: filtered.length })}
            </span>
          )}
        </div>
      </div>

      <div className="side__list" ref={liste}>
        {bots.length === 0 && (
          <div className="side__empty">
            <span className="h">{t("side.noBots")}</span>
            <span style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-3)" }}>
              {t("side.noBotsHint")}
            </span>
            <button type="button" className="btn-fld" onClick={onNewBot}>
              {t("side.newBotShort")}
            </button>
          </div>
        )}

        {bots.length > 0 && filtered.length === 0 && (
          <div className="side__empty">
            <span style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.7 }}>
              {t("side.noMatch", { q: query })}
            </span>
          </div>
        )}

        {filtered.map(({ oge: b, cikiyor }) => {
          const s = summaries[b.id];
          const secili = b.id === selectedId;
          const soruyor = waiting.includes(b.id);
          return (
            <div
              className="botblok"
              key={b.id}
              data-flip={b.id}
              data-cikis={cikiyor || undefined}
            >
              <div
                className="row"
                role="option"
                tabIndex={0}
                aria-selected={secili}
                onClick={() => onSelect(b.id)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelect(b.id);
                  }
                }}
              >
                <Avatar tone={b.avatar} name={b.name} />
                <span className="row__name">{b.name}</span>

                {/* Sağ künye tek bir şey söyler ve önceliği var: önce
                 * "seni bekliyor", sonra "koşuyor", yoksa session sayısı.
                 * Tasarımda üçü de aynı yerde duruyor. */}
                <span
                  className={soruyor || s?.running ? "row__mark row__mark--run" : "row__mark"}
                >
                  {soruyor
                    ? t("side.ask")
                    : s?.running
                      ? t("side.stRun")
                      : (s?.sessionCount ?? b.sessions.length)}
                </span>

                <div className="row__ops">
                  {secili && (
                    <>
                      <button
                        type="button"
                        className="ib"
                        style={{ width: 22, height: 22 }}
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
                        style={{ width: 22, height: 22 }}
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
                  <button
                    type="button"
                    className="ib"
                    style={{ width: 22, height: 22 }}
                    aria-label={t("side.toggleSessions", { name: b.name })}
                    aria-expanded={secili && !collapsed.has(b.id)}
                    aria-controls={secili ? `sessions-${b.id}` : undefined}
                    disabled={!secili}
                    onClick={(e) => {
                      e.stopPropagation();
                      olcOnce(sessionHeight, sessionPanel.current);
                      setCollapsed((previous) => {
                        const next = new Set(previous);
                        if (next.has(b.id)) next.delete(b.id);
                        else next.add(b.id);
                        return next;
                      });
                    }}
                  >
                    <IconChevron acik={secili && !collapsed.has(b.id)} />
                  </button>
                </div>
              </div>

              {/* Session listesi — yalnızca açık botta. Bot satırı **yeni**
               * session açıyor; buradaki satırlar var olanı açıyor. */}
              {secili && (
                <div
                  id={`sessions-${b.id}`}
                  ref={sessionPanel}
                  inert={collapsed.has(b.id)}
                  aria-hidden={collapsed.has(b.id)}
                  className={collapsed.has(b.id) ? "session-panel session-panel--collapsed" : "session-panel"}
                >
                  <SessionListesi
                    sessions={sessions}
                    selected={selectedSession}
                    onSelect={onSelectSession}
                    onDelete={onDeleteSession}
                    onNew={() => onSelect(b.id)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* "Yeni bot" listenin sonunda — tasarımda başlıkta artı yok. */}
        {bots.length > 0 && (
          <button type="button" className="row" onClick={onNewBot}>
            <Avatar tone={null} name="" bos />
            <span className="h" style={{ flexGrow: 1, textAlign: "left" }}>
              {t("side.newBotShort")}
            </span>
          </button>
        )}
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
        uyari={bekleyen > 0 ? t("side.waitingCount", { n: bekleyen }) : undefined}
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
  useLayoutEffect(
    () => gecirYukseklik(iz, kap.current, "var(--dur-base)"),
    [hepsi],
  );

  const gorunen = hepsi ? sessions : sessions.slice(0, ACIK_SESSION);
  const gizli = sessions.length - gorunen.length;

  return (
    <div className="oturumlist" ref={kap}>
      {gorunen.map((o) => {
        // Durum dar olukta, üç harf. Renk yalnızca durumdan geliyor.
        const [st, sinif] = o.running
          ? [t("side.stRun"), "osat__st osat__st--run"]
          : o.status === "failed"
            ? [t("side.stErr"), "osat__st osat__st--fail"]
            : [t("side.stOk"), "osat__st"];
        return (
          <div
            key={o.id}
            className="osat"
            role="option"
            tabIndex={0}
            aria-selected={o.id === selected}
            onClick={() => onSelect(o.id)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelect(o.id);
              }
            }}
          >
            <span className={o.running ? `${sinif} nabiz` : sinif}>{st}</span>
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
          {t("side.moreSessions", { n: gizli })}
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
          {t("home.less")}
        </button>
      )}

      <button
        type="button"
        className="osat osat--eylem osat--yeni"
        onClick={onNew}
      >
        {t("side.newSession")}
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
