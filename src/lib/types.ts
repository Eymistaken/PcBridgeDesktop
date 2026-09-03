/** Rust tarafındaki `mcp::AgentModel` ile birebir. */
export interface AgentModel {
  id: string;
  efforts: string[];
  defaultEffort: string | null;
}

/** Rust tarafındaki `mcp::Agent` ile birebir. */
export interface Agent {
  id: string;
  description: string;
  available: boolean;
  path: string | null;
  defaultModel: string | null;
  defaultEffort: string | null;
  models: AgentModel[];
  /** Sunucunun "engelli (secilemez)" dediği modeller. */
  disabled: string[];
  /** "yalnizca acikca istenirse" listesi. */
  optIn: string[];
  note: string | null;
}

export interface ConnSnapshot {
  endpoint: string;
  toolCount: number;
  agents: Agent[];
  defaultAgent: string | null;
  defaultWorkdir: string | null;
  /** Ayrıştırıcı hiçbir ajan çıkaramadıysa ham metin. */
  rawAgents: string | null;
}

/** Rust tarafındaki `mcp::ConnError` — `#[serde(tag="kind", content="detail")]`. */
export type ConnError =
  | { kind: "noToken" }
  | { kind: "unauthorized" }
  | { kind: "unreachable"; detail: string }
  | { kind: "keyring"; detail: string }
  | { kind: "protocol"; detail: string };

export type Theme = "system" | "dark" | "light";

// ─────────────────────────────── botlar ───────────────────────────────

/**
 * Kimlik rengi: **hue** (0-359), `null` ise addan türetilir.
 *
 * Açıklık ve doygunluk temadan geliyor (`--av-l` / `--av-c`) ve sabit; bu
 * yüzden avatardaki harfin kontrastı hue'dan bağımsız garanti. 360 hue'nun
 * hepsi için hesaplandı: koyu temada en düşük oran 4,62, aydınlıkta 4,88 —
 * AA'nın (4,5) altına düşen hue yok.
 */
export type Avatar = number | null;

/**
 * Addan hue: FNV-1a, 0-359.
 *
 * **Karma yalnızca burada.** Rust yalnızca sayıyı saklıyor; iki dilde iki
 * karma er geç ayrışır ve aynı botun rengi iki yerde farklı çıkardı.
 *
 * Ad `tr-TR` kurallarıyla küçültülüyor — avatardaki harf de `toLocaleUpperCase`
 * ile büyütülüyor, ikisi aynı alfabede kalsın.
 */
export function hueOf(name: string): number {
  const s = name.trim().toLocaleLowerCase("tr-TR");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // FNV asalıyla çarpma; `Math.imul` 32 bitte kalmayı garanti ediyor.
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % 360;
}

/** Botun fiilen çizilecek hue'su: elle seçim varsa o, yoksa addan. */
export const hueFor = (avatar: Avatar, name: string): number =>
  avatar ?? hueOf(name);

/** Temanın açıklık/doygunluğuyla birleşmiş renk. */
export const avatarVar = (hue: number) => `oklch(var(--av-l) var(--av-c) ${hue})`;

/**
 * Koşumu **kim yürütüyor**.
 *
 * `pcbridge-agent`: eski yol — pcbridge bir CLI başlatır, araçlar o CLI'nın
 * kendi MCP yapılandırmasından gelir.
 * `yerel-model`: yeni yol — döngü uygulamanın içinde döner, araçları modele
 * uygulama verir ve modelin tarafında hiçbir kurulum gerekmez.
 */
export type Backend = "pcbridge-agent" | "yerel-model";

export const BACKENDS: Backend[] = ["pcbridge-agent", "yerel-model"];

/**
 * Botun izin kipi: gördüğü aracı sormadan çalıştırabilir mi.
 *
 * Araç **filtresinden ayrı bir soru.** Filtre "bu bot neyi görebilir", kip
 * "gördüğünü sormadan yapabilir mi" der. Okuma hiçbir kipte sorulmaz — onu
 * filtre zaten karara bağladı.
 *
 * | Kip | Okuma | Yazma | Masaüstü |
 * |---|---|---|---|
 * | `sor` | serbest | sorar | sorar |
 * | `yazma-serbest` | serbest | serbest | sorar |
 * | `serbest` | serbest | serbest | serbest |
 */
