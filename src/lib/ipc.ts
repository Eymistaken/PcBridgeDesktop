import { invoke } from "@tauri-apps/api/core";

import { t } from "./i18n";

import type {
  AuditRow,
  Bot,
  BotDraft,
  BotSummary,
  ConnError,
  ConnSnapshot,
  DesktopReply,
  DesktopState,
  McpTool,
  ModelConfig,
  ModelInfo,
  PendingPermission,
  RunCtx,
  Shots,
  TerminalsView,
  Turn,
} from "./types";

/**
 * Tauri, komut `Err(E)` dönerse E'yi olduğu gibi fırlatır. Bizim E'miz
 * `ConnError`; başka bir şey gelirse (panik, seri hâle getirme hatası)
 * `protocol`e düşürüyoruz ki arayüzde `undefined` görünmesin.
 */
function asConnError(e: unknown): ConnError {
  if (e && typeof e === "object" && "kind" in e) {
    return e as ConnError;
  }
  return { kind: "protocol", detail: String(e) };
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw asConnError(e);
  }
}

/** Bağlanılacak uç nokta — Rust söyler, frontend kopyalamaz. */
export const endpoint = () => call<string>("endpoint");

/** Keyring'de kullanılabilir bir token var mı. Token'ın kendisi hiç gelmez. */
export const hasToken = () => call<boolean>("has_token");

/**
 * `token` verilirse onunla dener ve yalnızca çalıştığı kanıtlanınca keyring'e
 * yazılır; verilmezse keyring'deki kullanılır.
 */
export const connect = (token?: string) =>
  call<ConnSnapshot>("connect", { token: token ?? null });

export const refresh = () => call<ConnSnapshot>("refresh");

/** Bağlantıyı kapatır ve token'ı keyring'den siler. */
export const signOut = () => call<void>("sign_out");

/**
 * Rust `#kod` ya da `#kod:ayrıntı` gönderiyor; sözlükte karşılığı varsa
 * seçili dilde yazılır. **Tanınmayan metin olduğu gibi kalır** — pcbridge'in
 * kendi cümlelerini uydurma bir çeviriyle değiştirmek yanlış olurdu.
 */
function kodCoz(detail: string): string {
  if (!detail.startsWith("#")) return detail;
  const i = detail.indexOf(":");
  const kod = i < 0 ? detail.slice(1) : detail.slice(1, i);
  const anahtar = `err.${kod}`;
  const cevrilen = t(anahtar, { detail: i < 0 ? "" : detail.slice(i + 1) });
  return cevrilen === anahtar ? detail : cevrilen;
}

/** Rust'tan düz dizge olarak gelen hata (`BotError`, `PtyError`). */
export function detailText(e: unknown): string {
  return kodCoz(typeof e === "string" ? e : String((e as { detail?: string })?.detail ?? e));
}

/** Hata nesnesini kullanıcıya gösterilecek cümleye çevirir. */
export function errorText(e: ConnError): string {
  switch (e.kind) {
    case "noToken":
      return t("err.noToken");
    case "unauthorized":
      return t("err.unauthorized");
    case "unreachable":
      return t("err.unreachable", { detail: kodCoz(e.detail) });
    case "keyring":
      return kodCoz(e.detail);
    case "protocol":
      // Kendi ürettiğimiz kod zaten tam bir cümle; "Beklenmeyen yanıt"
      // çerçevesi yalnızca sunucudan gelen ham metne takılır.
      return e.detail.startsWith("#")
        ? kodCoz(e.detail)
        : t("err.protocol", { detail: e.detail });
  }
}

// ─────────────────────────────── botlar ───────────────────────────────

export const listBots = () => call<Bot[]>("list_bots");
export const createBot = (draft: BotDraft) => call<Bot>("create_bot", { draft });
export const updateBot = (id: string, draft: BotDraft) =>
  call<Bot>("update_bot", { id, draft });
export const deleteBot = (id: string) => call<void>("delete_bot", { id });

// ─────────────────────────────── koşumlar ───────────────────────────────

/** Botun tüm turları — diskteki `jobs/<id>/` kayıtlarından kurulur. */
export const botHistory = (id: string) => call<Turn[]>("bot_history", { id });

/**
 * Botun son **yerel** koşumundan bağlam defteri.
 *
 * `pcbridge-agent` yolunda `null` döner: koşumu pcbridge yürütüyor ve `usage`
 * bize hiç gelmiyor. O botlarda bar çizilmiyor, uydurma bir sayı gösterilmiyor.
 */
export const botCtx = (id: string) => call<RunCtx | null>("bot_ctx", { id });

/**
 * Kullanıcının açıkça istediği özetleme; düşen mesaj sayısını döner.
 *
 * Otomatik yoldan farkı kazanç tabanının atlanması. **Koşum sürerken
 * çağrılmaz** — akıştaki mesaj listesi o sırada diskle aynı değil.
 */
