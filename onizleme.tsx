/* GEÇİCİ — Aşama doğrulaması için. İşi bitince silinir. (.gitignore'da) */
import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/geist-mono/400.css";
import "./src/styles/tokens.css";
import "./src/styles/app.css";

import Sidebar from "./src/Sidebar";
import Chat from "./src/views/Chat";
import SessionHome from "./src/views/SessionHome";
import TerminalSidebar from "./src/TerminalSidebar";
import Connection from "./src/views/Connection";
import Onboarding from "./src/Onboarding";
import BotForge from "./src/BotForge";
import Terminals from "./src/views/Terminals";
import { duzenKur } from "./src/lib/agac";
import Composer from "./src/ui/Composer";
import PermMenu from "./src/ui/PermMenu";
import ModeSwitch from "./src/ui/ModeSwitch";
import type { Turn, JobEvent, PendingPermission } from "./src/lib/types";
import { setActiveLang } from "./src/lib/i18n";
import type { Bot, BotSummary, ConnSnapshot, DesktopState, SessionSummary } from "./src/lib/types";

// Bileşenler IPC'ye uzanıyor; önizlemede komut başına sahte yanıt.
const sahteIpc: Record<string, unknown> = {
  system_status:
    "host: ZorinOS\nyuk: 0.42 0.51 0.63\nbellek: 9.2G / 32G\ndisk: 412G / 931G",
  audit_tail: [
    { ts: "2026-09-08 17:52:14", event: "screen_capture", detail: "monitör 2 · ölçek 0", denied: false, error: false },
    { ts: "2026-09-08 17:52:19", event: "mouse", detail: "tıklama (2028, 102) · monitör 2 (HDMI-1)", denied: false, error: false },
    { ts: "2026-09-08 17:52:21", event: "keyboard", detail: "type · chars: 23", denied: false, error: false },
    { ts: "2026-09-08 17:52:26", event: "keyboard", detail: "key delete — odak masaüstündeydi", denied: true, error: false },
  ],
  screen_capture: { shots: [], note: "son yakalama · 2 monitör · 3840×1080 · 17:52:14" },
  model_config: { baseUrl: "http://127.0.0.1:1234/v1", hasKey: false },
  model_models: [],
  mcp_tools: [
    { name: "fs_list", description: null, inputSchema: {}, readOnly: true, group: "read" },
    { name: "fs_read", description: null, inputSchema: {}, readOnly: true, group: "read" },
    { name: "fs_search", description: null, inputSchema: {}, readOnly: true, group: "read" },
    { name: "job_list", description: null, inputSchema: {}, readOnly: true, group: "read" },
    { name: "job_status", description: null, inputSchema: {}, readOnly: true, group: "read" },
    { name: "system_status", description: null, inputSchema: {}, readOnly: true, group: "read" },
    { name: "fs_write", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "shell_run", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "shell_run_background", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "agent_run", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "job_cancel", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "tmux_send", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "tmux_keys", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "tmux_start", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "tmux_kill", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "notify", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "ui_click", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "ui_set_text", description: null, inputSchema: {}, readOnly: false, group: "write" },
    { name: "screen_info", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "screen_capture", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "mouse", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "keyboard", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "window_focus", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "window_list", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "ui_dump", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "computer_batch", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "computer_task", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
    { name: "desktop_unlock", description: null, inputSchema: {}, readOnly: false, group: "desktop" },
  ],
  desktop_state: { unlocked: true, remaining: 84, hardRemaining: 2887, reason: "Chrome'da kanal araması", grantedAt: 0, known: true },
};
(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
  invoke: (cmd: string) => Promise.resolve(sahteIpc[cmd] ?? null),
  transformCallback: (f: unknown) => f,
};

setActiveLang("tr");
document.documentElement.setAttribute("lang", "tr");
const tema = new URLSearchParams(location.search).get("tema") || "dark";
document.documentElement.setAttribute("data-theme", tema);

const bot = (id: string, name: string, hue: number, n = 0): Bot => ({
  id, name, avatar: hue, agent: "agy", backend: "yerel-model",
  model: "ornith-1.5-35b-a3b", effort: null, workdir: "/home/eymistaken/Masaüstü/app",
  preamble: "", permission: "sor", timeout: 900,
  tools: ["fs_list", "fs_read", "screen_capture", "mouse", "keyboard"],
  contextBudget: 8192, maxTurns: 100, forceWhenBusy: false,
  sessions: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: "", jobs: [], createdAt: 0, updatedAt: 0 })) as never,
  createdAt: 0, updatedAt: 1757000000,
});

