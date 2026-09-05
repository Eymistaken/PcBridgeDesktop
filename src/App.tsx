import { useCallback, useEffect, useRef, useState } from "react";

import Onboarding from "./Onboarding";
import Shell from "./Shell";
import { connect, endpoint as fetchEndpoint, hasToken } from "./lib/ipc";
import { applyTheme, readTheme } from "./lib/theme";
import { devinimSuresi } from "./lib/cikis";
import { readLang, setActiveLang, t, writeLang, type Lang } from "./lib/i18n";
import type { ConnError, ConnSnapshot, Theme } from "./lib/types";

type Boot =
  | { s: "checking" }
  | { s: "welcome"; hasStoredToken: boolean; error?: ConnError }
  | { s: "ready"; snap: ConnSnapshot };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ s: "checking" });
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [lang, setLangState] = useState<Lang>(readLang);

  /**
   * Etkin dil **ağaç çizilmeden** yerine konur. `t` bileşen dışındaki düz
   * yardımcılardan da çağrılıyor (`errorText`, `sayac`); bir etkiye
   * bırakılsaydı ilk render bir tık eski dilde çizilirdi.
   */
  setActiveLang(lang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeLang(l);
  }, []);

  // Ekran okuyucu ve tireleme buna bakıyor.
  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);
  // Uç noktayı Rust söyler; burada kopyası tutulmaz.
  const [endpoint, setEndpoint] = useState("");

  /**
   * `<html data-theme>` **durumdan türetilir.** Tek yerde emirle yazılınca
   * ikisi ayrışabiliyordu: bir kez React "aydınlık" derken DOM koyu kaldı
   * (ölçüldü) — düğme seçili görünüyor ama ekran değişmiyor. Buradaki etki
   * her render'da doğruyu geri koyuyor, yani ayrışma kendini onarıyor.
   */
  /**
   * Tema **yumuşak** takas olsun.
   *
   * `applyTheme` yalnızca niteliği değiştiriyor ve tokenlar anında yer
   * değiştiriyordu — bütün uygulama bir karede zıplıyordu. `<html>`'e kısa
   * ömürlü bir sınıf konuyor; geçişi yalnızca o sınıf varken açan kural
   * `app.css`'te.
   *
   * **İlk çizimde konmuyor:** açılışta kaydedilmiş temayı uygulamak bir
   * "geçiş" değil, başlangıç durumu — uygulama açılırken soluklanmamalı.
   */
  const ilkTema = useRef(true);
  useEffect(() => {
    if (ilkTema.current) {
      ilkTema.current = false;
      applyTheme(theme);
      return;
    }
    const kok = document.documentElement;
    kok.classList.add("tema-gecis");
    applyTheme(theme);
    const zamanlayici = window.setTimeout(
      () => kok.classList.remove("tema-gecis"),
      devinimSuresi() + 40,
    );
    return () => {
      window.clearTimeout(zamanlayici);
      kok.classList.remove("tema-gecis");
    };
  }, [theme]);

  /** Dil değişince içerik soluklanarak takas olsun — aynı usul, ayrı sınıf. */
  const ilkDil = useRef(true);
  useEffect(() => {
    if (ilkDil.current) {
      ilkDil.current = false;
      return;
    }
    const kok = document.documentElement;
    kok.classList.add("dil-gecis");
    const zamanlayici = window.setTimeout(
      () => kok.classList.remove("dil-gecis"),
      devinimSuresi() + 40,
    );
    return () => {
      window.clearTimeout(zamanlayici);
      kok.classList.remove("dil-gecis");
    };
  }, [lang]);

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
          {t("boot.keyring")}
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
      lang={lang}
      onLang={setLang}
      onAuthLost={(error) => setBoot({ s: "welcome", hasStoredToken: true, error })}
    />
  );
}
