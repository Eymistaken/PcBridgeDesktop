import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";

import BotForge from "./BotForge";
import Sidebar, { sayilar } from "./Sidebar";
import Connection from "./views/Connection";
import Chat from "./views/Chat";
import SessionHome from "./views/SessionHome";
import Composer from "./ui/Composer";
import TerminalSidebar from "./TerminalSidebar";
import Terminals from "./views/Terminals";
import ModeSwitch from "./ui/ModeSwitch";
import Avatar from "./ui/Avatar";
import PermMenu from "./ui/PermMenu";
import { IconPencil, IconPlus, IconRefresh } from "./ui/Icon";
import { t, type Lang } from "./lib/i18n";
import { kisaltEv } from "./lib/yol";
import { botDraft } from "./lib/types";
import { useCikisIcerik } from "./lib/cikis";
import {
  answerPermission,
  botSummaries,
  cancelJob,
  compactSession,
  deleteBot,
  deleteSession,
  detailText,
  desktopLock,
  desktopState as fetchDesktop,
  desktopUnlock,
  errorText,
  exportSession,
  listBots,
  listSessions,
  modelConfig,
  pendingPermissions,
  refresh as refreshConn,
  resumeWatches,
  sendMessage,
  sessionCtx,
  sessionHistory,
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
  Permission,
  RunCtx,
  SessionSummary,
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
  /**
   * Seçili session.
   *
   * `undefined` **geçerli bir durum**: bot seçili ama henüz session yok
   * (yeni bot, ya da kullanıcı "yeni session" ekranında). O hâlde
   * `sendMessage` `null` gönderir ve Rust session'ı yaratıp kimliğini döner.
   */
  const [selectedSession, setSelectedSession] = useState<string>();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
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

  // Örtü katmanları kapanırken bir karede yok olmasın. İçerik de devinim
  // boyunca korunuyor: `silinecek` `undefined` olur olmaz kartta gösterilecek
  // ad kalmıyordu.
  const { icerik: forgeIcerik, render: forgeVar, cikiyor: forgeCikiyor } = useCikisIcerik(forge);
  const { icerik: silIcerik, render: silVar, cikiyor: silCikiyor } = useCikisIcerik(silinecek);

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
  /**
   * ⚠️ **Süzme session'a bakar, bota değil.** Aynı botun iki session'ı
   * paralel koşabiliyor; yalnızca `botId`'ye bakmak açık ekrana ötekinin
   * token'larını yazardı.
   */
  const oturumRef = useRef<string | undefined>(undefined);
  oturumRef.current = selectedSession;
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

  /**
   * Seçili botun session listesi.
   *
   * Arama ve açılış kartları bunu okuyor; sıra Rust'ta `updatedAt`'e göre
   * verilmiş (en son dokunulan önce).
   */
  const oturumlariYukle = useCallback(async (botId: string) => {
    try {
      const liste = await listSessions(botId);
      setSessions(liste);
      return liste;
    } catch {
      // Liste kozmetik: okunamazsa boş kalır, sohbet çalışmaya devam eder.
      setSessions([]);
      return [];
    }
  }, []);

  const botlariYukle = useCallback(async () => {
    const liste = await listBots();
    setBots(liste);
    await ozetleriYukle();
    return liste;
  }, [ozetleriYukle]);

  /**
   * Bot değişince session listesi yeniden okunur.
   *
   * ⚠️ **Session seçilmiyor** — kullanıcının kararı (2026-09-05): bota
   * tıklamak son session'a dönmüyor, boş bir ekran açıyor. Session ilk
   * mesajla doğuyor (`bots::ensure_session`), o yüzden düğmeye basıp
   * yazmayan kullanıcı arkasında boş kayıt bırakmıyor.
   */
  useEffect(() => {
    setSelectedSession(undefined);
    if (!selectedId) {
      setSessions([]);
      return;
    }
    let iptal = false;
    void oturumlariYukle(selectedId).then(() => {
      if (iptal) return;
    });
    return () => {
      iptal = true;
    };
  }, [selectedId, oturumlariYukle]);

  /** Session'ı listeden düşürür; açık olan silinirse yeni-session ekranına döner. */
  const oturumSil = useCallback(
    async (botId: string, sid: string) => {
      try {
        await deleteSession(botId, sid);
        setSelectedSession((s) => (s === sid ? undefined : s));
        await oturumlariYukle(botId);
        await ozetleriYukle();
      } catch (e) {
        setChatError(detailText(e));
      }
    },
    [oturumlariYukle, ozetleriYukle],
  );

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
    if (!selectedId || !selectedSession) {
      setCtx(null);
      return;
    }
    let iptal = false;
    void sessionCtx(selectedId, selectedSession)
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
  }, [selectedId, selectedSession]);

  /**
   * Seçili session'ın geçmişi diskten kurulur.
   *
   * ⚠️ **`turns` önce boşaltılıyor.** Eskiden yalnızca `selectedId` yokken
   * temizleniyordu; A'dan B'ye geçildiğinde `botHistory(B)` çözülene kadar
   * ekranda **A'nın baloncukları** B'nin başlığı altında duruyordu. Kozmetik
   * değil, doğruluk hatası — ve `Chat`'in kaydırma sezgiseli de bu yüzden
   * yanlış tarafa düşüyordu (bkz. `Chat.tsx`).
   */
  useEffect(() => {
    setTurns([]);
    if (!selectedId || !selectedSession) return;
    let iptal = false;
    setChatError(undefined);
    void sessionHistory(selectedId, selectedSession)
      .then((t) => {
        if (!iptal) setTurns(t);
      })
      .catch((e) => {
        if (!iptal) setChatError(detailText(e));
      });
    return () => {
      iptal = true;
    };
  }, [selectedId, selectedSession]);

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
        if (p.sessionId !== oturumRef.current) return;
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
        if (e.payload.sessionId !== oturumRef.current) return;
        setCtx(e.payload.ctx);
      }),
      listen<CompactPayload>("job://compacting", (e) => {
        if (e.payload.sessionId !== oturumRef.current) return;
        setCompacting(e.payload.active);
      }),
      listen<StatusPayload>("job://status", (e) => {
        const p = e.payload;
        if (p.sessionId === oturumRef.current) {
          setTurns((prev) =>
            prev.map((t) => (t.jobId === p.jobId ? { ...t, meta: p.meta } : t)),
          );
        }
        if (p.done) {
          // Koşum bitti: bekleyen isteği Rust zaten düşürdü, kart da kalkmalı.
          setPending((q) => q.filter((x) => x.runId !== p.jobId));
          // Koşum yarıda kesilmişse "özetleniyor" şeridi asılı kalırdı.
          if (p.sessionId === oturumRef.current) setCompacting(false);
          void ozetleriYukle();
          // Session listesi de tazelensin: başlık ve durum noktası değişti.
          if (p.botId === seciliRef.current) void oturumlariYukle(p.botId);
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
      // `selectedSession` yoksa Rust yeni bir session açıp kimliğini döner —
      // "yeni session" ayrı bir eylem değil, ilk mesajla doğuyor.
      const { jobId, sessionId } = await sendMessage(
        selectedId,
        selectedSession ?? null,
        text,
      );
      setSelectedSession(sessionId);
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
      await oturumlariYukle(selectedId);
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
    if (!selectedId || !selectedSession) return;
    try {
      await cancelJob(selectedId, selectedSession, jobId);
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
  const ozetle = useCallback(async (bot: Bot, sid: string) => {
    setCompacting(true);
    setChatError(undefined);
    try {
      await compactSession(bot.id, sid);
      setTurns(await sessionHistory(bot.id, sid));
      setCtx(await sessionCtx(bot.id, sid));
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
  const disaAktar = useCallback(async (bot: Bot, sid: string) => {
    const ad = `${bot.name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "")}.json`;
    try {
      // **`save()` bir `catch` ile susturulmaz.** İptalde zaten `null` dönüyor;
      // yutulan tek şey gerçek hataydı — izin listesinde `dialog:allow-save`
      // yokken çağrı reddediliyor ve tuş hiçbir iz bırakmadan ölü görünüyordu.
      const yol = await save({
        defaultPath: ad,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!yol) return;
      setChatError(t("chat.exported", { path: await exportSession(bot.id, sid, yol) }));
    } catch (e) {
      setChatError(detailText(e));
    }
  }, []);

  // Süren iş: seçili botun bitmemiş son turu.
  const suren = [...turns].reverse().find((t) => {
    const s = t.meta.status;
    return t.meta.exitCode === null && (s === "running" || s === null || s === undefined);
  });

  /**
   * Kenar çubuğunun **kabuğu** — başlık ve kip anahtarı burada, iki kipte de
   * aynı düğümler.
   *
   * ⚠️ Eskiden ikisi de `Sidebar` ve `TerminalSidebar`'ın **içindeydi** ve
   * kip değişince bütün sütun sökülüp yeniden kuruluyordu. Sonucu ölçüldü:
   * `.modesw__thumb`'ın kayma geçişi **hiç oynamıyordu** — yeni kurulan bir
   * öğenin önceki `transform` değeri olmadığı için geçişin başlangıç ucu yok.
   * YAPILACAKLAR.md "kayan parça çalışıyor" diyordu; WebKitGTK'da bakılınca
   * parça takasta ışınlanıyordu. Kabuk dışarı alınınca anahtar takasta
   * hayatta kalıyor ve gerçekten kayıyor.
   */
  const yanKabuk = (icerik: React.ReactNode) => (
    <div className="side">
      <div className="side__head">
        <span className="side__title">pcbridge</span>
        <button
          className="ib ib--filled"
          type="button"
          title={mode === "terminals" ? t("term.newSessionTitle") : t("side.newBotTitle")}
          aria-label={mode === "terminals" ? t("term.newSession") : t("side.newBot")}
          onClick={() =>
            mode === "terminals" ? setYeniSinyal((n) => n + 1) : setForge({})
          }
        >
          <IconPlus />
        </button>
      </div>

      <div className="side__modes">
        <ModeSwitch mode={mode} onMode={setMode} />
      </div>

      {icerik}
    </div>
  );

  if (mode === "terminals") {
    return (
      <div className="shell">
        {yanKabuk(
        <TerminalSidebar
          view={tview}
          panes={panes}
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
        />,
        )}
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
      {yanKabuk(
      <Sidebar
        snap={snap}
        desktop={desktop}
        onOpenSystem={() => setSelectedId(undefined)}
        onToggleDesktop={() => void masaustuCevir()}
        bots={bots}
        summaries={summaries}
        selectedId={selectedId}
        onSelect={(id) => {
          // Aynı bota yeniden tıklamak da **yeni session** açar: kullanıcının
          // istediği eylem "bu asistanla yeni bir işe başla".
          setSelectedId(id);
          setSelectedSession(undefined);
        }}
        sessions={sessions}
        selectedSession={selectedSession}
        onSelectSession={setSelectedSession}
        onDeleteSession={(sid) => selectedId && void oturumSil(selectedId, sid)}
        onEdit={(bot) => setForge({ bot })}
        onDelete={setSilinecek}
        refreshing={busyConn}
        connError={connError}
        waiting={pending.map((p) => p.botId)}
      />,
      )}

      <div className="main" key="agents">
        {secili && !selectedSession ? (
          <>
            <div className="main__head">
              <Avatar tone={secili.avatar} name={secili.name} size={26} />
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                {secili.name}
              </span>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {[
                  secili.model,
                  secili.backend === "yerel-model"
                    ? t("side.nTools", { n: secili.tools.length })
                    : secili.effort,
                  kisaltEv(secili.workdir),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <div style={{ flexGrow: 1 }} />
              <button
                className="ib"
                type="button"
                title={t("side.edit")}
                aria-label={t("side.editBot", { name: secili.name })}
                onClick={() => setForge({ bot: secili })}
              >
                <IconPencil />
              </button>
            </div>
            <SessionHome
              bot={secili}
              sessions={sessions}
              onOpen={setSelectedSession}
              onDelete={(sid) => void oturumSil(secili.id, sid)}
              composer={
                <Composer
                  botName={secili.name}
                  workdir={secili.workdir}
                  busy={sending}
                  resetKey={`${secili.id}:yeni`}
                  onSend={(t) => void gonder(t)}
                  foot={
                    <>
                      <PermMenu
                        value={secili.permission}
                        botName={secili.name}
                        tools={secili.tools}
                        force={secili.forceWhenBusy}
                        onChange={(p: Permission) => {
                          if (secili.permission !== p) {
                            void alanDegistir(secili, { permission: p });
                          }
                        }}
                        onForce={(v: boolean) => void alanDegistir(secili, { forceWhenBusy: v })}
                        onEditTools={() => setForge({ bot: secili })}
                      />
                      <div style={{ flexGrow: 1 }} />
                    </>
                  }
                />
              }
            />
            {chatError && (
              <div className="home__hata">{chatError}</div>
            )}
          </>
        ) : secili ? (
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
            sessionId={selectedSession ?? ""}
            sessionCount={sessions.length}
            pending={pending.find((p) => p.sessionId === selectedSession)}
            onAnswer={(runId, allow) => void izinYanitla(runId, allow)}
            onPermission={(p) => {
              if (secili.permission !== p) void alanDegistir(secili, { permission: p });
            }}
            onForce={(v) => void alanDegistir(secili, { forceWhenBusy: v })}
            ctx={ctx}
            tps={tps}
            baseUrl={modelKaynak}
            compacting={compacting}
            onCompact={() => selectedSession && void ozetle(secili, selectedSession)}
            efforts={
              snap.agents
                .find((a) => a.id === secili.agent)
                ?.models.find((m) => m.id === secili.model)?.efforts ?? []
            }
            onEffort={(e) => void alanDegistir(secili, { effort: e })}
            onEditBot={() => setForge({ bot: secili })}
            onExport={() => selectedSession && void disaAktar(secili, selectedSession)}
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

      {forgeVar && forgeIcerik && (
        <BotForge
          agents={snap.agents}
          defaultWorkdir={snap.defaultWorkdir}
          bot={forgeIcerik.bot}
          cikiyor={forgeCikiyor}
          onCancel={() => setForge(undefined)}
          onDone={(bot) => {
            setForge(undefined);
            void botlariYukle();
            setSelectedId(bot.id);
          }}
        />
      )}

      {silVar && silIcerik && (
        <div
          className="scrim"
          data-cikis={silCikiyor || undefined}
          role="dialog"
          aria-modal="true"
          aria-label={t("del.title")}
        >
          <div className="card" style={{ width: 420, background: "var(--bg)" }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{t("del.ask", { name: silIcerik.name })}</span>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t("del.blurb")}
            </span>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn-quiet" onClick={() => setSilinecek(undefined)}>
                {t("del.cancel")}
              </button>
              <button type="button" className="btn-primary" onClick={() => void sil(silIcerik)}>
                {t("del.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