const bots = [bot("b1", "Desktop Bot", 250, 7), bot("b2", "Code Assistant", 150, 12), bot("b3", "Report Bot", 30, 3)];

const summaries: Record<string, BotSummary> = {
  b1: { id: "b1", jobId: "j1", status: null, line: "Chrome'da kanal araması", at: 1757000000, running: true, sessionCount: 7, sessionId: "o1" },
  b2: { id: "b2", jobId: null, status: "finished", line: null, at: 1756900000, running: false, sessionCount: 12, sessionId: null },
  b3: { id: "b3", jobId: null, status: null, line: null, at: 1756800000, running: false, sessionCount: 3, sessionId: null },
};

const sessions: SessionSummary[] = [
  { id: "o1", title: "Chrome'da kanal araması", turnCount: 18, jobId: "j1", status: null, line: null, at: 0, running: true, createdAt: 0, updatedAt: 0 },
  { id: "o2", title: "Masaüstü dosyalarını topla", turnCount: 6, jobId: null, status: "finished", line: null, at: 0, running: false, createdAt: 0, updatedAt: 0 },
  { id: "o3", title: "Ekran çözünürlüğü kontrolü", turnCount: 3, jobId: null, status: "finished", line: null, at: 0, running: false, createdAt: 0, updatedAt: 0 },
  { id: "o4", title: "Vesktop pencere denemesi", turnCount: 9, jobId: null, status: "failed", line: null, at: 0, running: false, createdAt: 0, updatedAt: 0 },
  { id: "o5", title: "Rapor taslağı", turnCount: 2, jobId: null, status: "finished", line: null, at: 0, running: false, createdAt: 0, updatedAt: 0 },
  { id: "o6", title: "Log incelemesi", turnCount: 4, jobId: null, status: "finished", line: null, at: 0, running: false, createdAt: 0, updatedAt: 0 },
  { id: "o7", title: "Bağlam ölçümü", turnCount: 1, jobId: null, status: "finished", line: null, at: 0, running: false, createdAt: 0, updatedAt: 0 },
];

const snap: ConnSnapshot = {
  endpoint: "http://127.0.0.1:8765/mcp", toolCount: 33,
  agents: [{ name: "claude", models: [], efforts: [] }, { name: "agy", models: [], efforts: [] }] as never,
  defaultAgent: "agy", defaultWorkdir: null, rawAgents: null,
};
const kilitli: DesktopState = { unlocked: false, remaining: 0, hardRemaining: 0, reason: null, grantedAt: null, known: true };
const acik: DesktopState = { unlocked: true, remaining: 84, hardRemaining: 2887, reason: "Chrome'da kanal araması", grantedAt: 0, known: true };


