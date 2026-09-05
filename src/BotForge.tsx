import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import Avatar from "./ui/Avatar";
import Picker from "./ui/Picker";
import Seg from "./ui/Seg";
import { gecirYukseklik, olcOnce, type YukseklikIzi } from "./lib/yukseklik";
import {
  createBot,
  detailText,
  mcpTools,
  modelModels,
  updateBot,
} from "./lib/ipc";
import { t } from "./lib/i18n";
import { BACKENDS, PERMISSIONS, SORAR, hueFor } from "./lib/types";
import { TOOL_GROUPS, byGroup, type ToolGroup } from "./lib/tools";
import type {
  Agent,
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
  onDone: (bot: Bot) => void;
  onCancel: () => void;
  /** Kapanış devinimi sürerken `true` — `useCikis` söküme kadar bunu verir. */
  cikiyor?: boolean;
}

type Sekme = "kimlik" | "motor" | "araclar" | "calisma";
const SEKMELER: Sekme[] = ["kimlik", "motor", "araclar", "calisma"];

const BOS: Omit<BotDraft, "avatar" | "agent"> = {
  name: "",
  backend: "pcbridge-agent",
  model: null,
  effort: null,
  workdir: "",
  preamble: "",
  // **En kısıtlayıcı kip başlangıç.** Yeni bir botun sessizce her şeyi
  // sormadan yapması, kipi bir tercih değil bir sürprize çevirirdi.
  permission: "sor",
  timeout: 1800,
  // **Boş başlar.** Bir bota araç vermek ayrı ve bilinçli bir eylem.
  tools: [],
  contextBudget: 8192,
  // 24 masaüstü işinde yetmiyordu (ölçüldü): bak-uygula-bak döngüsü doğası
  // gereği onlarca adım. Tavana gelince koşum düşmüyor, soruluyor.
  maxTurns: 100,
  // **Kapalı.** Bir güvenlik kapısını kaldırmak bilinçli bir eylem olmalı.
  forceWhenBusy: false,
};

