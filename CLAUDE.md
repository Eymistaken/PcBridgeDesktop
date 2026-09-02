# CLAUDE.md — PcBridgeDesktop

> **BU DEPODA İŞE BAŞLAMADAN ÖNCE `YAPILACAKLAR.md`'Yİ OKU.**
> Sıradaki iş orada. [ASAMALAR.md](ASAMALAR.md)'deki beş aşama **bitti**;
> o dosya artık yapılacak iş listesi değil, bitmiş işin kaydı.
>
> **"YAPILACAKLAR.md'yi uygula" denince kastedilen bölüm 1'dir**
> (*Uygulama ajan çalıştırıcısı olsun*). Bölüm 2 (*Eklentiler*) bilerek
> beklemede — kullanıcı açıkça istemeden ona başlama.
>
> **Kod yazmadan önce** bölüm 1'in "Karar verilmemiş" başlığındaki dört
> soruyu kullanıcıya sor; cevapsız yazılan kod büyük ihtimalle atılır.
>
> `YAPILACAKLAR.md` **yerel bir dosyadır, depoda yoktur** — kullanıcının
> isteğiyle izlenmiyor. Yoksa kullanıcıya söyle, uydurma.

pcbridge MCP sunucusunun **Tauri 2 masaüstü istemcisi.** Botlar, ajan kipi,
gerçek terminal ızgarası.

## Değişmez

- **`/home/eymistaken/Belgeler/Pcbridge` DEĞİŞTİRİLMEZ.** O ayrı bir depo ve
  ayrı bir iş. Orada eksik görürsen kullanıcıya söyle, kendi başına dokunma.
- **`config.toml` okunmaz, yazılmaz.** Parola ve statik token taşıyor, 0600.
  Token yalnızca OS keyring'de (`keyring` crate → Secret Service) durur.
  Hiçbir yerde loglanmaz, ekrana basılmaz, dosyaya yazılmaz. Bir aşamanın
  ucundan uca doğrulaması gerçek token istiyorsa **kullanıcı kendisi yazar**;
  token'ı isteme, okumaya çalışma.
- **Bot, uygulamanın kendi JSON'unda yaşar** (`~/.config/pcbridge-desktop/bots.json`).
  `[agents.*]` bloğu yazma yeteneği bilinçli olarak yok.
- Ölçmediğini "çalışıyor" diye yazma. "Hata vermedi" kanıt değil.

## Tasarım kanunu — "Nötr Kabuk"

Tuval sözleşmedir: **https://claude.ai/code/artifact/dd0430d2-3926-4ee4-a0e5-4cfec4ce8b1b**
Kaynak artboard'lar `design/*.dc.html`. Kod bunlardan sapamaz.

**Tek ilke:** kabuk renksiz. Renk yalnızca **kimlikten** (bot avatarı) ve
**durumdan** (çalışıyor/bitti/başarısız) gelir. Sistem aksan rengi **yoktur** —
her yere serpiştirilmiş bir aksan, arayüzü jenerik yapan şeyin ta kendisidir.

### Tokenlar

```css
/* koyu — birincil */
--bg:#151618;      --bg-side:#0F0F11;   --field:#1F2023;
--surface:#26282A; --surface-2:#36383B; --line:#2F3033;  --well:#08090B;
--text:#EAEBED;    --text-muted:#96989C;
--run:#D3A056;     --ok:#75B683;        --fail:#E2726B;  --blue:#398AD6;
--av: #8D73D1 #398AD6 #009FA0 #399D57 #B67700 #CD6151;   /* L=62 C=0.14 */

/* aydınlık — varyant */
--bg:#F8F8FA;      --bg-side:#F1F2F4;   --field:#EBEDEF;
--surface:#E8E9EC; --surface-2:#D9DBDE; --line:#D9DBDD;  --well:#111213;
--text:#191B1D;    --text-muted:#56585D;
--run:#8D5E00;     --ok:#337344;        --fail:#AF3C3A;
--av: #6A4FA9 #0465AF #007A7C #007834 #905300 #A43C2F;   /* L=50 C=0.14 */
```

Hepsi oklch'ten üretildi, hue 265 (hafif soğuk), ve **kontrastı hesaplandı**:
`--text` 15.2:1, `--text-muted` 6.3:1, durum renkleri 5.9–7.7:1. Yeni renk
eklerken oranı hesapla, tahmin etme.

