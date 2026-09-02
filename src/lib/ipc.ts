import { invoke } from "@tauri-apps/api/core";

import type {
  Avatar,
  Bot,
  BotDraft,
  BotSummary,
  ConnError,
  ConnSnapshot,
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

/** Hata nesnesini kullanıcıya gösterilecek Türkçe cümleye çevirir. */
export function errorText(e: ConnError): string {
  switch (e.kind) {
    case "noToken":
      return "Token bulunamadı.";
    case "unauthorized":
      return "Sunucu token'ı kabul etmedi (401). Doğru statik token'ı yapıştır.";
    case "unreachable":
      return `Sunucuya ulaşılamıyor. pcbridge çalışıyor mu? — ${e.detail}`;
    case "keyring":
      return e.detail;
    case "protocol":
      return `Beklenmeyen yanıt: ${e.detail}`;
  }
}

// ─────────────────────────────── botlar ───────────────────────────────

export const listBots = () => call<Bot[]>("list_bots");
export const createBot = (draft: BotDraft) => call<Bot>("create_bot", { draft });
export const updateBot = (id: string, draft: BotDraft) =>
  call<Bot>("update_bot", { id, draft });
export const deleteBot = (id: string) => call<void>("delete_bot", { id });
export const suggestAvatar = () => call<Avatar>("suggest_avatar");

// ─────────────────────────────── koşumlar ───────────────────────────────

/** Botun tüm turları — diskteki `jobs/<id>/` kayıtlarından kurulur. */
export const botHistory = (id: string) => call<Turn[]>("bot_history", { id });

/** Kenar çubuğu satırları — her botun son koşum özeti. */
export const botSummaries = () => call<BotSummary[]>("bot_summaries");

/** `agent_run` → iş kimliği. Akış Tauri olaylarıyla gelir. */
export const sendMessage = (id: string, text: string) =>
  call<{ jobId: string }>("send_message", { id, text });

export const cancelJob = (jobId: string) => call<string>("cancel_job", { jobId });

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
