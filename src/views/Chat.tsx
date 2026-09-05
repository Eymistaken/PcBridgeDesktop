import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import Avatar from "../ui/Avatar";
import CtxMenu, { UYARI } from "../ui/CtxMenu";
import Markdown from "../ui/Markdown";
import PermAsk from "../ui/PermAsk";
import { useCikis, useCikisIcerik, useCikisListesi } from "../lib/cikis";
import { useAkisMaskesi } from "../lib/akis";
import PermMenu from "../ui/PermMenu";
import Picker from "../ui/Picker";
import Thinking from "../ui/Thinking";
import {
  IconAttach,
  IconCheck,
  IconClose,
  IconCross,
  IconExport,
  IconSend,
  IconStop,
} from "../ui/Icon";
import { toBlocks, finishedOf, type Block } from "../lib/timeline";
import { locale, t, toolVerb } from "../lib/i18n";
import { detailText } from "../lib/ipc";
import type { Bot, PendingPermission, Permission, RunCtx, Turn } from "../lib/types";

interface Props {
  bot: Bot;
  turns: Turn[];
  /** Süren işin kimliği — yoksa şerit çizilmez. */
  running?: { jobId: string; startedAt: number | null; label: string };
  busy: boolean;
  error?: string;
  onSend: (text: string) => void;
  onCancel: (jobId: string) => void;
  /** Bu bot için yanıt bekleyen izin isteği — yoksa kart çizilmez. */
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
  const [text, setText] = useState("");
  const [ekler, setEkler] = useState<string[]>([]);
  const dip = useRef<HTMLDivElement>(null);
  const alan = useRef<HTMLTextAreaElement>(null);

  // Besteci üstündeki üç şerit de kapanırken bir karede yok oluyordu.
  // İzin sorusu ve koşum şeridi **içeriğini de** korumak zorunda: yanıt
  // verilir verilmez `pending` düşüyor ve kart boşalırdı.
  const { icerik: kosum, render: kosumVar, cikiyor: kosumCikiyor } = useCikisIcerik(running);
  const { icerik: izin, render: izinVar, cikiyor: izinCikiyor } = useCikisIcerik(pending);
  const { render: ozetVar, cikiyor: ozetCikiyor } = useCikis(compacting);
  // Kaldırılan ek çipi de solarak gitsin.
  const ekListesi = useCikisListesi(ekler, (yol) => yol);

  /**
   * Yeni içerik gelince dibe kay.
   *
   * Üç durumda **ani**, yalnızca birinde yumuşak:
   *
   * 1. ⚠️ **Sohbet ilk gösterildiğinde.** Kip anahtarından dönmek `Chat`'i
   *    yeniden kuruyor; yumuşak kaydırma o anda "geçmişin içinde hızla aşağı
   *    süzülme" gibi görünüyordu. Görüntü **en altta başlamalı**, oraya
   *    inmemeli. Bot değişimi de aynı: yeni sohbet dibinden açılır.
   * 2. **Akış sürerken.** Bu etki her token'da çalışıyor; `smooth` her
   *    seferinde yeni bir kaydırma isteği kuyruğa koyup bir öncekini keser ve
   *    liste dibe hiç yetişemez.
   * 3. Hareket azaltılmışken.
   *
   * Geriye kalan: **açık duran bir sohbete yeni bir tur eklenmesi.** Yumuşak
   * olması gereken tek durum o.
   */
  const sonBot = useRef<string>("");
  useEffect(() => {
    const ilkGosterim = sonBot.current !== bot.id;
    sonBot.current = bot.id;
    const yumusak =
      !ilkGosterim && !running && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dip.current?.scrollIntoView({ block: "end", behavior: yumusak ? "smooth" : "auto" });
  }, [turns, running, bot.id]);

  // Bot değişince yarım kalan metin ve ekler karışmasın.
  useEffect(() => {
    setText("");
    setEkler([]);
  }, [bot.id]);