const ev = (e: JobEvent) => e;
const simdi = Math.floor(Date.now() / 1000) - 252;
const turlar: Turn[] = [
  {
    jobId: "j1",
    prompt: "Chrome'da sağdaki ekranda kanalı aç ve en yeni videonun başlığını söyle.",
    events: [
      ev({ kind: "thinking", text: "Sağdaki ekran HDMI-1 ve ofseti (1920,0), yani global x = 1920 + görüntü x. Önce monitör 2'yi yakalayıp kanal sekmesini bulmalıyım; tıklamadan önce ekranın hangi bölgesinde olduğunu doğrulayacağım.", ms: 4200, delta: false }),
      ev({ kind: "toolStart", id: "1", tool: "screen_info", detail: "2 monitör · DP-2 (0,0) · HDMI-1 (1920,0)" }),
      ev({ kind: "toolEnd", id: "1", ok: true }),
      ev({ kind: "toolStart", id: "2", tool: "screen_capture", detail: "monitör 2 · ölçek 0 · 1920×1080" }),
      ev({ kind: "toolEnd", id: "2", ok: true }),
      ev({ kind: "toolStart", id: "3", tool: "window_focus", detail: "chrome — “YouTube — Chromium”" }),
      ev({ kind: "toolEnd", id: "3", ok: true }),
      ev({ kind: "toolStart", id: "4", tool: "mouse", detail: "tıklama (2028, 102) · monitör 2 (HDMI-1)" }),
      ev({ kind: "text", text: "Kanal sayfası açıldı. En yeni video **“Aşama 19 — terminal bölme ağacı”**, 2 gün önce yüklenmiş.\n\nİki not:\n\n- Adres çubuğuna `ctrl+l` ile gittim; tıklama üçüncü denemede kapıya takılıyordu.\n- `ui_dump` Chrome'da boş döndü, ekran görüntüsüne düştüm.", delta: false }),
    ] as JobEvent[],
    meta: { jobId: "j1", status: null, exitCode: null, startedAt: simdi, finishedAt: null } as never,
  },
];

const izin: PendingPermission = {
  runId: "r1", botId: "b1", sessionId: "o1", kind: "arac",
  tool: "keyboard", detail: "type · 23 karakter", group: "desktop",
  args: '{"action":"type","text":"pcbridge-desktop"}',
} as never;


const tview = {
  sessions: [
    { name: "claude", command: "claude", workdir: "/home/eymistaken/app", attached: false },
    { name: "agy", command: "agy", workdir: "/home/eymistaken/app", attached: true },
    { name: "htop", command: "htop", workdir: "/home/eymistaken", attached: false },
    { name: "logs", command: "journalctl", workdir: "/home/eymistaken", attached: false },
    { name: "build", command: "cargo", workdir: "/home/eymistaken/app", attached: false },
    { name: "backup", command: "rsync", workdir: "/home/eymistaken", attached: false },
  ],
  raw: null,
} as never;
const acikBolmeler = ["claude", "agy", "htop", "logs", "build"];
const agacOrnek = duzenKur(acikBolmeler, "ana");

const bos = () => {};

function Kolon({ baslik, cocuk }: { baslik: string; cocuk: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="h" style={{ paddingLeft: 4 }}>{baslik}</span>
      <div className="side" style={{ height: 620 }}>
        <div className="side__head"><span className="side__title">pcbridge</span></div>
        {cocuk}
      </div>
    </div>
  );
}

function Yan(p: Partial<React.ComponentProps<typeof Sidebar>>) {
  return (
    <>
      <ModeSwitch mode="agents" onMode={bos} />
      <div className="side__govde">
        <div className="katman" data-yon="sol" data-etkin>
          <Sidebar
            snap={snap} desktop={kilitli} onOpenSystem={bos} onToggleDesktop={bos}
            bots={bots} summaries={summaries} selectedId="b1" onSelect={bos}
            sessions={sessions} selectedSession="o1" onSelectSession={bos}
            onDeleteSession={bos} onEdit={bos} onDelete={bos} onNewBot={bos}
            refreshing={false} waiting={[]} {...p}
          />
        </div>
      </div>
    </>
  );
}

const ekran = new URLSearchParams(location.search).get("ekran") ?? "chat";

const ajanlar = [
  { id: "claude", description: "Claude Code CLI", available: true, path: "/usr/local/bin/claude", models: [{ id: "sonnet", efforts: ["low", "medium", "high"] }, { id: "opus", efforts: [] }] },
  { id: "agy", description: "Antigravity CLI", available: true, path: "/home/eymistaken/.local/bin/agy", models: [{ id: "ornith-1.5-35b-a3b", efforts: [] }] },
] as never;

