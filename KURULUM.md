# Install · Kurulum

Linux x86-64. Packages are on the
[Releases](https://github.com/Eymistaken/PcBridgeDesktop/releases) page, built
by CI on Ubuntu 22.04.

---

## English

### deb — puts the app in your menu

```bash
sudo apt install ./Pcbridge-Desktop_0.1.0_amd64.deb
```

This installs `/usr/bin/pcbridge-desktop`, a desktop entry and the icons, so
the app shows up in the application menu like any other program. Dependencies
are `libwebkit2gtk-4.1-0` and `libgtk-3-0` — apt pulls them in.

On Ubuntu 24.04 and derivatives (Zorin OS 18, …) `libgtk-3-0` no longer exists
under that name; the `t64` package provides it and apt resolves this on its
own. No action needed.

Remove it with:

```bash
sudo apt remove pcbridge-desktop
```

### AppImage — single file, no install

```bash
chmod +x Pcbridge-Desktop_0.1.0_amd64.AppImage
./Pcbridge-Desktop_0.1.0_amd64.AppImage
```

An AppImage does **not** register itself in the application menu. That is by
design, not a missing feature — install the deb if you want a menu entry, or
use a tool like AppImageLauncher.

### What it needs at runtime

- A running [pcbridge](https://github.com/Eymistaken/Pcbridge) server, reachable
  at `http://127.0.0.1:8765/mcp`. Override with `PCBRIDGE_MCP_ENDPOINT`.
- Its static token. The app asks for it on first launch and keeps it **only** in
  the system keyring (Secret Service) — never in a file, never on screen.
- `tmux`, for the terminal panes.
- A Secret Service provider, e.g. `gnome-keyring-daemon` running with its
  `secrets` component.

### Build it yourself

```bash
npm ci
npm run tauri build
```

Build dependencies:

```bash
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev \
  libayatana-appindicator3-dev libxdo-dev libssl-dev build-essential curl wget file
```

Packages land in `src-tauri/target/release/bundle/`.

---

## Türkçe

### deb — uygulamayı menüye koyar

```bash
sudo apt install ./Pcbridge-Desktop_0.1.0_amd64.deb
```

`/usr/bin/pcbridge-desktop`, masaüstü girdisi ve ikonlar kurulur; uygulama
diğer programlar gibi menüde görünür. Bağımlılıklar `libwebkit2gtk-4.1-0` ve
`libgtk-3-0` — apt kendisi getirir.

Ubuntu 24.04 ve türevlerinde (Zorin OS 18, …) `libgtk-3-0` o adla yok; `t64`
paketi onu sağlıyor ve apt bunu kendi çözüyor. Yapılacak bir şey yok.

Kaldırmak için:

```bash
sudo apt remove pcbridge-desktop
```

### AppImage — tek dosya, kurulum yok

```bash
chmod +x Pcbridge-Desktop_0.1.0_amd64.AppImage
./Pcbridge-Desktop_0.1.0_amd64.AppImage
```

AppImage kendini uygulama menüsüne **kaydetmez.** Bu eksik değil, tasarım
gereği böyle — menüde görünmesini istiyorsan deb'i kur ya da AppImageLauncher
gibi bir araç kullan.

### Çalışması için gerekenler

- Çalışan bir [pcbridge](https://github.com/Eymistaken/Pcbridge) sunucusu,
  `http://127.0.0.1:8765/mcp` adresinde. `PCBRIDGE_MCP_ENDPOINT` ile değişir.
- Sunucunun statik token'ı. Uygulama ilk açılışta ister ve **yalnızca** sistem
  anahtarlığında (Secret Service) tutar — dosyaya yazmaz, ekrana basmaz.
- Terminal bölmeleri için `tmux`.
- Bir Secret Service sağlayıcısı; örneğin `gnome-keyring-daemon`'ın `secrets`
  bileşeniyle çalışıyor olması.

### Kendin derlemek

```bash
npm ci
npm run tauri build
```

Derleme bağımlılıkları yukarıdaki İngilizce bölümde. Paketler
`src-tauri/target/release/bundle/` altına düşer.
