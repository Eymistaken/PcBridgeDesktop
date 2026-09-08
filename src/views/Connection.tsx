import { useState } from "react";

import Desktop from "./Desktop";
import ModelServer from "./ModelServer";
import Seg from "../ui/Seg";
import Oluk from "../ui/Oluk";
import { IconCheck, IconCross } from "../ui/Icon";
import { LANGS, t, type Lang } from "../lib/i18n";
import type { Agent, ConnSnapshot, DesktopState, Theme } from "../lib/types";

interface Props {
  snap: ConnSnapshot;
  theme: Theme;
  onTheme: (t: Theme) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
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
type Bolum =
  "baglanti" | "model" | "ajanlar" | "masaustu" | "gorunum" | "kisayollar";

/**
 * Sistem paneli: bot seçili değilken ana panelin kalıcı görünümü. Kenar
 * çubuğunun dibindeki şerit buraya getiriyor.
 *
 * ⚠️ **Eskiden altı kart tek uzun sütundaydı** — içlerinde 390 satırlık
 * masaüstü paneli de vardı — ve her şey kaydırılarak aranıyordu. Artık sol
 * bölüm listesi + sağ panel: her bölüm tek ekrana sığıyor.
 *
 * Sıra sonuç doğurma gücüne göre: masaüstü izni bu panelin en sonuç
 * doğuran parçası, o yüzden listede yukarıda ve **açılışta seçili.**
 */
export default function Connection({
  snap,
  theme,
  onTheme,
  lang,
  onLang,
  desktop,
  onDesktop,
}: Props) {
  const [bolum, setBolum] = useState<Bolum>("masaustu");

  // ⚠️ Bölüm satırlarının ikonları KALKTI: tasarımda düz metin ve altı
  // çizili seçim var. İkonlar sadece çizilmemekle kalmayıp veriden de
  // düşürüldü — okunmayan bir alan bu depoda bir kez bir yıl yaşadı.
  const bolumler: { id: Bolum; ad: string }[] = [
    { id: "masaustu", ad: t("sys.secDesktop") },
    { id: "baglanti", ad: t("sys.secConnection") },
    { id: "model", ad: t("sys.secModel") },
    { id: "ajanlar", ad: t("sys.secAgents") },
    { id: "gorunum", ad: t("sys.secAppearance") },
    { id: "kisayollar", ad: t("sys.secShortcuts") },
  ];

  return (
    <div className="sys">
      <div className="sysnav" role="tablist" aria-label={t("sys.title")}>
        {bolumler.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={bolum === b.id}
            onClick={() => setBolum(b.id)}
          >
            {b.ad}
          </button>
        ))}
      </div>

      {/* `key` bölüm değişince içeriği yeniden kurar — giriş devinimi
       * oynasın diye. İçerideki durum (süre seçimi, gerekçe metni)
       * kısa ömürlü ve zaten sıfırlanması doğru. */}
      <div className="sysgov" key={bolum} role="tabpanel">
        {bolum === "masaustu" && (
          <Desktop state={desktop} onState={onDesktop} />
        )}
        {bolum === "baglanti" && (
          <Oluk et={t("sys.server")}>
            <Facts
              rows={[
                [
                  t("sys.endpoint"),
                  <span className="mono">{snap.endpoint}</span>,
                ],
                [t("sys.tools"), `${snap.toolCount}`],
                [
                  t("sys.defaultAgent"),
                  snap.defaultAgent ? (
                    <span className="mono">{snap.defaultAgent}</span>
                  ) : (
                    "—"
                  ),
                ],
                [
                  t("sys.defaultWorkdir"),
                  snap.defaultWorkdir ? (
                    <span className="mono">{snap.defaultWorkdir}</span>
                  ) : (
                    "—"
                  ),
                ],
              ]}
            />
          </Oluk>
        )}
        {bolum === "model" && <ModelServer />}
        {bolum === "ajanlar" && (
          <Oluk et={t("sys.secAgents")}>
            {snap.agents.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13.5 }}>
                  {t("sys.agentsUnparsed")}
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
          </Oluk>
        )}
        {bolum === "gorunum" && (
          <Oluk et={t("sys.secAppearance")}>
            <div className="grp">
              <span className="lbl">{t("sys.theme")}</span>
              <Seg
                value={theme}
                ariaLabel={t("sys.theme")}
                options={[
                  { value: "system", label: t("sys.themeSystem") },
                  { value: "dark", label: t("sys.themeDark") },
                  { value: "light", label: t("sys.themeLight") },
                ]}
                onChange={onTheme}
              />
            </div>

            <div className="grp">
              <span className="lbl">{t("sys.language")}</span>
              {/* Dil adları kendi dillerinde yazılır — "Türkçe" arayüz
                İngilizceyken de Türkçe okunur. */}
              <Seg
                value={lang}
                ariaLabel={t("sys.language")}
                options={LANGS.map((l) => ({
                  value: l,
                  label: t(l === "en" ? "sys.langEn" : "sys.langTr"),
                }))}
                onChange={onLang}
              />
            </div>
          </Oluk>
        )}
        {bolum === "kisayollar" && (
          <Oluk et={t("sys.secShortcuts")}>
            <div className="kisayollar">
              {(
                [
                  ["Ctrl 1", t("mode.bots")],
                  ["Ctrl 2", t("mode.terminals")],
                  ["Ctrl N", t("sys.scNewBot")],
                  ["Ctrl 0", t("sys.scPanel")],
                  ["Enter", t("sys.scSend")],
                  ["Shift Enter", t("sys.scNewline")],
                  ["Esc", t("sys.scClose")],
                ] as const
              ).map(([tus, ne]) => (
                <div key={tus} className="kisayol">
                  <span className="kbd">{tus}</span>
                  <span>{ne}</span>
                </div>
              ))}
            </div>
            <span className="sysnot">{t("sys.scHint")}</span>
          </Oluk>
        )}
      </div>
    </div>
  );
}

/** Ad–değer satırları; her satırın altında cetvel. */
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="facts">
      {rows.map(([k, v]) => (
        <div key={k} className="facts__row">
          <span className="facts__ad">{k}</span>
          <span className="facts__deger">{v}</span>
        </div>
      ))}
    </div>
  );
}

function AgentBlock({ agent }: { agent: Agent }) {
  return (
    <div className="ajan">
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {agent.available ? <IconCheck /> : <IconCross />}
        <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
          {agent.id}
        </span>
        <span className="sysnot">{agent.description}</span>
      </div>

      {agent.path && (
        <span
          className="mono muted"
          style={{ fontSize: 12, overflowWrap: "anywhere" }}
        >
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
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  fontSize: 12.5,
                }}
              >
                <span
                  className="mono"
                  style={{
                    width: 150,
                    flex: "none",
                    fontWeight: isDefault ? 500 : 400,
                  }}
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            fontSize: 12,
          }}
        >
          {agent.disabled.length > 0 && (
            <span className="muted">
              {t("sys.disabled", { list: agent.disabled.join(", ") })}
            </span>
          )}
          {agent.optIn.length > 0 && (
            <span className="muted">
              {t("sys.optIn", { list: agent.optIn.join(", ") })}
            </span>
          )}
          {agent.note && (
            <span className="muted">{t("sys.note", { note: agent.note })}</span>
          )}
        </div>
      )}
    </div>
  );
}
