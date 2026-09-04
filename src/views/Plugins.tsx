import { useEffect, useState } from "react";

import {
  createServer,
  deleteServer,
  detailText,
  gmailAuthorize,
  gmailConnect,
  gmailState,
  pluginStatus,
  reconnectPlugin,
  updateServer,
} from "../lib/ipc";
import { t } from "../lib/i18n";
import type { GmailState, PluginStatus, ServerDraft } from "../lib/types";

/**
 * Eklentiler kartı — ek MCP sunucularının kayıt defteri.
 *
 * **Renk yalnızca durumdan.** Eklentinin kimlik rengi yok: avatar tonları
 * bota ait, sunucuya değil. Nokta `--ok` / `--fail` / `--run`, gerisi kabuk.
 *
 * **pcbridge listede ama satırı düzenlenemez.** Uygulamanın kendisi ona bağlı;
 * kapatılabilir bir satır olarak çizmek kullanıcıya var olmayan bir seçenek
 * göstermek olurdu.
 */
export default function Plugins({
  pcbridgeTools,
  liste,
  onListe,
}: {
  pcbridgeTools: number;
  /** Durum `Shell`'de duruyor — şerit de aynı listeyi gösteriyor. */
  liste: PluginStatus[];
  onListe: (l: PluginStatus[]) => void;
}) {
  const [hata, setHata] = useState<string | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [yeni, setYeni] = useState(false);
  const [mesgul, setMesgul] = useState<string | null>(null);

  /** Gmail kendi kaydını kurabiliyor; liste sonrasında tazeleniyor. */
  async function yenile() {
    try {
      onListe(await pluginStatus());
    } catch {
      // Tazeleme başarısızsa eldeki liste duruyor; bir sonraki eylem düzeltir.
    }
  }

  /** Her eylem tam listeyi geri veriyor: kayıt ve canlı bağlantı tek karede. */
  async function calistir(id: string, is: () => Promise<PluginStatus[]>) {
    setMesgul(id);
    setHata(null);
    try {
      onListe(await is());
      setDuzenlenen(null);
      setYeni(false);
    } catch (e) {
      setHata(detailText(e));
    } finally {
      setMesgul(null);
    }
  }

  return (
    <div className="card">
      <span className="h">{t("plg.title")}</span>
      <span className="muted" style={{ fontSize: 12.5 }}>
        {t("plg.what")}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Satir
          ad="pcbridge"
          durum={{ nokta: "var(--ok)", metin: t("plg.connected", { n: pcbridgeTools }) }}
          alt={t("plg.builtin")}
        />

        {liste.map((p) =>
          duzenlenen === p.id ? (
            <Form
              key={p.id}
              baslangic={p}
              mesgul={mesgul === p.id}
              onVazgec={() => setDuzenlenen(null)}
              onKaydet={(d) => void calistir(p.id, () => updateServer(p.id, d))}
            />
          ) : (
            <Satir
              key={p.id}
              ad={p.name}
              durum={durumu(p, mesgul === p.id)}
              alt={`${p.command}${p.args.length ? ` ${p.args.join(" ")}` : ""}`}
              hata={p.error}
              eylemler={
                <>
                  {!p.connected && p.enabled && (
                    <button
                      type="button"
                      className="btn-quiet"
                      disabled={mesgul === p.id}
                      onClick={() => void calistir(p.id, () => reconnectPlugin(p.id))}
                    >
                      {t("plg.reconnect")}
                    </button>
                  )}
                  <button type="button" className="btn-quiet" onClick={() => setDuzenlenen(p.id)}>
                    {t("plg.edit")}
                  </button>
                  <button
                    type="button"
                    className="btn-quiet"
                    disabled={mesgul === p.id}
                    onClick={() => void calistir(p.id, () => deleteServer(p.id))}
                  >
                    {t("plg.remove")}
                  </button>
                </>
              }
            />
          ),
        )}

        {liste.length === 0 && !yeni && (
          <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            {t("plg.empty")}
          </span>
        )}

        {yeni ? (
          <Form
            mesgul={mesgul === "#yeni"}
            onVazgec={() => setYeni(false)}
            onKaydet={(d) => void calistir("#yeni", () => createServer(d))}
          />
        ) : (
          <div>
            <button type="button" className="btn-primary" onClick={() => setYeni(true)}>
              {t("plg.add")}
            </button>
          </div>
        )}

        <Gmail onBagli={() => void yenile()} />
      </div>

      {hata && (
        <span style={{ color: "var(--fail)", fontSize: 12.5 }}>{hata}</span>
      )}
      <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
        {t("plg.secretsHint")}
      </span>
    </div>
  );
}

