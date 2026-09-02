import Desktop from "./Desktop";
import { IconCheck, IconCross } from "../ui/Icon";
import type { Agent, ConnSnapshot, DesktopState, Theme } from "../lib/types";

interface Props {
  snap: ConnSnapshot;
  theme: Theme;
  onTheme: (t: Theme) => void;
  desktop: DesktopState;
  onDesktop: (s: DesktopState) => void;
}

/**
 * Sistem paneli: bot seçili değilken ana panelin kalıcı görünümü. Kenar
 * çubuğunun dibindeki şerit buraya getiriyor.
 *
 * **Masaüstü izni en üstte:** bu panelin en sonuç doğuran parçası o, ve
 * durumu her açılışta gözle görünmeli.
 */
export default function Connection({ snap, theme, onTheme, desktop, onDesktop }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      <Desktop state={desktop} onState={onDesktop} />

      <div className="card">
        <span className="h">Sunucu</span>
        <Facts
          rows={[
            ["Uç nokta", <span className="mono">{snap.endpoint}</span>],
            ["Araç", `${snap.toolCount}`],
            [
              "Varsayılan ajan",
              snap.defaultAgent ? <span className="mono">{snap.defaultAgent}</span> : "—",
            ],
            [
              "Varsayılan dizin",
              snap.defaultWorkdir ? (
                <span className="mono">{snap.defaultWorkdir}</span>
              ) : (
                "—"
              ),
            ],
          ]}
        />
      </div>

      <div className="card">
        <span className="h">Ajanlar — {snap.agents.length}</span>
        {snap.agents.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 13.5 }}>
              Sunucu ajan listesi döndürdü ama ayrıştırılamadı.
            </span>
            {snap.rawAgents && (
              <pre
                className="mono"
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  borderRadius: "var(--r-sm)",
                  background: "var(--field)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  overflowX: "auto",
                }}
              >
                {snap.rawAgents}
              </pre>
            )}
          </div>
        ) : (
          snap.agents.map((a) => <AgentBlock key={a.id} agent={a} />)
        )}
      </div>

      <div className="card">
        <span className="h">Kısayollar</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(
            [
              ["Ctrl 1", "Botlar"],
              ["Ctrl 2", "Terminal"],
              ["Ctrl N", "Yeni bot · yeni oturum"],
              ["Ctrl 0", "Bu panel"],
              ["Enter", "Gönder"],
              ["Shift Enter", "Satır atla"],
              ["Esc", "Pencereyi kapat"],
            ] as const
          ).map(([tus, ne]) => (
            <div key={tus} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="kbd">{tus}</span>
              <span style={{ fontSize: 13 }}>{ne}</span>
            </div>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          Metin alanında ve terminal bölmesinde <span className="mono">Ctrl N</span> çalışmaz —
          her tuş yazdığın yere gider.
        </span>
      </div>

      <div className="card">
        <span className="h">Görünüm</span>
        <div className="seg" role="group" aria-label="Tema">
          {(["system", "dark", "light"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={theme === t}
              onClick={() => onTheme(t)}
            >
              {t === "system" ? "Sistem" : t === "dark" ? "Koyu" : "Aydınlık"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span className="muted" style={{ fontSize: 12.5, width: 130, flex: "none" }}>
            {k}
          </span>
          <span style={{ fontSize: 13, minWidth: 0, overflowWrap: "anywhere" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function AgentBlock({ agent }: { agent: Agent }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "13px 15px",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {agent.available ? <IconCheck /> : <IconCross />}
        <span className="mono" style={{ fontSize: 13.5, fontWeight: 500 }}>
          {agent.id}
        </span>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {agent.description}
        </span>
      </div>

      {agent.path && (
        <span className="mono muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>
          {agent.path}
        </span>
      )}

      {agent.models.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {agent.models.map((m) => {
            const isDefault = m.id === agent.defaultModel;
            return (
              <div
                key={m.id}
                style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: 12.5 }}
              >
                <span
                  className="mono"
                  style={{ width: 150, flex: "none", fontWeight: isDefault ? 500 : 400 }}
                >
                  {m.id}
                  {isDefault && " ·"}
                </span>
                <span className="muted" style={{ minWidth: 0 }}>
                  {m.efforts.map((e, i) => (
                    <span key={e}>
                      {i > 0 && ", "}
                      <span
                        style={
                          e === m.defaultEffort
                            ? { color: "var(--text)", fontWeight: 500 }
                            : undefined
                        }
                      >
                        {e}
                      </span>
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(agent.disabled.length > 0 || agent.optIn.length > 0 || agent.note) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
          {agent.disabled.length > 0 && (
            <span className="muted">Engelli: {agent.disabled.join(", ")}</span>
          )}
          {agent.optIn.length > 0 && (
            <span className="muted">Yalnızca açıkça istenirse: {agent.optIn.join(", ")}</span>
          )}
          {agent.note && <span className="muted">Not: {agent.note}</span>}
        </div>
      )}
    </div>
  );
}
