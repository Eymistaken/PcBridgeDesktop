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

/** Altı hazır ton. Hex değil **ad** saklanır — renk temadan çözülür. */
export type Avatar = "mor" | "mavi" | "cam" | "yesil" | "kehribar" | "mercan";

export const AVATARS: Avatar[] = ["mor", "mavi", "cam", "yesil", "kehribar", "mercan"];

/** `var(--av-mor)` gibi — koyu ve aydınlık temada farklı hex'e çözülür. */
export const avatarVar = (a: Avatar) => `var(--av-${a})`;

export interface Bot {
  id: string;
  name: string;
  avatar: Avatar;
  agent: string;
  model: string | null;
  effort: string | null;
  workdir: string;
  preamble: string;
  desktop: boolean;
  timeout: number;
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
  model: string | null;
  effort: string | null;
  workdir: string;
  preamble: string;
  desktop: boolean;
  timeout: number;
}

// ─────────────────────────────── koşumlar ───────────────────────────────

export type JobEvent =
  | { kind: "session"; id: string; model: string | null; cwd: string | null }
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
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
  | { kind: "raw"; text: string };

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
