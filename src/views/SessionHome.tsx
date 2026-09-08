import { useMemo, useRef, useState, type ReactNode } from "react";

import { IconClose, IconSearch } from "../ui/Icon";
import Oluk from "../ui/Oluk";
import { useFlip } from "../lib/flip";
import { locale, t } from "../lib/i18n";
import type { SessionSummary } from "../lib/types";

/** Arama kapalıyken gösterilen kart sayısı. */
const KART = 6;

interface Props {
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
 * Üç kıta: açılış sözü, besteci, önceki session'lar.
 *
 * ⚠️ `bot` propu **kaldırıldı**. Botun kimliği (ad, çip, model, dizin)
 * ana panel başlığında duruyor ve burada ikinci kez çizilmiyordu; okunmayan
 * bir prop bu depoda bir kez `Bot.desktop` olarak bir yıl yaşadı.
 */
export default function SessionHome({
  sessions,
  onOpen,
  onDelete,
  composer,
}: Props) {
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
        {/* Açılış kıtası: solda session numarası, sağda ne olduğunu söyleyen
         * tek cümle. Botun kimliği başlıkta zaten yazıyor; burada anlatılan
         * şey **session'ın kendisi** — bağlamın sınırı orası. */}
        <Oluk et={t("home.sessionNo", { n: sessions.length + 1 })}>
          <h1 className="home__baslikBuyuk">{t("home.headline")}</h1>
          <p className="home__alt">{t("home.subtitle")}</p>
        </Oluk>

        <Oluk et={t("chat.gPrompt")}>{composer}</Oluk>

        {sessions.length > 0 && (
          <Oluk et={t("home.recent")}>
              <div className="home__baslik">
                {arama === null ? (
                  <button
                    type="button"
                    className="btn-quiet"
                    title={t("home.searchSessions")}
                    onClick={() => setArama("")}
                  >
                    {t("home.searchShort")}
                  </button>
                ) : (
                  <div className="field home__ara">
                    <IconSearch />
                    <input
                      autoFocus
                      className="mono"
                      style={{ fontSize: 11 }}
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
                <div style={{ flexGrow: 1 }} />
                {arama === null && suzulmus.length > KART && (
                  <button
                    type="button"
                    className="btn-quiet"
                    onClick={() => setHepsi((h) => !h)}
                  >
                    {hepsi ? t("home.less") : t("home.more")}
                  </button>
                )}
              </div>

              {gorunen.length === 0 ? (
                <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
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
                <span className="okart__daha">
                  {t("side.moreSessions", { n: gizli })}
                </span>
              )}
          </Oluk>
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
  // Durum dar olukta, üç harf — kenar çubuğundaki session listesiyle
  // aynı kısaltmalar. İki yerde iki farklı gösterim ayrışırdı.
  const [st, sinif] = oturum.running
    ? [t("side.stRun"), "okart__st okart__st--run nabiz"]
    : oturum.status === "failed"
      ? [t("side.stErr"), "okart__st okart__st--fail"]
      : [t("side.stOk"), "okart__st"];
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
      <span className={sinif}>{st}</span>
      <span className="okart__ad">{oturum.title || t("side.untitled")}</span>
      <span className="okart__meta">
        {t("home.turns", { n: oturum.turnCount })} ·{" "}
        {oturum.running
          ? t("home.running")
          : zaman(oturum.at ?? oturum.updatedAt)}
      </span>
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
