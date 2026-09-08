import { useState } from "react";

import { connect, errorText, signOut } from "./lib/ipc";
import { t } from "./lib/i18n";
import Oluk from "./ui/Oluk";
import type { ConnError, ConnSnapshot } from "./lib/types";

interface Props {
  endpoint: string;
  /** Keyring'de zaten bir token varsa yeniden deneme yolu açılır. */
  hasStoredToken: boolean;
  initialError?: ConnError;
  onConnected: (snap: ConnSnapshot) => void;
  /** Kayıtlı token silindiğinde — App yeniden değerlendirsin. */
  onCleared: () => void;
}

/**
 * Token yokken (ya da reddedildiğinde) kabuğun yerine geçen tam ekran.
 * Kabuğu arkada verisiz çizmiyoruz: ölçmediğini çalışıyor gibi gösterme.
 */
export default function Onboarding({
  endpoint,
  hasStoredToken,
  initialError,
  onConnected,
  onCleared,
}: Props) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ConnError | undefined>(initialError);

  async function attempt(value?: string) {
    setBusy(true);
    setError(undefined);
    try {
      onConnected(await connect(value));
    } catch (e) {
      setError(e as ConnError);
    } finally {
      setBusy(false);
    }
  }

  return (
    // ⚠️ **Arkasında kabuk yok.** Uygulama ölçmediği şeyi çizmiyor: token
    // doğrulanana kadar bot listesi de bağlantı şeridi de yok.
    <div className="welcome">
      <form
        className="welcome__box"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim() && !busy) void attempt(token.trim());
        }}
      >
        <Oluk et={t("welcome.server")}>
          <div className="welcome__ic">
            <div>
              <span className="welcome__ad">pcbridge</span>
              <span className="welcome__uc mono">{endpoint}</span>
            </div>

            <p className="welcome__blurb">{t("welcome.blurb")}</p>

            <div className="grp">
              <span className="h">{t("welcome.token")}</span>
              <div className="field">
                <input
                  className="mono welcome__token"
                  type="password"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  value={token}
                  placeholder="••••••••••••••••"
                  aria-label={t("welcome.token")}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <span className="welcome__hata">{errorText(error)}</span>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button className="btn-primary" type="submit" disabled={busy || !token.trim()}>
            {busy ? t("welcome.connecting") : t("welcome.connect")}
          </button>
          {hasStoredToken && (
            <>
              <button
                className="btn-quiet"
                type="button"
                disabled={busy}
                onClick={() => void attempt(undefined)}
              >
                {t("welcome.trySaved")}
              </button>
              {/* Reddedilen bir token anahtarlıkta kalırsa uygulama her
                  açılışta onu deneyip 401 alır. Silmenin yolu burada. */}
              <button
                className="btn-quiet"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(undefined);
                  try {
                    await signOut();
                    onCleared();
                  } catch (e) {
                    setError(e as ConnError);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("welcome.deleteSaved")}
              </button>
            </>
          )}
            </div>

            <div className="welcome__notlar mono">
              <span>{t("welcome.needs")}</span>
              <span>{t("welcome.envHint")}</span>
            </div>
          </div>
        </Oluk>
      </form>
    </div>
  );
}
