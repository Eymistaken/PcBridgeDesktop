import { useMemo, useRef, useState, type ReactNode } from "react";

import Avatar from "../ui/Avatar";
import { IconClose, IconSearch } from "../ui/Icon";
import { useFlip } from "../lib/flip";
import { locale, t } from "../lib/i18n";
import type { Bot, SessionSummary } from "../lib/types";

/** Arama kapalıyken gösterilen kart sayısı. */
const KART = 6;

interface Props {
  bot: Bot;
  sessions: SessionSummary[];
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  /** Besteci — `Chat` ile aynı bileşen, çağıran kuruyor. */
  composer: ReactNode;
}

/**
 * Bota girince açılan ekran: **yeni bir session**.
 *
 * Kullanıcının kararı (2026-09-05): bota tıklamak son session'a dönmüyor,
 * boş bir ekran açıyor. Session ilk mesajla doğuyor — düğmeye basıp yazmayan
 * kullanıcı arkasında boş kayıt bırakmıyor (`bots::ensure_session`).
 *
 * Ortada besteci, altında son session kartları, yanında arama ve "daha
 * fazla göster".
 */
export default function SessionHome({ bot, sessions, onOpen, onDelete, composer }: Props) {
  const [arama, setArama] = useState<string | null>(null);
  const [hepsi, setHepsi] = useState(false);
  const izgara = useRef<HTMLDivElement>(null);
  // Süzülünce ve "daha fazla" açılınca kartlar yerlerine kaysın.
  useFlip(izgara);

  const suzulmus = useMemo(() => {
    const q = (arama ?? "").trim().toLocaleLowerCase(locale());
    if (!q) return sessions;
    return sessions.filter(
      (o) =>
        o.title.toLocaleLowerCase(locale()).includes(q) ||
        (o.line ?? "").toLocaleLowerCase(locale()).includes(q),
    );
  }, [sessions, arama]);

  // Arama açıkken hepsi görünür: süzmenin sonucunu kırpmak yanıltıcı olurdu.
  const gorunen = hepsi || arama !== null ? suzulmus : suzulmus.slice(0, KART);
  const gizli = suzulmus.length - gorunen.length;

  return (
    <div className="home">
      <div className="home__ic">
        <div className="home__selam">
          <Avatar tone={bot.avatar} name={bot.name} size={52} />
          <span className="home__ad">{bot.name}</span>
          <span className="home__alt">{t("home.subtitle")}</span>
        </div>

        {composer}

        {sessions.length > 0 && (
          <div className="home__bolum">
            <div className="home__baslik">
              <span className="baslik" style={{ flexGrow: 1 }}>
                {t("home.recent")}
              </span>
              {arama === null ? (
                <button
                  type="button"
                  className="ib"
                  style={{ width: 28, height: 28 }}
                  title={t("home.searchSessions")}
                  aria-label={t("home.searchSessions")}
                  onClick={() => setArama("")}
                >
                  <IconSearch />
                </button>
              ) : (
                <div className="field home__ara">
                  <IconSearch />
                  <input
                    autoFocus
                    value={arama}
                    placeholder={t("home.searchSessions")}
                    aria-label={t("home.searchSessions")}
                    spellCheck={false}
                    onChange={(e) => setArama(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setArama(null)}
                  />
                  <button
                    type="button"
                    className="ek__sil"
                    title={t("home.less")}
                    aria-label={t("home.less")}
                    onClick={() => setArama(null)}
                  >
                    <IconClose size={11} />
                  </button>
                </div>
              )}
              {arama === null && suzulmus.length > KART && (
                <button type="button" className="home__daha" onClick={() => setHepsi((h) => !h)}>
                  {hepsi ? t("home.less") : t("home.more")}
                </button>
              )}
            </div>

            {gorunen.length === 0 ? (
              <span className="muted" style={{ fontSize: 12.5 }}>
                {t("home.noMatch", { q: arama ?? "" })}
              </span>
            ) : (
              <div className="oturumlar" ref={izgara}>
                {gorunen.map((o) => (
                  <OturumKarti
                    key={o.id}
                    oturum={o}
                    onOpen={() => onOpen(o.id)}
                    onDelete={() => onDelete(o.id)}
                  />
                ))}
              </div>
            )}
            {arama === null && !hepsi && gizli > 0 && (
              <span className="muted" style={{ fontSize: 12 }}>
                {t("side.moreSessions", { n: gizli })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OturumKarti({
  oturum,
  onOpen,
  onDelete,
}: {
  oturum: SessionSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const renk = oturum.running
    ? "var(--run)"
    : oturum.status === "failed"
      ? "var(--fail)"
      : "var(--ok)";
  return (
    <div
      className="okart"
      data-flip={oturum.id}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="okart__ust">
        <span className="okart__ad">{oturum.title || t("side.untitled")}</span>
        <button
          type="button"
          className="ek__sil okart__sil"
          title={t("side.deleteSession")}
          aria-label={t("side.deleteSession")}
          // Süren koşumu olan session Rust'ta zaten reddediliyor; burada da
          // düğmeyi kapatmak kullanıcıyı boş bir hataya sokmuyor.
          disabled={oturum.running}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <IconClose size={11} />
        </button>
      </div>
      <span className="okart__meta">
        <span className={oturum.running ? "dot dot--pulse" : "dot"} style={{ background: renk }} />
        {t("home.turns", { n: oturum.turnCount })} ·{" "}
        {oturum.running ? t("home.running") : zaman(oturum.at ?? oturum.updatedAt)}
      </span>
      <span className="okart__son">{oturum.line || t("home.empty")}</span>
    </div>
  );
}

/** `1725540000` → `2 sa` / `dün` / `5 Eyl`. Kenar çubuğuyla aynı ölçek. */
function zaman(unix: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const simdi = new Date();
  const fark = simdi.getTime() - d.getTime();
  const lc = locale();
  if (d.toDateString() === simdi.toDateString()) {
    return d.toLocaleTimeString(lc, { hour: "2-digit", minute: "2-digit" });
  }
  if (fark < 7 * 24 * 3600 * 1000) {
    return d.toLocaleDateString(lc, { weekday: "short" });
  }
  return d.toLocaleDateString(lc, { day: "numeric", month: "short" });
}
