import { useCallback, useEffect, useState } from "react";

import Onboarding from "./Onboarding";
import Shell from "./Shell";
import { connect, endpoint as fetchEndpoint, hasToken } from "./lib/ipc";
import { applyTheme, readTheme } from "./lib/theme";
import type { ConnError, ConnSnapshot, Theme } from "./lib/types";

type Boot =
  | { s: "checking" }
  | { s: "welcome"; hasStoredToken: boolean; error?: ConnError }
  | { s: "ready"; snap: ConnSnapshot };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ s: "checking" });
  const [theme, setTheme] = useState<Theme>(readTheme);
  // Uç noktayı Rust söyler; burada kopyası tutulmaz.
  const [endpoint, setEndpoint] = useState("");

  /**
   * `<html data-theme>` **durumdan türetilir.** Tek yerde emirle yazılınca
   * ikisi ayrışabiliyordu: bir kez React "aydınlık" derken DOM koyu kaldı
   * (ölçüldü) — düğme seçili görünüyor ama ekran değişmiyor. Buradaki etki
   * her render'da doğruyu geri koyuyor, yani ayrışma kendini onarıyor.
   */
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const start = useCallback(async () => {
    try {
      setEndpoint(await fetchEndpoint());
    } catch {
      // Uç nokta okunamazsa karşılama onsuz da çalışır.
    }

    let stored = false;
    try {
      stored = await hasToken();
    } catch (e) {
      // Anahtarlığın kendisi erişilemez: karşılamada söyle.
      setBoot({ s: "welcome", hasStoredToken: false, error: e as ConnError });
      return;
    }

    if (!stored) {
      setBoot({ s: "welcome", hasStoredToken: false });
      return;
    }

    try {
      setBoot({ s: "ready", snap: await connect() });
    } catch (e) {
      setBoot({ s: "welcome", hasStoredToken: true, error: e as ConnError });
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  if (boot.s === "checking") {
    return (
      <div className="welcome">
        <span className="muted" style={{ fontSize: 13 }}>
          Anahtarlık okunuyor…
        </span>
      </div>
    );
  }

  if (boot.s === "welcome") {
    return (
      <Onboarding
        endpoint={endpoint}
        hasStoredToken={boot.hasStoredToken}
        initialError={boot.error}
        onConnected={(snap) => setBoot({ s: "ready", snap })}
        onCleared={() => setBoot({ s: "welcome", hasStoredToken: false })}
      />
    );
  }

  return (
    <Shell
      snap={boot.snap}
      onSnap={(snap) => setBoot({ s: "ready", snap })}
      theme={theme}
      onTheme={setTheme}
      onAuthLost={(error) => setBoot({ s: "welcome", hasStoredToken: true, error })}
    />
  );
}
