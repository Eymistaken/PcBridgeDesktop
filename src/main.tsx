import React from "react";
import ReactDOM from "react-dom/client";

// Yazı tipleri paketten gelir, ağdan değil: uygulama açılışta çevrimdışı
// çalışmalı ve Tauri CSP'sinde fonts.googleapis.com deliği açılmamalı.
// (Tasarımın artboard'u Google Fonts <link>'i kullanıyor çünkü o bir web
// sayfası; uygulamada aynısını yapmak CSP'ye delik açmak olurdu.)
//
// Türkçe kapsamı ölçüldü — üç ailede de `ı ç ö ü Ç Ö Ü` latin'de,
// `ğ ş İ Ğ Ş` latin-ext'te; unicode-range doğru yönlendiriyor. Bu yüzden
// ağırlık dosyaları bütün olarak alınıyor, tek tek altküme seçilmiyor.
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
// Terminalin İÇİ tasarıma dahil değil — kullanıcının kararı. Geist Mono
// yalnızca `ui/Term.tsx` için paketleniyor (`--mono-term`).
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";

import App from "./App";
import { readTheme, applyTheme } from "./lib/theme";
import { readLang } from "./lib/i18n";
import "./styles/tokens.css";
import "./styles/app.css";

// İlk boyamadan önce: aksi hâlde koyu tema bir kare boyunca yanlış görünür.
applyTheme(readTheme());

/*
 * ⚠️ **Dil de ilk boyamadan önce.**
 *
 * `index.html` `lang="tr"` ile açılıyor ve `App`'in etkisi ilk boyamadan
 * SONRA çalışıyordu. Arayüz İngilizceyken o bir karede `text-transform:
 * uppercase` Türkçe kuralı uyguluyor ve başlıklar "DESKTOP PERMİSSİON" diye
 * çıkıyordu (noktalı İ). Ekran okuyucu ve tireleme de aynı niteliğe bakıyor.
 */
document.documentElement.setAttribute("lang", readLang());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
