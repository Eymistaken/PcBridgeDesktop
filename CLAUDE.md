# CLAUDE.md — PcBridgeDesktop

## ► "İşleme devam edelim" dendiğinde

Kullanıcı bu depoda yeni bir oturum açıp *"devam edelim"* ya da benzeri bir şey
derse **başka bir şey sormadan** şunu yap:

1. **`YAPILACAKLAR.md`'yi oku.** Sıradaki iş orada, ayrıntısıyla ve ölçümüyle.
   Dosya **yereldir, depoda yoktur** (kullanıcının isteğiyle izlenmiyor);
   yoksa kullanıcıya söyle, **içeriğini uydurma**.
2. ✅ **Koordinat açığı 2026-09-04'te kapandı (Aşama 11).** Kayıt
   `YAPILACAKLAR.md`'de "✅ KAPANDI: koordinat isabeti". Orada **bekleyen tek
   şey ölçüm**: yasak kalkınca sabit görev × 5 koşum, sonra
   `cargo test --lib skor_kosumlar -- --ignored --nocapture`. Taban ve
   "düzeldi" ölçütü o başlıkta yazılı.
3. ⛔ **Eklentiler (MCP kayıt defteri) 2026-09-04'te yazıldı ve aynı gün
   GERİ ALINDI.** Kullanıcının kararı: *"bence plugin eklemek için erken."*
   İki commit `revert` edildi, silinmedi; geri getirmek `git revert` ile tek
   komut. **Kendi başına yeniden başlatma** — yalnızca kullanıcı açıkça isterse.
   Ölçümler `YAPILACAKLAR.md`'de "Geri alındı — ama bunlar ölçüldü"
   başlığında duruyor; yeniden yazılırsa o sayılar **yeniden ölçülmesin.**

   Erken olmasının gerekçesi kayda değer: eklenti bağlamak "zehirli üçlü"yü
   açıyor (bot güvenilmeyen metin okuyor, elinde shell ve masaüstü var) ve
   masaüstü kapıları hâlâ **gerçek bir koşumda sınanmadı** (madde 6).

   ⚠️ **Sıradaki aşama belli değil.** Kullanıcıya ne yapmak istediğini sor;
   uydurma.
4. 🎬 **"Animasyonlarla ilgili kısmı hallet" dendiğinde:** `YAPILACAKLAR.md`'de
   **"Devinim geçişi — arayüzün animasyon katmanı"** başlığını oku, iş orada
   ayrıntısıyla ve ölçütüyle yazılı. Kullanıcının 2026-09-04 isteği.

   ⚠️ **Uygulama animasyonsuz DEĞİL** — 30 geçiş, 4 keyframe ve bir
   `prefers-reduced-motion` bloğu zaten var (sayıldı). Boşluk başka: çıkış
   devinimi **sıfır**, `:active` **sıfır**, ve süreler tokensız — yedi ayrı
   sayı elle yazılmış. Var olanı ikinci kez yazma.

   Kullanıcı boşlukları **tek tek saydı** ve hepsi kodda doğrulanıp
   "Kullanıcının saydığı somut boşluklar" başlığına (a)–(h) diye yazıldı.
   ⚠️ **Token akışı** "CSS ekle" ile çözülmüyor: bugünkü mimari token başına
   DOM düğümü vermiyor, blok bütün olarak yeniden çiziliyor. **Yol seçildi —
   açığa çıkarma maskesi** (`mask-image`, opaklık).

   ⛔ **Terminal kapsam dışı, tamamı.** Kullanıcının kararı: *"terminal
   sonuçta animasyon olmaz."* Ne tuval, ne bölme kabuğu, ne ızgara.

   Arayüz işi olduğu için **yasak kapsamında değil** (madde 5).
5. ⛔ **Yerel modelle masaüstü testi yapma.** Kullanıcı 2026-09-04'te
   "ben gelene kadar modeli çalıştırıp test etme" dedi; sebebi o gün yaşanan
   veri kaybı (aşağıda, Aşama 10). Arayüz işleri ve pcbridge ile ölçüm
   serbest, **bot koşumu başlatmak değil.** Bu kısıt kullanıcı kaldırana
   kadar geçerli.
6. **Açık kalan üç uç:**
   - Tur içi özetleme **gerçek modelle sınanmadı** (Aşama 8'de LM Studio
     kapalıydı). İlk fırsatta bütçesi kasten küçük bir botla uzun bir koşum
     yapılıp `job://compacting` ve `Devam et.` yolu görülmeli.
   - Markdown çözümleyicisinin **birim testi yok**; projede JS test koşucusu
     yok ve eklemek ayrı bir karar. Doğrulama iki temada gözle yapıldı.
   - **Aşama 11'in kapısı gerçek bir koşumda tetiklendiği görülmedi** —
     yasak yüzünden. Kapı ısrarı kesiyor ama **isabeti artırmıyor**: model
     hâlâ ıskalıyor, yalnızca üçüncüde durduruluyor. Ölçüm sonrası "tekrar"
     hâlâ yüksekse sıradaki adım Set-of-Mark; gerekçesi YAPILACAKLAR.md'de.
7. **Aşama sırası:** [ASAMALAR.md](ASAMALAR.md)'deki **on bir aşama da bitti.**
   O dosya artık yapılacak iş listesi değil, **bitmiş işin kaydı** — yeni iş
   bitince oraya bir aşama olarak taşınır.
8. **Çalışma tarzı bu dosyanın sonunda.** Özeti: ölçmediğini "çalışıyor" diye
   yazma, her aşamadan sonra fiilen çalıştır, sonra commit.

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
- **Botun `backend` alanı koşumu kimin yürüttüğünü söyler**
  (`pcbridge-agent` | `yerel-model`). Ama **yönlendirme buna bakmaz**, koşum
  kimliğinin önekine bakar: `local-…` bizim (`runs.rs`), `%Y%m%d-%H%M%S-…`
  pcbridge'in (`jobs.rs`). Kullanıcı arka ucu sonradan değiştirse bile eski
  geçmiş doğru yerden okunsun diye.
- **Araç filtresi ile izin kipi ayrı sorulardır.** Filtre "bu bot neyi
  görebilir" (`Bot.tools`), kip "gördüğünü sormadan yapabilir mi"
  (`Bot.permission`). Grup listesi **`src-tauri/src/tools.rs`'te**, arayüzde
  değil — kipi Rust uyguluyor ve ikinci bir liste ayrışırdı. Ön yüz grubu
  `mcp_tools` yanıtındaki `group` alanından okur.
- **Aynı işi yapan iki denetim koyma.** `Bot.desktop` bayrağı bir yıl boyunca
  kaydedildi ve hiç okunmadı; kullanıcı ölü anahtarı açıp masaüstü izni
  verdiğini sandı (Aşama 7). Bir alan ya okunur ya silinir.
- **`RunCtx`'in iki yazıcısı ayrı kalır.** `ctx_olcum` yalnızca ölçümü,
  `ctx_ozet` yalnızca denetim noktasını yazar, ikisi de oku-değiştir-yaz.
  Tek bir yazıcı ikisini de taşıyınca koşum sonundaki ölçüm, aynı koşumun
  başında konmuş özeti siliyordu (Aşama 8).
- **Tavan ve izin aynı kuyruğu kullanır.** Tur tavanı sorusu için ikinci bir
  bekleme makinesi kurulmadı: `Runs.bekleyen`, `answer_permission` ve
  `PermAsk` ikisini de taşıyor, `IzinIstegi.kind` ayırıyor.