export type Permission = "sor" | "yazma-serbest" | "serbest";

export const PERMISSIONS: Permission[] = ["sor", "yazma-serbest", "serbest"];

/**
 * Her kipin **sorduğu** gruplar — Rust'taki `tools::Izin::sorar` ile birebir.
 *
 * Kararı bu tablo vermiyor; kipi Rust uyguluyor. Burası yalnızca arayüzün
 * "bu kip neye uygulanıyor" diye anlatabilmesi için.
 */
export const SORAR: Record<Permission, ToolGroup[]> = {
  sor: ["write", "desktop"],
  "yazma-serbest": ["desktop"],
  serbest: [],
};

export interface Bot {
  id: string;
  name: string;
  avatar: Avatar;
  agent: string;
  backend: Backend;
  model: string | null;
  effort: string | null;
  workdir: string;
  preamble: string;
  permission: Permission;
  timeout: number;
  /** Modele gösterilen araçlar. **Boş = hiçbiri.** */
  tools: string[];
  /** Bağlam bütçesi (token); aşılınca geçmiş özetlenir. */
  contextBudget: number;
  /**
   * Bir koşumdaki en fazla model gidiş-dönüşü.
   *
   * **Bot başına**, çünkü sohbet botuyla masaüstü botunun ihtiyacı aynı değil.
   * Tavana gelince koşum düşmez, kullanıcıya devam edip etmeyeceği sorulur.
   */
  maxTurns: number;
  /**
   * Masaüstü araçlarına `force=true` eklensin mi.
   *
   * pcbridge, kullanıcı klavye/fareye son 60 saniyede dokunduysa **yazma**
   * eylemlerini reddediyor. Botu izleyerek çalıştıran kullanıcıda kapı hiç
   * açılmıyor. **Varsayılan kapalı:** bir güvenlik kapısını kaldırmak
   * bilinçli bir eylem olmalı.
   */
  forceWhenBusy: boolean;
  sessionId: string | null;
  /** Koşum kimlikleri, eskiden yeniye. Geçmiş bunlardan kurulur. */
  jobs: string[];
  createdAt: number;
  updatedAt: number;
}

/** Formdan gelen alanlar; `id` ve zaman damgaları Rust tarafında konur. */
export interface BotDraft {
  name: string;
  avatar: Avatar;
  agent: string;
  backend: Backend;
  model: string | null;
  effort: string | null;
  workdir: string;
  preamble: string;
  permission: Permission;
  timeout: number;
  tools: string[];
  contextBudget: number;
  maxTurns: number;
  forceWhenBusy: boolean;
}

/**
 * Kayıtlı bir bottan form taslağı.
 *
 * `updateBot` bir `BotDraft` bekliyor; bir `Bot`'u olduğu gibi yollamak
 * çalışırdı (Rust bilinmeyen alanları yutuyor) ama hangi alanların gerçekten
 * yazıldığı örtük kalırdı. Kip menüsü ile form aynı dönüşümü kullanıyor.
 */
export function botDraft(bot: Bot): BotDraft {
  return {
    name: bot.name,
    avatar: bot.avatar,
    agent: bot.agent,
    backend: bot.backend,
    model: bot.model,
    effort: bot.effort,
    workdir: bot.workdir,
    preamble: bot.preamble,
    permission: bot.permission,
    timeout: bot.timeout,
    tools: bot.tools,
    contextBudget: bot.contextBudget,
    maxTurns: bot.maxTurns,
    forceWhenBusy: bot.forceWhenBusy,
  };
}

// ────────────────────────────── model sunucusu ──────────────────────────────

/** Kayıtlı adres. Anahtarın **kendisi hiç gelmez**, yalnızca var olup olmadığı. */
export interface ModelConfig {
  baseUrl: string;
  hasKey: boolean;
}

