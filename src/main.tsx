import React from "react";
import ReactDOM from "react-dom/client";

// Yazı tipleri paketten gelir, ağdan değil: uygulama açılışta çevrimdışı
// çalışmalı ve Tauri CSP'sinde fonts.googleapis.com deliği açılmamalı.
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";

import App from "./App";
import { readTheme, applyTheme } from "./lib/theme";
import "./styles/tokens.css";
import "./styles/app.css";

// İlk boyamadan önce: aksi hâlde koyu tema bir kare boyunca yanlış görünür.
applyTheme(readTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