export const compactBot = (id: string) => call<number>("compact_bot", { id });

/**
 * Sohbeti tek bir JSON dosyasına yazar; yazılan yolu döner.
 *
 * **Sır taşımaz:** ne pcbridge token'ı ne model anahtarı diske yazılıyor —
 * ikisi de keyring'de. Dosyada botun alanları, koşum metaları, olaylar ve
 * bağlam defteri var.
 */
export const exportBot = (id: string, path: string) =>
  call<string>("export_bot", { id, path });

/** Kenar çubuğu satırları — her botun son koşum özeti. */
export const botSummaries = () => call<BotSummary[]>("bot_summaries");

/** `agent_run` → iş kimliği. Akış Tauri olaylarıyla gelir. */
export const sendMessage = (id: string, text: string) =>
  call<{ jobId: string }>("send_message", { id, text });

/**
 * Koşumu durdurur. `botId` yerel koşum için gerekli: iptal edilen döngünün
 * bitiş olayını doğru bota yollayabilmek için.
 */
export const cancelJob = (botId: string, jobId: string) =>
  call<string>("cancel_job", { botId, jobId });

/**
 * Bekleyen bir izin isteğine kullanıcının kararı.
 *
 * `false` dönmesi hata değil: istek bu arada düşmüş olabilir (koşum bitti ya
 * da durduruldu). Arayüz kartı öylece kaldırır.
 */
export const answerPermission = (runId: string, allow: boolean) =>
  call<boolean>("answer_permission", { runId, allow });

/**
 * Yanıt bekleyen izin istekleri.
 *
 * Arayüz yeniden kurulunca yayınlanmış olay kaçıyor; bu olmadan sorulan şey
 * ekrandan siliniyor ve koşum sessizce bekliyordu.
 */
export const pendingPermissions = () => call<PendingPermission[]>("pending_permissions");

/** Açılışta yarım kalmış işleri yeniden izlemeye alır. */
export const resumeWatches = () => call<string[]>("resume_watches");

// ────────────────────────────── terminaller ──────────────────────────────

export const terminals = () => call<TerminalsView>("terminals");

/** `tmux new-session -A -s <ad>` — varsa bağlanır, yoksa yaratır. */
export const ptyOpen = (session: string, cols: number, rows: number, workdir?: string) =>
  call<void>("pty_open", { session, cols, rows, workdir: workdir ?? null });

export const ptyWrite = (session: string, data: string) =>
  call<void>("pty_write", { session, data });

export const ptyResize = (session: string, cols: number, rows: number) =>
  call<void>("pty_resize", { session, cols, rows });

/** Bölmeyi kapatır; **oturum yaşamaya devam eder.** */
export const ptyClose = (session: string) => call<void>("pty_close", { session });

/** Oturumu **sonlandırır** — geri dönüşü yok. */
export const tmuxKill = (session: string) => call<string>("tmux_kill", { session });

// ────────────────────────── masaüstü izni ──────────────────────────

/** Geri sayımın kaynağı: diskteki `desktop_unlock.json`. MCP pollanmaz. */
export const desktopState = () => call<DesktopState>("desktop_state");

export const desktopUnlock = (minutes: number, reason: string) =>
  call<DesktopReply>("desktop_unlock", { minutes, reason });

export const desktopLock = () => call<DesktopReply>("desktop_lock");

/** pcbridge denetim kaydının kuyruğu, eskiden yeniye. */
export const auditTail = (n: number) => call<AuditRow[]>("audit_tail", { n });

export const systemStatus = () => call<string>("system_status");

/** İzin kapalıyken `shots` boş döner ve `note` gerekçeyi taşır. */
export const screenCapture = () => call<Shots>("screen_capture");

// ────────────────────────── model sunucusu ──────────────────────────

/** Kayıtlı adres. Anahtarın **kendisi hiç gelmez**. */
export const modelConfig = () => call<ModelConfig>("model_config");

/**
 * Adresi kaydeder. `key` verilmezse anahtara dokunulmaz; boş dizge verilirse
 * keyring'den **silinir**.
 */
export const saveModelConfig = (baseUrl: string, key?: string) =>
  call<ModelConfig>("save_model_config", { baseUrl, key: key ?? null });

/**
 * `GET /v1/models`. Bağlantıyı denemenin de yolu bu: liste geldiyse sunucu
 * ayakta ve anahtar geçerli demektir. `baseUrl` verilmezse kayıtlı adres.
 */
export const modelModels = (baseUrl?: string) =>
  call<ModelInfo[]>("model_models", { baseUrl: baseUrl ?? null });

/** Araç filtresinin listelediği araçlar — ad, açıklama, şema. */
export const mcpTools = () => call<McpTool[]>("mcp_tools");