/** Durum cümlesi ve noktası — **her durumun ayrı bir insan cümlesi var.** */
function durumu(p: PluginStatus, mesgul: boolean): { nokta: string; metin: string } {
  if (mesgul) return { nokta: "var(--run)", metin: t("plg.connecting") };
  if (!p.enabled) return { nokta: "var(--text-muted)", metin: t("plg.off") };
  if (p.connected) return { nokta: "var(--ok)", metin: t("plg.connected", { n: p.toolCount }) };
  return { nokta: "var(--fail)", metin: t("plg.down") };
}

function Satir({
  ad,
  durum,
  alt,
  hata,
  eylemler,
}: {
  ad: string;
  durum: { nokta: string; metin: string };
  alt: string;
  hata?: string | null;
  eylemler?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 14px",
        borderRadius: "var(--r-sm)",
        // Ayırıcı çizgi değil yüzey kademesi.
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          className="dot"
          style={{ background: durum.nokta, flex: "none", alignSelf: "center" }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{ad}</span>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {durum.metin}
        </span>
        {eylemler && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{eylemler}</span>
        )}
      </div>
      <span className="mono muted" style={{ fontSize: 11.5, overflowWrap: "anywhere" }}>
        {alt}
      </span>
      {/* Sürecin kendi son sözü. Yutulursa kullanıcı neden bağlanmadığını
          asla öğrenemez — `npx` paketi bulamadığında söylediği tek şey bu. */}
      {hata && (
        <span
          className="mono"
          style={{ fontSize: 11.5, color: "var(--fail)", overflowWrap: "anywhere" }}
        >
          {hata}
        </span>
      )}
    </div>
  );
}

function Form({
  baslangic,
  mesgul,
  onKaydet,
  onVazgec,
}: {
  baslangic?: PluginStatus;
  mesgul: boolean;
  onKaydet: (d: ServerDraft) => void;
  onVazgec: () => void;
}) {
  const [name, setName] = useState(baslangic?.name ?? "");
  const [command, setCommand] = useState(baslangic?.command ?? "npx");
  const [args, setArgs] = useState((baslangic?.args ?? []).join("\n"));
  const [enabled, setEnabled] = useState(baslangic?.enabled ?? true);

  const gecerli = name.trim() !== "" && command.trim() !== "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "13px 15px",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
      }}
    >
      <span className="lbl">{baslangic ? baslangic.name : t("plg.newTitle")}</span>

      <div className="grp">
        <span className="lbl">{t("plg.name")}</span>
        <div className="fld">
          <input
            value={name}
            spellCheck={false}
            placeholder="Gmail"
            style={{ flexGrow: 1 }}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="grp">
        <span className="lbl">{t("plg.command")}</span>
        <div className="fld">
          <input
            className="mono"
            value={command}
            spellCheck={false}
            placeholder="npx"
            style={{ flexGrow: 1 }}
            onChange={(e) => setCommand(e.target.value)}
          />
        </div>
      </div>

      <div className="grp">
        <span className="lbl">{t("plg.args")}</span>
        {/* `.fld` **sarmalamıyor**: `textarea`'nın kendi zemini, dolgusu ve
            köşesi var, `.fld` ise 42 px'lik bir satır — içine konunca metin
            kabından taşıyordu (gözle görüldü). */}
        <textarea
          className="mono"
          value={args}
          rows={3}
          spellCheck={false}
          placeholder="@modelcontextprotocol/server-everything"
          onChange={(e) => setArgs(e.target.value)}
        />
        <span className="muted" style={{ fontSize: 11.5 }}>
          {t("plg.argsHint")}
        </span>
      </div>

      {/* Yerel onay kutusu **kullanılmıyor**: GTK onu sistem aksan rengiyle
          çiziyor ve tasarım kanununda sistem aksan rengi yok. Aynı gerekçeyle
          `<select>` yerine `Picker` var. */}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <button
          type="button"
          className="tgl"
          data-on={enabled ? "1" : undefined}
          role="switch"
          aria-checked={enabled}
          aria-label={t("plg.enable")}
          onClick={() => setEnabled(!enabled)}
        >
          <span />
        </button>
        <span style={{ fontSize: 13 }}>{t("plg.enable")}</span>
      </div>

      <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
        {t("plg.firstRunHint")}
      </span>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={!gecerli || mesgul}
          onClick={() =>
            onKaydet({
              name: name.trim(),
              command: command.trim(),
              args: args
                .split("\n")
                .map((a) => a.trim())
                .filter((a) => a !== ""),
              enabled,
            })
          }
        >
          {mesgul ? t("plg.adding") : baslangic ? t("plg.save") : t("plg.add")}
        </button>
        <button type="button" className="btn-quiet" disabled={mesgul} onClick={onVazgec}>
          {t("plg.cancel")}
        </button>
      </div>
    </div>
  );
}