- **Modelin koordinatına güvenilmez; uygulama doğrular.** Yerel model
  masaüstünde bir kez ofseti unuttu, tıklama komşu ekrandaki **masaüstüne**
  düştü, ardından gönderdiği `ctrl+a` + `delete` kullanıcının bütün masaüstünü
  çöpe attı — ve orada bütün kod dizinleri duruyordu. `agent.rs::tehlike_kapisi`
  üç şeyi engelliyor: son `screen_capture`'ın **dışına** düşen `mouse`
  çağrısı, odak masaüstündeyken gönderilen **silme** tuşu, ve her koşulda
  **kalıcı silme** (`shift+delete`). Üçü de izin kipinden **bağımsız**:
  kullanıcı "serbest" dese bile sorulmaz, engellenir.
  Bir prompt satırı bunun yerine geçmez — model aynı koşumda dört kez doğru
  yapıp beşincide unuttu.
- **Dördüncü kapı ısrarı kesiyor** (Aşama 11): aynı bölgeye (50 px) üçüncü
  tıklama engellenir. Bu bir veri kaybı kapısı değil, boşa dönen turları
  kesiyor; ölçüldü ki model hedefi ıskaladığında koordinatı 30–40 px oynatıp
  yeniden deniyor. Sayılar aşağıda, "Ne sık bozuluyor".
- **Araç yanıtına bilgi eklemek davranış değiştirmiyor.** `mouse` yanıtı
  monitörü zaten yazıyordu, `screen_capture` dönüşüm formülünü zaten veriyordu,
  model her tıklamadan sonra görüntü zaten alıyordu — üçü de dinlenmedi.
  Kaldıraç ya kararı modelden almak ya da eylemi engellemek.
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
--run:#D3A056;     --ok:#75B683;        --fail:#E2726B;
--av-l:0.62;       --av-c:0.14;         /* hue ADDAN türer, 0-359 */

/* aydınlık — varyant */
--bg:#F8F8FA;      --bg-side:#F1F2F4;   --field:#EBEDEF;
--surface:#E8E9EC; --surface-2:#D9DBDE; --line:#D9DBDD;  --well:#111213;
--text:#191B1D;    --text-muted:#56585D;
--run:#8D5E00;     --ok:#337344;        --fail:#AF3C3A;
--av-l:0.50;       --av-c:0.14;