**Üçüncü bir metin seviyesi YOK.** İki denemede de AA'nın altında kaldı
(3.7 ve 3.1). Hiyerarşi boyut ve ağırlıkla kurulur.
`--text-muted` **`--surface-2` üstünde kullanılmaz** (4.08:1).

### Köşeler — üç değer

`10px` satır/alan/düğme · `20px` baloncuk/kuyu/panel · `9999px` besteci/avatar.

İç içe yüzeyde yarıçap **dış − dolgu**'dur (10 − 3 = 7). 30px altındaki ikon
çizimleri bu ölçekte **değildir**, orantılı çizilir.

### Yazı

**Geist** (arayüz + mesajlar) · **Geist Mono** (terminal, job id, yol).
Hepsine gerçek fallback yığını. Serif yok.

Artboard'lar Google Fonts `<link>`'i kullanır çünkü onlar web sayfası.
**Uygulama kullanmaz:** `@fontsource/geist-sans` + `@fontsource/geist-mono`
paketten gelir — açılışta ağa bağlanılmaz ve Tauri CSP'sinde
`fonts.googleapis.com` deliği açılmaz. CSS aile adları paketin ilan ettiği
adlardır: **`"Geist Sans"`** ve `"Geist Mono"` (`"Geist"` değil).

### Yasak

Sistem aksan rengi · gradyan · cam/blur · neon · **renkli birincil düğme**
(birincil eylem `--text` dolgu, `--bg` metin) · karışık köşe yarıçapı ·
üçüncü metin seviyesi · emoji ve dingbat ikon (ikonlar 20px ızgarada inline
SVG) · hover'da zıplama veya ölçeklenme · **sahte pencere düğmeleri**
(GNOME kendi çiziyor) · shadcn/MUI/Chakra · Inter/Roboto/Arial/Fraunces ·
işe yaramayan sayı ve rozet.

Ayırıcı olarak çizgi değil **yüzey kademesi** kullanılır. Seçim yükselen
yüzeyle anlatılır, renkli çubukla değil.

### Tuvalden bilinçli iki sapma

Kullanıcının 2026-09-02'deki isteğiyle; artboard'a geri çevrilmez.

1. **Kip anahtarı kenar çubuğunun tepesinde.** Artboard ana panelin sağ
   üstüne iki ikon düğme koyuyordu; şimdi uygulama adının altında tek bir
   `Botlar | Terminal` anahtarı var (kayan parça, `--surface-2`).
2. **Besteci ipucu `Ctrl ↵`.** Artboard `⌘↵` yazıyor — o bir macOS işareti,
   bu makine Linux. `↵` duruyor: tuş adı, ikon değil.

## Ölçülmüş gerçekler

- **Bağlantı:** `http://127.0.0.1:8765/mcp`, başlık
  `Authorization: Bearer <static_token>`. Doğrulandı — `pcbridge/auth.py:399`
  statik token'ı erişim token'ı sayıyor, `tests/test_e2e.py:924` bu çağrıyı
  yapıyor. stdio **kullanılmıyor**: orada sunucuyu istemci başlatır ve uygulama
  kapanınca çalışan ajan işi de ölür.
  ⚠️ **Bu gerekçe 2026-09-02'de bilinçli olarak terk edildi.** Uygulama ajan
  döngüsünü kendi yürütecek ve iş uygulamayla birlikte ölecek; kullanıcı bu
  bedeli kabul etti. Ölçüm doğru, ama artık bir yasak değil. Gerekçesi ve
  planı **`YAPILACAKLAR.md` bölüm 1'de** (yerel dosya, depoda değil).
- **İş çıktısı diskte:** `~/.local/state/pcbridge/jobs/<id>/` altında
  `meta.json` (durum, pid, argv, exit_code), `out.log` (stdout+stderr birleşik),
  `exit_code` (iş bitince yazılır). Canlı akış için **MCP pollanmaz**, dosya
  offset'ten okunur.
- **Parser adları** `plain`, `claude_stream_json`, `agy_json` —
  `pcbridge/jobs.py`'deki karşılıklarından birebir taşınır.
