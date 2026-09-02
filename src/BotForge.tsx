import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import Avatar from "./ui/Avatar";
import { createBot, updateBot } from "./lib/ipc";
import { AVATARS, avatarVar } from "./lib/types";
import type { Agent, Avatar as Tone, Bot, BotDraft } from "./lib/types";

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
  model: null,
  effort: null,
  workdir: "",
  preamble: "",
  desktop: false,
  timeout: 1800,
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

  const agent = agents.find((a) => a.id === draft.agent);
  const model = agent?.models.find((m) => m.id === draft.model) ?? null;
  const efforts = model?.efforts ?? [];

  // Ajan değişince o ajanda olmayan model/effort taşınmamalı.
  useEffect(() => {
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
  }, [agent, draft.model]);

  // Model değişince effort da o modelin listesinden olmalı.
  useEffect(() => {
    if (!model) return;
    if (draft.effort && model.efforts.includes(draft.effort)) return;
    setDraft((d) => ({ ...d, effort: model.defaultEffort ?? model.efforts[0] ?? null }));
  }, [model, draft.effort]);

  async function kaydet() {
    setBusy(true);
    setError(undefined);
    try {
      onDone(bot ? await updateBot(bot.id, draft) : await createBot(draft));
    } catch (e) {
      setError(typeof e === "string" ? e : String((e as { detail?: string })?.detail ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function dizinSec() {
    const secilen = await open({
      directory: true,
      multiple: false,
      defaultPath: draft.workdir || defaultWorkdir || undefined,
      title: "Çalışma dizini",
    });
    if (typeof secilen === "string") setDraft((d) => ({ ...d, workdir: secilen }));
  }

  const cagri = `agent_run(${draft.agent}${draft.model ? ", " + draft.model : ""}${
    draft.effort ? ", " + draft.effort : ""
  }, ${draft.workdir || "…"}, wait_seconds=0)`;

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={bot ? "Botu düzenle" : "Yeni bot"}>
      <div className="forge">
        <div className="forge__head">
          <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em" }}>
            {bot ? "Botu düzenle" : "Yeni bot"}
          </span>
          <div style={{ flexGrow: 1 }} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            Bu uygulamada yaşar · <span className="mono">config.toml</span>'a dokunulmaz
          </span>
        </div>

        <div className="forge__body">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Avatar tone={draft.avatar} name={draft.name || "?"} size={56} />
            <div className="grp" style={{ flexGrow: 1 }}>
              <label className="lbl" htmlFor="bot-ad">
                Ad
              </label>
              <div className="fld" style={{ background: "var(--surface)" }}>
                <input
                  id="bot-ad"
                  autoFocus
                  value={draft.name}
                  placeholder="Köprü Bakımı"
                  style={{ flexGrow: 1, fontWeight: 500 }}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grp">
            <span className="lbl">İşaret</span>
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
                altısı da aynı L ve C · yalnızca hue değişir
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div className="grp" style={{ flexGrow: 1 }}>
              <span className="lbl">Ajan</span>
              <div className="seg" role="group" aria-label="Ajan">
                {agents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={!a.available}
                    aria-pressed={draft.agent === a.id}
                    title={a.available ? a.description : "PATH'te bulunamadı"}
                    onClick={() => setDraft({ ...draft, agent: a.id })}
                  >
                    {a.id}
                  </button>
                ))}
              </div>
            </div>
            <div className="grp" style={{ width: 200, flex: "none" }}>
              <label className="lbl" htmlFor="bot-model">
                Model
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

          <div className="grp">
            <span className="lbl">Effort</span>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div className="seg" role="group" aria-label="Effort">
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
                <span className="mono">list_agents</span>'tan okundu
                {agent && agent.disabled.length > 0 && (
                  <>
                    {" · "}
                    <span style={{ color: "var(--fail)" }}>{agent.disabled.join(", ")}</span> kapalı
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grp">
            <label className="lbl" htmlFor="bot-dizin">
              Çalışma dizini
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="fld" style={{ flexGrow: 1 }}>
                <input
                  id="bot-dizin"
                  className="mono"
                  spellCheck={false}
                  value={draft.workdir}
                  placeholder="/home/eymistaken"
                  style={{ flexGrow: 1, fontSize: 13 }}
                  onChange={(e) => setDraft({ ...draft, workdir: e.target.value })}
                />
              </div>
              <button type="button" className="fld btn-fld" onClick={() => void dizinSec()}>
                Seç…
              </button>
            </div>
          </div>

          <div className="grp">
            <label className="lbl" htmlFor="bot-yonerge">
              Kalıcı yönerge · her prompt'un başına eklenir
            </label>
            <textarea
              id="bot-yonerge"
              value={draft.preamble}
              placeholder="Türkçe cevap ver. Ölçmediğin şeyi “çalışıyor” diye yazma."
              onChange={(e) => setDraft({ ...draft, preamble: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <button
              type="button"
              role="switch"
              aria-checked={draft.desktop}
              aria-label="Masaüstü izni"
              className="tgl"
              data-on={draft.desktop ? "1" : undefined}
              onClick={() => setDraft({ ...draft, desktop: !draft.desktop })}
            >
              <span />
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>Masaüstü izni</span>
              <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                Açılırsa her koşumda <span className="mono">desktop_unlock</span> istenir —
                sanal klavye ve fare. Süre dolunca kendiliğinden kapanır.
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
            Vazgeç
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !draft.name.trim() || !draft.workdir.trim()}
            onClick={() => void kaydet()}
          >
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