  // Yazdıkça büyüyen alan. Önce sıfırla, sonra ölç: aksi hâlde küçülmez.
  useEffect(() => {
    const el = alan.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  /**
   * Ek = **yol**, kopya değil. Ajan aynı makinede çalışıyor; dosyayı bir
   * yere yüklemenin anlamı yok, mutlak yolu vermek yeter — ajan kendi
   * `Read` aracıyla açar. Yollar prompt'a görünür biçimde ekleniyor:
   * kullanıcı ne gönderdiğini kendi baloncuğunda okuyabilsin.
   */
  async function dosyaSec() {
    const secilen = await open({
      multiple: true,
      title: t("chat.pickFiles"),
      defaultPath: bot.workdir || undefined,
    }).catch(() => null);
    if (!secilen) return;
    const yollar = Array.isArray(secilen) ? secilen : [secilen];
    setEkler((eski) => [...eski, ...yollar.filter((y) => !eski.includes(y))]);
    alan.current?.focus();
  }

  function gonder() {
    const metin = text.trim();
    if (!metin || busy) return;
    onSend(
      ekler.length > 0 ? `${metin}\n\n${t("chat.attached")}\n${ekler.join("\n")}` : metin,
    );
    setText("");
    setEkler([]);
  }

  return (
    <>
      <div className="main__head">
        <Avatar tone={bot.avatar} name={bot.name} size={26} />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{bot.name}</span>
        <span className="mono muted" style={{ fontSize: 12 }}>
          {[
            bot.model,
            // Yerel botta effort yok; onun yerinde kaç araç gördüğü duruyor.
            bot.backend === "yerel-model"
              ? t("side.nTools", { n: bot.tools.length })
              : bot.effort,
            kisaltEv(bot.workdir),
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

      <div className="chat">
        {turns.length === 0 && !running && (
          <div className="chat__bos">
            <span style={{ fontSize: 14, fontWeight: 500 }}>{t("chat.empty")}</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              {t("chat.emptyHint")}
            </span>
          </div>
        )}

        {turns.map((tur) => (
          <TurnView key={tur.jobId} turn={tur} live={running?.jobId === tur.jobId} />
        ))}

        {error && (
          <div className="bub" style={{ background: "var(--field)", color: "var(--fail)" }}>
            {error}
          </div>
        )}
        <div ref={dip} />
      </div>

      {kosumVar && kosum && (
        <div className="jobstrip" data-cikis={kosumCikiyor || undefined}>
          <div className="jobstrip__box">
            <span className="dot dot--pulse" style={{ background: "var(--run)" }} />
            <span style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {kosum.label}
            </span>
            <span className="mono muted" style={{ fontSize: 12, flex: "none" }}>
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
            <span className="dot dot--pulse" style={{ background: "var(--run)" }} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("ctx.compacting")}</span>
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

      <div className="composer">
        {ekler.length > 0 && (
          <div className="ekler">
            {ekListesi.map(({ oge: yol, cikiyor }) => (
              <span key={yol} className="ek" data-cikis={cikiyor || undefined} title={yol}>
                <IconAttach size={13} color="var(--text-muted)" />
                <span className="mono ek__ad">{dosyaAdi(yol)}</span>
                <button
                  type="button"
                  className="ek__sil"
                  title={t("chat.removeAttachment")}
                  aria-label={t("chat.removeNamed", { name: dosyaAdi(yol) })}
                  onClick={() => setEkler((e) => e.filter((x) => x !== yol))}
                >
                  <IconClose size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="composer__box">
          <button
            type="button"
            className="ib"
            style={{ width: 36, height: 36, background: "var(--surface)" }}
            title={t("chat.attach")}
            aria-label={t("chat.attach")}
            onClick={() => void dosyaSec()}
          >
            <IconAttach color="var(--text-muted)" />
          </button>
          <textarea
            ref={alan}
            className="composer__text"
            rows={1}
            value={text}
            placeholder={t("chat.write", { name: bot.name })}
            aria-label={t("chat.write", { name: bot.name })}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter ve Ctrl+Enter gönderir; Shift+Enter satır atlar.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                gonder();
              }
            }}
          />
          <button
            type="button"
            className="ib composer__send"
            title={t("chat.send")}
            aria-label={t("chat.send")}
            disabled={busy || !text.trim()}
            onClick={gonder}
          >
            <IconSend />
          </button>
        </div>
        <div className="composer__foot">
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
              <button type="button" className="ctxoneri" onClick={onCompact}>
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
        </div>
      </div>
    </>
  );
}

/** `/home/x/rapor.md` → `rapor.md` */
function dosyaAdi(yol: string): string {
  const i = yol.lastIndexOf("/");
  return i < 0 ? yol : yol.slice(i + 1);
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

function TurnView({ turn, live }: { turn: Turn; live: boolean }) {
  const blocks = useMemo(() => toBlocks(turn.events), [turn.events]);
  const bitis = finishedOf(turn.events);
  const kesildi = durduruldu(turn);

  return (
    <>
      {turn.meta.startedAt && <span className="ts">{saat(turn.meta.startedAt)}</span>}

      {turn.prompt && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div className="bub" style={{ background: "var(--surface-2)", whiteSpace: "pre-wrap" }}>
            {turn.prompt}
          </div>
        </div>
      )}

      {blocks.map((b, i) => (
        // Yalnızca **süren** turun **son** bloğu canlı: akış orada.
        <BlockView key={i} block={b} live={live && i === blocks.length - 1} />
      ))}

      {kesildi ? (
        <span className="ts">{t("chat.stopped")}</span>
      ) : (
        bitis &&
        !bitis.ok && (
          <div style={{ display: "flex" }}>
            <div className="bub" style={{ background: "var(--surface)", color: "var(--fail)" }}>
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
function MetinBloku({ text, live }: { text: string; live: boolean }) {
  const kap = useRef<HTMLDivElement>(null);
  useAkisMaskesi(kap, text, live);
  return (
    <div style={{ display: "flex" }}>
      <div className="bub" style={{ background: "var(--surface)" }}>
        <div ref={kap} className={live ? "akis--canli" : undefined}>
          <Markdown text={text} />
        </div>
      </div>
    </div>
  );
}

function BlockView({ block, live }: { block: Block; live: boolean }) {
  if (block.t === "text") {
    return <MetinBloku text={block.text} live={live} />;
  }

  if (block.t === "thinking") {
    return <Thinking text={block.text} ms={block.ms} live={live} />;
  }

  if (block.t === "raw") {
    return (
      <div style={{ display: "flex" }}>
        <pre className="bub mono well">{block.text}</pre>
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
            <div style={{ color: "var(--fail)", marginTop: 6 }}>{detailText(block.text)}</div>
          )}
        </div>
      </div>
    );
  }

  // Döküm baloncuğu — referansın imza hamlesi.
  return (
    <div style={{ display: "flex" }}>
      <div className="bub bub--dokum">
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
    <span className="mono" style={{ fontSize: 13, color: "var(--run)", flex: "none" }}>
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
  return ayniGun ? hhmm : `${d.toLocaleDateString(lc, { day: "numeric", month: "short" })} ${hhmm}`;
}

/** `/home/eymistaken/Belgeler/X` → `~/Belgeler/X` */
function kisaltEv(p: string): string {
  const m = p.match(/^\/home\/[^/]+(\/.*)?$/);
  return m ? "~" + (m[1] ?? "") : p;
}