- **Ajanlar** `config.toml`'da tanımlı: `claude`, `antigravity`. Uygulama
  bunları `list_agents` ile **okur**.
- Sistem bağımlılıkları kurulu: `libwebkit2gtk-4.1-dev` 2.52.3, `librsvg2-dev`,
  `libayatana-appindicator3-dev`, `libsoup-3.0-dev`, tmux 3.4, cargo 1.95,
  node v26.8.1.
- **Kabuk istemi:** `eymistaken@ZorinOS:~/yol$` — starship/oh-my-posh **yok**,
  varsayılan Ubuntu PS1 (`\u@\h` 01;32, `\w` 01;34).
- **`tests/test_desktop.py` `PASS`/`FAIL` basar, `✓` değil**; özeti
  `398 gecti, 0 kaldi` (aksansız, kaynakta öyle).
- **`systemctl --user restart pcbridge` çalışan işleri öldürür** (cgroup).
  Bu depoda gerekmiyor — pcbridge değişmiyor — ama unutma.

### Masaüstü istemcisinin yığını — 2026-09-01'de ölçüldü

- **`list_agents` yapısal veri döndürmüyor.** Yanıt markdown prose, bir
  `{"result": "…"}` sarmalı içinde (FastMCP dizge dönüşlerini hem
  `structuredContent`'e hem bir metin bloğuna koyuyor). Model/effort listeleri
  o metinden **ayrıştırılıyor** — `src-tauri/src/mcp.rs::parse_agents`, gerçek
  çıktı üstünde birim testi var. Biçim değişirse ayrıştırıcı satırı atlar,
  ajan yine listelenir; bağlantı düşmez.
- **Tokensiz `POST /mcp` → `401`** + `www-authenticate: Bearer` başlığı, içinde
  sunucunun kendi `resource_metadata` adresi. Bu OAuth işaretinin peşine
  **düşülmüyor**; rmcp'nin `auth` (oauth2) özelliği kapalı, statik token
  yetiyor.
- **`rmcp` 3.2.0 API'si** (kaynaktan doğrulandı, tahmin değil):
  `StreamableHttpClientTransportConfig::with_uri(..).auth_header(token)` —
  token **`Bearer` öneki olmadan** verilir, önekini rmcp koyar.
  `StreamableHttpClientTransport::from_config(cfg)` · `().serve(transport)`
  (`impl ClientHandler for ()` var) · `list_all_tools()` ·
  `call_tool(CallToolRequestParams::new("ad"))` — bu struct `#[non_exhaustive]`,
  alan alan kurulamaz. Özellikler: `client`,
  `transport-streamable-http-client-reqwest`, `reqwest`, `default-features = false`.
- **`keyring` 4.2.0 libsecret FFI kullanmıyor.** Varsayılan `v1` özelliği
  Linux'ta `zbus-secret-service-keyring-store`'u seçiyor — saf Rust D-Bus.
  **`libsecret-1-dev` kurulu değil** (yalnızca `.so.0` var) ve gerekmiyor.
  API `keyring::v1::{Entry, Error, Result}`; `Entry::new(service, user)`,
  `set_password`, `get_password`, `delete_credential`. Kayıt yoksa
  `Error::NoEntry`, kasa kurulamazsa `Error::NoDefaultStore`.
  `gnome-keyring-daemon` `--components=pkcs11,secrets` ile çalışıyor.
  D-Bus çağrıları **bloklar** — kasa kilitliyse GNOME kilit penceresi açar ve
  çağrı kullanıcı yanıtlayana kadar döner. Hepsi `spawn_blocking`'de.
- **Uygulamanın veri dizini `~/.local/share/com.pcbridge.desktop/`** —
  `~/.config/pcbridge-desktop/` değil. WebKit yerel deposu (tema tercihi),
  önbellek ve HSTS orada. Sızıntı taraması **bu** yolu da kapsamalı.
- **Geist'in Türkçe kapsamı tam.** `geist-sans` tek altkümede 538 glif, hepsi
  var. `geist-mono` bölünmüş: `ı ç ö ü Ç Ö Ü` → `latin` (225 glif),
  `ğ ş İ Ğ Ş` → `latin-ext` (173 glif); `unicode-range` doğru yönlendiriyor,
  yedek yığına düşen karakter yok. Bu yüzden `400.css`/`500.css` bütün olarak
  içe aktarılıyor, tek tek altküme seçilmiyor.

### İş yaşam döngüsü — 2026-09-02'de ölçüldü

- **`job_status` çağrılmadan iş diskte hiç bitmiyor.** pcbridge biten çocuk
  süreci ancak o çağrıda topluyor; o ana kadar süreç **zombi** (`Zs
  <defunct>`) kalıyor ve `meta.json`'a `status`/`exit_code` **yazılmıyor**.
  Ölçüm: bir iş 74 saniye boyunca `status: None` kaldı, `job_status`
  çağrılınca anında `finished`/`exit 0` oldu.
  Sonuç: yalnızca dosya izleyen bir istemci işin bittiğini **asla göremez.**
  `jobs.rs` bunu şöyle çözüyor — çıktıdan `Finished` olayı görülünce ya da
  çıktı 5 sn susunca **bir kez** `job_status` çağrılır. "Canlı akış için MCP
  pollanmaz" kuralı çiğnenmiyor: **çıktı** hâlâ dosyadan geliyor.
- **`agent_run` ve `shell_run_background` farklı biçimde dönüyor.**
  `shell_run_background` → ``Baslatildi: `<job_id>` ``;
  `agent_run` → ``**<job_id>** — durum: `running` `` (`tools.py::_fmt_job_summary`).
  İlk ters tırnak `agent_run`'da **durum**, kimlik değil — bu bir kez yanlış
  iş kimliği kaydettirdi. Kimlik ayırıcıdan değil **biçiminden** okunur:
  `%Y%m%d-%H%M%S-<6 hex>` (`jobs.py:105`).
- **`agy_json` JSONL değil**, tek JSON nesnesi, iş bitince yazılıyor:
  `conversation_id` · `status` (SUCCESS|ERROR) · `response` ·
  `duration_seconds` · `num_turns` · `usage` · hata varsa `error`.
- **Durdurulan iş `failed` görünür**, `cancelled` değil: `exit_code` 130
  (SIGINT) / 143 (SIGTERM) / 137 (SIGKILL). Arayüz bunu "durduruldu" diye
  gösterir — kullanıcının bilerek kestiği şey hata değildir.
- **`claude` ajanı şu an pcbridge altında çalışmıyor:** CLI kendi OAuth
  oturumunu yenileyemiyor ("Failed to authenticate: OAuth session expired").
  Aynı komut kullanıcının kabuğunda çalışıyor. `antigravity` sorunsuz.

### tmux bölmeleri — 2026-09-02'de ölçüldü

- **`tmux new-session -A` oturumu onu yaratan istemciye bağlıyor.** PTY
  master'ı düşünce istemci ölüyor **ve oturum da ölüyor** — "bölme kapatmak
  oturumu öldürmez" ölçütü çiğneniyordu. Doğrusu iki adım:
  önce `tmux new-session -d -s <ad>` (ayrık; varsa hata verir, zararsız),
  sonra PTY içinde `tmux attach-session -t <ad>`. Böylece oturumun sahibi
  sunucu oluyor.
- **PTY'yi düşürmek yetmez, istemciyi tmux'a söyleyerek ayırmak gerekir.**
  Kapatırken `tmux detach-client -t /dev/<pts>` çağrılıyor; pts, istemci
  pid'inden `ps -o tty=` ile bulunuyor. `-s <oturum>` **kullanılmaz**: o,
  kullanıcının fiziksel terminalini de düşürürdü.
  Yalıtım testi: `pty.fork()` + `tmux attach` + master'ı kapat → oturum
  yaşıyor. Yani tmux'un kendi davranışı doğru, hata bizdeydi.
- **Yeniden bağlanınca tmux ekranı kendiliğinden çizmiyor.** Bileşen yeniden
  kurulduğunda (kip değişimi, HMR) xterm sıfırlanır ama PTY zaten açıksa yeni
  veri akmaz ve bölme boş kalır. `Ptys::open` bu durumda eskisini kapatıp
  **yeniden bağlanıyor**; yeni `attach` tam yeniden çizim getiriyor.
  Boyut değiştirip geri almak (SIGWINCH) **işe yaramıyor** — denendi.
- **`tmux_list` markdown tablo döndürüyor**, yapısal veri değil:
  `| oturum | calisan | dizin | PC'de acik mi |`, adlar ters tırnaklı,
  son sütun `evet`/`hayir`.
- **"PC'de de açık" bayrağı yalnız başına yanıltıcı.** Biz bir bölme açınca
  tmux'un `attached` bayrağı bizim yüzümüzden `evet` oluyor. Doğrusu
  `tmux list-sessions -F '#{session_attached}'` ile **sayıyı** alıp kendi
  bölmemizi düşmek.
- **PTY baytları base64 ile taşınıyor.** Kaçış dizisi ya da çok baytlı bir
  karakter parça sınırına denk gelebiliyor; dizgeye çevirmek bozardı.

### Terminal çizimi — 2026-09-02'de ölçüldü

- **Satır aralığı 1.0'a yakın olmak zorunda.** TUI'ler (Claude Code,
  Antigravity) çerçevelerini `─ │ ╭ ╯` ve blok karakterleriyle çiziyor;
  1.62'de bu karakterler hücreyi doldurmuyor ve logo ile çerçeveler kopuk
  kopuk görünüyordu. Şimdi **1.15**.
- **WebGL çizici yalnızca hız için değil.** `customGlyphs` kutu-çizim ve blok
  karakterlerini hücreye tam oturacak şekilde kendi çiziyor, yazı tipinin
  glif metriğine bırakmıyor. `@xterm/addon-webgl`; bağlam kaybolursa DOM
  çiziciye düşülüyor.
- **Punto tam sayı** (13). Kesirli punto hücre genişliğini kesirli yapıyor.
- **Yazı tipi ÖNCE yüklenir, terminal SONRA kurulur.** xterm hücre
  genişliğini `open()` anında bir kez ölçüyor. `document.fonts.ready` tek
  başına yetmez: `@fontsource` yüz tanımları tembel, istenmemiş bir yazı tipi
  için "bekleyen yükleme" yoktur ve `ready` hemen çözülür.
  `document.fonts.load('13px "Geist Mono"')` isteği açıkça başlatıyor.
- **Ölçüm:** bölme 222x45 çıktı; `COLUMNS` kadar uzunlukta bir cetvel tek
  satıra tam sığdı, taşma ve sarma yok. tmux durum çubuğu da tam genişlikte.
- **Yeniden boyutlandırma geciktiriliyor** (90 ms) ve yalnızca sütun/satır
  **gerçekten değiştiyse** gönderiliyor: `ResizeObserver` pencere
  sürüklenirken onlarca kez ateşliyor, her biri tmux'a tam yeniden çizim
  yaptırıyordu.
- **Tema değişimi dışarıdan izleniyor.** Bölme açık kalırken kabuk teması
  değişebiliyor; `data-theme` niteliği ve `prefers-color-scheme` izlenip
  `term.options.theme` yenileniyor.

### Masaüstü izni — 2026-09-02'de ölçüldü

- **İzin durumu MCP'de değil DİSKTE:**
  `~/.local/state/pcbridge/desktop_unlock.json` →
  `{"until", "hard_until", "reason", "granted", "granted_by"}`. Geri sayım
  buradan okunuyor; saniyede bir MCP çağrısı yapılmıyor. Süre kendiliğinden
  dolduğunda sunucu kimseye haber vermiyor — dosyayı okumaktan başka yol yok.
- **İki sayı var, biri değil.** `until` **kayan kira**: her masaüstü
  eyleminden sonra `unlock_idle_seconds` (bu makinede **90 sn**) ileriye
  itiliyor, eylem gelmezse düşüyor. `hard_until` **sert tavan**.
  "60 dakika açtım ama rozet 1:29 diyor" bundan; arayüz ikisini de gösteriyor.
- **Ölmüş izin diriltilmiyor.** `until` geçince `touch()` hiçbir şey yapmıyor,
  `hard_until` hâlâ ileride olsa bile. Arayüz bunu açıkça yazıyor.
- **Kilitliyken hiçbir masaüstü aracı çalışmıyor** — `screen_capture` ve
  `ui_dump` dahil. Yani "kilitli görünümün ekran görüntüsünü al" mümkün değil;
  `XDG_STATE_HOME` başka bir dizine yöneltilerek ölçüldü.
- **`audit.log` gizli veri taşımıyor:** yazılan metin değil `chars: 5` gibi
  sayılar kaydediliyor. Bu yüzden kayıt olduğu gibi gösterilebiliyor.
- **`screen_capture` görüntüyü `ContentBlock::Image`** ile döndürüyor
  (`data` base64 + `mime_type`). İzin kapalıyken **hata değil**, yalnızca
  metin dönüyor ve görüntü listesi boş kalıyor.

### Arayüz — 2026-09-02'de ölçüldü

- **`<html data-theme>` React durumundan türetilir.** Emirle tek yerde
  yazılınca ikisi ayrışabiliyordu: bir kez düğme "Aydınlık" seçili görünürken
  DOM koyu kaldı ve tekrar tıklamak düzeltmedi. `App`'teki
  `useEffect(() => applyTheme(theme), [theme])` her render'da doğruyu geri
  koyuyor.
- **`color-scheme` bildirilir.** Kaydırma çubuğu, yerel denetim varsayılanları
  ve WebView'in kendi zemini buna bakıyor; söylenmezse tokenlar koyu, çubuklar
  aydınlık kalıyor.
- **Genel `textarea` kuralı besteciyi bozuyordu:** `min-height: 76px`
  (BotForge'un yönerge alanı için) besteciyi 76 px açılıyor gösteriyordu.
  `.composer__text` bunu açıkça sıfırlıyor.
- **`Ctrl+,` kısayolu Türkçe Q düzeninde beklenen `e.key`'i vermiyor.**
  Rakam tuşları düzenden bağımsız — panel kısayolu **`Ctrl+0`**.
  `e.code === "Comma"` yine de kabul ediliyor.
- **pcbridge'in sanal faresinin tekerleği WebKitGTK'da kaydırmıyor** (ölçüldü;
  `Tab` ile odak taşıyınca kap düzgün kaydı). Uygulamanın hatası değil,
  otomasyonun sınırı — gerçek fareyle sorun yok.

### Kontrast tablosu — hesaplandı, tahmin değil

Metin renginin her yüzey üstündeki oranı. `✓` AA metin (4.5), `~` yalnızca
büyük metin/grafik (3.0):

| | `--bg` | `--bg-side` | `--field` | `--surface` | `--surface-2` |
|---|---|---|---|---|---|
| **koyu** `--text` | 15.18✓ | 16.05✓ | 13.66✓ | 12.40✓ | 9.86✓ |
| **koyu** `--text-muted` | 6.27✓ | 6.63✓ | 5.64✓ | 5.12✓ | **4.07~** |
| **koyu** `--run` / `--ok` | 7.70 / 7.57✓ | 8.14 / 8.00✓ | 6.93 / 6.81✓ | 6.29 / 6.18✓ | 5.00 / 4.91✓ |
| **koyu** `--fail` | 5.91✓ | 6.25✓ | 5.32✓ | 4.83✓ | **3.84~** |
| **aydınlık** `--text` | 16.28✓ | 15.42✓ | 14.72✓ | 14.23✓ | 12.45✓ |
| **aydınlık** `--text-muted` | 6.71✓ | 6.36✓ | 6.07✓ | 5.86✓ | 5.13✓ |
| **aydınlık** `--run` / `--ok` | 5.30 / 5.39✓ | 5.02 / 5.10✓ | 4.79 / 4.87✓ | 4.63 / 4.70✓ | **4.05 / 4.12~** |
| **aydınlık** `--fail` | 5.61✓ | 5.31✓ | 5.07✓ | 4.90✓ | **4.29~** |

Kalın olanlar AA'nın altında: koyu temada `--text-muted` ve `--fail`,
aydınlık temada üç durum rengi — hiçbiri **`--surface-2` üstünde kullanılmaz.**
`--text-muted` `--surface` üstünde geçiyor (5.12 / 5.86), orada serbest.

## Çalışma tarzı

- Her aşamadan sonra **fiilen çalıştırıp test et**, sonra commit.
- Ajan koşumu **kota yakar**. Geliştirirken ucuz `shell_run` işleri kullan
  (`sleep 3; echo ok`); gerçek `claude -p` yalnızca bir kez ve kullanıcı
  haberdarken.
- Dosya düzenleme komutu önerirken `nano` kullanma; kullanıcının `edit`
  takma adı var.
