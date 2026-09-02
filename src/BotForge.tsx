import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import Avatar from "./ui/Avatar";
import { createBot, detailText, mcpTools, modelModels, updateBot } from "./lib/ipc";
import { t } from "./lib/i18n";
import { AVATARS, BACKENDS, avatarVar } from "./lib/types";
import { TOOL_GROUPS, byGroup, groupOf, type ToolGroup } from "./lib/tools";
import type {
  Agent,
  Avatar as Tone,
  Backend,
  Bot,
  BotDraft,
  McpTool,
  ModelInfo,
} from "./lib/types";

interface Props {
  agents: Agent[];
  defaultWorkdir: string | null;
  /** Düzenleme kipinde dolu gelir. */
  bot?: Bot;
  suggested: Tone;
  onDone: (bot: Bot) => void;
  onCancel: () => void;
}

const BOS: Omit<BotDraft, "avatar" | "agent"> = {
  name: "",
  backend: "pcbridge-agent",
  model: null,
  effort: null,
  workdir: "",
  preamble: "",
  desktop: false,
  timeout: 1800,
  // **Boş başlar.** Bir bota araç vermek ayrı ve bilinçli bir eylem.
  tools: [],
  contextBudget: 8192,
};

export default function BotForge({
  agents,
  defaultWorkdir,
  bot,
  suggested,
  onDone,
  onCancel,
}: Props) {
  const ilkAjan = bot?.agent ?? agents.find((a) => a.available)?.id ?? agents[0]?.id ?? "";
  const [draft, setDraft] = useState<BotDraft>({
    ...BOS,
    ...(bot ?? {}),
    avatar: bot?.avatar ?? suggested,
    agent: ilkAjan,
    workdir: bot?.workdir ?? defaultWorkdir ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [yerelModeller, setYerelModeller] = useState<ModelInfo[]>([]);
  const [araclar, setAraclar] = useState<McpTool[]>([]);
  const [aracHata, setAracHata] = useState<string>();
  /// Varsayılan araç kümesi bir kez uygulanır; kullanıcı hepsini bilerek
  /// kapatırsa geri gelmemeli.
  const varsayilanKonuldu = useRef(false);

  const yerel = draft.backend === "yerel-model";
  const agent = agents.find((a) => a.id === draft.agent);
  const model = agent?.models.find((m) => m.id === draft.model) ?? null;
  const efforts = model?.efforts ?? [];

  // Yerel arka uç seçilince model listesi ve araçlar gerekiyor. Sunucu
  // kapalıysa liste boş kalır ve form bunu açıkça söyler — sessizce
  // boş bir açılır menü göstermez.
  useEffect(() => {
    if (!yerel) return;
    let iptal = false;
    void (async () => {
      try {
        const [m, a] = await Promise.all([modelModels(), mcpTools()]);
        if (iptal) return;
        setYerelModeller(m);
        setAraclar(a);
        setAracHata(undefined);

        // Yeni bir botta okuma araçları açık başlar; yazma ve masaüstü
        // kapalı. Bir bota yazma aracı vermek ayrı ve bilinçli bir eylem.
        if (!bot && !varsayilanKonuldu.current) {
          varsayilanKonuldu.current = true;
          const okuma = a.filter((x) => groupOf(x) === "read").map((x) => x.name);
          setDraft((d) => (d.tools.length === 0 ? { ...d, tools: okuma } : d));
        }
      } catch (e) {
        if (!iptal) setAracHata(detailText(e));
      }
    })();
    return () => {
      iptal = true;
    };
  }, [yerel]);

  // Ajan değişince o ajanda olmayan model/effort taşınmamalı.
  // Yerel yolda ajan ağacı geçersiz: kaskad hiç çalışmamalı, yoksa
  // kullanıcının seçtiği yerel modeli `null`'a sıfırlar.
  useEffect(() => {
    if (yerel) return;
    if (!agent) return;
    const gecerli = agent.models.some((m) => m.id === draft.model);
    if (!gecerli) {
      const m = agent.models.find((x) => x.id === agent.defaultModel) ?? agent.models[0];
      setDraft((d) => ({
        ...d,
        model: m?.id ?? null,
        effort: m?.defaultEffort ?? null,
      }));
    }
  }, [yerel, agent, draft.model]);

  // Model değişince effort da o modelin listesinden olmalı.
  useEffect(() => {
    if (yerel) return;
    if (!model) return;
    if (draft.effort && model.efforts.includes(draft.effort)) return;
    setDraft((d) => ({ ...d, effort: model.defaultEffort ?? model.efforts[0] ?? null }));
  }, [yerel, model, draft.effort]);

  async function kaydet() {
    setBusy(true);
    setError(undefined);
    try {
      onDone(bot ? await updateBot(bot.id, draft) : await createBot(draft));
    } catch (e) {
      setError(detailText(e));
    } finally {
      setBusy(false);
    }
  }

  async function dizinSec() {
    const secilen = await open({
      directory: true,
      multiple: false,
      defaultPath: draft.workdir || defaultWorkdir || undefined,
      title: t("forge.chooseTitle"),
    });
    if (typeof secilen === "string") setDraft((d) => ({ ...d, workdir: secilen }));
  }

  const gruplar = byGroup(araclar);

  function aracDegistir(ad: string, acik: boolean) {
    setDraft((d) => ({
      ...d,
      tools: acik ? [...d.tools, ad] : d.tools.filter((x) => x !== ad),
    }));
  }

  function grupDegistir(grup: ToolGroup, acik: boolean) {
    const adlar = gruplar[grup].map((x) => x.name);
    setDraft((d) => ({
      ...d,
      tools: acik
        ? [...new Set([...d.tools, ...adlar])]
        : d.tools.filter((x) => !adlar.includes(x)),
    }));
  }

  // Yerel yolda `agent_run` hiç çağrılmıyor; önizleme onu yazsaydı yalan
  // söylerdi.
  const cagri = yerel
    ? `chat(${draft.model ?? "…"}, ${t("forge.nTools", { n: draft.tools.length })})`
    : `agent_run(${draft.agent}${draft.model ? ", " + draft.model : ""}${
        draft.effort ? ", " + draft.effort : ""
      }, ${draft.workdir || "…"}, wait_seconds=0)`;

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={bot ? t("forge.edit") : t("forge.new")}>
      <div className="forge">
        <div className="forge__head">
          <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em" }}>
            {bot ? t("forge.edit") : t("forge.new")}
          </span>
          <div style={{ flexGrow: 1 }} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            {t("forge.livesHere")}
          </span>
        </div>

        <div className="forge__body">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Avatar tone={draft.avatar} name={draft.name || "?"} size={56} />
            <div className="grp" style={{ flexGrow: 1 }}>
              <label className="lbl" htmlFor="bot-ad">
                {t("forge.name")}
              </label>
              <div className="fld" style={{ background: "var(--surface)" }}>
                <input
                  id="bot-ad"
                  autoFocus
                  value={draft.name}
                  placeholder={t("forge.namePlaceholder")}
                  style={{ flexGrow: 1, fontWeight: 500 }}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grp">
            <span className="lbl">{t("forge.mark")}</span>
            <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
              {AVATARS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-label={t}
                  aria-pressed={draft.avatar === t}
                  onClick={() => setDraft({ ...draft, avatar: t })}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9999,
                    flex: "none",
                    background: avatarVar(t),
                    boxShadow:
                      draft.avatar === t
                        ? "0 0 0 2px var(--bg), 0 0 0 4px var(--text)"
                        : undefined,
                  }}
                />
              ))}
              <div style={{ flexGrow: 1 }} />
              <span className="muted" style={{ fontSize: 11.5 }}>
                {t("forge.markHint")}
              </span>
            </div>
          </div>

          <div className="grp">
            <span className="lbl">{t("forge.backend")}</span>
            <div className="seg" role="group" aria-label={t("forge.backend")}>
              {BACKENDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={draft.backend === b}
                  title={t(`forge.backend.${b}.hint`)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      backend: b as Backend,
                      // Bir arka ucun model kimliği ötekinde hiçbir şey ifade
                      // etmiyor. Taşınırsa kullanıcı `sonnet`'i LM Studio'ya
                      // işaret eden bir botla kaydedebilirdi.
                      ...(b === draft.backend ? {} : { model: null, effort: null }),
                    })
                  }
                >
                  {t(`forge.backend.${b}`)}
                </button>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 11.5 }}>
              {t(`forge.backend.${draft.backend}.hint`)}
            </span>
          </div>

          {yerel ? (
            <div className="grp">
              <label className="lbl" htmlFor="bot-yerel-model">
                {t("forge.model")}
              </label>
              <div className="fld">
                <select
                  id="bot-yerel-model"
                  className="mono"
                  value={draft.model ?? ""}
                  style={{ flexGrow: 1 }}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value || null })}
                >
                  <option value="">{t("forge.pickModel")}</option>
                  {/* Kaydedilmiş model sunucuda görünmüyorsa yine de
                      listelenir: seçim sessizce kaybolmamalı. */}
                  {(draft.model && !yerelModeller.some((m) => m.id === draft.model)
                    ? [{ id: draft.model }, ...yerelModeller]
                    : yerelModeller
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </select>
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {aracHata ?? t("forge.modelsFrom", { n: yerelModeller.length })}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 16 }}>
              <div className="grp" style={{ flexGrow: 1 }}>
                <span className="lbl">{t("forge.agent")}</span>
                <div className="seg" role="group" aria-label={t("forge.agent")}>
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!a.available}
                      aria-pressed={draft.agent === a.id}
                      title={a.available ? a.description : t("forge.notOnPath")}
                      onClick={() => setDraft({ ...draft, agent: a.id })}
                    >
                      {a.id}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grp" style={{ width: 200, flex: "none" }}>
                <label className="lbl" htmlFor="bot-model">
                  {t("forge.model")}
                </label>
                <div className="fld">
                  <select
                    id="bot-model"
                    value={draft.model ?? ""}
                    style={{ flexGrow: 1, fontWeight: 500 }}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value || null })}
                  >
                    {(agent?.models ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {yerel && (
            <div className="grp">
              <span className="lbl">{t("forge.tools")}</span>
              {araclar.length === 0 ? (
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {t("forge.toolsUnavailable")}
                </span>
              ) : (
                <div className="toolset">
                  {TOOL_GROUPS.map((g) => {
                    const liste = gruplar[g];
                    if (liste.length === 0) return null;
                    const secili = liste.filter((x) => draft.tools.includes(x.name)).length;
                    return (
                      <div key={g} className="toolset__grup">
                        <div className="toolset__bas">
                          <button
                            type="button"
                            className="toolset__hepsi"
                            aria-pressed={secili === liste.length}
                            onClick={() => grupDegistir(g, secili !== liste.length)}
                          >
                            {t(`forge.toolGroup.${g}`)}
                          </button>
                          <span className="muted" style={{ fontSize: 11.5 }}>
                            {secili}/{liste.length}
                          </span>
                        </div>
                        {g !== "read" && (
                          <span className="muted" style={{ fontSize: 11.5 }}>
                            {t(`forge.toolGroup.${g}.warn`)}
                          </span>
                        )}
                        <div className="toolset__liste">
                          {liste.map((x) => (
                            <button
                              key={x.name}
                              type="button"
                              className="toolset__arac mono"
                              aria-pressed={draft.tools.includes(x.name)}
                              title={x.description ?? x.name}
                              onClick={() =>
                                aracDegistir(x.name, !draft.tools.includes(x.name))
                              }
                            >
                              {x.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {yerel && (
            <div className="grp" style={{ width: 220 }}>
              <label className="lbl" htmlFor="bot-butce">
                {t("forge.budget")}
              </label>
              <div className="fld">
                <input
                  id="bot-butce"
                  className="mono"
                  type="number"
                  min={512}
                  step={512}
                  value={draft.contextBudget}
                  style={{ flexGrow: 1 }}
                  onChange={(e) =>
                    setDraft({ ...draft, contextBudget: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {t("forge.budgetHint")}
              </span>
            </div>
          )}

          {!yerel && (
          <div className="grp">
            <span className="lbl">{t("forge.effort")}</span>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div className="seg" role="group" aria-label={t("forge.effort")}>
                {efforts.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={draft.effort === e}
                    onClick={() => setDraft({ ...draft, effort: e })}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {t("forge.readFrom")}
                {agent && agent.disabled.length > 0 && (
                  <>
                    {" · "}
                    <span style={{ color: "var(--fail)" }}>{agent.disabled.join(", ")}</span>{" "}
                    {t("forge.disabledSuffix")}
                  </>
                )}
              </span>
            </div>
          </div>
          )}

          <div className="grp">
            <label className="lbl" htmlFor="bot-dizin">
              {t("forge.workdir")}
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="fld" style={{ flexGrow: 1 }}>
                <input
                  id="bot-dizin"
                  className="mono"
                  spellCheck={false}
                  value={draft.workdir}
                  placeholder="/home/…"
                  style={{ flexGrow: 1, fontSize: 13 }}
                  onChange={(e) => setDraft({ ...draft, workdir: e.target.value })}
                />
              </div>
              <button type="button" className="fld btn-fld" onClick={() => void dizinSec()}>
                {t("forge.choose")}
              </button>
            </div>
          </div>

          <div className="grp">
            <label className="lbl" htmlFor="bot-yonerge">
              {t("forge.preamble")}
            </label>
            <textarea
              id="bot-yonerge"
              value={draft.preamble}
              placeholder={t("forge.preamblePlaceholder")}
              onChange={(e) => setDraft({ ...draft, preamble: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <button
              type="button"
              role="switch"
              aria-checked={draft.desktop}
              aria-label={t("forge.desktop")}
              className="tgl"
              data-on={draft.desktop ? "1" : undefined}
              onClick={() => setDraft({ ...draft, desktop: !draft.desktop })}
            >
              <span />
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("forge.desktop")}</span>
              <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                {t("forge.desktopHint")}
              </span>
            </div>
          </div>

          {error && (
            <span style={{ fontSize: 13, color: "var(--fail)", lineHeight: 1.5 }}>{error}</span>
          )}
        </div>

        <div className="forge__foot">
          <span className="mono muted" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cagri}
          </span>
          <div style={{ flexGrow: 1 }} />
          <button type="button" className="btn-quiet" onClick={onCancel} disabled={busy}>
            {t("forge.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              busy ||
              !draft.name.trim() ||
              !draft.workdir.trim() ||
              // Yerel yolda model seçilmeden kaydetmek Rust'ta
              // `#modelRequired` ile reddedilirdi; formda engelliyoruz.
              (yerel && !draft.model)
            }
            onClick={() => void kaydet()}
          >
            {busy ? t("forge.saving") : t("forge.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
