import { useState } from "react";

import { connect, errorText, signOut } from "./lib/ipc";
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
    <div className="welcome">
      <form
        className="welcome__box"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim() && !busy) void attempt(token.trim());
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em" }}>
            pcbridge
          </span>
          <span className="mono muted" style={{ fontSize: 12.5 }}>
            {endpoint}
          </span>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          Sunucunun statik token'ını yapıştır. Doğrulandıktan sonra yalnızca
          sistem anahtarlığında saklanır — dosyaya yazılmaz, ekrana basılmaz.
        </p>

        <div className="field" style={{ height: 44 }}>
          <input
            type="password"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            value={token}
            placeholder="Statik token"
            aria-label="Statik token"
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        {error && (
          <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fail)" }}>
            {errorText(error)}
          </span>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn-primary" type="submit" disabled={busy || !token.trim()}>
            {busy ? "Bağlanıyor…" : "Bağlan"}
          </button>
          {hasStoredToken && (
            <>
              <button
                className="btn-quiet"
                type="button"
                disabled={busy}
                onClick={() => void attempt(undefined)}
              >
                Kayıtlı token'la dene
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
                Kayıtlıyı sil
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
