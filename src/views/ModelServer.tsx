import { useEffect, useState } from "react";

import { detailText, modelConfig, modelModels, saveModelConfig } from "../lib/ipc";
import { t } from "../lib/i18n";
import type { ModelInfo } from "../lib/types";

type Durum =
  | { s: "bos" }
  | { s: "deniyor" }
  | { s: "ok"; models: ModelInfo[] }
  | { s: "hata"; mesaj: string };

/**
 * Yerel model sunucusu kartı.
 *
 * **Tek adres, bot değil uygulama düzeyinde.** Bot yalnızca o sunucudaki bir
 * modeli seçiyor; kullanıcının kuracağı tek şey bu satır.
 *
 * Anahtar keyring'e gider, dosyaya **hiç yazılmaz**; buraya da geri gelmez —
 * alan yalnızca "kayıtlı bir anahtar var" bilgisini gösterir.
 */
export default function ModelServer() {
  const [adres, setAdres] = useState("");
  const [anahtar, setAnahtar] = useState("");
  const [kayitliAnahtar, setKayitliAnahtar] = useState(false);
  const [durum, setDurum] = useState<Durum>({ s: "bos" });

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const c = await modelConfig();
        if (iptal) return;
        setAdres(c.baseUrl);
        setKayitliAnahtar(c.hasKey);
      } catch {
        // Yapılandırma okunamıyorsa kart boş başlar; bu bir hata durumu
        // değil, henüz kurulmamış demek.
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  async function dene() {
    setDurum({ s: "deniyor" });
    try {
      // Önce kaydediliyor: kullanıcı "Dene" deyip pencereyi kapatınca
      // yazdığı adresin kaybolması şaşırtıcı olurdu.
      const c = await saveModelConfig(adres, anahtar.trim() ? anahtar : undefined);
      setAdres(c.baseUrl);
      setKayitliAnahtar(c.hasKey);
      setAnahtar("");
      setDurum({ s: "ok", models: await modelModels(c.baseUrl) });
    } catch (e) {
      setDurum({ s: "hata", mesaj: detailText(e) });
    }
  }

  async function anahtariSil() {
    try {
      const c = await saveModelConfig(adres, "");
      setKayitliAnahtar(c.hasKey);
      setAnahtar("");
    } catch (e) {
      setDurum({ s: "hata", mesaj: detailText(e) });
    }
  }

  return (
    <div className="card">
      <span className="h">{t("sys.modelServer")}</span>
      <span className="muted" style={{ fontSize: 12.5 }}>
        {t("sys.modelServerWhat")}
      </span>

      <div className="grp">
        <label className="lbl" htmlFor="model-adres">
          {t("sys.modelUrl")}
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="fld" style={{ flexGrow: 1 }}>
            <input
              id="model-adres"
              className="mono"
              spellCheck={false}
              placeholder="http://127.0.0.1:1234/v1"
              value={adres}
              style={{ flexGrow: 1 }}
              onChange={(e) => setAdres(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={durum.s === "deniyor" || !adres.trim()}
            onClick={() => void dene()}
          >
            {durum.s === "deniyor" ? t("sys.modelTrying") : t("sys.modelTry")}
          </button>
        </div>
      </div>

      <div className="grp">
        <label className="lbl" htmlFor="model-anahtar">
          {t("sys.modelKey")}
        </label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="fld" style={{ flexGrow: 1 }}>
            <input
              id="model-anahtar"
              type="password"
              autoComplete="off"
              placeholder={kayitliAnahtar ? t("sys.modelKeySaved") : t("sys.modelKeyNone")}
              value={anahtar}
              style={{ flexGrow: 1 }}
              onChange={(e) => setAnahtar(e.target.value)}
            />
          </div>
          {kayitliAnahtar && (
            <button type="button" className="btn-quiet" onClick={() => void anahtariSil()}>
              {t("sys.modelKeyClear")}
            </button>
          )}
        </div>
        <span className="muted" style={{ fontSize: 11.5 }}>
          {t("sys.modelKeyHint")}
        </span>
      </div>

      {durum.s !== "bos" && (
        <div style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 13 }}>
          <span
            className={durum.s === "deniyor" ? "dot dot--pulse" : "dot"}
            style={{
              background:
                durum.s === "ok"
                  ? "var(--ok)"
                  : durum.s === "hata"
                    ? "var(--fail)"
                    : "var(--run)",
              alignSelf: "center",
            }}
          />
          {durum.s === "ok" && (
            <span>
              {t("sys.modelOk", { n: durum.models.length })}
              {durum.models.length > 0 && (
                <>
                  {" · "}
                  <span className="mono muted">
                    {durum.models.map((m) => m.id).join(", ")}
                  </span>
                </>
              )}
            </span>
          )}
          {durum.s === "hata" && <span style={{ color: "var(--fail)" }}>{durum.mesaj}</span>}
          {durum.s === "deniyor" && <span className="muted">{t("sys.modelTrying")}</span>}
        </div>
      )}
    </div>
  );
}