export interface ModelInfo {
  id: string;
  /**
   * Sunucunun bildirdiği bağlam uzunluğu (token).
   *
   * **OpenAI standardında yok** — LM Studio'nun kendi `/api/v0/models`
   * ucundan geliyor. Başka bir sunucuda gelmez; o zaman bütçe kendiliğinden
   * doldurulmaz, kullanıcının yazdığı değer kalır.
   */
  contextLength?: number;
  /** Model görüntü okuyabiliyor mu. */
  vision?: boolean;
}

/** Bir MCP aracının modele anlatılabilecek hâli. */
export interface McpTool {
  name: string;
  description: string | null;
  inputSchema: unknown;
  /** Sunucunun ipucu; grup zaten bunu hesaba katıyor, burada yalnızca bilgi. */
  readOnly: boolean | null;
  /** Aracın grubu — **Rust'ta** hesaplanır, kipi uygulayan yer orası. */
  group: ToolGroup;
}

/** Araç filtresindeki üç grup. Rust'taki `tools::Grup` ile birebir. */
export type ToolGroup = "read" | "write" | "desktop";

export const TOOL_GROUPS: ToolGroup[] = ["read", "write", "desktop"];

/**
 * Yanıt bekleyen bir izin isteği.
 *
 * Koşum başına en fazla bir tane olur: araçlar sırayla yürütülüyor. Koşum
 * kullanıcı yanıtlayana kadar **bekler**; zaman aşımı yok.
 */
export interface PendingPermission {
  runId: string;
  botId: string;
  /**
   * Ne soruluyor: bir araç çağrısı mı, yoksa tur tavanına gelmiş koşumun
   * devam edip etmeyeceği mi. Aynı kuyruk ve aynı kart ikisini de taşıyor —
   * ikinci bir bekleme makinesi kurulmuyor.
   */
  kind: "arac" | "tur";
  /** Araç çağrısının kimliği; tur sorusunda `tur-<n>`. */
  id: string;
  /** Tur sorusunda boş. */
  tool: string;
  /** Araçta argüman özeti, turda o ana kadarki tur sayısı. */
  detail: string;
  /** Tur sorusunun grubu **yok**: bir araç değil, koşumun kendisi soruluyor. */
  group: ToolGroup | null;
  /** Argümanların ham JSON'ı: kullanıcı **neyi** onayladığını görmeli. */
  args: string;
}

// ─────────────────────────────── koşumlar ───────────────────────────────

export type JobEvent =
  | { kind: "session"; id: string; model: string | null; cwd: string | null }
  /**
   * Ajanın söylediği metin. `delta` bu parçanın öncekine **nasıl**
   * ekleneceğini söyler: CLI ayrıştırıcıları tamamlanmış bloklar yayar
   * (satır atlanarak birleşir), uygulamanın kendi döngüsü token akışı yayar
   * (olduğu gibi birleşir). Eski kayıtlarda alan yok — blok sayılır.
   */
  | { kind: "text"; text: string; delta?: boolean }
  /**
   * Ajanın düşünmesi. `ms` yalnızca **kapanış** olayında dolu: bir turun
   * düşünme akışı bitince metinsiz tek bir olay geliyor ve süreyi o taşıyor.
   * Eski kayıtlarda alan yok; başlık o zaman süresiz yazılır.
   */
  | { kind: "thinking"; text: string; delta?: boolean; ms?: number }
  | { kind: "toolStart"; id: string; tool: string; detail: string }
  | { kind: "toolEnd"; id: string; ok: boolean }
  | {
      kind: "finished";
      ok: boolean;
      turns: number | null;
      durationMs: number | null;
      costUsd: number | null;
      error: string | null;
    }
  | { kind: "raw"; text: string }
  /**
   * Bağlam özetlendi: bu olaydan **öncesi** tek bir mesajla değiştirildi.
   * Yalnızca uygulamanın kendi ajan döngüsü üretir. `text` `#summaryFailed`
   * ise özetleme başarısız olmuş ve sert kırpmaya düşülmüştür.
   */
  | { kind: "summary"; text: string; dropped: number };

