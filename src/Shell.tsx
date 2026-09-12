import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";

import BotForge from "./BotForge";
import Sidebar, { sayilar } from "./Sidebar";
import Connection from "./views/Connection";
import Chat from "./views/Chat";
import SessionHome from "./views/SessionHome";
import Composer from "./ui/Composer";
import TerminalSidebar from "./TerminalSidebar";
import Terminals from "./views/Terminals";
import ModeSwitch from "./ui/ModeSwitch";
import PermMenu from "./ui/PermMenu";
import { IconPlus } from "./ui/Icon";
import { t, type Lang } from "./lib/i18n";
import { inisiKaydet } from "./lib/inis";
import { kisaltEv } from "./lib/yol";
import { botDraft } from "./lib/types";
import { ekle, oturumKoy, oturumlar, type Dugum } from "./lib/agac";
import {
  agacYaz,
  alanAdlandir,
  alanKlasor,
  alanEkle,
  alanSil,
  etkinAgac,
  etkinDizin,
  etkinYap,
  oku as okuAlanlarHam,
  oturumDus,
  oturumTasi,
  type AlanDurum,
} from "./lib/alanlar";
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
  ptyClose,
  ptyInfo,
  terminals as loadTerminals,
  tmuxFreeName,
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
  PtyInfo,
  TerminalsView,
  Theme,
  Turn,
} from "./lib/types";

/** Bölmeler uygulama kapanınca kaybolmamalı — bitiş ölçütü bunu istiyor. */
const PANE_KEY = "pcbridge.panes";
/**
 * Kullanıcının elle verdiği bölme etiketleri (`session` → etiket).
 *
 * ⚠️ tmux adı **yeniden adlandırılmıyor.** O ad ağacın, bu anahtarın, PTY
 * `HashMap`'inin ve olay yüklerinin anahtarı; değiştirmek dördünü birden
 * kaydırırdı. Elle etiket varsa dinamik başlık (`user@host: ~dizin`) durur —
 * GNOME Terminal'in davranışı. Etiket silinince dinamik başlık geri gelir.
 */
const ETIKET_KEY = "pcbridge.terminal.etiketler";
const MODE_KEY = "pcbridge.mode";

function okuMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "terminals"
      ? "terminals"
      : "agents";
  } catch {
    return "agents";
  }
}

/**
 * Bölme ağacını diskten okur.
 *
 * ⚠️ **Dörtlü sınır kalktı.** Eskiden burada ve `setPanes`'te `slice(0, 4)`
 * vardı; Rust'ta hiçbir sınır yok (`pty.rs` sınırsız `HashMap`) ve dört bölme
 * doluyken kenar çubuğundan beşinci oturuma tıklamak **sessizce yutuluyordu**.
 * Eski düz dizi biçimi `agac.oku` içinde ızgaraya göç ediyor.
 */
/**
 * Çalışma alanları — terminal kipinin sekmeleri, her biri kendi ağacıyla.
 *
 * Eski tek ağaç (`PANE_KEY`) buradan **göç ediyor**: ilk açılışta tek bir
 * alana dönüşüyor, ilk kayıttan sonra eski anahtar diskten siliniyor.
 */
const ALAN_KEY = "pcbridge.terminal.alanlar";

function okuAlanlar(): AlanDurum {
  try {
    return okuAlanlarHam(
      localStorage.getItem(ALAN_KEY),
      localStorage.getItem(PANE_KEY),
      t("area.n", { n: 1 }),
    );
  } catch {
    return okuAlanlarHam(null, null, t("area.n", { n: 1 }));
  }
}

