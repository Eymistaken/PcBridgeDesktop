import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";

import BotForge from "./BotForge";
import Sidebar, { sayilar } from "./Sidebar";
import Connection from "./views/Connection";
import Chat from "./views/Chat";
import TerminalSidebar from "./TerminalSidebar";
import Terminals from "./views/Terminals";
import { IconRefresh } from "./ui/Icon";
import { t, type Lang } from "./lib/i18n";
import { botDraft } from "./lib/types";
import {
  answerPermission,
  botCtx,
  botHistory,
  botSummaries,
  cancelJob,
  compactBot,
  deleteBot,
  detailText,
  desktopLock,
  desktopState as fetchDesktop,
  desktopUnlock,
  errorText,
  exportBot,
  listBots,
  modelConfig,
  pendingPermissions,
  refresh as refreshConn,
  resumeWatches,
  sendMessage,
  terminals as loadTerminals,
  tmuxKill,
  updateBot,
} from "./lib/ipc";
import type {
  Bot,
  BotDraft,
  BotSummary,
  ChunkPayload,
  CompactPayload,
  CtxPayload,
  ConnError,
  ConnSnapshot,
  DesktopState,
  Mode,
  PendingPermission,
  RunCtx,
  StatusPayload,
  TerminalsView,
  Theme,
  Turn,
} from "./lib/types";

/** Bölmeler uygulama kapanınca kaybolmamalı — bitiş ölçütü bunu istiyor. */
const PANE_KEY = "pcbridge.panes";
const MODE_KEY = "pcbridge.mode";

function okuMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "terminals" ? "terminals" : "agents";
  } catch {
    return "agents";
  }
}

function okuPanes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PANE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
}

interface Props {
  snap: ConnSnapshot;
  onSnap: (s: ConnSnapshot) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  onAuthLost: (e: ConnError) => void;
}