/**
 * Gmail'in tek seferlik kurulumu.
 *
 * **Neden ayrı bir blok:** Gmail, kayıt defterindeki öteki sunucular gibi
 * "komut + argüman" değil; Google'da kayıtlı bir OAuth istemcisi istiyor ve o
 * istemci **kullanıcının**. Tek tuşla bağlanan uygulamalarda istemci ürüne
 * gömülü; bu uygulamanın öyle bir kaydı yok ve bir kullanıcı hesabında proje
 * açmak uygulamanın işi değil. Blok tam olarak bunu anlatıyor, sonra
 * yapılabilecek her şeyi tek tuşa indiriyor.
 *
 * ⚠️ **Sır tek yön.** `client_secret` yazılıyor, geri okunmuyor; alan her
 * açılışta boş başlıyor ve durumda yalnızca "dosya var mı" duruyor.
 */
function Gmail({ onBagli }: { onBagli: () => void }) {
  const [durum, setDurum] = useState<GmailState | null>(null);
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const d = await gmailState();
        if (!iptal) setDurum(d);
      } catch {
        // Durum okunamazsa blok çizilmiyor; Gmail zaten isteğe bağlı.
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  async function calistir(is: () => Promise<GmailState>) {
    setMesgul(true);
    setHata(null);
    try {
      setDurum(await is());
      // Sır ekranda kalmıyor.
      setSecret("");
      onBagli();
    } catch (e) {
      setHata(detailText(e));
    } finally {
      setMesgul(false);
    }
  }

  if (!durum) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 11,
        padding: "13px 15px",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          className="dot"
          style={{
            background: durum.authorized
              ? "var(--ok)"
              : durum.hasKeys
                ? "var(--run)"
                : "var(--text-muted)",
            flex: "none",
            alignSelf: "center",
          }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("gml.title")}</span>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {mesgul ? t("gml.working") : durum.authorized ? t("gml.on") : durum.hasKeys ? t("gml.ready") : ""}
        </span>
      </div>

      {!durum.hasKeys && (
        <>
          <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            {t("gml.why")}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[t("gml.step1"), t("gml.step2"), t("gml.step3")].map((x) => (
              <span key={x} className="muted" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
                {x}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 11.5 }}>
              {t("gml.callback")}
            </span>
            <span className="mono" style={{ fontSize: 11.5, overflowWrap: "anywhere" }}>
              {durum.callback}
            </span>
          </div>

          <div className="grp">
            <span className="lbl">{t("gml.clientId")}</span>
            <div className="fld">
              <input
                className="mono"
                value={id}
                spellCheck={false}
                autoComplete="off"
                placeholder="…apps.googleusercontent.com"
                style={{ flexGrow: 1 }}
                onChange={(e) => setId(e.target.value)}
              />
            </div>
          </div>

          <div className="grp">
            <span className="lbl">{t("gml.clientSecret")}</span>
            <div className="fld">
              {/* `type="password"`: sır omuz üstünden okunmasın. Geri de
                  gelmiyor — bir kez yazılıp dosyaya gidiyor. */}
              <input
                type="password"
                value={secret}
                autoComplete="off"
                style={{ flexGrow: 1 }}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {mesgul && (
        <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
          {t("gml.workingHint")}
        </span>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {durum.hasKeys ? (
          <button
            type="button"
            className="btn-primary"
            disabled={mesgul}
            onClick={() => void calistir(gmailAuthorize)}
          >
            {durum.authorized ? t("gml.reauthorize") : t("gml.authorize")}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={mesgul || !id.trim() || !secret.trim()}
            onClick={() => void calistir(() => gmailConnect(id.trim(), secret))}
          >
            {t("gml.connect")}
          </button>
        )}
      </div>

      {hata && (
        <span
          className="mono"
          style={{ fontSize: 11.5, color: "var(--fail)", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
        >
          {hata}
        </span>
      )}

      {/* ⚠️ Ölçülmüş bir tuzak, sürpriz olmasın diye önden yazılıyor. */}
      <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
        {t("gml.testingWarn")}
      </span>
      <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
        {t("gml.fileNote", { keys: durum.oauthPath, creds: durum.credentialsPath })}
      </span>
    </div>
  );
}