export default function BotForge({
  agents,
  defaultWorkdir,
  bot,
  onDone,
  onCancel,
  cikiyor,
}: Props) {
  const ilkAjan =
    bot?.agent ?? agents.find((a) => a.available)?.id ?? agents[0]?.id ?? "";
  const [draft, setDraft] = useState<BotDraft>({
    ...BOS,
    ...(bot ?? {}),
    avatar: bot?.avatar ?? null,
    agent: ilkAjan,
    workdir: bot?.workdir ?? defaultWorkdir ?? "",
  });
  const [sekme, setSekme] = useState<Sekme>("kimlik");
  /**
   * Sekmeler farklı yükseklikte: ölçüldü, ajan arka ucunda 242 ↔ 555 px,
   * yerel modelde 325 ↔ 635 px. Sekme değişince örtü sertçe zıplıyordu;
   * yükseklik `gecirYukseklik` ile geçiyor (düşünce kutusu ve katlanır
   * session listesiyle aynı yardımcı).
   */
  const forgeRef = useRef<HTMLDivElement>(null);
  const yukIz = useRef<number | null>(null) as YukseklikIzi;
  useLayoutEffect(
    () => gecirYukseklik(yukIz, forgeRef.current, "var(--dur-base)"),
    [sekme],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [yerelModeller, setYerelModeller] = useState<ModelInfo[]>([]);
  const [araclar, setAraclar] = useState<McpTool[]>([]);
  const [aracHata, setAracHata] = useState<string>();
  /// Varsayılan araç kümesi bir kez uygulanır; kullanıcı hepsini bilerek
  /// kapatırsa geri gelmemeli.
  const varsayilanKonuldu = useRef(false);

  const yerel = draft.backend === "yerel-model";

  /**
   * Model seçilince bağlam bütçesini sunucunun bildirdiği uzunluğa çeker.
   *
   * LM Studio'da modeli kaç token'a yüklediysen bütçe o oluyor; elle
   * kopyalamak gereksiz bir adım ve yanlış yazılması kolay. **Yalnızca sunucu
   * söylediyse** değişiyor — bilgi gelmezse kullanıcının yazdığı değer
   * korunuyor, uydurulmuyor. Alan düzenlenebilir kalıyor.
   */
  function modelSec(id: string) {
    const m = yerelModeller.find((x) => x.id === id);
    setDraft((d) => ({
      ...d,
      model: id || null,
      contextBudget: m?.contextLength ?? d.contextBudget,
    }));
  }

  /** Seçenek satırının sağındaki ikincil bilgi. */
  function modelNotu(m: ModelInfo): string | undefined {
    const parcalar: string[] = [];
    if (m.contextLength)
      parcalar.push(t("forge.ctxTokens", { n: kisaSayi(m.contextLength) }));
    if (m.vision) parcalar.push(t("forge.vision"));
    return parcalar.length > 0 ? parcalar.join(" · ") : undefined;
  }

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
          const okuma = a.filter((x) => x.group === "read").map((x) => x.name);
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
      const m =
        agent.models.find((x) => x.id === agent.defaultModel) ??
        agent.models[0];
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
    setDraft((d) => ({
      ...d,
      effort: model.defaultEffort ?? model.efforts[0] ?? null,
    }));
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
    if (typeof secilen === "string")
      setDraft((d) => ({ ...d, workdir: secilen }));
  }

  const gruplar = byGroup(araclar);
  /**
   * Kipin **sormadığı** ama botun hiç aracının olmadığı gruplar.
   *
   * "Hiç sorma" seçip masaüstü aracı olmayan bir bottan masaüstü işi beklemek
   * doğal bir yanlış anlama; iki kez oldu. Kip araç listesini **kendiliğinden
   * değiştirmiyor** — 33 aracın tamamı küçük bir modeli boğuyor ve yalnızca
   * okuyan, hiç sormayan bir bot meşru bir kurulum. Ama boşluk burada
   * söyleniyor ve tek tıkla kapanıyor.
   */
  const bosSerbest = TOOL_GROUPS.filter(
    (g) =>
      !SORAR[draft.permission].includes(g) &&
      gruplar[g].length > 0 &&
      gruplar[g].every((x) => !draft.tools.includes(x.name)),
  );

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
    <div
      className="scrim"
      data-cikis={cikiyor || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={bot ? t("forge.edit") : t("forge.new")}
    >
      <div className="forge" ref={forgeRef}>
        <div className="forge__head">
          <span
            style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em" }}
          >
            {bot ? t("forge.edit") : t("forge.new")}
          </span>
          <div style={{ flexGrow: 1 }} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            {t("forge.livesHere")}
          </span>
        </div>

        <div className="sek" role="tablist" aria-label={t("forge.tabs")}>
          {SEKMELER.map((sk) => (
            <button
              key={sk}
              type="button"
              role="tab"
              aria-selected={sekme === sk}
              onClick={() => {
                olcOnce(yukIz, forgeRef.current);
                setSekme(sk);
              }}
            >
              {t(`forge.tab_${sk}`)}
            </button>
          ))}
        </div>

        {/* `key` sekme değişince içeriği yeniden kurar: giriş devinimi
         * oynasın diye. Taslak `draft`'ta, o yüzden hiçbir alan kaybolmuyor. */}
        <div className="forge__body" key={sekme} role="tabpanel">
          {sekme === "kimlik" && (
            <>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Avatar
                  tone={draft.avatar}
                  name={draft.name || "?"}
                  size={56}
                />
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
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/*
               * **Hue şeridi.** Renk ada göre kendiliğinden değişiyor; şeride
               * dokununca elle seçime geçiyor ve "ada göre" onu geri alıyor.
               * Açıklık ve doygunluk şeritte de sabit — seçilebilecek her renk
               * avatarda göründüğü gibi ve harfin kontrastı hepsinde AA üstünde.
               */}
              <div className="grp">
                <span className="lbl">{t("forge.mark")}</span>
                <div className="huesecim">
                  <input
                    type="range"
                    className="hue"
                    min={0}
                    max={359}
                    step={1}
                    aria-label={t("forge.mark")}
                    value={hueFor(draft.avatar, draft.name)}
                    onChange={(e) =>
                      setDraft({ ...draft, avatar: Number(e.target.value) })
                    }
                  />
                  <button
                    type="button"
                    className="toolset__hepsi"
                    disabled={draft.avatar === null}
                    onClick={() => setDraft({ ...draft, avatar: null })}
                  >
                    {t("forge.markAuto")}
                  </button>
                </div>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {draft.avatar === null
                    ? t("forge.markHint")
                    : t("forge.markManual")}
                </span>
              </div>
            </>
          )}

          {sekme === "motor" && (
            <>
              <div className="grp">
                <span className="lbl">{t("forge.backend")}</span>
                <div
                  className="seg"
                  role="group"
                  aria-label={t("forge.backend")}
                >
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
                          ...(b === draft.backend
                            ? {}
                            : { model: null, effort: null }),
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
                  <Picker
                    id="bot-yerel-model"
                    mono
                    value={draft.model ?? ""}
                    placeholder={t("forge.pickModel")}
                    ariaLabel={t("forge.model")}
                    options={
                      /* Kaydedilmiş model sunucuda görünmüyorsa yine de
                     listelenir: seçim sessizce kaybolmamalı. */
                      (draft.model &&
                      !yerelModeller.some((m) => m.id === draft.model)
                        ? [{ id: draft.model }, ...yerelModeller]
                        : yerelModeller
                      ).map((m) => ({
                        value: m.id,
                        label: m.id,
                        note: modelNotu(m),
                      }))
                    }
                    onChange={modelSec}
                  />
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {aracHata ??
                      t("forge.modelsFrom", { n: yerelModeller.length })}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 16 }}>
                  <div className="grp" style={{ flexGrow: 1 }}>
                    <span className="lbl">{t("forge.agent")}</span>
                    <div
                      className="seg"
                      role="group"
                      aria-label={t("forge.agent")}
                    >
                      {agents.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          disabled={!a.available}
                          aria-pressed={draft.agent === a.id}
                          title={
                            a.available ? a.description : t("forge.notOnPath")
                          }
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
                    <Picker
                      id="bot-model"
                      value={draft.model ?? ""}
                      placeholder={t("forge.pickModel")}
                      ariaLabel={t("forge.model")}
                      options={(agent?.models ?? []).map((m) => ({
                        value: m.id,
                        label: m.id,
                      }))}
                      onChange={(v) => setDraft({ ...draft, model: v || null })}
                    />
                  </div>
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
                        setDraft({
                          ...draft,
                          contextBudget: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {t("forge.budgetHint")}
                  </span>
                </div>
              )}

              <div className="grp" style={{ width: 220 }}>
                <label className="lbl" htmlFor="bot-tavan">
                  {t("forge.maxTurns")}
                </label>
                <div className="fld">
                  <input
                    id="bot-tavan"
                    className="mono"
                    type="number"
                    min={1}
                    step={10}
                    value={draft.maxTurns}
                    style={{ flexGrow: 1 }}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        maxTurns: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {t("forge.maxTurnsHint")}
                </span>
              </div>
              {!yerel && (
                <div className="grp">
                  <span className="lbl">{t("forge.effort")}</span>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Seg
                      value={draft.effort ?? ""}
                      ariaLabel={t("forge.effort")}
                      options={efforts.map((e) => ({ value: e, label: e }))}
                      onChange={(e) => setDraft({ ...draft, effort: e })}
                    />
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      {t("forge.readFrom")}
                      {agent && agent.disabled.length > 0 && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--fail)" }}>
                            {agent.disabled.join(", ")}
                          </span>{" "}
                          {t("forge.disabledSuffix")}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {sekme === "araclar" && (
            <>
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
                        const secili = liste.filter((x) =>
                          draft.tools.includes(x.name),
                        ).length;
                        return (
                          <div key={g} className="toolset__grup">
                            <div className="toolset__bas">
                              {/* Grup adı **etiket**, düğme değil: tıklanınca on
                              aracı birden açan bir başlık, düğmeye benzemediği
                              için kimse tıklamıyordu. Eylem ayrı ve görünür. */}
                              <span className="toolset__ad">
                                {t(`forge.toolGroup.${g}`)}
                              </span>
                              <span
                                className="muted"
                                style={{ fontSize: 11.5 }}
                              >
                                {secili}/{liste.length}
                              </span>
                              <div style={{ flexGrow: 1 }} />
                              <button
                                type="button"
                                className="toolset__hepsi"
                                onClick={() =>
                                  grupDegistir(g, secili !== liste.length)
                                }
                              >
                                {secili === liste.length
                                  ? t("forge.toolGroup.none")
                                  : t("forge.toolGroup.all")}
                              </button>
                            </div>
                            {g !== "read" && (
                              <span
                                className="muted"
                                style={{ fontSize: 11.5 }}
                              >
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
                                    aracDegistir(
                                      x.name,
                                      !draft.tools.includes(x.name),
                                    )
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
              <div className="grp">
                <span className="lbl">{t("forge.permission")}</span>
                <Seg
                  esit
                  value={draft.permission}
                  ariaLabel={t("forge.permission")}
                  options={PERMISSIONS.map((k) => ({
                    value: k,
                    label: t(`perm.${k}`),
                  }))}
                  onChange={(k) => setDraft({ ...draft, permission: k })}
                />
                <span
                  className="muted"
                  style={{ fontSize: 11.5, lineHeight: 1.5 }}
                >
                  {t(`perm.${draft.permission}.hint`)}
                </span>
                {bosSerbest.length > 0 && (
                  <div className="permgap">
                    <span className="permgap__metin">
                      {t("forge.permGap", {
                        groups: bosSerbest
                          .map((g) => t(`forge.toolGroup.${g}`))
                          .join(", "),
                      })}
                    </span>
                    <button
                      type="button"
                      className="toolset__hepsi"
                      onClick={() =>
                        bosSerbest.forEach((g) => grupDegistir(g, true))
                      }
                    >
                      {t("forge.toolGroup.all")}
                    </button>
                  </div>
                )}

                {/*
                 * Kip ile aynı grupta: ikisi de "bu bot ne yapabilir" sorusunun
                 * parçası. **Yalnızca masaüstü aracı seçilmiş botta** görünüyor —
                 * masaüstüne erişemeyen bir botta hiçbir şey yapmaz ve okunmayan
                 * bir anahtar bu depoda bir kez kullanıcıya izin verdiğini
                 * sandırdı.
                 */}
                {gruplar.desktop.some((x) => draft.tools.includes(x.name)) && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.forceWhenBusy}
                    className="permmenu__anahtar"
                    style={{ marginTop: 6 }}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        forceWhenBusy: !draft.forceWhenBusy,
                      })
                    }
                  >
                    <span className="permmenu__metin">
                      <span className="permmenu__ad">{t("forge.force")}</span>
                      <span className="permmenu__ipucu">
                        {t("forge.forceHint")}
                      </span>
                    </span>
                    <span className="anahtar" aria-hidden="true">
                      <span className="anahtar__top" />
                    </span>
                  </button>
                )}
              </div>
            </>
          )}

          {sekme === "calisma" && (
            <>
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
                      onChange={(e) =>
                        setDraft({ ...draft, workdir: e.target.value })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="fld btn-fld"
                    onClick={() => void dizinSec()}
                  >
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
                  onChange={(e) =>
                    setDraft({ ...draft, preamble: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {error && (
            <span
              style={{ fontSize: 13, color: "var(--fail)", lineHeight: 1.5 }}
            >
              {error}
            </span>
          )}
        </div>

        <div className="forge__foot">
          <span
            className="mono muted"
            style={{
              fontSize: 11.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {cagri}
          </span>
          <div style={{ flexGrow: 1 }} />
          <button
            type="button"
            className="btn-quiet"
            onClick={onCancel}
            disabled={busy}
          >
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

/** `100096` → `100K`. Seçenek satırı dar; tam sayı bütçe alanında zaten var. */
function kisaSayi(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}
