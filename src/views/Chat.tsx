import { memo, useEffect, useMemo, useRef, useState } from "react";

import Avatar from "../ui/Avatar";
import Composer from "../ui/Composer";
import CtxMenu, { UYARI } from "../ui/CtxMenu";
import Markdown from "../ui/Markdown";
import PermAsk from "../ui/PermAsk";
import { useCikis, useCikisIcerik } from "../lib/cikis";
import { useAkisMaskesi } from "../lib/akis";
import PermMenu from "../ui/PermMenu";
import Picker from "../ui/Picker";
import Thinking from "../ui/Thinking";
import { IconCheck, IconCross, IconExport, IconStop } from "../ui/Icon";
import { toBlocks, finishedOf, type Block } from "../lib/timeline";
import { locale, t, toolVerb } from "../lib/i18n";
import { detailText } from "../lib/ipc";
import { kisaltEv } from "../lib/yol";
import type {
  Bot,
  PendingPermission,
  Permission,
  RunCtx,
  Turn,
} from "../lib/types";

interface Props {
  bot: Bot;
  turns: Turn[];
  /** Süren işin kimliği — yoksa şerit çizilmez. */
  running?: { jobId: string; startedAt: number | null; label: string };
  busy: boolean;
  error?: string;
  onSend: (text: string) => void;
  onCancel: (jobId: string) => void;
  /** Açık session'ın kimliği — besteci sıfırlaması buna bakıyor. */
  sessionId: string;
  /** Bu botun kaç session'ı var — başlıktaki sayaç. */
  sessionCount: number;
  /** Bu **session** için yanıt bekleyen izin isteği — yoksa kart çizilmez. */
  pending?: PendingPermission;
  onAnswer: (runId: string, allow: boolean) => void;
  /** Kip **botun kendi alanı**; menü onu doğrudan yazar. */
  onPermission: (p: Permission) => void;
  /** "Ben makinedeyken de çalışsın" — o da botun kendi alanı. */
  onForce: (v: boolean) => void;
  /** Son bağlam ölçümü; `null` → yerel koşum yok ya da eski arka uç. */
  ctx: RunCtx | null;
  /** Anlık üretim hızı (token/sn); koşum yokken `null`. */
  tps: number | null;
  /** Model sunucusunun adresi — menüde yerel/bulut ayrımı için. */
  baseUrl: string;
  /** Özetleme şu an çalışıyor mu (`job://compacting`). */
  compacting: boolean;
  onCompact: () => void;
  /** Effort **botun kendi alanı**; seçici onu doğrudan yazar. */
  efforts: string[];
  onEffort: (e: string) => void;
  /** Kip menüsündeki sayaçtan bot ayarlarına geçiş. */
  onEditBot: () => void;
  /** Sohbeti JSON olarak diske yazar. */
  onExport: () => void;
}