export default function Shell({ snap, onSnap, theme, onTheme, lang, onLang, onAuthLost }: Props) {
  const [busyConn, setBusyConn] = useState(false);
  const [connError, setConnError] = useState<string>();

  const [bots, setBots] = useState<Bot[]>([]);
  const [summaries, setSummaries] = useState<Record<string, BotSummary>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chatError, setChatError] = useState<string>();
  const [sending, setSending] = useState(false);

  /**
   * Seçili botun son bağlam ölçümü ve özetleme durumu.
   *
   * Kaynak **koşumun kendisi**: `job://ctx` her turda geliyor, bar koşum
   * sürerken de akıyor. Koşum yokken diskteki son `ctx.json` okunuyor.
   */
  const [ctx, setCtx] = useState<RunCtx | null>(null);
  const [compacting, setCompacting] = useState(false);

  /**
   * Anlık üretim hızı (token/sn) — **kayan pencere.**
   *
   * Koşum başından beri ortalama almak, uzun bir araç çağrısından sonra hızı
   * olduğundan düşük gösteriyordu; kullanıcı "anlık" istedi. Son üç saniyeye
   * bakılıyor. Akıştaki her parça kabaca bir token: OpenAI uyumlu sunucular
   * token başına bir çerçeve gönderiyor. Kesin sayı koşum bitince
   * `ctx.completionTokens`'tan geliyor, o yüzden bu değer `~` ile yazılıyor.
   */
  const hizPencere = useRef<number[]>([]);
  const [tps, setTps] = useState<number | null>(null);
  const [modelKaynak, setModelKaynak] = useState<string>("");

  const [forge, setForge] = useState<{ bot?: Bot }>();
  const [silinecek, setSilinecek] = useState<Bot>();

  const [mode, setModeState] = useState<Mode>(okuMode);

  // Kip de kalıcı: terminal kipinde kapatılan uygulama orada açılsın.
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Kalıcılık kaybolur ama uygulama çalışır.
    }
  }, []);
  const [tview, setTview] = useState<TerminalsView>({ sessions: [], openHere: [], raw: null });
  const [panes, setPanesState] = useState<string[]>(okuPanes);

  const setPanes = useCallback((p: string[]) => {
    const kesik = p.slice(0, 4);
    setPanesState(kesik);
    try {
      localStorage.setItem(PANE_KEY, JSON.stringify(kesik));
    } catch {
      // Kalıcılık kaybolur ama uygulama çalışmaya devam eder.
    }
  }, []);

  /**
   * Masaüstü izni. Kaynak **disk**, MCP değil: süre kendiliğinden dolduğunda
   * sunucu kimseye haber vermiyor, bir de dosya okumak ağ çağrısından ucuz.
   * Açıkken saniyede bir okunur (geri sayım akıcı olsun), kapalıyken seyrek.
   */
  const [desktop, setDesktop] = useState<DesktopState>({
    unlocked: false,
    remaining: 0,
    hardRemaining: 0,
    reason: null,
    grantedAt: null,
    known: false,
  });

  useEffect(() => {
    let iptal = false;
    let t: ReturnType<typeof setTimeout>;
    const tik = () => {
      void fetchDesktop()
        .then((s) => {
          if (iptal) return;
          setDesktop(s);
          t = setTimeout(tik, s.unlocked ? 1000 : 4000);
        })
        .catch(() => {
          if (!iptal) t = setTimeout(tik, 4000);
        });
    };
    tik();
    return () => {
      iptal = true;
      clearTimeout(t);
    };
  }, []);

  /** Ctrl+N kenar çubuğundaki "yeni oturum" alanını açsın diye artan sayaç. */
  const [yeniSinyal, setYeniSinyal] = useState(0);

  /**
   * Kilit rozetinin eylemi: kapalıysa 15 dakika açar, açıksa kilitler.
   *
   * Süre seçimi panelde duruyor; buradaki tek tıklık yol **sık yapılan şey**
   * için — panele gidip süre seçmek her seferinde üç tıklamaydı.
   */
  const masaustuCevir = useCallback(async () => {
    try {
      const y = desktop.unlocked
        ? await desktopLock()
        : await desktopUnlock(15, t("desk.openedFrom"));
      setDesktop(y.state);
    } catch (e) {
      setConnError(errorText(e as ConnError));
    }
  }, [desktop.unlocked]);

  const terminalleriYukle = useCallback(async () => {
    try {
      setTview(await loadTerminals());
    } catch (e) {
      setConnError(errorText(e as ConnError));
    }
  }, []);

  /**
   * Terminal kipinde oturum listesi. İlk geçişte çekilir, sonra 10 saniyede
   * bir tazelenir: bölme başlığındaki "çalışan program" aksi hâlde bölme
   * açıldığı andaki değerde donup kalıyor (`bash` yazarken içeride `agy`
   * çalışıyor). Kip terminal değilken zamanlayıcı hiç kurulmaz.
   */
  useEffect(() => {
    if (mode !== "terminals") return;
    void terminalleriYukle();
    const t = setInterval(() => void terminalleriYukle(), 10000);
    return () => clearInterval(t);
  }, [mode, terminalleriYukle]);

  // Olay dinleyicileri seçili botu görebilsin diye ref'te tutuyoruz.
  const seciliRef = useRef<string | undefined>(undefined);
  seciliRef.current = selectedId;
  // Kısayol dinleyicisi bir kez kuruluyor; güncel kipi ref'ten okur.
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const secili = bots.find((b) => b.id === selectedId);

  const ozetleriYukle = useCallback(async () => {
    try {
      const liste = await botSummaries();
      setSummaries(Object.fromEntries(liste.map((s) => [s.id, s])));
    } catch {
      // Özet kozmetik; başarısız olursa satırlar bot alanlarına düşer.
    }
  }, []);

  const botlariYukle = useCallback(async () => {
    const liste = await listBots();
    setBots(liste);
    await ozetleriYukle();
    return liste;
  }, [ozetleriYukle]);

  useEffect(() => {
    void (async () => {
      const liste = await botlariYukle();
      if (liste.length > 0) setSelectedId((s) => s ?? liste[0].id);
      // Uygulama kapalıyken süren işler varsa izlemeye geri al.
      await resumeWatches().catch(() => []);
    })();
  }, [botlariYukle]);

  // Seçili botun son bağlam ölçümü. Koşum başlayınca `job://ctx` devralıyor.
  useEffect(() => {
    setCompacting(false);
    if (!selectedId) {
      setCtx(null);
      return;
    }
    let iptal = false;
    void botCtx(selectedId)
      .then((c) => {
        if (!iptal) setCtx(c);
      })
      .catch(() => {
        // Bağlam çubuğu kozmetik: okunamazsa çizilmez, sohbet çalışır.
        if (!iptal) setCtx(null);
      });
    return () => {
      iptal = true;
    };
  }, [selectedId]);

  // Seçili botun geçmişi diskten kurulur.
  useEffect(() => {
    if (!selectedId) {
      setTurns([]);
      return;
    }
    let iptal = false;
    setChatError(undefined);
    void botHistory(selectedId)
      .then((t) => {
        if (!iptal) setTurns(t);
      })
      .catch((e) => {
        if (!iptal) setChatError(detailText(e));
      });
    return () => {
      iptal = true;
    };
  }, [selectedId]);

  /**
   * Yanıt bekleyen izin istekleri, koşum kimliğine göre.
   *
   * Açılışta ve her abonelik kurulumunda diskten değil **Rust'tan** okunuyor:
   * arayüz yeniden kurulunca yayınlanmış olay kaçıyor ve kart ekrandan
   * siliniyordu; koşum ise sessizce beklemeye devam ediyordu.
   */
  const [pending, setPending] = useState<PendingPermission[]>([]);

  const izinYanitla = useCallback(async (runId: string, allow: boolean) => {
    // Kart hemen kalksın: yanıt yolda ve iki kez tıklamanın anlamı yok.
    setPending((p) => p.filter((x) => x.runId !== runId));
    try {
      await answerPermission(runId, allow);
    } catch {
      // İstek bu arada düşmüş olabilir (koşum bitti, durduruldu). Kart
      // zaten kalktı; kullanıcıya söylenecek bir şey yok.
    }
  }, []);

  /**
   * Botun bir alanını yerinde yazar.
   *
   * Kip de "makinedeyken de çalışsın" anahtarı da **botun kendi alanı**;
   * besteci menüsü onları doğrudan yazıyor, ayrı bir oturum kopyası yok.
   * Aynı işi yapan iki denetimden biri bu depoda bir kez ölü kaldı.
   */
  const alanDegistir = useCallback(async (bot: Bot, yama: Partial<BotDraft>) => {
    try {
      const yeni = await updateBot(bot.id, { ...botDraft(bot), ...yama });
      setBots((prev) => prev.map((b) => (b.id === yeni.id ? yeni : b)));
    } catch (e) {
      setChatError(detailText(e));
    }
  }, []);

  // Canlı akış.
  useEffect(() => {
    void pendingPermissions().then(setPending).catch(() => undefined);
    const abonelikler = [
      listen<PendingPermission>("job://permission", (e) => {
        setPending((p) => [...p.filter((x) => x.runId !== e.payload.runId), e.payload]);
      }),
      listen<ChunkPayload>("job://chunk", (e) => {
        const p = e.payload;
        if (p.botId !== seciliRef.current) return;
        const simdi = performance.now();
        for (const olay of p.events) {
          if ((olay.kind === "text" || olay.kind === "thinking") && olay.delta) {
            hizPencere.current.push(simdi);
          }
        }
        setTurns((prev) =>
          prev.map((t) =>
            t.jobId === p.jobId ? { ...t, events: [...t.events, ...p.events] } : t,
          ),
        );
      }),
      listen<CtxPayload>("job://ctx", (e) => {
        if (e.payload.botId !== seciliRef.current) return;
        setCtx(e.payload.ctx);
      }),
      listen<CompactPayload>("job://compacting", (e) => {
        if (e.payload.botId !== seciliRef.current) return;
        setCompacting(e.payload.active);
      }),
      listen<StatusPayload>("job://status", (e) => {
        const p = e.payload;
        if (p.botId === seciliRef.current) {
          setTurns((prev) =>
            prev.map((t) => (t.jobId === p.jobId ? { ...t, meta: p.meta } : t)),
          );
        }
        if (p.done) {
          // Koşum bitti: bekleyen isteği Rust zaten düşürdü, kart da kalkmalı.
          setPending((q) => q.filter((x) => x.runId !== p.jobId));
          // Koşum yarıda kesilmişse "özetleniyor" şeridi asılı kalırdı.
          if (p.botId === seciliRef.current) setCompacting(false);
          void ozetleriYukle();
        }
      }),
    ];
    return () => {
      void Promise.all(abonelikler).then((fns) => fns.forEach((f) => f()));
    };
  }, [ozetleriYukle]);

  /**
   * Hız göstergesi saniyede iki kez tazelenir; her parçada durum yazmak
   * React'i boşuna döndürürdü.
   */
  useEffect(() => {
    const t = setInterval(() => {
      const esik = performance.now() - 3000;
      const p = hizPencere.current.filter((x) => x >= esik);
      hizPencere.current = p;
      // İki parçadan az varsa ortada bir hız yok; boş göstermek yalan değil.
      setTps(p.length >= 2 ? p.length / 3 : null);
    }, 500);
    return () => clearInterval(t);
  }, []);

  /** Model nereden geliyor — menüde "yerel mi bulut mu" bunu okuyor. */
  useEffect(() => {
    void modelConfig()
      .then((c) => setModelKaynak(c.baseUrl))
      .catch(() => setModelKaynak(""));
  }, []);

  /**
   * Klavye kısayolları. Metin alanındayken **hiçbiri çalışmaz** — Ctrl+N
   * yazarken bir pencere açması sinir bozucu olurdu. Terminal bölmesi de
   * bir metin alanı sayılır: her tuş tmux'a gitmeli.
   */
  useEffect(() => {
    const yaziliyor = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const ad = el.tagName;
      return (
        ad === "INPUT" ||
        ad === "TEXTAREA" ||
        el.isContentEditable ||
        !!el.closest?.(".xterm")
      );
    };

    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setForge(undefined);
        setSilinecek(undefined);
        return;
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
      if (e.key === "1") {
        e.preventDefault();
        setMode("agents");
      } else if (e.key === "2") {
        e.preventDefault();
        setMode("terminals");
      } else if (e.key === "0" || e.code === "Comma") {
        // Rakam tuşları klavye düzeninden bağımsız; `,` Türkçe Q'da başka
        // bir yere düşüyor ve `e.key` beklenen değeri vermiyor (ölçüldü).
        // `code` ile virgül yine de kabul ediliyor.
        e.preventDefault();
        setSelectedId(undefined);
        setMode("agents");
      } else if (e.key === "n" || e.key === "N") {
        if (yaziliyor(e.target)) return;
        e.preventDefault();
        if (modeRef.current === "terminals") setYeniSinyal((n) => n + 1);
        else setForge({});
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [setMode]);

  async function tazele() {
    setBusyConn(true);
    setConnError(undefined);
    try {
      onSnap(await refreshConn());
      await botlariYukle();
    } catch (e) {
      const err = e as ConnError;
      if (err.kind === "unauthorized" || err.kind === "noToken") {
        onAuthLost(err);
        return;
      }
      setConnError(errorText(err));
    } finally {
      setBusyConn(false);
    }
  }

  async function gonder(text: string) {
    if (!selectedId) return;
    setSending(true);
    setChatError(undefined);
    const simdi = Date.now() / 1000;
    try {
      const { jobId } = await sendMessage(selectedId, text);
      // İyimser tur: akış gelmeye başlayana kadar ekran boş kalmasın.
      setTurns((prev) => [
        ...prev,
        {
          jobId,
          prompt: text,
          meta: {
            id: jobId,
            kind: null,
            label: text,
            cwd: null,
            parser: null,
            status: "running",
            exitCode: null,
            startedAt: simdi,
            finishedAt: null,
            agent: secili?.agent ?? null,
            prompt: text,
            resumeSession: null,
          },
          events: [],
        },
      ]);
      await botlariYukle();
    } catch (e) {
      const err = e as ConnError;
      if (err.kind === "unauthorized" || err.kind === "noToken") {
        onAuthLost(err);
        return;
      }
      setChatError(errorText(err));
    } finally {
      setSending(false);
    }
  }

  async function durdur(jobId: string) {
    if (!selectedId) return;
    try {
      await cancelJob(selectedId, jobId);
    } catch (e) {
      setChatError(errorText(e as ConnError));
    }
  }

  async function sil(bot: Bot) {
    setSilinecek(undefined);
    try {
      await deleteBot(bot.id);
      const liste = await botlariYukle();
      if (selectedId === bot.id) setSelectedId(liste[0]?.id);
    } catch (e) {
      setConnError(detailText(e));
    }
  }

  /**
   * Kullanıcının istediği özetleme.
   *
   * Bittikten sonra bağlam yeniden okunuyor: denetim noktası diske yazıldı ve
   * bar hâlâ eski sayıyı gösteriyor olurdu. Sayının kendisi ancak **sonraki
   * koşumda** düşer — özetin kazancını ölçen şey sunucunun `usage`'ı.
   */
  const ozetle = useCallback(async (bot: Bot) => {
    setCompacting(true);
    setChatError(undefined);
    try {
      await compactBot(bot.id);
      setTurns(await botHistory(bot.id));
      setCtx(await botCtx(bot.id));
    } catch (e) {
      setChatError(detailText(e));
    } finally {
      setCompacting(false);
    }
  }, []);

  /**
   * Sohbeti dosyaya yazar. Yeri kullanıcı seçiyor; uygulamanın kendi
   * dizinine sessizce yazmak, dosyayı bulmayı ayrı bir işe çevirirdi.
   */
  const disaAktar = useCallback(async (bot: Bot) => {
    const ad = `${bot.name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "")}.json`;
    const yol = await save({
      defaultPath: ad,
      filters: [{ name: "JSON", extensions: ["json"] }],
    }).catch(() => null);
    if (!yol) return;
    try {
      setChatError(t("chat.exported", { path: await exportBot(bot.id, yol) }));
    } catch (e) {
      setChatError(detailText(e));
    }
  }, []);

  // Süren iş: seçili botun bitmemiş son turu.
  const suren = [...turns].reverse().find((t) => {
    const s = t.meta.status;
    return t.meta.exitCode === null && (s === "running" || s === null || s === undefined);
  });

  if (mode === "terminals") {
    return (
      <div className="shell">
        <TerminalSidebar
          view={tview}
          panes={panes}
          mode={mode}
          onMode={setMode}
          desktop={desktop}
          newSignal={yeniSinyal}
          onOpenSystem={() => {
            setSelectedId(undefined);
            setMode("agents");
          }}
          onToggleDesktop={() => void masaustuCevir()}
          onOpen={(name) => {
            if (!panes.includes(name)) setPanes([...panes, name]);
          }}
          onNew={(name) => {
            // Yeni oturum: bölmeyi açmak zaten `tmux new-session -A` ile
            // yaratıyor, ayrıca bir tmux_start'a gerek yok.
            if (!panes.includes(name)) setPanes([...panes, name]);
            void terminalleriYukle();
          }}
          onKill={(name) => {
            void tmuxKill(name)
              .then(() => {
                setPanes(panes.filter((p) => p !== name));
                return terminalleriYukle();
              })
              .catch((e) => setConnError(errorText(e as ConnError)));
          }}
        />
        <div className="main" key="terminals">
          <Terminals
            view={tview}
            panes={panes}
            onPanes={setPanes}
            onReload={() => void terminalleriYukle()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <Sidebar
        snap={snap}
        mode={mode}
        onMode={setMode}
        desktop={desktop}
        onOpenSystem={() => setSelectedId(undefined)}
        onToggleDesktop={() => void masaustuCevir()}
        bots={bots}
        summaries={summaries}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setForge({})}
        onEdit={(bot) => setForge({ bot })}
        onDelete={setSilinecek}
        refreshing={busyConn}
        connError={connError}
        waiting={pending.map((p) => p.botId)}
      />

      <div className="main" key="agents">
        {secili ? (
          <Chat
            bot={secili}
            turns={turns}
            running={
              suren
                ? { jobId: suren.jobId, startedAt: suren.meta.startedAt, label: suren.meta.label ?? suren.prompt }
                : undefined
            }
            busy={sending}
            error={chatError}
            onSend={(t) => void gonder(t)}
            onCancel={(j) => void durdur(j)}
            pending={pending.find((p) => p.botId === secili.id)}
            onAnswer={(runId, allow) => void izinYanitla(runId, allow)}
            onPermission={(p) => {
              if (secili.permission !== p) void alanDegistir(secili, { permission: p });
            }}
            onForce={(v) => void alanDegistir(secili, { forceWhenBusy: v })}
            ctx={ctx}
            tps={tps}
            baseUrl={modelKaynak}
            compacting={compacting}
            onCompact={() => void ozetle(secili)}
            efforts={
              snap.agents
                .find((a) => a.id === secili.agent)
                ?.models.find((m) => m.id === secili.model)?.efforts ?? []
            }
            onEffort={(e) => void alanDegistir(secili, { effort: e })}
            onEditBot={() => setForge({ bot: secili })}
            onExport={() => void disaAktar(secili)}
          />
        ) : (
          <>
            <div className="main__head">
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                {t("sys.title")}
              </span>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {sayilar(snap.toolCount, snap.agents.length)}
              </span>
              <div style={{ flexGrow: 1 }} />
              <button
                className="ib"
                type="button"
                title={t("sys.refresh")}
                aria-label={t("sys.refreshConn")}
                disabled={busyConn}
                onClick={() => void tazele()}
              >
                <IconRefresh />
              </button>
            </div>
            <div className="main__body">
              {connError && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "13px 16px",
                    borderRadius: "var(--r-lg)",
                    background: "var(--field)",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--fail)",
                  }}
                >
                  {connError}
                </div>
              )}
              <Connection
                snap={snap}
                theme={theme}
                onTheme={onTheme}
                lang={lang}
                onLang={onLang}
                desktop={desktop}
                onDesktop={setDesktop}
              />
            </div>
          </>
        )}
      </div>

      {forge && (
        <BotForge
          agents={snap.agents}
          defaultWorkdir={snap.defaultWorkdir}
          bot={forge.bot}
          onCancel={() => setForge(undefined)}
          onDone={(bot) => {
            setForge(undefined);
            void botlariYukle();
            setSelectedId(bot.id);
          }}
        />
      )}

      {silinecek && (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={t("del.title")}>
          <div className="card" style={{ width: 420, background: "var(--bg)" }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{t("del.ask", { name: silinecek.name })}</span>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t("del.blurb")}
            </span>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn-quiet" onClick={() => setSilinecek(undefined)}>
                {t("del.cancel")}
              </button>
              <button type="button" className="btn-primary" onClick={() => void sil(silinecek)}>
                {t("del.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