function Ana() {
  if (ekran === "term") {
    return (
      <Terminals agac={agacOrnek} view={tview} onAgac={bos} onOpen={bos} onClose={bos} onReload={bos} />
    );
  }
  if (ekran === "sys") {
    return (
      <>
        <div className="main__head">
          <span className="main__head__ad">Sistem</span>
          <span className="main__head__kunye">33 araç · 2 ajan</span>
          <button className="btn-quiet">Tazele</button>
        </div>
        <div className="main__body">
          <Connection
            snap={{ ...snap, agents: ajanlar }}
            theme="dark" onTheme={bos} lang="tr" onLang={bos}
            desktop={acik} onDesktop={bos}
          />
        </div>
      </>
    );
  }
  if (ekran === "home") {
    return (
      <>
        <div className="main__head">
          <span className="av" style={{ width: 11, height: 11, background: "oklch(var(--av-l) var(--av-c) 250)" }} />
          <span className="main__head__ad">Desktop Bot</span>
          <span className="main__head__kunye">ornith-1.5-35b-a3b · 11 araç · ~/Masaüstü/app</span>
          <button className="btn-quiet">Düzenle</button>
        </div>
        <SessionHome
          sessions={sessions} onOpen={bos} onDelete={bos}
          composer={
            <Composer
              botName="Desktop Bot" workdir="/home/eymistaken" busy={false}
              resetKey="x" onSend={bos}
              foot={<><PermMenu value="sor" botName="Desktop Bot" tools={bots[0].tools} force={false} onChange={bos} onForce={bos} onEditTools={bos} /><div style={{ flexGrow: 1 }} /></>}
            />
          }
        />
      </>
    );
  }
  return (
    <Chat
      bot={bots[0]} turns={turlar}
      running={{ jobId: "j1", startedAt: simdi, label: "Chrome'da kanal araması" }}
      busy sessionId="o1" sessionCount={7}
      onSend={bos} onCancel={bos} pending={izin} onAnswer={bos}
      onPermission={bos} onForce={bos} ctx={null} tps={null}
      baseUrl="http://127.0.0.1:1234/v1" compacting={false} onCompact={bos}
      efforts={[]} onEffort={bos} onEditBot={bos} onExport={bos}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {ekran === "welcome" ? (
      <Onboarding
        endpoint="http://127.0.0.1:8765/mcp"
        hasStoredToken
        error={{ kind: "unauthorized" } as never}
        onReady={bos}
        onCleared={bos}
      />
    ) : ekran === "forge" ? (
      <BotForge
        agents={ajanlar} defaultWorkdir="/home/eymistaken"
        bot={{ ...bots[0], tools: ["fs_list","fs_read","fs_search","job_list","job_status","system_status","screen_info","screen_capture","mouse","keyboard","window_focus"] }} cikiyor={false} onCancel={bos} onDone={bos}
      />
    ) : (
    <div className="shell" style={{ height: "100vh" }}>
      <div className="side">
        <div className="side__head"><span className="side__title">pcbridge</span></div>
        {ekran === "term" ? (
          <>
            <ModeSwitch mode="terminals" onMode={bos} />
            <div className="side__govde">
              <div className="katman" data-yon="sag" data-etkin>
                <TerminalSidebar
                  view={tview} panes={acikBolmeler} desktop={acik} newSignal={0}
                  onOpen={bos} onNew={bos} onKill={bos} onOpenSystem={bos}
                  onToggleDesktop={bos}
                />
              </div>
            </div>
          </>
        ) : (
          <Yan desktop={acik} selectedId={ekran === "sys" ? undefined : "b1"} />
        )}
      </div>
      <div className="main">
        <Ana />
      </div>
    </div>
    )}
  </React.StrictMode>,
);
