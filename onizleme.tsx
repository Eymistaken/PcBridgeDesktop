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
import ModeSwitch from "./src/ui/ModeSwitch";
import { setActiveLang } from "./src/lib/i18n";
import type { Bot, BotSummary, ConnSnapshot, DesktopState, SessionSummary } from "./src/lib/types";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div style={{ display: "flex", gap: 26, padding: 26, background: "var(--bg)", minHeight: "100vh", alignItems: "flex-start" }}>
      <Kolon baslik="olağan · session açık" cocuk={<Yan desktop={acik} />} />
      <Kolon baslik="izin bekliyor" cocuk={<Yan waiting={["b3"]} selectedId="b3" sessions={[]} />} />
      <Kolon baslik="bot yok" cocuk={<Yan bots={[]} selectedId={undefined} sessions={[]} />} />
      <Kolon baslik="bağlantı yok" cocuk={<Yan connError="connection refused · 127.0.0.1:8765" bots={[]} selectedId={undefined} sessions={[]} />} />
    </div>
  </React.StrictMode>,
);