export default function Chat({
  bot,
  turns,
  running,
  busy,
  error,
  sessionId,
  sessionCount,
  onSend,
  onCancel,
  pending,
  onAnswer,
  onPermission,
  onForce,
  ctx,
  tps,
  baseUrl,
  compacting,
  onCompact,
  efforts,
  onEffort,
  onEditBot,
  onExport,
}: Props) {
  const kaydiran = useRef<HTMLDivElement>(null);
  const altlik = useRef<HTMLDivElement>(null);

  /**
   * Yüzen altlığın **ölçülen** yüksekliğini panele yazar.
   *
   * Besteci, koşum şeridi ve izin kartı sohbetin üstünde yüzüyor; sohbetin
   * alt dolgusu ve kenar maskesi bu sayıyı okuyor (`--besteci-h`). Sabit bir
   * tahmin yetmezdi: yükseklik ek çipleriyle, çok satırla ve şeritlerin
   * gelip gitmesiyle değişiyor.
   */
  useEffect(() => {
    const el = altlik.current;
    const kap = kaydiran.current;
    const panel = el?.closest(".main") as HTMLElement | null;
    if (!el || !kap || !panel) return;

    /*
     * ⚠️ **Besteci büyüyünce sohbet dibe geri çekilmeli.**
     *
     * Ölçüldü (WebKitGTK): dört satır yazınca altlık 103 → 213 px'e çıkıyor,
     * `.chat`'in alt dolgusu da o kadar büyüyor ama kaydırma konumu yerinde
     * kalıyordu — son baloncuk bestecinin **136 px arkasına** giriyordu.
     *
     * Dip takibi bir dinleyiciyle: kullanıcı yukarı kaydırmışsa geri
     * çekilmiyoruz (okuduğu yerden koparmak olurdu), yalnızca zaten diptekiyse.
     */
    const dipte = { current: true };
    const dipIzle = () => {
      dipte.current = kap.scrollHeight - kap.scrollTop - kap.clientHeight < 8;
    };
    kap.addEventListener("scroll", dipIzle, { passive: true });

    const yaz = () => {
      panel.style.setProperty(
        "--besteci-h",
        `${Math.round(el.offsetHeight)}px`,
      );
      if (dipte.current) kap.scrollTop = kap.scrollHeight;
    };
    yaz();
    const gozcu = new ResizeObserver(yaz);
    gozcu.observe(el);
    return () => {
      gozcu.disconnect();
      kap.removeEventListener("scroll", dipIzle);
      panel.style.removeProperty("--besteci-h");
    };
  }, []);

  // Besteci üstündeki üç şerit de kapanırken bir karede yok oluyordu.
  // İzin sorusu ve koşum şeridi **içeriğini de** korumak zorunda: yanıt
  // verilir verilmez `pending` düşüyor ve kart boşalırdı.
  const {
    icerik: kosum,
    render: kosumVar,
    cikiyor: kosumCikiyor,
  } = useCikisIcerik(running);
  const {
    icerik: izin,
    render: izinVar,
    cikiyor: izinCikiyor,
  } = useCikisIcerik(pending);
  const { render: ozetVar, cikiyor: ozetCikiyor } = useCikis(compacting);

  /**
   * Yeni içerik gelince dibe kay.
   *
   * Üç durumda **ani**, yalnızca birinde yumuşak:
   *
   * 1. ⚠️ **Sohbet ilk gösterildiğinde.** Kip anahtarından dönmek `Chat`'i
   *    yeniden kuruyor; yumuşak kaydırma o anda "geçmişin içinde hızla aşağı
   *    süzülme" gibi görünüyordu. Görüntü **en altta başlamalı**, oraya
   *    inmemeli. Session değişimi de aynı: yeni sohbet dibinden açılır.
   * 2. **Akış sürerken.** Bu etki her token'da çalışıyor; `smooth` her
   *    seferinde yeni bir kaydırma isteği kuyruğa koyup bir öncekini keser ve
   *    liste dibe hiç yetişemez.
   * 3. Hareket azaltılmışken.
   *
   * Geriye kalan: **açık duran bir sohbete yeni bir tur eklenmesi.** Yumuşak
   * olması gereken tek durum o.
   */
  const sonOturum = useRef<string>("");
  const sonTurSayisi = useRef(0);
  /**
   * Bu sohbet **kurulduğunda** kaç tur vardı.
   *
   * Bundan sonrası "yeni" sayılıyor ve giriş devinimini oynatıyor; mount'ta
   * gelen geçmiş animasyonsuz oturuyor.
   */
  const mountTurSayisi = useRef<number>(-1);
  if (mountTurSayisi.current < 0 && turns.length > 0) {
    mountTurSayisi.current = turns.length;
  }
  useEffect(() => {
    /*
     * ⚠️ **Ölçüt session, bot değil — ve ref'ler gerçekten sıfırlanıyor.**
     *
     * Eski hata zinciri: `Shell` bot değişiminde `turns`'ü temizlemiyordu,
     * o yüzden seçim anındaki ilk koşumda `turns` hâlâ **önceki** botundu
     * ve `sonTurSayisi`'na onun sayısı yazılıyordu. Geçmiş gelince ikinci
     * koşum "aynı bot, zaten doluydu, tur eklendi" diye okuyor ve yumuşak
     * kaydırma yapıyordu — sohbet eski mesajların içinden aşağı süzülüyordu.
     * Kullanıcı bunu iki kez bildirdi.
     *
     * `Shell` artık `turns`'ü boşaltıyor (Aşama 14) ve burada da ölçüt
     * session kimliği: session değişince sayaç sıfırlanıyor, yani "zaten
     * doluydu" bir sonraki sohbete taşınamıyor.
     */
    const ayniOturum = sonOturum.current === sessionId;
    if (!ayniOturum) sonTurSayisi.current = 0;
    /*
     * ⚠️ **Bot değişimini "bot kimliği değişti mi" ile ölçmek yetmiyor.**
     * İlk düzeltmede öyleydi ve hata sürdü: bota geçildiği anda `turns`
     * hâlâ **boş** oluyor (geçmiş `botHistory` ile sonradan geliyor). Yani
     * ilk çalıştırma boş listede oluyor, geçmiş dolunca etki **ikinci** kez
     * çalışıyor ve o çalıştırma artık "aynı bot" sayıldığı için yumuşak
     * kalıyordu — sohbet yukarıdan aşağıya süzülüyordu, kullanıcı bunu iki
     * kez bildirdi.
     *
     * Ölçüt bu yüzden **içerik**: yumuşak kaydırma yalnızca *zaten dolu
     * olduğunu gördüğümüz* bir sohbete tur eklenince. Geçmişin ilk kez
     * yerleşmesi bir "ekleme" değil, sohbetin açılışıdır.
     */
    const zatenDoluydu = ayniOturum && sonTurSayisi.current > 0;
    const turEklendi = turns.length > sonTurSayisi.current;
    sonOturum.current = sessionId;
    sonTurSayisi.current = turns.length;

    const yumusak =
      zatenDoluydu &&
      turEklendi &&
      !running &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /*
     * ⚠️ **Kabın kendisi kaydırılıyor, işaretçi `scrollIntoView` ile değil.**
     *
     * Eski yol dipteki sıfır yükseklikli işaretçiyi kabın alt kenarına
     * hizalıyordu — ama besteci artık sohbetin **üstünde yüzüyor** ve
     * `.chat` onun için bir alt dolgu ayırıyor. İşaretçi kenara oturunca o
     * dolgu görünürün dışında kalıyor ve son mesaj bestecinin arkasına
     * giriyordu. Ölçüldü: `scrollTop` en fazlanın tam **117 px** (dolgunun
     * kendisi kadar) altında kalıyordu.
     *
     * Dibe kaydırmak dolguyu da tüketiyor; son mesaj bestecinin üstünde
     * duruyor.
     */
    const el = kaydiran.current;
    if (!el) return;
    if (yumusak) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, [turns, running, sessionId]);

  return (
    <>
      <div className="main__head">
        <Avatar tone={bot.avatar} name={bot.name} size={26} />
        <span
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          {bot.name}
        </span>
        <span className="mono muted" style={{ fontSize: 12 }}>
          {[
            bot.model,
            // Yerel botta effort yok; onun yerinde kaç araç gördüğü duruyor.
            bot.backend === "yerel-model"
              ? t("side.nTools", { n: bot.tools.length })
              : bot.effort,
            kisaltEv(bot.workdir),
            sessionCount > 1 ? t("side.sessions", { n: sessionCount }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <div style={{ flexGrow: 1 }} />
        <button
          type="button"
          className="ib"
          title={t("chat.export")}
          aria-label={t("chat.export")}
          disabled={turns.length === 0}
          onClick={onExport}
        >
          <IconExport />
        </button>
      </div>

      <div className="chat" ref={kaydiran}>
        {turns.length === 0 && !running && (
          <div className="chat__bos">
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {t("chat.empty")}
            </span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              {t("chat.emptyHint")}
            </span>
          </div>
        )}

        {turns.map((tur, i) => (
          <TurnView
            key={tur.jobId}
            turn={tur}
            live={running?.jobId === tur.jobId}
            // ⚠️ Giriş devinimi **yalnızca sonradan eklenen** tura.
            // Eskiden `.bub`'un hepsi koşulsuz oynuyordu: sohbet her
            // kurulduğunda (kip anahtarı, session takası) geçmişin
            // tamamı aynı anda animasyon başlatıyordu.
            yeni={i >= mountTurSayisi.current}
          />
        ))}

        {error && (
          <div
            className="bub"
            style={{ background: "var(--field)", color: "var(--fail)" }}
          >
            {error}
          </div>
        )}
      </div>

      <div className="altlik" ref={altlik}>
        {kosumVar && kosum && (
          <div className="jobstrip" data-cikis={kosumCikiyor || undefined}>
            <div className="jobstrip__box">
              <span
                className="dot dot--pulse"
                style={{ background: "var(--run)" }}
              />
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {kosum.label}
              </span>
              <span
                className="mono muted"
                style={{ fontSize: 12, flex: "none" }}
              >
                {kosum.jobId}
              </span>
              <div style={{ flexGrow: 1 }} />
              <Elapsed startedAt={kosum.startedAt} />
              <button
                type="button"
                className="ib"
                title={t("chat.stop")}
                aria-label={t("chat.stop")}
                style={{ width: 30, height: 30, background: "var(--surface)" }}
                onClick={() => onCancel(kosum.jobId)}
              >
                <IconStop />
              </button>
            </div>
          </div>
        )}

        {ozetVar && (
          <div className="jobstrip" data-cikis={ozetCikiyor || undefined}>
            <div className="jobstrip__box">
              <span
                className="dot dot--pulse"
                style={{ background: "var(--run)" }}
              />
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                {t("ctx.compacting")}
              </span>
            </div>
          </div>
        )}

        {izinVar && izin && (
          <PermAsk
            istek={izin}
            cikiyor={izinCikiyor}
            botName={bot.name}
            onAnswer={(allow) => onAnswer(izin.runId, allow)}
          />
        )}

        <Composer
          botName={bot.name}
          workdir={bot.workdir}
          busy={busy}
          resetKey={`${bot.id}:${sessionId}`}
          onSend={onSend}
          foot={
            <>
              <PermMenu
                value={bot.permission}
                botName={bot.name}
                tools={bot.tools}
                force={bot.forceWhenBusy}
                onChange={onPermission}
                onForce={onForce}
                onEditTools={onEditBot}
              />

              <div style={{ flexGrow: 1 }} />

              {/* %90'da öneri. Menüyü açmadan görünmeli: kullanıcı bağlamın
               * dolduğunu fark etmeden koşum başlatıyordu. */}
              {ctx &&
                bot.backend === "yerel-model" &&
                bot.contextBudget > 0 &&
                ctx.promptTokens / bot.contextBudget >= UYARI &&
                !busy &&
                !running &&
                !compacting && (
                  <button
                    type="button"
                    className="ctxoneri"
                    onClick={onCompact}
                  >
                    {t("ctx.suggest")}
                  </button>
                )}

              {/* Effort yalnızca eski yolda var; yerel modelde böyle bir kavram
               * yok. `PermMenu` deseni: botun kendi alanını yazıyor. */}
              {bot.backend === "pcbridge-agent" && efforts.length > 0 && (
                <Picker
                  chip
                  up
                  value={bot.effort ?? ""}
                  options={efforts.map((e) => ({ value: e, label: e }))}
                  placeholder={t("forge.effort")}
                  ariaLabel={t("forge.effort")}
                  onChange={onEffort}
                />
              )}

              <CtxMenu
                model={bot.model}
                budget={bot.contextBudget}
                // Doluluk yalnızca yerel modelde ölçülüyor: `agent_run` yolunda
                // koşumu pcbridge yürütüyor ve `usage` bize hiç gelmiyor.
                ctx={bot.backend === "yerel-model" ? ctx : null}
                busy={busy || !!running}
                tps={running ? tps : null}
                baseUrl={baseUrl}
                // Eski yolda modeli bir CLI yürütüyor ve o buluta gidiyor.
                agent={bot.backend === "pcbridge-agent" ? bot.agent : undefined}
                compacting={compacting}
                onCompact={onCompact}
              />
            </>
          }
        />
      </div>
    </>
  );
}

/**
 * Kullanıcı durdurduysa bu bir hata değil. Sinyalle ölen süreç 128+sinyal
 * döner: 130 SIGINT, 143 SIGTERM, 137 SIGKILL — `job_cancel`'ın bıraktığı iz.
 */
function durduruldu(turn: Turn): boolean {
  if (turn.meta.status === "cancelled") return true;
  const c = turn.meta.exitCode;
  return c === 130 || c === 143 || c === 137;
}

/**
 * ⚠️ **`memo`** — `Markdown`'la aynı gerekçe. Akıştaki her parça `turns`
 * dizisini yeniliyor ama **yalnızca bir turun** nesnesi değişiyor; ötekiler
 * kimliklerini koruyor. Memo olmadan hepsi yeniden çiziliyordu.
 */
const TurnView = memo(TurnViewIc);

function TurnViewIc({
  turn,
  live,
  yeni,
}: {
  turn: Turn;
  live: boolean;
  yeni: boolean;
}) {
  const blocks = useMemo(() => toBlocks(turn.events), [turn.events]);
  const bitis = finishedOf(turn.events);
  const kesildi = durduruldu(turn);

  // `data-yeni` giriş devinimini tetikliyor — bkz. `app.css` "devinim".
  const y = yeni || undefined;
  return (
    <>
      {turn.meta.startedAt && (
        <span className="ts" data-yeni={y}>
          {saat(turn.meta.startedAt)}
        </span>
      )}

      {turn.prompt && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            className="bub"
            data-yeni={y}
            style={{ background: "var(--surface-2)", whiteSpace: "pre-wrap" }}
          >
            {turn.prompt}
          </div>
        </div>
      )}

      {blocks.map((b, i) => (
        // Yalnızca **süren** turun **son** bloğu canlı: akış orada.
        <BlockView
          key={i}
          block={b}
          live={live && i === blocks.length - 1}
          yeni={yeni}
        />
      ))}

      {kesildi ? (
        <span className="ts" data-yeni={y}>
          {t("chat.stopped")}
        </span>
      ) : (
        bitis &&
        !bitis.ok && (
          <div style={{ display: "flex" }}>
            <div
              className="bub"
              data-yeni={y}
              style={{ background: "var(--surface)", color: "var(--fail)" }}
            >
              {bitis.error ?? t("chat.failed")}
            </div>
          </div>
        )
      )}
    </>
  );
}

/**
 * Ajanın metni. Markdown olarak çiziliyor: model kalın yazmaya, liste ve
 * tablo kurmaya çalışıyor ve ham `**` ekranda duruyordu.
 *
 * Akış sürerken metnin ucu maskeyle soluk kalıyor — `useAkisMaskesi`.
 * Sarmalayıcı `<div>` **balonun içinde**: maske `.bub`'a konsaydı zemini de
 * maskelerdi ve baloncukta saydam bir çentik açılırdı.
 */
function MetinBloku({
  text,
  live,
  yeni,
}: {
  text: string;
  live: boolean;
  yeni?: boolean;
}) {
  const kap = useRef<HTMLDivElement>(null);
  useAkisMaskesi(kap, text, live);
  return (
    <div style={{ display: "flex" }}>
      <div
        className="bub"
        data-yeni={yeni || undefined}
        style={{ background: "var(--surface)" }}
      >
        <div ref={kap} className={live ? "akis--canli" : undefined}>
          <Markdown text={text} />
        </div>
      </div>
    </div>
  );
}

function BlockView({
  block,
  live,
  yeni,
}: {
  block: Block;
  live: boolean;
  yeni: boolean;
}) {
  const y = yeni || undefined;
  if (block.t === "text") {
    return <MetinBloku text={block.text} live={live} yeni={yeni} />;
  }

  if (block.t === "thinking") {
    return <Thinking text={block.text} ms={block.ms} live={live} yeni={yeni} />;
  }

  if (block.t === "raw") {
    return (
      <div style={{ display: "flex" }}>
        <pre className="bub mono well" data-yeni={y}>
          {block.text}
        </pre>
      </div>
    );
  }

  // Bağlam özeti. Sessizce olmaz: özetleme fazladan bir model koşumu ve
  // geçmişin bir kısmının atılması demek — ikisi de görünür olmalı.
  if (block.t === "summary") {
    // İki durum da metin değil **kod** taşır ve `err.*` sözlüğünden çözülür.
    const basarisiz = block.text.startsWith("#");
    return (
      <div style={{ display: "flex" }}>
        <div
          className="bub muted"
          data-yeni={y}
          style={{
            background: "var(--surface)",
            whiteSpace: "pre-wrap",
            fontSize: 13,
            borderLeft: "2px solid var(--line)",
            borderTopLeftRadius: 6,
            borderBottomLeftRadius: 6,
          }}
        >
          {block.dropped > 0 && (
            <div style={{ fontWeight: 600, marginBottom: basarisiz ? 0 : 6 }}>
              {t("chat.summarized", { n: block.dropped })}
            </div>
          )}
          {basarisiz ? null : block.text}
          {basarisiz && (
            <div style={{ color: "var(--fail)", marginTop: 6 }}>
              {detailText(block.text)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Döküm baloncuğu — referansın imza hamlesi.
  return (
    <div style={{ display: "flex" }}>
      <div className="bub bub--dokum" data-yeni={y}>
        {block.rows.map((r, i) => (
          <div key={r.id + i} className="dokum__row">
            {r.state === "ok" && <IconCheck />}
            {r.state === "fail" && <IconCross />}
            {r.state === "run" && (
              <span
                className="dot dot--pulse"
                style={{ background: "var(--run)", margin: "0 3.5px" }}
              />
            )}
            <span
              style={{
                fontWeight: 600,
                width: 78,
                flex: "none",
                color: r.state === "run" ? "var(--run)" : undefined,
              }}
            >
              {r.state === "run" ? t("chat.runningVerb") : toolVerb(r.tool)}
            </span>
            <span className="mono muted dokum__detail">{r.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Elapsed({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return null;
  const sn = Math.max(0, Math.floor(now - startedAt));
  return (
    <span
      className="mono"
      style={{ fontSize: 13, color: "var(--run)", flex: "none" }}
    >
      {Math.floor(sn / 60)}:{String(sn % 60).padStart(2, "0")}
    </span>
  );
}

function saat(unix: number): string {
  const d = new Date(unix * 1000);
  const bugun = new Date();
  const ayniGun = d.toDateString() === bugun.toDateString();
  const lc = locale();
  const hhmm = d.toLocaleTimeString(lc, { hour: "2-digit", minute: "2-digit" });
  return ayniGun
    ? hhmm
    : `${d.toLocaleDateString(lc, { day: "numeric", month: "short" })} ${hhmm}`;
}