/**
 * Bir koşumun bağlam defteri — `runs/<id>/ctx.json`.
 *
 * `promptTokens` sunucunun **ölçtüğü** sayı (`stream_options.include_usage`),
 * tahmin değil; özetleme eşiği de besteci altındaki bar da buna bakıyor.
 */
export interface RunCtx {
  promptTokens: number;
  /** Doluysa bu koşum bir **denetim noktası**: öncesi bu özetle değişti. */
  summary: string | null;
  dropped: number;
  breakdown: Dokum;
}

/**
 * Bağlamın parçaları — **karakter cinsinden, ölçülerek.**
 *
 * Toplam `promptTokens` kesin; bu kırılım değil. Modelin tokenizer'ı elimizde
 * yok ve olmayan bir kesinliği varmış gibi göstermek yanlış olurdu — arayüz
 * bu satırları `≈` ile yazıyor.
 */
export interface Dokum {
  systemChars: number;
  toolChars: number;
  tools: number;
  historyChars: number;
  messages: number;
  /** Görüntü **karakter değil**; maliyeti ayrı bir kalem. */
  images: number;
}

/** `job://ctx` — her turda bir kez, bar canlı aksın diye. */
export interface CtxPayload {
  runId: string;
  botId: string;
  ctx: RunCtx;
}

/** `job://compacting` — anlık durum, diske yazılmıyor. */
export interface CompactPayload {
  runId: string;
  botId: string;
  active: boolean;
}

export interface JobMeta {
  id: string;
  kind: string | null;
  label: string | null;
  cwd: string | null;
  parser: string | null;
  status: string | null;
  exitCode: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  agent: string | null;
  prompt: string | null;
  resumeSession: string | null;
}

/** Bir tur: kullanıcının yazdığı + ajanın ürettikleri. */
export interface Turn {
  jobId: string;
  prompt: string;
  meta: JobMeta;
  events: JobEvent[];
}

/** Tauri olayları. */
export interface ChunkPayload {
  jobId: string;
  botId: string;
  events: JobEvent[];
}

export interface StatusPayload {
  jobId: string;
  botId: string;
  meta: JobMeta;
  done: boolean;
}

export interface BotSummary {
  id: string;
  jobId: string | null;
  status: string | null;
  /** Ajanın son söylediği satır. */
  line: string | null;
  at: number | null;
  running: boolean;
}

// ────────────────────────────── terminaller ──────────────────────────────

export interface TmuxSession {
  name: string;
  /** Oturumda çalışan program — bash, claude, journalctl… */
  command: string;
  workdir: string;
  /** Fiziksel bir terminal de bu oturuma bağlı mı. */
  attached: boolean;
}

export interface TerminalsView {
  sessions: TmuxSession[];
  /** Bu uygulamada bölmesi açık olanlar. */
  openHere: string[];
  raw: string | null;
}

export interface PtyData {
  session: string;
  /** Ham baytlar base64'te. */
  b64: string;
}

export type Mode = "agents" | "terminals";

// ─────────────────────────── masaüstü izni ───────────────────────────

/** Rust tarafındaki `desktop::DesktopState` ile birebir. */
export interface DesktopState {
  unlocked: boolean;
  /** Kayan kiranın kalanı, saniye. */
  remaining: number;
  /** Sert tavanın kalanı. `remaining`'den büyükse ikisi de gösterilir. */
  hardRemaining: number;
  reason: string | null;
  grantedAt: number | null;
  /** Durum dosyası okunabildi mi. Okunamadıysa **kilitli** sayılır. */
  known: boolean;
}

/** `desktop_unlock` / `desktop_lock` yanıtı: sunucunun cümlesi + gerçek durum. */
export interface DesktopReply {
  state: DesktopState;
  message: string;
}

export interface AuditRow {
  ts: string;
  event: string;
  detail: string;
  denied: boolean;
  error: boolean;
}

export interface Shots {
  shots: { src: string }[];
  /** Sunucunun metin yanıtı — izin kapalıyken ret gerekçesi burada. */
  note: string;
}