function okuEtiketler(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(ETIKET_KEY) ?? "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    // Bozuk bir kayıt arayüzü çökertmesin: yalnızca dizge değerler alınıyor.
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).filter(
        ([, x]) => typeof x === "string" && x !== "",
      ),
    ) as Record<string, string>;
  } catch {
    return {};
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

export default function Shell({
  snap,
  onSnap,
  theme,
  onTheme,
  lang,
  onLang,
  onAuthLost,
}: Props) {
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
  const {
    icerik: forgeIcerik,
    render: forgeVar,
    cikiyor: forgeCikiyor,
  } = useCikisIcerik(forge);
  const {
    icerik: silIcerik,
    render: silVar,
    cikiyor: silCikiyor,
  } = useCikisIcerik(silinecek);

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
  const [tview, setTview] = useState<TerminalsView>({
    sessions: [],
    openHere: [],
    raw: null,
  });
  /**
   * Terminal ağacı bir kez kurulunca **bağlı kalıyor** (kip geçişindeki
   * kasmanın çözümü), ama hiç terminale geçmeyen kullanıcı o maliyeti
   * ödemesin diye ilk geçişe kadar hiç kurulmuyor.
   */
  const [terminalAcildi, setTerminalAcildi] = useState(
    () => okuMode() === "terminals",
  );
  useEffect(() => {
    if (mode === "terminals") setTerminalAcildi(true);
  }, [mode]);
  const [durum, setDurum] = useState<AlanDurum>(okuAlanlar);
  const durumRef = useRef(durum);
  durumRef.current = durum;

  useEffect(() => {
    try {
      localStorage.setItem(ALAN_KEY, JSON.stringify(durum));
      // Göç tamamlandı: eski tek ağaç bir daha okunmuyor, diskte de kalmasın.
      localStorage.removeItem(PANE_KEY);
    } catch {
      // Persistence is optional; the in-memory layout remains usable.
    }
  }, [durum]);

  /**
   * Etkin alanın ağacı — arayüzün geri kalanı yalnızca bunu görüyor.
   *
   * Alan katmanı `Terminals`'a hiç sızmıyor: o bileşen bir ağaç çiziyor ve
   * hangi alanda olduğunu bilmiyor. Sekme değişince ağaç değişiyor, o kadar.
   */
  const agac = etkinAgac(durum);
  // Kısayol dinleyicisi bir kez kuruluyor; ağacı ref'ten okuyor.
  const agacRef = useRef<Dugum | null>(agac);
  agacRef.current = agac;

  const setAgac = useCallback<Dispatch<SetStateAction<Dugum | null>>>(
    (v) =>
      setDurum((d) =>
        agacYaz(
          d,
          typeof v === "function" ? v(etkinAgac(d)) : v,
          t("area.n", { n: 1 }),
        ),
      ),
    [],
  );

  /**
   * Alan değişince **eski alanın PTY'leri kapanır.**
   *
   * `Term` sökülürken PTY'yi bilerek kapatmıyor (bölme yeniden çizilirse aynı
   * oturuma bağlı kalmalı), ama arka plandaki bir alanın okuma iş parçacıkları
   * kimsenin dinlemediği olaylar yayardı ve alan sayısıyla birlikte artardı.
   * Oturum **ölmüyor** — tmux'ta yaşıyor ve geri dönülünce `attach` tam
   * yeniden çizim getiriyor (Aşama 6'da ölçüldü).
   */
  const oncekiAlan = useRef(durum.etkin);
  useEffect(() => {
    if (oncekiAlan.current === durum.etkin) return;
    const eski = durum.alanlar.find((a) => a.id === oncekiAlan.current);
    oncekiAlan.current = durum.etkin;
    for (const s of oturumlar(eski?.agac ?? null))
      void ptyClose(s).catch(() => {});
  }, [durum]);

  /** Açık bölmelerin oturum adları — kenar çubuğu bunu okuyor. */
  const panes = useMemo(() => oturumlar(agac), [agac]);

  /**
   * Bölme başlığının yazdığı **canlı** durum: `eymistaken@ZorinOS: ~yol` ve
   * ön planda çalışan program.
   *
   * ⚠️ Kaynak `tview` **değil.** O liste pcbridge'in `tmux_list` aracından
   * geliyor ve 10 saniyede bir tazeleniyor; kullanıcı klasör değiştirince
   * başlığın on saniye eski dizini yazması kabul edilemez. Bu harita yerel
   * `tmux display-message` çağrılarından doluyor ve `cd`'den hemen sonra
   * elle tazelenebiliyor.
   */
  const [infos, setInfos] = useState<Record<string, PtyInfo>>({});
  /** `oturumSonlandir` bir kez kuruluyor; yükleyiciyi ref'ten çağırıyor. */
  const terminalleriYukleRef = useRef<() => Promise<void>>(async () => {});
  const [etiketler, setEtiketler] = useState<Record<string, string>>(okuEtiketler);

  useEffect(() => {
    try {
      localStorage.setItem(ETIKET_KEY, JSON.stringify(etiketler));
    } catch {
      // Kalıcılık kaybolur; oturum içi etiketler çalışmaya devam eder.
    }
  }, [etiketler]);

  /** Boş etiket **siler** ve dinamik başlığa döndürür. */
  const etiketYaz = useCallback((session: string, ad: string) => {
    setEtiketler((eski) => {
      const yeni = { ...eski };
      const kirpik = ad.trim();
      if (kirpik) yeni[session] = kirpik;
      else delete yeni[session];
      return yeni;
    });
  }, []);

  const infoTazele = useCallback(async (adlar: string[]) => {
    if (adlar.length === 0) return;
    const ciftler = await Promise.all(
      adlar.map(async (ad) => {
        try {
          return [ad, await ptyInfo(ad)] as const;
        } catch {
          // Oturum henüz doğmamış ya da ölmüş olabilir; başlık o zaman
          // oturum adına düşüyor. Hata gösterilmiyor: bu bir yoklama.
          return null;
        }
      }),
    );
    setInfos((eski) => {
      const yeni = { ...eski };
      for (const c of ciftler) if (c) yeni[c[0]] = c[1];
      return yeni;
    });
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

  /**
   * Yeni terminal — **ad sorulmuyor.**
   *
   * Adı Rust üretiyor (`term1`, `term2`…) ve o ad teknik kimlik: ağacın,
   * `localStorage`'ın, PTY `HashMap`'inin ve olay yüklerinin anahtarı.
   * Başlıkta görünen `eymistaken@ZorinOS: ~` ise **etiket** ve `pty_info`'dan
   * geliyor. Elle ad vermek isteyen yol sağ tık menüsünde.
   *
   * Ağaçtaki adlar `taken` olarak gidiyor: bölme açılmış ama `pty_open` daha
   * dönmemişse tmux'ta o oturum henüz yok ve ad iki kez seçilebilirdi.
   */
  const yeniTerminal = useCallback(async () => {
    try {
      const ad = await tmuxFreeName(oturumlar(agacRef.current));
      // ⚠️ **Ölü oturumun etiketi yeni terminale yapışıyordu.** Etiket
      // haritasının anahtarı tmux adı, ve `free_name` adları geri
      // dönüştürüyor: oturum ölünce `term1` yeniden boşa çıkıyor ve bir
      // zamanlar ona verilmiş ad başlıkta yeniden beliriyor. Gerçek
      // `localStorage`'ta ölçüldü (2026-09-12): tmux sunucusu kapalıyken kayıt
      // hâlâ `{"term1":"Pcbridge"}` taşıyordu ve her yeni ilk terminal
      // "Pcbridge" adıyla doğuyordu. `free_name` adın tmux'ta **olmadığını**
      // garanti ediyor, yani buradaki etiket her koşulda ölü bir oturumun.
      etiketYaz(ad, "");
      setAgac((a) => ekle(a, ad));
    } catch (e) {
      setConnError(detailText(e));
    }
  }, [etiketYaz]);

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

  /**
   * Oturumu **sonlandırır** — bölme kapatmaktan ayrı ve geri dönüşü yok.
   *
   * İki yerden çağrılıyor (kenar çubuğu satırı ve sağ tık menüsü); ikinci bir
   * kopya yazmak yerine tek fonksiyon. Bu depoda aynı işi yapan iki
   * denetimden biri bir kez ölü kalmıştı.
   */
  const oturumSonlandir = useCallback((name: string) => {
    void tmuxKill(name)
      .then(() => {
        // Etiket öldürülen oturuma aitti; adı geri dönüştüğünde yeni bir
        // terminale yapışmasın diye kaynağında siliniyor. Boş ad `etiketYaz`
        // için zaten "sil" demek — ikinci bir silme yolu yazılmadı.
        etiketYaz(name, "");
        // Oturum öldü: onu gösteren bölme de kalkmalı — hangi alanda olursa
        // olsun. Arka plandaki bir alanda ölü bir bölme bırakmak, oraya
        // dönene kadar görünmeyen bir hata olurdu.
        setDurum((d) => oturumDus(d, name));
        return terminalleriYukleRef.current();
      })
      .catch((e) => setConnError(errorText(e as ConnError)));
  }, [etiketYaz]);

  /**
   * Kenar çubuğundan bir oturumu açık bir bölmenin **üstüne** bırakmak.
   *
   * Gelen oturum ağaçta zaten varsa iş `takas`'a düşüyor (iki bölme yer
   * değiştiriyor, kimse arka plana atılmıyor); yoksa bölmedeki oturum arka
   * plana düşüyor ve PTY'si kapanıyor. **Oturum ölmüyor** — tmux'ta yaşamaya
   * devam ediyor ve kenar çubuğunda "burada değil" listesine geçiyor.
   */
  const oturumYerlestir = useCallback((session: string, bolmeId: string) => {
    const mevcut = agacRef.current;
    if (!mevcut) return;
    const { agac: yeni, dusen } = oturumKoy(mevcut, bolmeId, session);
    if (yeni === mevcut) return;
    setAgac(yeni);
    if (dusen) void ptyClose(dusen).catch(() => {});
    void terminalleriYukleRef.current();
  }, []);

  // ─────────────────────── çalışma alanları ───────────────────────
  //
  // Hepsi `durumRef` üstünden okuyor, state güncelleyicinin **içinde** yan
  // etki yapmıyor: StrictMode güncelleyiciyi iki kez çağırıyor ve `ptyClose`
  // orada iki kez gönderilirdi.

  const alanSec = useCallback((id: string) => {
    setDurum((d) => etkinYap(d, id));
  }, []);

  /**
   * Yeni alan sıradaki **boş** numarayla doğuyor; adı sekmede çift tıkla
   * değişiyor.
   *
   * ⚠️ Numara listenin uzunluğundan değil, kullanılmayan ilk sayıdan geliyor:
   * alanlar artık kapatılabildiği için "Alan 1, Alan 2" varken 1'i kapatmak
   * uzunluğu 1'e düşürüyor ve sıradaki alan da "Alan 2" olurdu. Ad rengi de
   * besliyor (`hueOf`), yani iki aynı adlı sekme aynı renkte olurdu.
   */
  const alanYeni = useCallback(() => {
    setDurum((d) => {
      let n = 1;
      while (d.alanlar.some((a) => a.ad === t("area.n", { n }))) n += 1;
      return alanEkle(d, t("area.n", { n }));
    });
  }, []);

  /**
   * Alanın varsayılan klasörü — burada doğan terminaller oradan başlıyor.
   *
   * ⚠️ **`.catch(() => null)` YOK**, bölme klasörü seçicisindeki gerekçenin
   * aynısı: iptali `null` ile bildiren bir API'de `catch` yalnızca gerçek
   * hatayı gizler ve tuş ölü görünür (CLAUDE.md, bir yıl süren dışa aktarma
   * hatası).
   */
  const alanKlasorSec = useCallback(async (id: string) => {
    const alan = durumRef.current.alanlar.find((a) => a.id === id);
    try {
      const secilen = await open({
        directory: true,
        multiple: false,
        defaultPath: alan?.dizin || undefined,
        title: t("area.chooseDir"),
      });
      if (typeof secilen !== "string") return; // kullanıcı iptal etti
      setDurum((d) => alanKlasor(d, id, secilen));
    } catch (e) {
      setConnError(detailText(e));
    }
  }, []);

  /** Alanın varsayılan klasörünü kaldırır; alan yeniden `~`'da doğuruyor. */
  const alanKlasorSil = useCallback((id: string) => {
    setDurum((d) => alanKlasor(d, id, ""));
  }, []);

  const alanAdiYaz = useCallback((id: string, ad: string) => {
    setDurum((d) => alanAdlandir(d, id, ad));
  }, []);

  /**
   * Alanı kapatır. İçindeki oturumlar **ölmüyor** — PTY'leri kapanıyor,
   * tmux'ta yaşamaya devam ediyorlar ve kenar çubuğunda "burada değil"
   * listesinde görünüyorlar. Bu, bölme kapatmanın kuralının aynısı.
   */
  const alanKapat = useCallback((id: string) => {
    const { durum: yeni, dusenler } = alanSil(durumRef.current, id);
    if (yeni === durumRef.current) return;
    // Kapanan alan etkin olansa `oncekiAlan` etkisi de tetiklenirdi ve aynı
    // oturumlar iki kez kapatılırdı; kaydırmayı burada yapıyoruz.
    oncekiAlan.current = yeni.etkin;
    setDurum(yeni);
    for (const s of dusenler) void ptyClose(s).catch(() => {});
  }, []);

  /** Oturumu başka bir alana taşır ve orayı etkin yapar. */
  const oturumAlanaTasi = useCallback((session: string, hedef: string) => {
    setDurum((d) => oturumTasi(d, session, hedef));
  }, []);

  const terminalleriYukle = useCallback(async () => {
    try {
      setTview(await loadTerminals());
    } catch (e) {
      setConnError(errorText(e as ConnError));
    }
  }, []);
  terminalleriYukleRef.current = terminalleriYukle;

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

  /**
   * Bölme başlıklarının canlı durumu.
   *
   * Bölme listesi değişince hemen, sonra 4 saniyede bir: `terminals()`'in 10
   * saniyesinden sık, çünkü başlıktaki dizin ve çalışan program kullanıcının
   * gözünün önünde. Çağrı yerel ve ucuz (ölçüldü: `tmux display-message`
   * milisaniyeler), ama gereksiz sıklık da tmux sunucusunu meşgul eder.
   */
  useEffect(() => {
    if (mode !== "terminals") return;
    void infoTazele(panes);
    const t = setInterval(() => void infoTazele(panes), 4000);
    return () => clearInterval(t);
  }, [mode, panes, infoTazele]);

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
  const alanDegistir = useCallback(
    async (bot: Bot, yama: Partial<BotDraft>) => {
      try {
        const yeni = await updateBot(bot.id, { ...botDraft(bot), ...yama });
        setBots((prev) => prev.map((b) => (b.id === yeni.id ? yeni : b)));
      } catch (e) {
        setChatError(detailText(e));
      }
    },
    [],
  );

  // Canlı akış.
  useEffect(() => {
    void pendingPermissions()
      .then(setPending)
      .catch(() => undefined);
    const abonelikler = [
      listen<PendingPermission>("job://permission", (e) => {
        setPending((p) => [
          ...p.filter((x) => x.runId !== e.payload.runId),
          e.payload,
        ]);
      }),
      listen<ChunkPayload>("job://chunk", (e) => {
        const p = e.payload;
        if (p.sessionId !== oturumRef.current) return;
        const simdi = performance.now();
        for (const olay of p.events) {
          if (
            (olay.kind === "text" || olay.kind === "thinking") &&
            olay.delta
          ) {
            hizPencere.current.push(simdi);
          }
        }
        setTurns((prev) =>
          prev.map((t) =>
            t.jobId === p.jobId
              ? { ...t, events: [...t.events, ...p.events] }
              : t,
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
        if (modeRef.current === "terminals") void yeniTerminal();
        else setForge({});
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [setMode, yeniTerminal]);

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
      // ⚠️ **Ölçüm sökümden önce.** `setSelectedSession` `SessionHome`'u
      // söküp `Chat`'i kuruyor; bestecinin ortadaki yeri o karede
      // kayboluyor. `inis.ts` farkı yeni bestecinin mount'unda oynatıyor.
      if (!selectedSession) inisiKaydet();
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
      setChatError(
        t("chat.exported", { path: await exportSession(bot.id, sid, yol) }),
      );
    } catch (e) {
      setChatError(detailText(e));
    }
  }, []);

  // Süren iş: seçili botun bitmemiş son turu.
  const suren = [...turns].reverse().find((t) => {
    const s = t.meta.status;
    return (
      t.meta.exitCode === null &&
      (s === "running" || s === null || s === undefined)
    );
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
        {/* Artı yalnızca terminal kipinde: bot kipinde "yeni bot" listenin
         * sonunda bir satır (tasarım başlıkta artı göstermiyor).
         *
         * ⚠️ Eskiden burası kenar çubuğundaki bir metin alanını odaklıyordu ve
         * kullanıcı tmux oturum adını **elle** yazmak zorundaydı. Artık ad
         * sorulmuyor: Rust boş bir ad üretiyor, başlık `user@host: ~dizin`
         * yazıyor ve elle adlandırma sağ tık menüsünde. */}
        {mode === "terminals" && (
          <button
            className="ib"
            type="button"
            title={t("term.newSessionTitle")}
            aria-label={t("term.newSession")}
            onClick={() => void yeniTerminal()}
          >
            <IconPlus />
          </button>
        )}
      </div>

      {/* ⚠️ `.side__modes` sınıfını ModeSwitch'in KENDİSİ taşıyor; buradaki
       * ikinci sarmalayıcı kalktı. İki öğe aynı sınıfı taşıyınca dolgu iki
       * kez uygulanıyordu. */}
      <ModeSwitch mode={mode} onMode={setMode} />

      <div className="side__govde">{icerik}</div>
    </div>
  );

  /*
   * ⚠️ **İki kip de BAĞLI kalıyor — kip anahtarındaki kasmanın sebebi buydu.**
   *
   * Eskiden `.main` `key="agents"` / `key="terminals"` ile zorla yeniden
   * kuruluyordu. Terminal kipine her geçişte dört `Term` sıfırdan doğuyordu:
   * yazı tipi beklemesi, 20 CSS tokeninin `getComputedStyle` ile okunması,
   * `new Terminal` + üç eklenti + `open` + `fit`, bir IPC, iki `listen`, bir
   * `ResizeObserver`, bir `MutationObserver` — hepsi kayan parçanın 300 ms'lik
   * geçişiyle aynı pencerede. Ölçüldü (WebKitGTK, 8 geçiş): **5 kare 33 ms'yi
   * aşıyor, en uzunu 91 ms.**
   *
   * Görünmeyen kip `visibility: hidden` ile duruyor — `display: none`
   * **kullanılmıyor**: gizli kapta viewport 0x0 oluyor, `fit()` bozuluyor ve
   * geçişler hiç ilerlemiyor (CLAUDE.md, Aşama 12 ölçümü).
   *
   * Terminal ağacı **ilk geçişte tembel** kuruluyor: hiç terminale
   * geçmeyen kullanıcı o maliyeti hiç ödemiyor.
   */
  const terminalKatmani = terminalAcildi && (
    <div
      className="katman"
      data-yon="sag"
      data-etkin={mode === "terminals" || undefined}
    >
      <div className="main">
        <Terminals
          view={tview}
          infos={infos}
          etiketler={etiketler}
          onEtiket={etiketYaz}
          onKill={oturumSonlandir}
          onInfoTazele={(adlar) => void infoTazele(adlar)}
          onHata={setConnError}
          agac={agac}
          onAgac={setAgac}
          dizin={etkinDizin(durum)}
          alanlar={durum.alanlar}
          etkinAlan={durum.etkin}
          onAlanaTasi={oturumAlanaTasi}
          onReload={() => {
            void terminalleriYukle();
            void infoTazele(oturumlar(agacRef.current));
          }}
        />
      </div>
    </div>
  );

  const terminalKenari = terminalAcildi && (
    <div
      className="katman"
      data-yon="sag"
      data-etkin={mode === "terminals" || undefined}
    >
      <TerminalSidebar
        view={tview}
        infos={infos}
        etiketler={etiketler}
        onEtiket={etiketYaz}
        onYerlestir={oturumYerlestir}
        alanlar={durum.alanlar}
        etkinAlan={durum.etkin}
        onAlanSec={alanSec}
        onAlanYeni={alanYeni}
        onAlanAd={alanAdiYaz}
        onAlanKapat={alanKapat}
        onAlanKlasor={(id) => void alanKlasorSec(id)}
        onAlanKlasorSil={alanKlasorSil}
        onAlanaTasi={oturumAlanaTasi}
        panes={panes}
        desktop={desktop}
        onOpenSystem={() => {
          setSelectedId(undefined);
          setMode("agents");
        }}
        onToggleDesktop={() => void masaustuCevir()}
        onOpen={(name) => setAgac(ekle(agac, name))}
        onKill={oturumSonlandir}
      />
    </div>
  );

  return (
    <div className="shell">
      {yanKabuk(
        <>
          {terminalKenari}
          <div
            className="katman"
            data-yon="sol"
            data-etkin={mode === "agents" || undefined}
          >
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
              onDeleteSession={(sid) =>
                selectedId && void oturumSil(selectedId, sid)
              }
              onEdit={(bot) => setForge({ bot })}
              onDelete={setSilinecek}
              onNewBot={() => setForge({})}
              refreshing={busyConn}
              connError={connError}
              waiting={pending.map((p) => p.botId)}
            />
          </div>
        </>,
      )}

      <div className="ana">
        {terminalKatmani}
        <div
          className="katman"
          data-yon="sol"
          data-etkin={mode === "agents" || undefined}
        >
          <div className="main">
            {secili && !selectedSession ? (
              <>
                <div className="main__head">
                  {/* ⚠️ **Adın kendisi düğme (2026-09-12).** Sağ üstteki
                    * `DÜZENLE` kelimesi kalktı; kullanıcının kararı:
                    * *"sol üstte ornith yazan o bot isminin kendisine
                    * tıklayınca direkt açılsın botforge. daha mantıklı
                    * olur."* Arada bir kalem ikonu da denenmedi — o da
                    * ikinci bir hedef olurdu. */}
                  <button
                    type="button"
                    className="main__head__ad"
                    title={t("side.editBot", { name: secili.name })}
                    aria-label={t("side.editBot", { name: secili.name })}
                    onClick={() => setForge({ bot: secili })}
                  >
                    {secili.name}
                  </button>
                  {/* Künye kenar çubuğundan buraya taşındı: tasarımda bot
                   * satırı tek satır ve modeli, araç sayısını, dizini
                   * başlık söylüyor. */}
                  <span className="main__head__kunye">
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
                </div>
                <SessionHome
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
                            onForce={(v: boolean) =>
                              void alanDegistir(secili, { forceWhenBusy: v })
                            }
                            onEditTools={() => setForge({ bot: secili })}
                          />
                          <div style={{ flexGrow: 1 }} />
                        </>
                      }
                    />
                  }
                />
                {chatError && <div className="home__hata">{chatError}</div>}
              </>
            ) : secili ? (
              <Chat
                bot={secili}
                turns={turns}
                running={
                  suren
                    ? {
                        jobId: suren.jobId,
                        startedAt: suren.meta.startedAt,
                        label: suren.meta.label ?? suren.prompt,
                      }
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
                  if (secili.permission !== p)
                    void alanDegistir(secili, { permission: p });
                }}
                onForce={(v) => void alanDegistir(secili, { forceWhenBusy: v })}
                ctx={ctx}
                tps={tps}
                baseUrl={modelKaynak}
                compacting={compacting}
                onCompact={() =>
                  selectedSession && void ozetle(secili, selectedSession)
                }
                efforts={
                  snap.agents
                    .find((a) => a.id === secili.agent)
                    ?.models.find((m) => m.id === secili.model)?.efforts ?? []
                }
                onEffort={(e) => void alanDegistir(secili, { effort: e })}
                onEditBot={() => setForge({ bot: secili })}
                onExport={() =>
                  selectedSession && void disaAktar(secili, selectedSession)
                }
              />
            ) : (
              <>
                <div className="main__head">
                  <span className="main__head__ad">{t("sys.title")}</span>
                  <span className="main__head__kunye">
                    {sayilar(snap.toolCount, snap.agents.length)}
                  </span>
                  <button
                    className="btn-quiet"
                    type="button"
                    title={t("sys.refresh")}
                    aria-label={t("sys.refreshConn")}
                    disabled={busyConn}
                    onClick={() => void tazele()}
                  >
                    {t("sys.refresh")}
                  </button>
                </div>
                <div className="main__body">
                  {connError && (
                    <div
                      style={{
                        marginBottom: 20,
                        padding: "12px 0",
                        borderTop: "1px solid var(--line)",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                        lineHeight: 1.6,
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
        </div>
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {t("del.ask", { name: silIcerik.name })}
            </span>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t("del.blurb")}
            </span>
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="btn-quiet"
                onClick={() => setSilinecek(undefined)}
              >
                {t("del.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void sil(silIcerik)}
              >
                {t("del.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