/* iki temada da AYNI — kuyu aydınlıkta da koyu kalıyor */
--well-text:#EAEBED;  --well-muted:#96989C;
/* ANSI, yalnızca terminal paleti — kabukta kullanılmazlar */
--blue:#398AD6 (ayd. #0465AF)  --magenta:#8D73D1 (#6A4FA9)  --cyan:#009FA0 (#007A7C)
```

Hepsi oklch'ten üretildi, hue 265 (hafif soğuk), ve **kontrastı hesaplandı**:
`--text` 15.2:1, `--text-muted` 6.3:1, durum renkleri 5.9–7.7:1. Yeni renk
eklerken oranı hesapla, tahmin etme.

**Kimlik rengi hue'dan.** Altı sabit ton kalktı; `Bot.avatar` bir hue sayısı
(`Option<u16>`, `None` → addan türetilir) ve renk
`oklch(var(--av-l) var(--av-c) <hue>)` ile çözülüyor. Açıklık ve doygunluk
sabit olduğu için avatardaki harfin kontrastı hue'dan **bağımsız garanti**:
360 hue için hesaplandı, koyu temada en düşük **4.62**, aydınlıkta **4.88**.
Karma **yalnızca TypeScript'te** (`types.ts::hueOf`) — iki dilde iki karma
ayrışırdı.

**Kuyunun metni tema değiştirmez.** `--well` aydınlık temada da koyu; metni
`--text`'ten almak orada **1.09:1** veriyordu (`--text-muted` 2.63) ve
terminal dahil her şey okunmuyordu. `--well-text` (15.72) ve `--well-muted`
(6.49) tema bloklarında **yeniden tanımlanmaz**.

**Üçüncü bir metin seviyesi YOK.** İki denemede de AA'nın altında kaldı
(3.7 ve 3.1). Hiyerarşi boyut ve ağırlıkla kurulur.
`--text-muted` **`--surface-2` üstünde kullanılmaz** (4.08:1).

### Köşeler — üç değer

`12px` satır/alan/düğme · `20px` baloncuk/kuyu/panel · `9999px` besteci/avatar.
(Kullanıcının 2026-09-03 isteğiyle 10 → 12 yumuşatıldı.)

İç içe yüzeyde yarıçap **dış − dolgu**'dur (12 − 3 = 9). 30px altındaki ikon
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

Sistem aksan rengi · **renkli gradyan** (aşağıda) · cam/blur · neon ·
**renkli birincil düğme** (birincil eylem `--text` dolgu, `--bg` metin) ·
karışık köşe yarıçapı · üçüncü metin seviyesi · emoji ve dingbat ikon
(ikonlar 20px ızgarada inline SVG) · hover'da zıplama veya ölçeklenme ·
**sahte pencere düğmeleri** (GNOME kendi çiziyor) · shadcn/MUI/Chakra ·
Inter/Roboto/Arial/Fraunces · işe yaramayan sayı ve rozet.

**"Gradyan yok" ne demek — kullanıcının netleştirmesi (2026-09-04).** Yasak
olan **renkli, dekoratif** gradyan: mavi-mor-neon geçişler, yani "AI slop"un
imzası. **Nötr (siyah-beyaz) gradyan yasak değil** ve kullanıcının kendi
sözüyle *"ChatGPT, Claude, Grok'ta standart, slop değil"*. Yani zeminde
renkli bir geçiş **hâlâ yok**, ama işlevsel ve renksiz bir geçiş — metnin
kenarını soluklaştıran `mask-image`, kaydırılabilir bir alanın kenar
soluğu — **serbest.**

Ölçüt renk: gradyanın iki ucu da nötrse (aynı hue, yalnızca açıklık ya da
opaklık değişiyorsa) sorun yok; hue değişiyorsa yasak.

Ayırıcı olarak çizgi değil **yüzey kademesi** kullanılır. Seçim yükselen
yüzeyle anlatılır, renkli çubukla değil.

**Markdown kendi kütüphanesini getirmez.** `src/lib/markdown.ts` modelin
yazdıklarını çözümlüyor ve `src/ui/Markdown.tsx` **React öğesi** üretiyor —
HTML dizgesi değil, yani `dangerouslySetInnerHTML` hiç yok ve modelin metni
işaretlemeye dönüşemiyor. Kapsam: başlık · kod · alıntı · liste · GFM
tablosu · çizgi; satır içinde kalın, eğik, kod, üstü çizili, bağlantı.
**Bağlantılar gezinmiyor** — uygulamanın dış bağlantı açacak eklentisi yok
ve webview'ı başka adrese götürmek uygulamayı kaybettirir.

**Yerel açılır liste (`<select>`) kullanılmaz.** GTK kendi kutusunu çiziyor:
köşeli, kendi renkleri, kendi yazı tipi — üç köşe değerinin hiçbirine uymuyor.
Yerine `src/ui/Picker.tsx`. Aynı gerekçeyle menüler de kendi bileşenimiz
(`PermMenu`). Menü ve liste yüzeyleri `--field` → `--surface` kademesini
kullanır; **`--surface-2`'ye ikincil metin taşıyan satırda çıkılmaz**
(`--text-muted` orada 4.07:1).

### Tuvalden bilinçli üç sapma

Kullanıcının isteğiyle; artboard'a geri çevrilmez.

1. **Kip anahtarı kenar çubuğunun tepesinde.** Artboard ana panelin sağ
   üstüne iki ikon düğme koyuyordu; şimdi uygulama adının altında tek bir
   `Botlar | Terminal` anahtarı var (kayan parça, `--surface-2`).
2. **Besteci ipucu `Ctrl ↵`.** Artboard `⌘↵` yazıyor — o bir macOS işareti,
   bu makine Linux. `↵` duruyor: tuş adı, ikon değil.
3. **Kimlik rengi altı ton değil hue çemberi** (2026-09-03). Artboard'lar altı
   sabit renk gösteriyor; renk artık addan türeyen bir hue. Kanunun **asıl**
   maddesi korundu: açıklık ve doygunluk sabit, o yüzden harf her hue'da
   okunuyor (360 hue hesaplandı). `design/*.dc.html` eski altı tonu taşımaya
   devam ediyor; **artboard'lar bu noktada koddan geride.**

## Ölçülmüş gerçekler

- **Bağlantı:** `http://127.0.0.1:8765/mcp`, başlık
  `Authorization: Bearer <static_token>`. Doğrulandı — `pcbridge/auth.py:399`
  statik token'ı erişim token'ı sayıyor, `tests/test_e2e.py:924` bu çağrıyı
  yapıyor. stdio **kullanılmıyor**: orada sunucuyu istemci başlatır ve uygulama
  kapanınca çalışan ajan işi de ölür.
  ⚠️ **Bu gerekçe 2026-09-02'de bilinçli olarak terk edildi ve iş bitti.**
  Uygulama ajan döngüsünü **artık kendi yürütüyor** (`agent.rs`); yerel koşum
  uygulamayla birlikte ölüyor ve açılışta `#appClosed` ile kapatılıyor.
  Kullanıcı bu bedeli kabul etti. Ölçüm doğru, ama bir yasak değil.
  Ayrıntı: **ASAMALAR.md, Aşama 6.**
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
- ⚠️ **WebGL çizici KULLANILMIYOR — WebKitGTK'da hiç çizmiyor.**
  `@xterm/addon-webgl` 2026-09-03'te kaldırıldı. Ölçüm: aynı sayfa, aynı 1,5
  saniye, **hiçbir girdi olayı olmadan** alınan gerçek widget görüntüsü
  (`WebKit2.WebView.get_snapshot`, JS piksel okuması değil) — WebGL açıkken
  tuval **bomboş**, kapalıyken yazı yerinde. Hız gerekçesi de düştü: 2000
  satır DOM çizicide 46 ms, WebGL'de 43 ms.
  `customGlyphs` artık bir **`Terminal` seçeneği** ve DOM çizicide de
  geçerli; kutu-çizim ve blok karakterleri hücreye tam oturuyor (çerçeve
  görüntüsüyle doğrulandı).
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

### Arayüz — 2026-09-03'te ölçüldü (Aşama 10)

- ⚠️ **Bir eklenti çağrısını `catch` ile susturmak tuşu ölü gösterir.**
  Dışa aktarma tuşu hiçbir şey yapmıyordu: `capabilities/default.json`
  yalnızca `dialog:allow-open` taşıyordu, `save()` **ayrı** bir izin
  (`dialog:allow-save`) istiyor ve reddediliyordu — ama çağrının sonundaki
  `.catch(() => null)` reddi **iptalden ayırmadan** yutuyor, `if (!yol)
  return` da sessizce dönüyordu. `open()` çalıştığı için (ataç, dizin seçme)
  fark bir yıl gözden kaçtı. **Ders:** iptali `null` ile bildiren bir API'de
  `catch` yalnızca gerçek hatayı gizler. Tauri eklentisinin her komutu ayrı
  izin ister; birini kullanıp ötekini eklememek sessiz bir ölüm.
- **Metinsiz `thinking` olayı kendine kutu açıyordu.** `agent.rs` tur sonunda
  yalnızca süreyi taşıyan bir olay yayıyor; `timeline.ts` onu ancak son blok
  düşünceyse birleştiriyordu, araya bir `text` girmişse ekrana **bomboş** bir
  "Thought for 1,5 s" kutusu koyuyordu. Diskteki gerçek kayıtlar üstünde
  ölçüldü: **34 boş kutu → 0**. Düzeltme ön yüzde, çünkü eski
  `events.jsonl`'ler o olayları hâlâ taşıyor.
- **121 dolu düşünce bloğunun 120'si sonunda satır sonu taşıyor.** Kapalı
  kutunun üç satırının bir kısmı boşa gidiyordu; `Thinking` artık metni bir
  kez `trim()` ediyor.
- **Kapalı üç satır sabit, açık `height: auto` idi** — üç satırdan kısa bir
  düşünceyi açmak kutuyu **daraltıyordu** (ölçüldü: 121 bloğun 60'ı bu
  durumda). `.dusunce__kuyu--acik` artık aynı ölçüde `min-height` taşıyor;
  kapalı hâlin sabit yüksekliği korundu.

### Yerel model yolu — 2026-09-02'de ölçüldü

- **LM Studio bu makinede Flatpak** (`ai.lmstudio.lm-studio` 0.4.23).
  Host'taki `~/.lmstudio/bin/lms` **ancak GUI açıkken** çalışıyor; kapalıyken
  "daemon is not running and no valid installation could be found" diyor —
  yanıltıcı, kurulum yerinde. Sıra: `flatpak run ai.lmstudio.lm-studio`,
  daemon ayağa kalksın, sonra `lms server start`. Ollama, llama.cpp, vLLM
  **kurulu değil**.
- **`ornith-1.5-35b-a3b` akış kipinde araç çağırıyor.** Ölçülen tel biçimi —
  istek `"tools":[{"type":"function","function":{name,description,parameters}}]`
  + `"stream":true` + `"stream_options":{"include_usage":true}`; yanıtta
  `tool_calls[].function.arguments` **kırık JSON dizgesi** olarak parça parça
  geliyor ve `id` yalnızca ilk parçada var — `index` ile birleştirmek şart.
- **`reasoning_content` ayrı bir alan.** `delta.content` değil; `Thinking`
  olayına çevriliyor. Bu modelde her yanıttan önce geliyor.
- **`usage.prompt_tokens` kesin sayı olarak dönüyor** (`include_usage`).
  Özetleme eşiği **tahminle değil bu sayıyla** tetikleniyor.
- **Uçtan uca ölçüm:** `cargo test --lib gercek_model -- --ignored --nocapture`
  → `ToolStart { tool: "fs_list", detail: "/tmp" }` → `ToolEnd { ok: true }` →
  model Türkçe yanıt. **27,9 saniye.** LM Studio ve pcbridge ayakta olmalı.
- **Araç filtresi fiilen kısıtlıyor.** LM Studio'nun kendi kaydında 7 istekte
  yalnızca `fs_list` göründü; seçilmeyen 32 araç modele hiç gönderilmedi.
  Doğrulama: `grep -o '"name": "[a-z_]*"' ~/.lmstudio/server-logs/<gün>.log`.
- **`Response::chunk()` reqwest'in `stream` özelliğinin dışında**
  (`reqwest-0.13.4/src/async_impl/response.rs:310` — kaynaktan okundu). SSE
  onunla okunuyor; `stream` özelliği ve `futures-util` **eklenmedi**.
- **`rmcp` araç adında `&'static str` istemiyor.**
  `CallToolRequestParams::new` `impl Into<Cow<'static, str>>` alıyor; eski
  kısıt bizim kendi koyduğumuzdu ve kalktı.
- **`rmcp::model::Tool` şemayı zaten taşıyor** — `input_schema: Arc<JsonObject>`
  ve `annotations.read_only_hint`. `list_all_tools` sonucundan alınıyor,
  **ek ağ çağrısı yok**. `ConnSnapshot`'a konmuyor: şemalar kilobaytlarca ve
  her `refresh()`'te ön yüze gitmemeli.
- **`JobMeta`'nın iki biçimi var ve karıştırılırsa iş sonsuza kadar "sürüyor"
  görünür.** Diskte **snake_case** (`exit_code`) — pcbridge'in yazdığıyla aynı;
  arayüze giden tel biçimi **camelCase** (`exitCode`). `runs.rs::meta_json`
  disk biçimini açıkça kuruyor, `JobMeta`'nın kendi `Serialize`'ı kullanılmıyor.
  Bir test bunu sabitliyor.
- **`Event::Text` ve `Event::Thinking` artık `delta` taşıyor.** İki üreticinin
  anlamı farklı: CLI ayrıştırıcıları tamamlanmış **blok** yayıyor (ardışık
  olanlar satır atlanarak birleşir), ajan döngüsü **token akışı** yayıyor
  (olduğu gibi birleşir). Alan olmadan `timeline.ts::toBlocks` her token'ın
  arasına `\n` koyuyordu ve **her kelime alt alta düşüyordu** — ekranda
  görüldü, düzeltildi. Eski kayıtlarda alan yok; `default` ile blok sayılıyor.
- **`runs::last_line` tek olaya bakamaz.** Token akışında sondaki olay çoğu
  zaman "." gibi tek bir parça; kenar çubuğunda o görünüyordu. Sondan geriye
  **ardışık** metin olayları birleştirilip son mesajın ilk satırı alınıyor.
- ⚠️ **pcbridge'in `fs_read`'i dosyanın SONUNU döndürüyor.** `max_chars` ile
  okunduğunda baş taraf kesiliyor ve yerine `…(kirpildi)…` yazılıyor (ölçüldü:
  `README.md`, `max_chars=300` → dosyanın son 300 karakteri). Sonuç: bir modele
  "dosyanın ilk satırı ne" diye sorulursa `fs_read` ile **asla** bulamıyor ve
  denemeye devam ediyor. pcbridge'in işi, bu depodan dokunulmuyor — ama
  yerel modelle çalışırken bu davranışı bilmek gerekiyor.

### İzin kipleri — 2026-09-03'te ölçüldü

- **Kip botun alanı, oturumun değil.** Besteci menüsü de BotForge de aynı
  `Bot.permission` alanını yazıyor. Ayrı bir oturum katmanı **bilinçli olarak
  yok**: bu depoda aynı işi yapan iki denetimden biri bir kez ölü kaldı.
- **Kip Rust'ta uygulanıyor** (`agent.rs::Kapi`), arayüzde değil. Arayüz
  yalnızca soruyu gösteriyor; reddi de kabulü de döngü uyguluyor.
- **`IzinKapisi` trait'i sync.** İsteği kaydedip `oneshot::Receiver` dönüyor,
  beklemek çağıranın işi — `dyn` ile `async fn` taşımamak için. `agent.rs`
  böylece Tauri'den bağımsız kaldı.
- **Döngü gerçekten bekliyor**, hemen reddetmiyor: yanıtı başka bir görevden
  gecikmeli veren bir test bunu sabitliyor
  (`dongu_yanit_gelene_kadar_bekler`).
- **Zaman aşımı yok.** Yanıtlanmayan istek koşumu süresiz bekletir; kenar
  çubuğu "İznini bekliyor" yazar. Sessizce reddetmek "izin istemedim" yalanı,
  sessizce kabul etmek daha kötüsü olurdu.
- **Soracak kimse yoksa reddedilir.** `Kapi.kapi == None` iken `Sor` kipi
  çalıştırmıyor; kullanıcının seçtiği kipi yok saymak olurdu.
- **Reddedilen çağrı koşumu düşürmez.** Modele "kullanıcı izin vermedi, aynı
  çağrıyı tekrarlama" yazılıyor; bu satır olmadan model aynı çağrıyı tur
  tavanına kadar yineliyordu.
- **`Bot.desktop` alanı kaldırıldı.** Diskteki eski `bots.json` onu hâlâ
  taşıyor; serde `deny_unknown_fields` kullanmadığı için sessizce yutuluyor ve
  ilk kayıtta düşüyor. Gerçek dosya üstünde ölçüldü.
- **Sistem promptu iki satır kazandı:** "kullanabileceğin araçlar yalnızca
  listedekiler" ve masaüstü kilidinin **o anki** durumu. İkincisi
  `desktop::read_state()`'ten geliyor ve `desktop_unlock`'un botun listesinde
  olup olmamasına göre farklı cümle kuruyor. Bu satırlar olmadan bir koşum 28
  paragraf boyunca olmayan bir aracı aradı.

### Masaüstü otomasyonu — 2026-09-03'te ölçüldü

- **`MAX_TUR = 24` masaüstü işi için yetmiyor.** Gerçek bir görev
  (`local-1a066f56b7d-a88e8c`: Chrome → YouTube → kanal ara → son video)
  `#turnLimit` ile düştü ve hedefe **bir tıklama** kalmıştı. Dağılım:
  6 `screen_capture` · 5 `keyboard` · 3 `mouse` · 2'şer `window_focus`,
  `window_list`, `ui_dump` · **2 `shell_run sleep`** · 1 `desktop_unlock`.
  Bak-uygula-bak döngüsü doğası gereği onlarca adım.
- **"Makinenin başında birisi var" reddi `GetIdletime`'dan geliyor.**
  `pcbridge/desktop/safety.py:73` D-Bus üstünden
  `org.gnome.Mutter.IdleMonitor.GetIdletime` okuyor; **yazma** eylemlerinde
  `idle_ms < idle_guard_seconds` (varsayılan **60 sn**) ise çağrı reddediliyor
  (`safety.py:264`). `force=true` kapıyı atlıyor. **Reddedilen çağrı
  `touch()` çağırmaz** — reddedilmek izni uzatmaz.
  Sonuç: kullanıcı botu **izlerken** `idle_ms` neredeyse hiç 60 sn'yi
  geçmiyor ve her yazma eylemi reddediliyor. Ölçülen koşumda model bunu
  aşmak için `sleep 12` ve `sleep 30` çalıştırdı: 42 saniye, iki tur israfı.
  `idle_guard_seconds` `config.toml`'da — **bu depodan değiştirilemez.**
- **Model çok düşünüyor.** Aynı koşumda **1965 `thinking`** olayına karşılık
  594 `text` ve 24 araç çağrısı. Düşünce hem bağlam hem ekran alanı yiyor.
- **`ui_dump` Chrome'da boş dönüyor** (bilinen); model bunu iki turda
  keşfediyor. Sistem promptu artık "ağaç boşsa ekran görüntüsüne düş" diyor.
- **Ölçekli ekran görüntüsünden koordinat hesaplamak model için tuzak.**
  Bir koşum yanlış pencereye tıkladı, birçoğunda uzun uzun ölçek çarpanı
  hesabı yapıldı. `scale=0` (tam çözünürlük) ile isabet belirgin arttı.
  ✅ **Artık ölçeği model seçmiyor** — bkz. bir alt bölüm.

### Koordinat isabeti — 2026-09-03'te ölçüldü (Aşama 10)

Kullanıcı "model **asla** doğru yere basamıyor" dedi. Tek bir hata değil;
modelden imkânsıza yakın bir hesap isteniyormuş.

- **`screen_capture`'ın iki varsayılanı birden aleyhe çalışıyor**
  (`pcbridge/tools.py:1341`): `monitor="all"` → her monitör için **ayrı**
  görüntü, ve `scale` boşken `screenshot_scale_long_edge` (kaynakta **1280**)
  → 1920x1080'lik bir ekran modele **0.667 ölçekle** gidiyor. Model her
  tıklamada `global = ofset + round(piksel / 0.667)` hesabını, iki görüntüden
  hangisine baktığını da takip ederek yapmak zorundaydı.
- **`mouse`'un `monitor` argümanı var** ve hiçbir yerde anlatılmıyordu:
  *"Treat x/y as coordinates inside this monitor instead of…"*. Tek monitör
  isteyip aynı monitörle tıklamak **ofset toplamayı da** sıfırlıyor.
- **Ölçek artık modelden istenmiyor.** `agent.rs::olcek_ekle`, `force_ekle`'nin
  ikizi: `screen_capture` çağrısına uygulama `scale = 0` koyuyor. Liste
  `tools.rs::OLCEK_ALIR` — **tek üyeli**, çünkü ölçüldü ki masaüstü
  grubundaki öteki dokuz aracın imzasında böyle bir alan yok.
  **Modelin açık seçimi ezilmiyor:** `scale` zaten verilmişse dokunulmuyor.
- **Model görüntüyü gerçekten görüyor.** LM Studio `/api/v0/models`:
  `ornith-1.5-35b-a3b` → `type: "vlm"`, `arch: "qwen35moe"`,
  `loaded_context_length: 200192`. Yani sorun körlük değil, aritmetik.
- ⚠️ **Sistem promptu pcbridge'in araç yanıtıyla çelişirse model yanıtı
  seçiyor.** İlk denemede prompt *"`mouse`'a `monitor` ver, görüntüdeki x/y'yi
  olduğu gibi yaz"* diyordu; `screen_capture`'ın **kendi yanıtı** ise
  *"`mouse` aracina **global** koordinati verin, `monitor` parametresi
  olmadan"*. Ölçülen koşumda model 9 `mouse` çağrısının **hiçbirinde**
  `monitor` kullanmadı ve `screen_capture`'ı 8 kez `{}` ile çağırdı — yani
  promptu değil, elindeki araç yanıtını dinledi. Prompt yanıtla **uyumlu**
  hâle getirildi: "her zaman `monitor` vererek **yakala**" (tek görüntü) ama
  "`mouse`'a **global** ver, ofseti ekle".
  **Ders:** araç yanıtı modele daha yakın ve daha somut; prompt onunla
  yarışamaz, ancak onu tamamlayabilir.
- **Ofset hatası ölçüldü, sonra düzeltildiği ölçüldü.** İki koşum, aynı
  makine, aynı model, tek fark sistem promptu:

  | | Çelişen prompt | Uyumlu prompt |
  |---|---|---|
  | `screen_capture` argümanı | 8 çağrının **hepsi** `{}` | hepsi `{"monitor":"2"}` |
  | `mouse` x değerleri | `120` (×3, **yanlış ekran**), `2480` | `2028`, `2030`, `2027` — **hepsi doğru ekranda** |
  | İlk hamle | doğrudan tıklamaya girişti | önce `screen_info` |

  İkinci koşumda model hesabı **açıkça yazdı**: *"Görüntü koordinatı: x≈108,
  y≈102 → global: x=2028, y=102"*. Ofset toplama sorunu ortadan kalktı;
  kalan hata **piksel hassasiyeti** (hedefi birkaç piksel ıskalamak), ki bu
  çok daha küçük ve farklı bir sorun.
- ⚠️ **Prompt ekran düzenini sabit yazıyor** ("iki ekran", "sağdakinin ofseti
  `(1920, 0)`"). Somutluk **işe yarayan şeyin ta kendisi** ama başka bir
  makinede yanlış olur. Doğrusu `screen_info`'yu koşum başında okuyup gömmek;
  YAPILACAKLAR.md'de.

#### Yanlış tıklamanın bedeli — 2026-09-04'te yaşandı

⚠️ **Prompt bir güvenlik katmanı değil.** Uyumlu promptla yapılan koşumda
(`local-1a06900af3e-99da36`) model dört tıklamayı **doğru** yaptı
(`x=2028, 2030, 2027, 2028`), sonra beşincide ofseti unuttu:

```
mouse   {"action":"click","x":250,"y":34}   ← Chrome sağ ekranda, ofset yok
keyboard {"action":"key","keys":"ctrl+a"}   ← masaüstündeki her şey seçildi
keyboard {"action":"key","keys":"delete"}   ← hepsi çöpe
```

Modelin kendi anlatımı: *"Adres çubuğu yaklaşık x=250, y=34 konumunda."* →
*"Adres çubuğu seçili. Tümünü temizleyip doğru URL'i yazayım."* Yani model
adres çubuğuna yazdığını **sanıyordu**. Kullanıcının bütün kod dizinleri
masaüstündeydi; elle durdurdu ve çöpten geri aldı. `shift+delete`
olsaydı kalıcı olurdu.

**Kondu — `agent.rs::tehlike_kapisi`, üç kapı:**

- **`mouse` son görüntünün dışına düşemez.** `screen_capture` yanıtındaki
  `… @ (1920, 0) …` satırlarından ekranın global dikdörtgeni okunuyor
  (`ekran_kutulari`) ve saklanıyor; sonraki `mouse` çağrısının x/y'si (ve
  sürüklemede `to_x`/`to_y`) o dikdörtgenin dışındaysa çağrı **hiç
  yapılmıyor**. Model iki ekranı birden istediyse kutular tuvalin tamamını
  kapsar ve kapı hiçbir şeye takılmaz. **Henüz görüntü alınmadıysa kapı
  açık** — dayanağımız yok, ve dayanaksız engellemek modeli çalışamaz
  hale getirirdi.
- **Odak masaüstündeyken silme tuşu geçmez.** `keys` içinde `delete` varsa
  `window_list` sorulup odağa bakılıyor. Ölçüldü: masaüstünün boş bir yerine
  tıklandığında odak `gjs — Desktop Icons 2` oluyor, yani sorgu olay anında
  doğru yanıtı verirdi. `backspace` **bilerek listede değil**: metin
  alanlarında olağan, masaüstünde bir şey silmiyor.
- **`shift+delete` her yerde reddediliyor**, odağa bakılmadan. Çöpe atılan
  geri alınabilir, kalıcı silinen alınamaz — ve bir modelin buna ihtiyacı
  olduğu bir durum yok. Kullanıcının kendi sözü: *"şükürler olsun model
  shift delete yapmadı"*.

⚠️ **Kapılar sonucu yakalıyor, sebebi değil.** Sebep açık kaldı: model bir
koordinatı doğru hesaplayıp **birkaç tur sonra unutuyor** — aynı koşumda dört
kez doğru yapıp beşincide. Yani sorun bilmemek değil, **tutmamak**. Kullanıcı
buna bir usul düşünüyor (bulunan koordinat kaydedilsin, kullanılırken
defterden okunsun, ekran değişince doğrulansın); ayrıntı YAPILACAKLAR.md'de.

Üçü de **izin kipinden bağımsız** ve red **sessiz değil**: modele ne
yapması gerektiğini anlatan bir metin, kullanıcıya sohbette bir `⛔` satırı
gidiyor. Reddin gerekçesi yazılı olmasaydı model çağrıyı arıza sanıp
yineleyecekti — bu daha önce ölçüldü.

#### Ne sık bozuluyor — 2026-09-04'te sayıldı (Aşama 11)

Diskteki beş masaüstü koşumunun `messages.jsonl`'i, model koşturulmadan,
kapının kendi ayrıştırıcısıyla yeniden oynatıldı:

| | sayı |
|---|---|
| tıklama | 25 |
| ekranın **dışına** düşen (ofset unutulmuş) | **1** |
| daha önce tıklanan bir noktanın 50 px yakınına yeniden tıklama | **8** |

**Ofset artık ana sorun değil** — `scale = 0` düzeltmesi işini görmüş, ve kalan
tek vaka zaten kapıya takılıyor. Ana desen **aynı yere tekrar tıklamak**:
model tıklıyor, görüntü alıyor, bakıyor, birkaç piksel yanına yeniden
tıklıyor. Felaket koşumunda adres çubuğu için `y = 102 → 95 → 63 → 95`.

⚠️ **Üç bilgilendirme kanalı zaten oradaydı, üçü de dinlenmedi:**

1. **`mouse` yanıtı hangi monitöre düştüğünü yazıyor** —
   `(250, 34) konumuna left tiklama · monitor 1 (DP-2).` Model o cümleyi gördü,
   o tur boyunca ekran 2'de çalışıyordu, ve devam etti.
2. **`screen_capture` dönüşüm formülünü her seferinde veriyor** —
   `global_x = ofset_x + goruntu_x / olcek`.
3. **25 tıklama için 39 ekran görüntüsü** alındı; yani model her tıklamadan
   sonra zaten doğruluyordu.

⇒ **Araç yanıtına bilgi eklemek bu modelde tek başına davranış değiştirmiyor.**
Kaldıraç ikisinden biri: koordinat kararını modelden almak, ya da eylemi
engellemek. "Tıklamadan sonra odağı söyle" türü fikirler bu ölçümün karşısında
tartılmalı — bilginin bir biçimi zaten oradaydı.

**Kondu — dördüncü kapı (`tehlike_kapisi`):** aynı bölgeye (50 px) üçüncü
tıklama engelleniyor. İkinci serbest, çünkü pcbridge'in boşta-kalma kapısı ilk
çağrıyı reddedip modele meşru bir `force` tekrarı yaptırabiliyor. Yalnızca
**çalışmış** tıklamalar sayılıyor. Seri `keyboard` · `window_focus` ·
`ui_click` · `ui_set_text` · `computer_batch` · `computer_task` ve
`mouse` `scroll`/`drag`/`hold`/`release` ile sıfırlanıyor;
**`screen_capture` ve `ui_dump` sıfırlamıyor** — model zaten her tıklamadan
sonra bakıyordu, görüntüyü sıfırlayıcı saymak kapıyı doğduğu gün işlevsiz
bırakırdı.

**Kapının kendi sayısı ham desenden küçük: 25'te 2, 8 değil.** Fark seri
sıfırlaması. Yakalanan ikisi felaket koşumunun adres çubuğu avındaki üçüncü ve
dördüncü deneme; model onları harcadıktan sonra zaten `ctrl+l`'e dönmüştü ve o
çalışmıştı — kapı onu iki tur önce oraya göndermiş olurdu.

#### Ekran düzeni promptta sabit değil — 2026-09-04'te ölçüldü

- **`screen_info` masaüstü kilitliyken de çalışıyor.** Ölçüldü: kilitli hâlde
  tam monitör tablosunu döndürdü (`window_list` ve `ui_dump` döndürmüyor).
  Yani sistem promptu kurulurken çağrılabiliyor, `desktop_unlock` gerekmiyor.
  Prompt artık *"iki ekran, sağdakinin ofseti (1920, 0)"* diye sabit yazmıyor,
  tabloyu buradan üretiyor; tablo okunamazsa **hiçbir sayı uydurulmuyor**.
- **Geometri ayrıştırıcısı tek:** `agent.rs::kutu_satiri`. Üstünde iki okuyucu
  var — `ekran_kutulari` (kapı, `screen_capture` başlığı) ve `ekran_listesi`
  (prompt, `screen_info`, monitör numarasıyla). İkisi de aynı `… 1920x1080 @
  (1920, 0) …` biçimini çözüyor; ayrı ayrıştırıcılar ayrışırdı.
- ⚠️ **`screen_info`'nun kutuları kapının durumuna konmaz.** `Iz.ekranlar`
  "modelin **baktığı** ekran" demek; bütün monitörlerle doldurmak
  `ekran_disinda`'yı sessizce her şeye açık hale getirirdi.
- ⚠️ **pcbridge modele iki ayrı yerde iki ayrı şey söylüyor.** `screen_info`:
  *"bir monitore ozel koordinat veriyorsaniz `monitor` parametresini de verin,
  ofseti pcbridge ekler"*. `screen_capture`: *"`mouse` aracina **global**
  koordinati verin, `monitor` parametresi olmadan"*. Prompt ikincisiyle uyumlu
  tutuluyor — tıklama anında modelin elindeki yanıt odur.

#### Chrome'un erişilebilirlik ağacı — ölçüldü ama **kullanılmıyor**

- **`ui_dump`'ın Chrome'da boş dönmesinin sebebi bulundu:**
  `org.a11y.Status.ScreenReaderEnabled` **`false`**. Chrome `frame`'i
  "1 çocuk" bildiriyor ama çocuk `None` — render ağacı hiç kurulmuyor.
  `toolkit-accessibility` (yani `IsEnabled`) zaten `true` ve **yetmiyor**.
- Bayrak `true` yapılınca ağaç **anında doluyor**: 609 düğüm, 282'si eylemli,
  adres çubuğu ve sayfa içeriği dahil (YouTube video başlıkları okundu),
  tarama **0,1 sn**. Yani teknik yol çalışıyor.
- ⚠️ **Ama kapalı kalıyor.** Kullanıcı açıkken "baş ütülüyor" dedi ve
  kapatılmasını istedi; bayrak `false`'a geri alındı ve uygulamaya böyle bir
  anahtar **konmadı**. Bu yüzden model Chrome'da ekran görüntüsüne düşmeye
  devam edecek — `scale = 0` işi bu yüzden daha da önemli.
- **Electron (Vesktop) bayrak açıkken bile ağacını vermedi.** Chromium
  tabanlı olması yetmiyor.
- **AT-SPI'ın `get_extents`'i sanıldığından iyi.** pcbridge "güvenilmez" diye
  koordinatı hiç döndürmüyor (`uitree.py` modül başlığı, 2026-08-02); ölçüldü
  ki gerçek uygulamalarda doğru — `pcbridge-desktop`'un "Kapat" düğmesi
  `@(1442,47) 32x24`, gnome-shell iki monitörü `@(0,0)` ve `@(1920,0)` ile
  ayırıyor. Bozuk düğümler `INT_MIN` (`-2147483648`) ile geliyor, yani
  **ayıklanabilir**. Set-of-Mark etiketleme bir gün yazılırsa koordinat
  kaynağı burası olur.

### Bağlam ve özetleme — 2026-09-03'te ölçüldü

- **Kazandırmayan özetleme yapılmaz.** Bütçesi 8192 olan bir botta koşum
  12.714 token'a çıktı, ama büyük koşum korunan pencerenin (son 2 koşum)
  içindeydi ve dışarıda yalnızca iki satırlık bir selamlaşma kaldı. Eski kod
  yine de tam bir yerel model turu harcayıp *"Kullanıcının amacı:
  Selamlaşmak"* diyen yanıltıcı bir özet üretti ve ~50 token kazandırdı.
  Artık **model çağrısından önce** kazanç tabanı var: düşecek metin bütçenin
  %10'unu (en az ~512 token) bulmuyorsa özetleme hiç denenmiyor.
- **Özetleme yardımcı olamıyorsa uygulama susmuyor.** `#budgetTooSmall`
  olayı yayılıyor ve arayüz "bütçeyi büyüt" diyor. Eskiden sessizce her
  koşumda bağlam taşıyordu.
- **`promptTokens` görüntü taşıyan turda şişer.** 30 mesaj + 7 görüntü →
  12.714. Görüntü diske yazılmadığı için sonraki koşumun geçmişi çok daha
  küçük olur; bu sayıyı doluluk göstergesi olarak kullanan her şey bunu
  hesaba katmalı.
- **Görüntünün maliyeti mütevazı.** Görüntülü koşumlar 2301 ve 2776 token'da
  kaldı; korkulan patlama olmadı (pcbridge görüntüyü küçültüyor).

### Arayüz turu — 2026-09-03'te ölçüldü

- **`force` argümanını 7 pcbridge aracı kabul ediyor, 10 değil.**
  `mouse` · `keyboard` · `ui_click` · `ui_set_text` · `window_focus` ·
  `computer_batch` · `computer_task`. `screen_capture`, `desktop_lock` ve
  `desktop_unlock` masaüstü grubunda olmalarına rağmen böyle bir alan
  **taşımıyor**; körlemesine eklemek onları bozardı. Liste
  `tools.rs::FORCE_ALIR`, bir test `MASAUSTU`'nun alt kümesi olduğunu
  sabitliyor. `force`'u **uygulama koyar** (`agent.rs::force_ekle`), modelden
  istenmez — sistem promptu anlatsa bile model keşfetmek için tur harcıyordu.
- ⚠️ **Özet denetim noktası kendi koşumunun sonunda siliniyordu.**
  `write_ctx_in` `fs::write` ile tam üzerine yazıyor; `kos` işareti yazdıktan
  sonra `tur_dongusu` aynı dosyaya `summary: None` koyuyordu. Sonuç: sonraki
  koşum geçmişin tamamını yeniden yükler ve özetleme her koşumda bir model
  turu harcar. **Aşama 8'de düzeltildi** — `Kayit::ctx_olcum` ve
  `ctx_ozet` ayrı, ikisi de oku-değiştir-yaz. Diskte hiç gözlenmemişti çünkü
  özet taşıyan tek koşum iptal edilmişti.
- **İşaret korunan pencerenin ilk koşumuna yazılır.** `gecmis_in` işaretten
  **itibarenini** taşıyor; yeni koşuma yazılırsa `ozetle_in`'in koruduğu iki
  koşum sessizce düşer.
- **Tur içi kesme araç çağrısı sınırından olmak zorunda**
  (`agent.rs::kesme_noktasi`). `tool_calls` taşıyan bir `assistant` mesajı
  `tool` yanıtlarından ayrılırsa sunucu isteği **400** ile reddediyor.
- **`oklch()` WebKitGTK 4.1'de çalışıyor** — varsayılmadı, ölçüldü:
  `CSS.supports('color','oklch(0.62 0.14 200)')` → `true`, ve
  `oklch(var(--av-l) var(--av-c) 250)` doğru çözülüyor (değişkenler dahil).
- **Eski altı tonun hue karşılıkları:** mor 295 · mavi 250 · cam 196 ·
  yeşil 150 · kehribar 72 · mercan 30. Bugünkü hex'lerden oklch'e çevrilerek
  bulundu; göç sonrası dördü birebir aynı, ikisi tek kanalda en fazla 3/255
  kayıyor. `Deserialize` hem sayı hem eski ad kabul ediyor.
- **Bir koşumda 4217 `thinking` olayı** ölçüldü
  (`local-1a066e01592-b08137`, 329 `text`'e karşılık). Düşünce kutusu bu
  yüzden kapalı başlıyor.
- **Düşünce kutusunun kaydırma ölçümü düzene bağlı olmak zorunda.** Tek
  seferlik ölçüm kap sıfır genişkeyken yapılıyor, `overflow-wrap: anywhere`
  yüzünden her karakter ayrı satıra düşüyor ve `scrollHeight` **7130px**
  çıkıyordu — kutu boş görünüyordu. `ResizeObserver` çözüyor.
- **`:0` ile ayrılan boş port testte kararsız.** Paralel koşan başka bir
  testin sahte sunucusu o portu kapabiliyor. "Erişilemez" sınayan testler
  `127.0.0.1:1` kullanıyor — bağlanmak ayrıcalık istediği için orada asla
  dinleyen olmuyor.
- **Bağlam dökümü karakter cinsinden, token değil.** Modelin tokenizer'ı
  elimizde yok; toplam `usage.prompt_tokens` kesin, kırılım değil. Arayüz o
  yüzden `≈` yazıyor.

### Terminal klavye gecikmesi — 2026-09-03'te bulundu ve düzeltildi

Kullanıcı "harfler bir basım geç geliyor, genel tepki de hantal" dedi.
**Sebep `@xterm/addon-webgl`'di:** WebKitGTK'da hiç çizmiyor, ekran ancak bir
girdi olayı tam yeniden çizim tetikleyince güncelleniyordu. Addon kaldırıldı.

Kanıt — aynı sayfa, aynı 1,5 saniye, hiç girdi yok, **gerçek widget
görüntüsü**: WebGL açık → boş; WebGL kapalı → yazı yerinde. JS'ten piksel
okumak WebGL tuvalinde güvenilmez (çizim tamponu sunumdan sonra siliniyor),
o yüzden `get_snapshot` kullanıldı.

Yol boyunca elenen katmanlar — hepsi temiz çıktı:

| Katman | Ölçüm |
|---|---|
| PTY + tmux yankısı (`Ptys`'in okuma/yazma deseninin aynısı) | **0,1–0,3 ms** |
| xterm `write` → ekrana çizim (geri çağrıyla) | **11 ms** |
| WebKitGTK `requestAnimationFrame`, boşta | **62 fps**, ortanca aralık 16 ms |
| Tauri `emit` (arka plan iş parçacığı) → `listen` | **0–1 ms** |
| WebKitGTK'da WebGL bağlamı (piksel geri okuma) | çalışıyor — **ama sunmuyor** |

- `portable_pty`'nin yazıcısı **tamponsuz** (`UnixMasterWriter`, doğrudan fd).
- **Girdi yöntemi (ibus + `tr+intl`) şüphesi elendi:** kullanıcı aynı düzenle
  GNOME Terminal ve Kitty'de gecikme olmadığını söyledi.
- **Ders:** tarayıcı ölçümü Chromium'da yapılırsa uygulamayı temsil etmez.
  Uygulama WebKitGTK; grafik yolunu ilgilendiren her ölçüm
  `gi.require_version("WebKit2", "4.1")` ile **asıl motorda** yapılmalı.
- Ayrıca ölçüldü: `tmux` sunucusunda **`escape-time 500`**. Düz harfleri
  etkilemiyor ama ESC ile başlayan her diziyi (ok tuşları, Alt bileşimleri,
  TUI'lerde ESC) yarım saniye geciktiriyor. Sunucu ayarı, oturuma özgü
  değil — **kullanıcının kendi tmux'u**, bu depodan değiştirilmedi.

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

**Kuyu ayrı bir yüzey** ve iki temada da koyu; metni tema tokenlarından
**alınmaz**:

| `--well` üstünde | koyu (#08090B) | aydınlık (#111213) |
|---|---|---|
| `--text` | 16.70✓ | **1.09** ✗ |
| `--text-muted` | 6.89✓ | **2.63** ✗ |
| **`--well-text`** | 16.70✓ | **15.72✓** |
| **`--well-muted`** | 6.89✓ | **6.49✓** |

**Avatar harfi** (`--bg` rengiyle, hue'dan bağımsız): 360 hue'nun hepsi
hesaplandı — koyu temada en düşük **4.62**, aydınlıkta **4.88**, AA altına
düşen hue yok.

## Nasıl ölçülür — bu depoda işe yarayan dört yöntem

"Ölçmediğini çalışıyor diye yazma" kuralının pratiği. Aşama 9'da dört gerçek
hata bu yollarla bulundu; her biri uygulamayı açıp elle denemekten hızlı.

### 1. Tarayıcı ölçümü **WebKitGTK'da** yapılır, Chromium'da değil

⚠️ **Bir kez yanlış yere baktırdı.** Tarayıcı bölmesi Chromium; uygulama
WebKitGTK. Grafik yolunu, CSS desteğini, çizici davranışını ilgilendiren
hiçbir ölçüm Chromium'da yapılamaz — WebGL çizicinin hiç çizmediği orada
görünmüyordu.

`gi` bağlayıcıları kurulu (`WebKit2 4.1`). İskelet:

```python
import gi; gi.require_version("WebKit2", "4.1"); gi.require_version("Gtk", "3.0")
from gi.repository import WebKit2, Gtk, GLib
w = Gtk.OffscreenWindow(); v = WebKit2.WebView(); w.add(v); w.show_all()
v.connect("load-changed", lambda vw, ev: ev == WebKit2.LoadEvent.FINISHED
          and GLib.timeout_add(1500, sor, vw))
v.load_uri("http://localhost:1420/sayfa.html")   # `npm run dev` ayakta
Gtk.main()
```

- **CSS/JS desteği:** `v.evaluate_javascript("CSS.supports(...)", ...)`.
  `oklch()` ve içindeki `var()` böyle doğrulandı.
- **Gerçekten çizildi mi:** `v.get_snapshot(...)` → PNG. **JS'ten piksel
  okumak WebGL tuvalinde yalan söyler** — çizim tamponu sunumdan sonra
  siliniyor. Snapshot derleyiciden geçen asıl çıktı.
- Boşta `requestAnimationFrame` 62 fps koşuyor; "rAF durmuş olabilir"
  hipotezi bu ölçümle elendi.

### 2. Bileşenleri uygulamayı açmadan görmek

Geçici bir `onizleme.tsx` + `onizleme.html` yazıp **gerçek bileşenleri**
uydurma proplarla `npm run dev`'de çizdir; tarayıcı bölmesinden iki temaya da
bak. Masaüstü kilidini açmaya, uygulamayı derlemeye gerek yok.
`PermMenu` gibi IPC isteyen bileşenler için `window.__TAURI_INTERNALS__.invoke`
taklidi yeter. İşi bitince **silinir.**

Böyle bulundu: kuyunun aydınlık temada okunmaması (1,09:1), düşünce
kutusunun boş görünmesi (kap sıfır genişkeyken ölçülmüş `scrollHeight`),
döküm satırlarının 30 px kayması.

### 3. Tauri IPC gecikmesi

Geçici bir komut + kurulumda arka plandan yayın; `eprintln!` ile stderr'e
yaz, uygulamayı `timeout 60 npm run tauri dev > log 2>&1` ile koştur, logu
oku. Yayın gecikmesi **0–1 ms** çıktı ve şüphe listesinden düştü.

### 4. Rust katmanı Tauri olmadan

`#[test] #[ignore = "elle ölçüm"]` bir test yazıp gerçek desenin aynısını
kur (PTY aç, iş parçacığında oku, yaz, yankıyı zamanla), ölç, **sonra sil.**
PTY + tmux yankısı 0,1–0,3 ms çıktı.

```bash
cargo test --lib pty::tests::olcum -- --ignored --nocapture
```

### 5. Koşum kaydından skorlamak — modeli hiç çalıştırmadan

Masaüstü koşumları `~/.local/state/pcbridge-desktop/runs/<id>/messages.jsonl`'e
yazılıyor ve **oradan yeniden oynatılabiliyor.** Aşama 11'in bütün ölçümü böyle
yapıldı; yerel model koşumu yasakken bile taban hesaplandı.

```bash
cargo test --lib skor_kosumlar -- --ignored --nocapture
SKOR_RUN=local-1a06900af3e-99da36 cargo test --lib skor_kosumlar -- --ignored --nocapture
```

- **Kapının kendi ayrıştırıcılarını kullanır** (`ekran_kutulari`,
  `Kutu::icerir`, `tekrar_tiklama`). Ayrı bir dilde ikinci bir uygulama
  yazılırsa skor kapıdan ayrışır ve **yalan söyler** — bir kez oldu: hızlı bir
  Python prototipi seri sıfırlamasını hesaba katmadığı için 8 tekrar saydı,
  kapının kendi kuralı 2 diyor.
- Kaydın içinde başarısız çağrı ayırt edilemiyor (yanıt metni serbest), o yüzden
  skor **üst sınır** verir; canlı kapı daha hoşgörülü.

### Testin dişi var mı?

Yeni bir regresyon testi yazınca **eski davranışı geri koyup düşmesini gör.**
Denetim noktası testi böyle doğrulandı: eski `write_ctx` geri konunca
`summary` `None` oluyor ve test kırmızıya dönüyor. Düşmeyen bir regresyon
testi hiçbir şey sabitlemez.

## Çalışma tarzı

- Her aşamadan sonra **fiilen çalıştırıp test et**, sonra commit.
- Ajan koşumu **kota yakar**. Geliştirirken ucuz `shell_run` işleri kullan
  (`sleep 3; echo ok`); gerçek `claude -p` yalnızca bir kez ve kullanıcı
  haberdarken.
- Dosya düzenleme komutu önerirken `nano` kullanma; kullanıcının `edit`
  takma adı var.
