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
4. ✅ **Aşama 13–19 2026-09-05'te bitti.** Kullanıcının "arayüz kırılgan,
   animasyonlar kötü, bot sistemi hoşuma gitmedi, terminal sistemi kötü"
   listesi kapandı. Ayrıntı ve bütün ölçümler
   [ASAMALAR.md](ASAMALAR.md)'de; özetle:

   - **Session katmanı:** bir bot artık bir sohbet değil, bir **asistan**.
     `Bot.sessions`, her session'ın **kendi bağlamı**. Bota tıklamak yeni
     session açıyor; session ilk mesajla doğuyor.
   - **Floating besteci:** arkasındaki `--bg` şeridi kalktı, sohbet
     bestecinin altından akıyor, kenar nötr maskeyle soluyor.
   - **Kip geçişindeki kasma ölçülerek kapandı:** en uzun kare 91 → 17 ms,
     33 ms'yi aşan kare 5/338 → **0/530**.
   - **Terminal bölme ağacı:** sınırsız bölme, sürüklenebilir ayraçlar,
     gri başlıktan tutup takas.
   - **Ayarlar ve BotForge** bölümlendi/sekmelendi.

   ⛔ **Terminal İÇİ devinim hâlâ kapsam dışı** — kullanıcının kararı.
   Devinen şey bölme *çerçevesi*; `.pane *` / `.xterm *` dokunulmuyor.
   ⛔ **View Transition API** WebKitGTK'da **var** ama kullanılmadı;
   gerekçesi Aşama 12'de.

5. ✅ **Tasarım 2026-09-08'de baştan değişti — "Ledger" (Aşama 22).**
   Kullanıcı Claude Design'da yeni bir tasarım çizdi ve *"yeni tasarım kanun
   olsun"* dedi. **"Nötr Kabuk" kanunu artık yürürlükte değil**; yerine bu
   dosyadaki *Tasarım kanunu — "Ledger"* geçti. Eski artboard'lar
   `design/eski-notr-kabuk/` altında kayıt olarak duruyor.

   Özet: kutular gitti, yerine **cetveller ve bir etiket oluğu** geldi. Dört
   metin seviyesi, iki köşe değeri (düğmelerin yarıçapı yok), baloncuksuz
   sohbet, altı çizili besteci. Durum renkleri ve avatar formülü korundu.

   ⛔ **Terminalin İÇİ tasarım dışı** — kullanıcının kararı: arayüz IBM Plex
   Mono'ya geçti, terminal Geist Mono'da kaldı (`--mono-term`).

   ⚠️ **Aydınlık tema tasarımda yok, TÜRETİLDİ.** Kullanıcı onayladı ama
   sayıları gören olmadı; ilk fırsatta gözle bakılmalı.

6. ⛔ **Yerel modelle masaüstü testi yapma.** Kullanıcı 2026-09-04'te
   "ben gelene kadar modeli çalıştırıp test etme" dedi; sebebi o gün yaşanan
   veri kaybı (aşağıda, Aşama 10). Arayüz işleri ve pcbridge ile ölçüm
   serbest, **bot koşumu başlatmak değil.** Bu kısıt kullanıcı kaldırana
   kadar geçerli.
7. **Açık kalan dört uç:**
   - Tur içi özetleme **gerçek modelle sınanmadı** (Aşama 8'de LM Studio
     kapalıydı). İlk fırsatta bütçesi kasten küçük bir botla uzun bir koşum
     yapılıp `job://compacting` ve `Devam et.` yolu görülmeli.
   - Markdown çözümleyicisinin **birim testi yok**; projede JS test koşucusu
     yok ve eklemek ayrı bir karar. Doğrulama iki temada gözle yapıldı.
   - **Aşama 11'in kapısı gerçek bir koşumda tetiklendiği görülmedi** —
     yasak yüzünden. Kapı ısrarı kesiyor ama **isabeti artırmıyor**: model
     hâlâ ıskalıyor, yalnızca üçüncüde durduruluyor. Ölçüm sonrası "tekrar"
     hâlâ yüksekse sıradaki adım Set-of-Mark; gerekçesi YAPILACAKLAR.md'de.
   - ✅ **Tasarım gerçek pencerede görüldü** — 2026-09-09'da ledger, ve
     **2026-09-12'de Aşama 26** (kullanıcı botlar kipini açıp denedi,
     ekran görüntüsü gönderdi: *"çok iyi olmuş test ettim biraz"*).
     ⚠️ **Ama Aşama 25'in terminal değişiklikleri hâlâ gerçek pencerede
     görülmedi** — satır aralığı 1.15 → 1.0 ve `.pane .term`'in kutu
     modeli. Doğrulama WebKitGTK'da, aynı motorda ve gerçek `Term`
     bileşeniyle yapıldı; gözle bakmak kullanıcıya kalıyor.
8. ✅ **Aşama 23 2026-09-08'de bitti — terminal kipi.** Kullanıcının sekiz
   isteği kapandı: ad sormayan `+`, sağ tık + yeniden adlandırma, klasör
   değiştirme, çalışma alanları, ikonlu düzen sırası, animasyonlu sıra
   değişimi, kenar çubuğundan bölmeye sürükleme, genişletme. Ayrıntı ve bütün
   ölçümler [ASAMALAR.md](ASAMALAR.md) Aşama 23'te; özetle:

   - **Düzen artık hesaplanan dikdörtgen**, iç içe flexbox değil
     (`agac.ts::yerlesim`). Liste `key={session}` ile çiziliyor, yani takas
     `Term`'i **yeniden kurmuyor**: 33 ms'yi aşan kare 0, `pty_open` çağrısı 0.
   - **Zoom arkadakileri boyutlandırmıyor** — ötekilerin kutusu birebir aynı.
   - **Çalışma alanları sekmeli**, her birinin kendi ağacı var.

   ✅ **Gerçek pencerede 2026-09-09'da görüldü** (madde 7).

9. ✅ **Aşama 24 (2026-09-08): Türkçe karakterler iki kez gönderiliyordu.**
   Kullanıcı *"ciddi hata"* dedi ve haklıydı. Sebep xterm'in yineleme
   korumasının `_keyUp`'ta sıfırlanan bir bayrağa bakması; ayrıntı aşağıda
   "Terminal kipi" ölçümlerinde ve [ASAMALAR.md](ASAMALAR.md) Aşama 24'te.
   **Sorun harf değil olay sırasıydı** — geç sırada ASCII de ikileniyor.

10. ✅ **Aşama 25 2026-09-12'de bitti — SORUN.md'nin terminal backlog'u.**
   Dokuz maddenin yedisi kapandı. Ayrıntı ve bütün ölçümler
   [ASAMALAR.md](ASAMALAR.md) Aşama 25'te; özetle:

   - **Ölü oturumun etiketi** yeni terminale yapışıyordu (`Pcbridge`); sebep
     `free_name`'in adları geri dönüştürmesi, gerçek `localStorage`'ta ölçüldü.
   - **Sıfır çalışma alanı** artık geçerli; son grup kapanabiliyor, orta tık
     kapatıyor, yeni terminal alanı kendiliğinden kuruyor.
   - **Alan başına varsayılan klasör** sağ tık menüsünde.
   - **`FitAddon` kenarlık kutusunu okuyordu** — yedi yükseklikten altısında
     bir fazla satır, ikisinde alt satır kırpılıyor.
   - **Satır aralığı 1.15 → 1.0**; blok karakterlerin satır arası boşluğu
     kapandı (247/255 → 54/255).

   ⏭️ **Blokların sütun arası dikişi ES GEÇİLDİ.** Ölçüldü, sebebi biliniyor
   (kesirli hücre genişliği; DOM çizicide çözümü yok), ve kullanıcı
   2026-09-12'de *"sorun değil, sonra da hallolur"* dedi. **Kendi başına
   yeniden ele alma.**
   ⚠️ **Açılışta siyah-beyaz terminal** açık: yeniden üretilemedi, en olası
   sebep ölçümle elendi. Ayrıntı SORUN.md "Hâlâ açık" başlığında.
   ✅ **Genel arayüz okunaklılığı** Aşama 26'da kapandı (aşağıda).

11. ✅ **Aşama 26 2026-09-12'de bitti — botlar kipinin arayüzü.** Kullanıcı
   `/design` ile üç yön çizdirdi, "D"yi seçti ve dört değişiklikle onayladı.
   Ayrıntı ve bütün ölçümler [ASAMALAR.md](ASAMALAR.md) Aşama 26'da; özetle:

   - **Bot ve session'ları çerçeveli bir kutuda** — *"soldaki bot, altındaki
     sessionlar ile başka botları ayırmak da çok zor"*.
   - **Kimlik rengi ve kimlik karesi kaldırıldı** — `Bot.avatar`, `hueFor`,
     `ui/Avatar.tsx`, hue şeridi silindi. `hueOf` **terminal sekmelerinde
     kalıyor** (kullanıcının kararı), ama nokta orada da yuvarlak.
   - **BotForge dört sekmeden üçe indi:** Temel (ad · yönerge · dizin) ·
     Motor · Araçlar & izin. Kimlik rengi kalkınca "Kimlik" tek alana
     düşmüştü.
   - **Sohbetteki 104px oluk kalktı;** konuşanı yön söylüyor.
   - **Yedi yerde kelime ikona döndü;** kelimeler `title`/`aria-label`'da.
   - **Besteci yeniden bir kutu, yer tutucusu boş.**
   - **Session açılış ekranı boşaldı:** açılış sözü ve `SESSION n` · `İSTEM`
     · `ÖNCE` etiketleri kalktı; besteci dikeyde ortada, ilk mesajda
     sohbetteki yerine **iniyor** (`lib/inis.ts`).
   - **Botun ayarlarını adının kendisi açıyor;** sağ üstteki `DÜZENLE`
     kelimesi kalktı.
   - **Seçenek sırası (`.seg`) altı çizili metinden çerçeveli kutulara
     döndü** — izin kipi, arka uç, tema, dil. Sekmeler (`.sek`, `.sekme`)
     alt çizgiyi tutuyor: onlar seçenek değil **yer** gösteriyor.

   ⚠️ **Terminal kipinin geri kalanı bu çalışmanın dışındaydı** — satır
   listesi, `.row__ops` hover davranışı, bölme başlıkları. Sekme rengine
   kullanıcı ayrıca karar verdi (kalıyor, yuvarlak). `PermAsk` hâlâ oluğu
   kullanıyor (bestecinin üstünde yüzen kart) — tasarımda yoktu.

12. **Aşama sırası:** [ASAMALAR.md](ASAMALAR.md)'deki **yirmi altı aşama da
   bitti.** O dosya artık yapılacak iş listesi değil, **bitmiş işin kaydı** —
   yeni iş bitince oraya bir aşama olarak taşınır.
13. **Çalışma tarzı bu dosyanın sonunda.** Özeti: ölçmediğini "çalışıyor" diye
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
- **Bir bot bir sohbet değil, bir asistan.** Yapılandırma (model, araç
  filtresi, izin kipi, çalışma dizini) **botta**, işler **`Session`'larda**.
  Bağlamın sınırı session'dır: `agent::gecmis_in` yalnızca bir session'ın
  `jobs`'ını okuyor ve iki session birbirinin geçmişini hiç görmez. Botun
  ayarları session'a **kopyalanmaz** — aynı işi yapan iki denetim bu depoda
  bir kez ölü kaldı.
  `Bot.jobs` ve `Bot.session_id` artık **göç alanı**: okunur, yazılmaz, ilk
  kayıtta diskten düşer. Yeni kod onlara asla yazmaz.
- **Olay yükleri `sessionId` taşır.** Aynı botun iki session'ı paralel
  koşabiliyor; yalnızca `botId`'ye bakan bir süzgeç açık ekrana ötekinin
  token'larını yazar.
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
- **Görünen etiket ile tmux adı ayrı.** Bir bölme bir tmux oturumu, ama ad
  ağacın, `localStorage`'ın, PTY `HashMap`'inin ve olay yüklerinin anahtarı —
  yeniden adlandırmak dördünü birden kaydırırdı. Kullanıcının verdiği etiket
  ayrı bir haritada (`pcbridge.terminal.etiketler`); varsa dinamik başlık
  (`user@host: ~dizin`) durur, silinince geri gelir. GNOME Terminal'in
  davranışı. Yeni terminalin adını **Rust üretiyor** (`tmux_free_name`),
  kullanıcı hiç yazmıyor.
  ⚠️ **Ad geri dönüştürülüyor, yani etiket oturumdan uzun yaşarsa yanlış
  terminale yapışır.** `free_name` `term1`'den başlayıp tmux'ta **olmayan**
  ilk adı veriyor; oturum ölünce `term1` yeniden boşa çıkıyor. Gerçek
  uygulamanın diskinde ölçüldü (2026-09-12): tmux sunucusu hiç çalışmazken
  kayıt `{"term1":"Pcbridge"}` taşıyordu ve her yeni ilk terminal "Pcbridge"
  adıyla doğuyordu. Etiket artık iki yerde düşüyor — oturum öldürülürken ve ad
  geri dönüştürülürken — ve ikisi de `etiketYaz(ad, "")` çağırıyor; boş ad
  zaten "sil" demek, ikinci bir silme yolu yazılmadı.
- **Otomatik olan şey listenin gruplanması, alan üyeliği değil.** Kullanıcı
  *"varsayılan olarak dizine göre otomatik ayrılır… ancak o terminal orada
  kalır"* dedi. Bir yeni terminal `~`'da doğuyor, yani dizine göre **atama**
  hepsini tek gruba düşürürdü; `cd`'den sonra yeniden atamak da terminalleri
  gruplar arasında zıplatırdı. Bu yüzden **alan üyeliği elle**, kenar
  çubuğundaki "burada değil" listesi **dizine göre** gruplanıyor.
  Üyeliğin tek kaynağı alanın ağacı (`alanlar.ts`) — ayrı bir
  `session → alan` haritası **yok**, alan rengi için ayrı bir hue alanı da
  yok (addan türüyor). İkisi de `Bot.desktop` dersinden.
- **Çalışma alanı sayısında ALT sınır da yok.** `alanSil` sonuncuyu da
  siliyor ve sıfır alan geçerli bir durum; eski gerekçe ("sekmesiz bir
  terminal kipi çizilemez") yanlıştı. Boş durum diskten okunurken korunuyor,
  ama *"kayıtta alan vardı ve hepsi bozuktu"* hâlâ göç yoluna düşüyor —
  `alanlar.ts::coz` ikisini ayırt ediyor. Hiç alan yokken ağaç yazmak alanı
  **kendiliğinden kuruyor** (`agacYaz`), yani yeni terminal açmak için önce
  grup yaratmak gerekmiyor; **boş ağaç için kurmuyor**, son bölmeyi kapatmak
  boş bir grup doğurmamalı.
- **Alanın varsayılan klasörü yalnızca DOĞUŞTA okunur.** tmux `-c`'yi yalnızca
  `new-session` yolunda görüyor (`pty.rs::open`), var olan oturuma bağlanmak
  onu hiç okumuyor. Bu yüzden klasör bölmeye **ilk çizimde donduruluyor**
  (`Bolme::ilkDizin`): canlı prop olsaydı alanın klasörünü değiştirmek
  `Term`'in kurulum efektini (deps `[session, workdir]`) yeniden çalıştırır ve
  açık bütün bölmeleri sökerdi.
- **Terminal bölme sayısında sınır YOK.** Dörtlü sınır bir ön yüz
  sözleşmesiydi (`slice(0, 4)`) ve beşinci oturumu **sessizce yutuyordu**;
  Rust'ta hiç olmadı (`pty.rs` sınırsız `HashMap`). Düzen bir ağaç
  (`src/lib/agac.ts`), `panes: string[]` değil.
- **Yükseklik geçişi tek yerde:** `src/lib/yukseklik.ts`. WebKitGTK'da
  `calc-size()` yok, `height: auto` CSS'ten geçirilemiyor. Düşünce kutusu,
  besteci, katlanır session listesi ve BotForge sekmeleri aynı yardımcıyı
  kullanıyor — dört kopya er geç ayrışırdı.
- **Yerinde adlandırma tek yerde:** `src/ui/InlineAd.tsx`. Bölme başlığı,
  kenar çubuğu satırı ve alan sekmesi aynı alanı kullanıyor; kabı `sinif`
  prop'undan geliyor. İki kopya bir süre yan yana durdu ve gerekçe "kapları
  farklı" idi — toplanınca bir sarkıntı kapandı: kenar çubuğu kopyası yalnızca
  `onClick`'i durduruyordu, oysa satırın sürüklemesi `pointerdown`'da başlıyor
  ve alanın içinde metin seçmek satırı sürüklemeye başlatıyordu.
  Bölmeye sürükleme de tek yerde: `src/lib/surukle.ts`, iki çağıran.
- Ölçmediğini "çalışıyor" diye yazma. "Hata vermedi" kanıt değil.

## Tasarım kanunu — "Ledger"

Tasarım: **Claude Design projesi `8794d0d1-189f-4c8b-ad90-732dcac791f6`**,
dosya `Pcbridge Redesign.dc.html` — sekiz ekran, uygulamanın tamamı.
Yerel kopyaları `design/*.dc.html`. Kod bunlardan sapamaz.

⚠️ **Botlar kipi 2026-09-12'de bu tuvalden ayrıldı (Aşama 26).** Kullanıcı
`/design` ile üç yön çizdirip "D"yi seçti; kaynak
`design/oneriler-2026-09-12/` (`Main.dc.html` seçilen, ötekiler kayıt) ve
tuval <https://claude.ai/code/artifact/4bc541ef-1b15-49d1-8f05-168f68e772d8>.
Sapmalar aşağıda, kendi başlıklarında yazılı. **Terminal kipi ve ayarlar
eski tuvalde kaldı.**

⚠️ **Bu kanun 2026-09-08'de "Nötr Kabuk"un yerine geçti.** Eskisi
[ASAMALAR.md](ASAMALAR.md) Aşama 20'de kayıt olarak duruyor; oradaki
ölçümler (özellikle kontrast tuzakları) hâlâ geçerli, yalnızca tokenların
adları değişti.

**Tek ilke: kutu yok, cetvel var.** Ayırıcı bir yüzey kademesi değil 1px'lik
bir çizgi; her bölüm solda mono, büyük harf bir etiket oluğuyla başlıyor.
Kabuk renksiz — renk yalnızca **durumdan** (çalışıyor/bitti/başarısız) gelir.
Sistem aksan rengi **yoktur**, ve 2026-09-12'den beri **kimlik rengi de
yoktur**.

⚠️ **İlkenin üç bilinçli istisnası var, üçü de 2026-09-12'de (Aşama 26)
kullanıcının kararıyla kondu.** Üçü de ölçülebilir bir şikâyetten doğdu,
biçim tercihinden değil:

| istisna | neden |
|---|---|
| **bot kutusu** (`.botkutu`) — çerçeveli, 4px | *"soldaki bot, altındaki sessionlar ile başka botları ayırmak da çok zor"* |
| **besteci** (`.composer`) — çerçeveli, zeminli | *"mesaj yazma kutusunun mesaj yazma kutusu olduğunu anlamak çok zor"* |
| **kullanıcının cümlesi** (`.sen`) — dolgulu, sağa dayalı | *"yazının benim promptum mu botun yanıtı mı olduğunu anlamak için yanlarındaki ufacık yazıları okumak gerekiyor"* |

Dördüncüsü daha küçük: seçili session kutunun içinde bir **yüzey
kademesiyle** işaretleniyor (`--field`), altı çizgiyle değil — çizgi
kutunun kendi cetveliyle karışıyordu. Bunların dışında kural yürürlükte:
yeni bir kutu **ancak kullanıcı bir okunurluk sorunu bildirdiğinde** açılır.

### Oluk — tasarımın imzası, ama artık sohbette değil

Solda 104px'lik mono büyük harf bir etiket (`.16em` aralık), sağda içerik.
Ayarlarda bölüm, ilk açılışta `SUNUCU`. **Kalan iki yer bunlar** — sohbet
dökümü ve session açılış ekranı 2026-09-12'de oluğu bıraktı.

⛔ **Sohbet dökümünden 2026-09-12'de kalktı (Aşama 26).** Kullanıcının sözü:
*"yazının benim promptum mu botun yanıtı mı olduğunu anlamak için
yanlarındaki ufacık yazıları okumak gerekiyor"* ve *"düşünce/araçlar/yanıt
falan bunlar olmasın böyle"*. Dökümde konuşanı artık **yön** söylüyor:
kullanıcının cümlesi sağa dayalı ve dolgulu (`.sen`), botun yanıtı sola
dayalı ve çıplak (`.bot`). `DÜŞÜNCE` ve `ARAÇLAR` tek bir **yardımcı
şeride** indi (`.yardim`): kıvılcım ikonu + süre, araç ikonu + ham araç
kimliği + durum noktası. `HAM` · `ÖZET` · `HATA` küçük bir mono satır
taşımaya devam ediyor (`.kita__et`) — onlar yönle anlatılamıyor.

**Tek yerde: `src/ui/Oluk.tsx`.** Dört dosyada dört kopyası vardı ve
toplandı; bu depoda kopyalanan yardımcı er geç ayrışıyor (`yukseklik.ts`
aynı sebeple toplanmıştı). Dar oluk (`--oluk-dar`, 34px) durum
kısaltmalarını taşıyor: **ÇLS · TMM · HTA** (İngilizcede RUN · OK · ERR).
⚠️ Kenar çubuğundaki session listesi de 2026-09-12'de **noktaya** geçti
(kullanıcı: *"sessionların sollarındaki renkli noktacıklar kalsın ama onlar
durum bildiriyor"*); kısaltma `aria-label`/`title`'da duruyor. Dar oluğu
hâlâ kullanan tek yer session açılış ekranının kart listesi (`.okart__st`),
ve kısaltmalar **aynı sözlükten** geliyor.

### Tokenlar

```css
/* koyu — birincil */
--bg:#101112;      --bg-side:#0b0c0d;   --well:#08090a;
--field:#1f2122;   --field-h:#2a2d2f;   --field-a:#33383a;
--line:#1f2122;    --line-2:#2a2d2f;    --line-3:#3a3d3f;
--text:#e9e9ea;    --text-2:#c4c6c8;    --text-3:#9b9ea2;  --text-muted:#8f9296;
--run:#d3a056;     --ok:#75b683;        --fail:#e2726b;
--av-l:0.62;       --av-c:0.14;         /* hue ADDAN türer, 0-359 */

/* aydınlık — TÜRETİLDİ; tasarım yalnızca koyu veriyor */
--bg:#f5f3ef;      --bg-side:#ebe8e2;   --field:#e1ddd5;
--field-h:#d5d0c6; --field-a:#c6c0b5;
--line:#dcd7ce;    --line-2:#c6c0b5;    --line-3:#aaa397;
--text:#191b1e;    --text-2:#333538;    --text-3:#505255;  --text-muted:#5a5c5f;
--run:#6f4700;     --ok:#266034;        --fail:#992d29;
--av-l:0.50;       --av-c:0.14;

/* İKİ TEMADA DA AYNI — kuyu aydınlıkta da koyu kalıyor */
--well-text:#e9e9ea   --well-muted:#9b9ea2   --well-sel:#33383a
--well-line:#2a2d2f   --well-run:#d3a056     --well-ok:#75b683   --well-fail:#e2726b
/* ANSI, yalnızca terminal — terminal her zaman kuyudadır, teması yok */
--blue:#398ad6   --magenta:#8d73d1   --cyan:#009fa0
```

**Metin DÖRT seviye.** Eski kanunda "üçüncüsü yok" bir kuraldı; sebebi o
seviyenin iki denemede de AA altında kalmasıydı (3.7 ve 3.1). Bu rampa
düşmüyor — koyu temada 15.58 / 11.03 / 7.03 / 6.05, aydınlıkta 15.57 /
11.10 / 7.07 / 6.05. Tam tablo aşağıda.

⛔ **Botların kimlik rengi ve kimlik karesi 2026-09-12'de KALDIRILDI
(Aşama 26).** Kullanıcının kararı: *"bu botların renklerinin olması hoşuma
gitmedi. renk özelliğini kaldıralım. hepsi tek renk olsun. zaten artık
çerçeve var."* ve — kareyi işaretleyerek — *"bu karelerin hiçbir anlamı
yok."* `Bot.avatar` (Rust ve TS), `Avatar` tipi, `hueFor`, `ui/Avatar.tsx`,
`.av` / `.av--bos` ve BotForge'un hue şeridi silindi. Botları ayıran şey
artık kenar çubuğundaki **çerçeveli kutu**; renk yalnızca **durumdan**
geliyor.

✅ **`hueOf` ve `avatarVar` duruyor ve kalıyor.** Terminal kipindeki çalışma
alanı sekmeleri (`AlanSekmeleri`, `.tile`) addan türeyen hue'yu kullanmaya
devam ediyor — kullanıcının kararı (2026-09-12): *"terminal sekmelerinin
renkleri kalsın ama kare kare değil botlardaki bildirim gibi yuvarlak
olsunlar"*. Yani **renk kaldı, biçim değişti**: 9px kare → 6px yuvarlak,
`.dot` ile aynı geometri. `--av-l` / `--av-c` tokenlarının tek okuyucusu
artık burası.

Diskteki `bots.json` `"avatar"` alanını hâlâ taşıyor; serde
`deny_unknown_fields` kullanmadığı için sessizce yutuluyor ve ilk kayıtta
düşüyor (`Bot.desktop`'ın yolu). Bir regresyon testi bunu sabitliyor:
`bots::tests::kalkan_avatar_alani_eski_dosyayi_bozmuyor`.

**Kuyunun rengi tema değiştirmez.** Kuyu (terminal, ham çıktı, izin kutusu,
kod bloğu) aydınlık temada da koyu; içindeki **hiçbir renk** tema
tokenından alınmaz — metin de, çizgi de, durum da, düğme de. Ölçüldü:
aydınlıkta `--text` kuyuda **1.12**, `--fail` **2.62**, birincil düğmenin
dolgusu **1.15**; ANSI üçlüsü 3.14–3.87. Bu yüzden `--well-*` ailesi var ve
tema bloklarında **yeniden tanımlanmaz.**

⚠️ **Bu bir yıllık bir hatayı da kapattı:** `Term.tsx` ANSI renklerini
`--run/--ok/--fail`'den okuyordu, yani aydınlık temada terminalin kırmızısı
ve yeşili kendi koyu zemininde **2.5:1** ile çiziliyordu.

### Köşeler — iki değer

`0` düğme · `4px` kuyu, panel, bölme, örtü, **bot kutusu ve besteci** ·
`9999px` 6px'lik noktalar — durum noktası (`.dot`) ve terminal/çalışma alanı
noktası (`.tile`). ⚠️ `.tile` 9px **kareydi**; kimlik çipinin biçimiydi ve
o kalkınca tek başına kaldı. Kullanıcının kararı (2026-09-12): *"terminal
sekmelerinin renkleri kalsın ama kare kare değil botlardaki bildirim gibi
yuvarlak olsunlar"*. ⚠️ **Düğmelerin yarıçapı yoktur** — tasarımda tek bir yuvarlatılmış
düğme yok.

### Yazı

**Public Sans** (arayüz) · **Source Serif 4** (ad ve başlık) ·
**IBM Plex Mono** (etiket, düğme, tablo, kimlik) · **Geist Mono**
(**yalnızca terminalin içi** — `--mono-term`).

Serif yalnızca **ad ve başlık** için; gövde metni serif olmaz. Tasarımda tek
bir serif paragraf yok.

Türkçe kapsamı **ölçüldü** (fontTools ile cmap okundu): dördünde de
`ı ç ö ü Ç Ö Ü â î û` → latin, `ğ ş İ Ğ Ş` → latin-ext; yedek yığına düşen
karakter yok.

⚠️ **Google Fonts `<link>` KULLANILMAZ.** Tauri CSP'si `font-src 'self'
data:` ve açılışta ağa bağlanılmıyor; hepsi `@fontsource` paketlerinden
gelir. Tasarımın artboard'u o linki kullanıyor çünkü o bir web sayfası.

⛔ **Terminalin İÇİ kapsam dışı** — kullanıcının kararı (2026-09-08). Arayüz
IBM Plex Mono'ya geçti, terminal Geist Mono'da kaldı; böylece CLAUDE.md'deki
hücre genişliği, satır aralığı (1.15), punto (13) ve 222x45 ölçümleri
geçerliliğini koruyor. `.pane *` / `.xterm *` dokunulmuyor.

### Devinim

**Hiç değişmedi.** Aşama 12'de ölçülerek kurulmuştu ve tasarım devinim
hakkında bir şey söylemiyor; çalışan sistem korundu. Süre ve easing role
göre adlandırılır:

```css
--dur-tap: 70ms    /* basma */      --ease-out: cubic-bezier(0.22,0.61,0.36,1)
--dur-fast: 120ms  /* hover·renk */ --ease-in:  cubic-bezier(0.55,0,1,0.45)
--dur-base: 180ms  /* giriş·çıkış */--ease-inout: cubic-bezier(0.32,0.72,0,1)
--dur-slow: 300ms  /* kayan·düzen */
--dur-pulse: 1.6s  /* durum ritmi */
```

**Basmanın iki biçimi var.** Dolgu taşıyan öğe bir kademe ilerler
(`--field` → `--field-h` → `--field-a`); dolgusuz olan — ledger'da çoğunluk
onlar — metnini bir kademe parlatır ve basmada bir kademe geri iner.
Basma `--dur-tap` ile girer, bırakma `--dur-fast` ile döner; asimetri
kasıtlı.

⚠️ **İkincil metin taşıyan öğe dolgu kademesine çıkmaz.** `--text-muted`
`--field-h` üstünde **4.44**, `--field-a` üstünde **3.80** — ikisi de AA
altında. Bu, eski paletteki "`--text-muted` `--surface-2` üstünde
kullanılmaz" kuralının aynısı: **palet değişti, tuzak değişmedi.**

**Çıkış devinimi kütüphanesiz** (`src/lib/cikis.ts`), **düzen devinimi**
`src/lib/flip.ts`, **bestecinin session açılışından sohbete inişi**
`src/lib/inis.ts`, **akan metnin ucu maskeyle soluk** (`src/lib/akis.ts`).

⚠️ **İniş neden ayrı bir modül:** iki besteci aynı öğe değil (biri
`SessionHome`'un içinde, biri `Chat`'in yüzen altlığında) ve yeni kurulan
bir öğe geçiş oynatmaz — Aşama 12'de ölçülmüştü. O yüzden **konum el
değiştiriyor**: `Shell` ilk mesajı gönderirken eskisinin üst kenarını
ölçüyor, `Chat` mount'ta farkı bir kez oynatıyor. Ölçüm **bir kez**
tüketiliyor, yoksa sonraki her mount'ta besteci zıplardı.
Maske **kıtanın içine** konur — `.oluk` üstünde oluk etiketini de
maskelerdi. Ölçüldü: kıta ızgarasında `--akis-x` 436px, iki katmanlı maske,
etiket maskelenmiyor.

**Tema ve dil kısa ömürlü sınıfla geçer** (`.tema-gecis`, `.dil-gecis`).
⛔ Terminal tema geçişinin dışında (`.pane *`, `.xterm *`).

### Yasak

Sistem aksan rengi · **kimlik rengi** · **renkli gradyan** (aşağıda) ·
cam/blur · neon · **renkli birincil düğme** (birincil eylem `--text` dolgu,
`--bg` metin; kuyunun içindeyse `--well-text` dolgu, `--well` metin) ·
**yuvarlatılmış düğme** · **kutu ve yüzey kademesiyle ayırma** (ayırıcı
çizgidir — yukarıdaki dört istisna dışında) · emoji ve dingbat ikon ·
hover'da zıplama veya ölçeklenme · **sahte pencere düğmeleri** (GNOME kendi
çiziyor) · shadcn/MUI/Chakra · Inter/Roboto/Arial.

**"Gradyan yok" ne demek — kullanıcının netleştirmesi (2026-09-04).** Yasak
olan **renkli, dekoratif** gradyan. **Nötr (siyah-beyaz) gradyan yasak
değil**: metnin kenarını soluklaştıran `mask-image`, kaydırılabilir bir
alanın kenar soluğu serbest. Ölçüt renk: iki uç da nötrse sorun yok, hue
değişiyorsa yasak.

⛔ **Tek istisna olan hue şeridi 2026-09-12'de kalktı.** `.huesecim`
dekoratif değil denetimin kendisiydi — kullanıcı BotForge → Kimlik'ten bir
hue seçiyordu. Kimlik rengi kaldırılınca denetim de kalktı, yani istisna
konusuz kaldı. **Kural artık istisnasız:** kabukta renkli gradyan yok.

⚠️ **"Eylemler kelime" kuralı 2026-09-12'de büyük ölçüde GERİ ALINDI
(Aşama 26).** Kullanıcının sözü: *"nerdeyse tüm tuşlarda logo yerine yazı
yazmaya kaçılmış. işte dışa aktarma tuşu, botlar ve terminal tuşu falan…
daha görsel odaklı gitsek"*, ve ayrıca *"gönder tuşunda bile yazı var"*,
*"altında ek tuşu da gördüğün gibi sadece bir 'ekle' yazısı"*, *"hiç sorma
yazısı da öyle"*.

Şu sekiz yer artık ikon: **kip anahtarı** (Botlar · Terminal), **dışa
aktar**, **ek**, **izin kipi**, **gönder**, **yeni session**, sohbetteki
**düşünce/araç** şeridi, ve BotForge'un **klasör seç** tuşu (`SEÇ…`).
`IconBot` · `IconTerminal` · `IconExport` · `IconSend` · `IconThought` ·
`IconTool` bu gün eklendi; `IconFolder` zaten vardı.

**Kelimeler silinmedi, `title` ve `aria-label`'a taşındı** — ipucu ve ekran
okuyucu aynı metni görüyor. Bir regresyon testi bunu sabitliyor
(`icon buttons keep their words…`): metni olmayan hiçbir düğme adsız
kalamaz.

Kelime kalan yerler: `KAYDET` · `VAZGEÇ` · `YENİ BOT` · izin kartının
`İZİN VER` / `REDDET` · `+3 DAHA`. Ölçüt şu: **tek bir eylemi olan küçük bir
hedef ikon, cümle kuran ya da onay isteyen bir düğme kelime.**

Kalan ikonlar 20px ızgarada inline SVG.

**Markdown kendi kütüphanesini getirmez.** `src/lib/markdown.ts` çözümlüyor,
`src/ui/Markdown.tsx` **React öğesi** üretiyor — HTML dizgesi değil, yani
`dangerouslySetInnerHTML` hiç yok. Başlıkları serif, satır içi kodu `--field`
zeminde. **Bağlantılar gezinmiyor.**

**Yerel açılır liste (`<select>`) kullanılmaz** — GTK kendi kutusunu çiziyor.
Yerine `src/ui/Picker.tsx`; menüler de kendi bileşenimiz (`PermMenu`).

### Tuvalden bilinçli sapmalar

1. **Kip anahtarı kenar çubuğunun tepesinde** (Botlar | Terminal), tasarımın
   gösterdiği gibi — ama artıyı yalnızca terminal kipinde tutuyoruz: bot
   kipinde "yeni bot" listenin sonunda **kesik çerçeveli bir yuva**
   (`.yenibot`), ve her bot kutusunun başlığında kendi artısı var.
2. **Besteci ipucu `Ctrl ↵`.** Tasarım `⌘↵` yazmıyor ama artboard macOS
   alışkanlığı taşıyor; bu makine Linux.
3. **Aydınlık tema tasarımda YOK ve türetildi.** Koyu rampanın kontrast
   yapısı aynalandı; zemin ailesi nötr-sıcak, çünkü tasarımın kendi tuval
   kâğıdı (#e8e6e1) o yönü gösteriyor.
4. **`RTT 6 ms` ve `pcbridge 0.4.2` çizilmiyor** — uygulamada o veri yok.
   Tasarımın kendi ilkesi bunu söylüyor: *"the app does not draw what it has
   not measured."*
5. **Masaüstü panelinde "LOCK NOW" düğmesi yok.** Anahtar zaten kilitliyor
   ve bu depoda aynı işi yapan iki denetimden biri bir kez ölü kaldı.
6. ⚠️ **Düzen sırası kelimeyle değil İKONLA.** Kanun 2026-09-08'e kadar
   tersini diyordu (*"ikon değil kelime, tasarımdaki gibi"*); kullanıcı aynı
   gün ikon istedi. Kelimeler `aria-label` ve `title`'da yaşıyor, yani ekran
   okuyucu ve ipucu aynı metni görüyor. Beş ikon 20px ızgarada, etkin olan
   `box-shadow: inset 0 -1px 0 var(--line-3)` ile altı çizili. Aynı gösterge
   çalışma alanı sekmelerinde de kullanılıyor — ikinci bir dil icat edilmedi.
7. **Terminal kipi sekmeli** (çalışma alanları) — tasarımda yok, kullanıcının
   isteği. Sekme bir kutu değil: etkin olan altındaki cetvelle işaretleniyor,
   rengi addan türüyor (`hueOf`, botlardaki formülün aynısı).
8. **Kenar çubuğunda satır eylemleri var** (düzenle · sil · katla), tasarımda
   yok. Çalışan işlevler; akışın dışında, satırın üstüne binerek duruyorlar —
   yer kapladıklarında 252px'lik sütunda bot adı "Deskto…" diye kırpılıyordu.

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

### Terminal kipi — 2026-09-08'de ölçüldü (Aşama 23)

- **`bind -p`:** `\C-u` = `unix-line-discard` — satırı keser **ve kill-ring'e
  koyar**; `\C-y` = `yank`. `HISTCONTROL=ignoreboth`, yani **baştaki bir
  boşluk** komutu geçmişe hiç sokmuyor. `cd` bu yüzden ` cd -- '<yol>'` diye
  gönderiliyor (`src/lib/kabuk.ts::cdDizisi`).
  ⚠️ **`\x19` (Ctrl+Y) bilinçli olarak YOK.** Plan yarım komutu geri koymak
  için onu kullanıyordu; ölçüldü ki **boş** satırda `Ctrl+U` kill-ring'e
  dokunmuyor, yani `Ctrl+Y` kullanıcının çok daha eski bir kesilmiş metnini
  yapıştırıyor (gerçek kabukta `echo ESKI_KESILEN` prompta düştü). Yarım
  komut kill-ring'de duruyor; geri getirmek isteyen kullanıcı kendisi
  `Ctrl+Y` yapıyor.
- **`tmux display-message -p -t <olmayan-oturum>` exit 0 döndürüyor**,
  stderr'e hiçbir şey yazmıyor ve bütün alanlar **boş** geliyor. İlk `info()`
  bu yüzden boş bir `PtyInfo` döndürüyordu ve başlık `eymistaken@: ` yazacaktı.
  Varlık yoklaması `#{session_name}`: boş dönerse `PtyError::Yok`.
- **Çalışan bir sürecin cwd'si dışarıdan değiştirilemez** — bu işletim
  sisteminin kuralı, uygulamanın eksiği **değil**. CLI algılaması
  `#{pane_current_command}`; bir CLI çalışıyorsa kullanıcıya soruluyor
  (*yeni pencere · yine de gönder · iptal*), sessizce hiçbir şey yapılmıyor.
- **`:has()` WebKitGTK 4.1'de destekleniyor** — varsayılmadı, ölçüldü.
- ⚠️ **xterm bir tuşu iki kez gönderebiliyor ve bu "Türkçe karakter hatası"
  gibi görünüyor.** xterm'in iki göndericisi var: `_keyDown` (tuş) ve
  `_inputEvent` (metin alanına düşen `insertText`). İkincisinin yineleme
  koruması `(!e.composed || !this._keyDownSeen)` ve **`_keyDownSeen`'i
  `_keyUp` sıfırlıyor** — yani `input` olayı `keyup`'tan **sonra** gelirse
  koruma çalışmıyor. ibus Türkçe düzende ASCII olmayan tuşu eşzamansız
  işliyor, `input` gerçekten sonra geliyor.
  **Sorun harf değil sıra:** ölçüldü ki geç sırada ASCII de ikileniyor
  (`aabbccdd`), erken sırada Türkçe ikilenmiyor (`öçığ`).
  Katlanma da buradan: her tuş iki karakter yazıyor, her geri silme birini
  siliyor; sil-yeniden yaz döngüsünün her turunda satır bir karakter uzuyor.
  **Düzeltme `Term.tsx`'te:** `onKey` yalnızca `_keyDown`/`_keyPress` veriyi
  kendisi gönderdiğinde ateşliyor, o yüzden ateşledikten sonra gelen aynı
  içerikli `insertText` durduruluyor. Dinleyici **kapta ve yakalama
  evresinde** — xterm kendi dinleyicisini metin alanına `open()` içinde
  kuruyor, aynı düğümde sonradan kurulan dinleyici sonra çalışır.
  Bozulmayan iki yol da ölçüldü: büyük harf muafiyeti (`_keyDown` 65–90'ı
  bilerek göndermiyor) ve gerçek IME derlemesi (keyCode 229).
  ⛔ **Yamayı `onData` seviyesinde yapmak yanlış olurdu:** orada iki özdeş
  olay görünüyor ve gerçekten iki kez basılmış bir harften ayırt edilemez.
- **`atob` + `TextDecoder({stream:true})` + `term.write` yolu temiz.**
  Yukarıdaki hatayı ararken ölçüldü: `"öçığşüÖÇİĞŞÜ ok"` her olası bayt
  kesiminde ikiye bölünüp yazıldı — **bozulan kesim yok**; bayt bayt yazmak
  da metni birebir veriyor. Çok baytlı karakter sorunu ÇIKTI yolunda değil.
- ⚠️ **xterm'in yardımcı metin alanı yalnızca Enter, Ctrl+C ve odak
  kaybında boşalıyor.** Yani yazdıkça birikiyor (ölçüldü). Zararsız — her
  gönderici kendi başlangıç ofsetini derleme başında okuyor — ama **elle
  temizlemek tehlikeli**: `_handleAnyTextareaChanges` bekleyen bir farkı
  varsa alanın kısalması ona geri silme (`DEL`) gibi görünür.
- **CSS `position: absolute`'u DOLGU KUTUSUNA göre çözüyor.** `.agac`'ın
  `padding`'i sessizce atlanıyordu ve bölmeler tuvalin kenarına yapışıyordu;
  içe bir `.tuval` katmanı kondu (`position: relative` onun).
- **Zoom'un ilk karesi 46–66 ms ve sebebi büyüyen yüzeyin boyası.** Üç şey
  denendi, **üçü de geri alındı**: `will-change` (48 → 53/59/66 ms, daha
  kötü), `z-index: 1` + `contain: paint` (etkisiz), `.term`'e
  `visibility: hidden` (55 ms — yani xterm sebep değil). Kabul edildi.
- **`Term` sökülürken PTY'yi kapatmıyor** (bölme yeniden çizilirse aynı
  oturuma bağlı kalmalı). Bu yüzden **çalışma alanı değişince** eski alanın
  PTY'leri açıkça kapatılıyor: yoksa arka plandaki alanların okuma iş
  parçacıkları kimsenin dinlemediği olaylar yayardı. Oturum ölmüyor.

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

- **Satır aralığı `1.0` ve bu bir yuvarlama değil, eşik.** TUI'ler (Claude
  Code, Antigravity) maskotlarını ve çerçevelerini blok karakterleriyle
  (`█ ▀ ▄ ▌`) çiziyor. 13px Geist Mono'da blok glifi **15px**; hücre bundan
  yüksek olunca fark satır sınırında **arka plan** olarak görünüyor ve yığın
  parçalanıyor. Gerçek widget görüntüsü üstünde piksel piksel ölçüldü
  (2026-09-12), dolu bir yığından geçen dikey kesitin dip değeri:
  **1.00 ve 1.05 → hücre 15px, düşüş 54/255** (yalnızca yumuşak kenar);
  **1.08 · 1.10 · 1.15 → hücre 16–17px, düşüş 247/255** yani tam boşluk.
  Eski 1.15 gaptan yanadaydı.
  ⚠️ **Sütun arası dikiş bununla düzelmiyor** ve satır aralığından bağımsız:
  hücre genişliği **7.798px**, yani kesirli, komşu bloklar alt piksel
  sınırlarında kenar yumuşatmasıyla çiziliyor — ölçülen her satır aralığında
  **84/255**. DOM çizicide kapatmanın yolu yok; gerçek çözüm tuval çizicisi.
- ⚠️ **WebGL çizici KULLANILMIYOR — WebKitGTK'da hiç çizmiyor.**
  `@xterm/addon-webgl` 2026-09-03'te kaldırıldı. Ölçüm: aynı sayfa, aynı 1,5
  saniye, **hiçbir girdi olayı olmadan** alınan gerçek widget görüntüsü
  (`WebKit2.WebView.get_snapshot`, JS piksel okuması değil) — WebGL açıkken
  tuval **bomboş**, kapalıyken yazı yerinde. Hız gerekçesi de düştü: 2000
  satır DOM çizicide 46 ms, WebGL'de 43 ms.
  ⚠️ **`customGlyphs` DOM çizicide çalışmıyor — bu satır bir yıl yanlıştı.**
  Eskiden burada *"artık bir `Terminal` seçeneği ve DOM çizicide de geçerli;
  kutu-çizim ve blok karakterleri hücreye tam oturuyor"* yazıyordu. Ölçüldü
  (2026-09-12): xterm 6'nın ana paketinde seçenek yalnızca iki yerde geçiyor —
  varsayılan değeri (`true`, yani açıkça vermek zaten gereksizdi) ve bir
  "değişti, yeniden çiz" dinleyicisi. Glifi çizen kod **tuval/WebGL eklenti
  paketlerinde**. Seçenek `Term.tsx`'ten kaldırıldı. Çerçevelerin düzgün
  görünmesi **Geist Mono'nun kendi kutu-çizim gliflerinden**; bloklar hücreye
  oturmuyor (yukarıdaki satır aralığı ölçümü).
- **Punto tam sayı** (13). Kesirli punto hücre genişliğini kesirli yapıyor.
- **Yazı tipi ÖNCE yüklenir, terminal SONRA kurulur.** xterm hücre
  genişliğini `open()` anında bir kez ölçüyor. `document.fonts.ready` tek
  başına yetmez: `@fontsource` yüz tanımları tembel, istenmemiş bir yazı tipi
  için "bekleyen yükleme" yoktur ve `ready` hemen çözülür.
  `document.fonts.load('13px "Geist Mono"')` isteği açıkça başlatıyor.
- **Ölçüm:** bölme 222x45 çıktı; `COLUMNS` kadar uzunlukta bir cetvel tek
  satıra tam sığdı, taşma ve sarma yok. tmux durum çubuğu da tam genişlikte.
  ⚠️ **Satır sayısı 2026-09-12'de değişti** (satır aralığı 1.15 → 1.0, hücre
  19 → 15px): aynı bölme artık daha çok satır taşıyor. Genişlik ölçümü
  geçerli, `45` değil.
- ⚠️ **`FitAddon` kabın KENARLIK kutusunu okuyor ve dolgu bir fazla satır
  veriyordu.** `proposeDimensions` satır sayısını
  `getComputedStyle(terminal.element.parentElement).height`'tan çıkarıyor ve
  yalnızca **terminalin kendi** (`.xterm`) dolgusunu düşüyor; dolgu ise kapta
  (`.pane .term`, `8px 10px`). Küresel `box-sizing: border-box` altında WebKit
  o özelliği kenarlık kutusu olarak veriyor (ölçüldü: 454, gerçek içerik 438).
  Yedi bölme yüksekliğinde ölçüldü — **altısında bir fazla satır**, son satır
  içerik kutusunun 3–13px altına taşıyor, ikisinde bölmenin `overflow: hidden`'ı
  tarafından **kırpılıyor**. Temiz çıkan ikisi `floor`'un iki sayı için aynı
  sonucu verdiği 3/19'luk azınlık, ve ilk ölçüm oraya denk geldiği için sorun
  "yok" görünmüştü. Düzeltme `.pane .term`'e **`box-sizing: content-box`**:
  düzeni hiç değiştirmiyor, yalnızca `getComputedStyle`'ın ne raporladığını
  değiştiriyor. Aynı hata genişlikte de vardı (bir fazla sütun).
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

### Devinim — 2026-09-05'te ölçüldü (Aşama 12)

- ⚠️ **WebKitGTK öneksiz `user-select`'i DESTEKLEMİYOR.**
  `CSS.supports('user-select','none')` → **false**;
  `CSS.supports('-webkit-user-select','none')` → **true**. `body`'deki
  öneksiz kural bir yıl boyunca ölüydü ve arayüzün her yazısı sürüklenince
  seçiliyordu. **Her `user-select` yanına `-webkit-` konur.** Seçim yalnızca
  yazılan yerde açık; terminal etkilenmiyor (xterm kendi seçim katmanını
  çiziyor, native seçime bağlı değil).
- **Düz bir CSS özel değişkeni geçiş yapamaz.** Akış maskesi ilk sürümde her
  token'da zıplıyordu; `--akis-x` `@property` ile **tipli** tanımlanınca
  geçirilebilir oldu (`syntax: "<length>"`). `@property` ve
  `CSS.registerProperty` WebKitGTK'da **destekleniyor** — ölçüldü.
  Başlangıç değeri çok büyük seçilir (`99999px`): sıfır olsaydı ilk
  ölçümden önceki karede blok tamamen maskelenirdi.
- **Mount'taki kaydırma yumuşak olmamalı.** `scrollIntoView({behavior:
  "smooth"})` bileşen ilk kurulduğunda "geçmişin içinde hızla süzülme" gibi
  görünüyor. Yumuşak kalan tek durum açık duran bir listeye içerik eklenmesi.
  ⚠️ **Bunu "bot kimliği değişti mi" ile ölçmek YETMİYOR** — bir kez daha
  hataya düşürdü. Bota geçildiği anda `turns` hâlâ **boş**; geçmiş
  `botHistory` ile sonradan geliyor, yani etki ikinci kez çalışıyor ve o
  çalıştırma "aynı bot" sayılıp yumuşak kalıyor. Ölçüt **içerik** olmalı:
  yumuşak kaydırma yalnızca *zaten dolu olduğu görülmüş* bir sohbete tur
  eklenince.

- ⚠️ **Tarayıcı bölmesi gizliyken viewport 0x0.** `40vh` sıfır çıkıyor,
  `scrollHeight` saçmalıyor ve **geçişler hiç ilerlemiyor** —
  `getComputedStyle` geçiş boyunca hep **başlangıç** değerini döndürüyor,
  yani doğru bir CSS kuralı "uygulanmadı" gibi görünüyor. Bu bir kez yarım
  saat yanlış yere baktırdı. Düzen ve devinim ölçümü **WebKitGTK'da**
  yapılır; bölme yalnızca göze bakmak için.
- **WebKitGTK 4.1'de ne var:** `document.startViewTransition` **var** ·
  çok katmanlı `mask-image` ve `mask-composite: add` var · `color-mix()` var ·
  `transition-behavior: allow-discrete` var · `Range` ile imleç dikdörtgeni
  var. **`interpolate-size: allow-keywords` ve `calc-size()` YOK** — yani
  `height: auto` CSS ile geçirilemiyor, düşünce kutusu JS ölçümüyle.
- **`prefers-reduced-motion` GTK'nın `gtk-enable-animations` ayarından
  geliyor.** Ölçüm emülasyonla değil onu kapatarak yapılır.
- **`mask-composite`'in başlangıç değeri `add`** — iki katmanı birleşim gibi
  toplamak için ek bir özellik yazmaya gerek yok.
- **Akış maskesinin ölçülebilir bedeli yok.** Gerçek koşum kaydından
  çıkarılan 948 parçalık token akışı yeniden oynatıldı (model koşturulmadan):
  maske açık ortanca **11 ms**, kapalı **12 ms**, p95 ikisinde de 16 ms.
- **Tema geçişinin bedeli var ama küçük:** geçişli ortanca **18 ms**, ani
  takas **16 ms** — 180 ms boyunca kare başına ~2 ms.
- ⚠️ **Yeni kurulan bir öğe geçiş oynatmaz.** Kip anahtarının kayan parçası
  bir yıl boyunca hiç kaymadı: kip değişince bütün sol sütun sökülüp yeniden
  kuruluyordu ve yeni öğenin önceki `transform`'u olmadığı için geçişin
  başlangıç ucu yoktu. Kabuk (başlık + anahtar) `Shell`'e taşındı; ölçüm
  0 → 38 (40 ms) → 123 (120 ms) → 137 (450 ms), takas boyunca aynı DOM düğümü.
- ⚠️ **Listeden düşen öğenin farkı `useEffect`'te alınmaz.** Etki boyamadan
  sonra çalıştığı için satır bir kare listeden düşüyor, altındakiler o karede
  yukarı atlıyor, sonra geri kayıyordu (ölçüldü: 283 → 233 → 279). Fark
  **çizim sırasında** alınır — React'in "props değişince durumu ayarla"
  deseni.
- **`data-cikis` `undefined` ile silinir, `false` ile değil.** React
  `data-*`'a `false` yazınca `data-cikis="false"` çıkıyor ve `[data-cikis]`
  seçicisi ona da uyuyor.

### Kontrast tablosu — hesaplandı, tahmin değil

Metin renginin her yüzey üstündeki oranı. `✓` AA metin (4.5), `~` yalnızca
büyük metin/grafik (3.0):

| | `--bg` | `--bg-side` | `--field` | `--field-h` | `--field-a` |
|---|---|---|---|---|---|
| **koyu** `--text` | 15.58✓ | 16.14✓ | 13.33✓ | 11.43✓ | 9.79✓ |
| **koyu** `--text-2` | 11.03✓ | 11.43✓ | 9.44✓ | 8.09✓ | 6.94✓ |
| **koyu** `--text-3` | 7.03✓ | 7.28✓ | 6.01✓ | 5.15✓ | **4.42~** |
| **koyu** `--text-muted` | 6.05✓ | 6.26✓ | 5.17✓ | **4.44~** | **3.80~** |
| **koyu** `--run` / `--ok` | 8.04 / 7.90✓ | 8.33 / 8.18✓ | 6.88 / 6.76✓ | — | — |
| **koyu** `--fail` | 6.17✓ | 6.39✓ | 5.28✓ | — | — |
| **aydınlık** `--text` | 15.57✓ | 14.11✓ | 12.74✓ | 11.23✓ | 9.54✓ |
| **aydınlık** `--text-2` | 11.10✓ | 10.06✓ | 9.08✓ | 8.01✓ | 6.80✓ |
| **aydınlık** `--text-3` | 7.07✓ | 6.41✓ | 5.79✓ | 5.10✓ | **4.33~** |
| **aydınlık** `--text-muted` | 6.05✓ | 5.49✓ | 4.95✓ | **4.37~** | **3.71~** |
| **aydınlık** `--run` / `--ok` | 7.35 / 6.76✓ | — | 6.02 / 5.53✓ | — | — |
| **aydınlık** `--fail` | 6.86✓ | — | 5.61✓ | — | — |

Kalın olanlar AA'nın altında: **`--text-3` ve `--text-muted` `--field-h` ve
`--field-a` üstünde kullanılmaz.** İkincil metin taşıyan bir denetim
hover'da dolguya değil **metnine** biner. Bu, eski paletteki
"`--text-muted` `--surface-2` üstünde kullanılmaz" kuralının aynısı —
palet değişti, tuzak değişmedi.

**Kuyu ayrı bir yüzey** ve iki temada da koyu; içindeki **hiçbir renk** tema
tokenlarından alınmaz:

| `--well` (#08090a) üstünde | tema tokenı | kuyu tokenı |
|---|---|---|
| metin | koyu 16.70✓ · **aydınlık 1.12** ✗ | **`--well-text` 16.43✓** |
| ikincil metin | **aydınlık 2.63** ✗ | **`--well-muted` 7.41✓** |
| çalışıyor | **aydınlık 2.45** ✗ | **`--well-run` 8.48✓** |
| bitti | **aydınlık 2.66** ✗ | **`--well-ok` 8.33✓** |
| başarısız | **aydınlık 2.62** ✗ | **`--well-fail` 6.50✓** |
| birincil düğme dolgusu | **aydınlık 1.15** ✗ | `--well-text` 16.43✓ |
| ANSI mavi / macenta / cyan | **aydınlık 3.31 / 3.14 / 3.87** ✗ | 5.49 / 5.22 / 6.14✓ |

⚠️ Alt üç satır **bir yıllık bir hatayı** kayda geçiriyor: `Term.tsx` ANSI
ve durum renklerini tema tokenlarından okuyordu, yani aydınlık temada
terminalin kırmızısı ve yeşili kendi koyu zemininde ~2.5:1 ile çiziliyordu.
2026-09-08'de `--well-*` ailesine geçirildi.

**Cetveller dekoratif** (WCAG 1.4.11 kapsam dışı) ama yine de ölçüldü:
`--line` zemin üstünde koyu temada 1.17, aydınlıkta 1.29; `--line-2` 1.44
ve 1.63; `--well-line` kuyu üstünde 1.44.

**Kimlik çipi yok** (2026-09-12'de kaldırıldı), yani "avatar harfi 360
hue'da AA geçiyor" ölçümü de konusuz.

**2026-09-12'de eklenen yüzeyler — WebKitGTK'da ölçüldü**, tahmin değil
(sonda öğe + `getComputedStyle`, `--bg` ile `--field` arası `color-mix`):

| | koyu | aydınlık |
|---|---|---|
| besteci zemini | `#171819` | `#ece9e3` |
| `--text` / besteci | 14.64✓ | 14.25✓ |
| `--text-2` / besteci | 10.37✓ | 10.16✓ |
| `--text-muted` / besteci | **5.68✓** | **5.54✓** |
| `--text` / `.sen` (= `--field`) | 13.33✓ | 12.74✓ |
| `--text-2` / araç çipi (= `--field`) | 9.44✓ | 9.08✓ |
| gönder: `--bg` / `--text` dolgu | 15.58✓ | 15.57✓ |

⚠️ Bestecinin içindeki ikonlar ve model künyesi `--text-muted` taşıyor ve
o zeminde **5.68 / 5.54** ile AA üstünde. Zemin bir kademe daha koyulaşırsa
(`--field`'e kadar) bu 5.17'ye iner, hâlâ geçer; `--field-h`'ye çıkarsa
**4.44** olur ve **düşer** — palet değişti, tuzak değişmedi.

Kutu çerçeveleri dekoratif (WCAG 1.4.11 kapsam dışı) ama ölçüldü: `--line-2`
`--bg-side` üstünde koyu 1.41 / aydınlık 1.48; etkin kutunun `--line-3`'ü
1.79 / 2.05.

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

⚠️ **Tarayıcı bölmesi GİZLİYKEN devinim saati donuyor** — 2026-09-05'te
ikinci kez tuzağa düşürdü. Belirtiler: `getAnimations()[0].currentTime` **0**'da
kalıyor ama `playState` `"running"` diyor, `getComputedStyle` bir geçiş boyunca
hep **başlangıç** değerini döndürüyor ve doğru bir CSS kuralı "hiç uygulanmadı"
gibi görünüyor. O gün bu yüzden bestecinin `transition: border-radius, padding`
kuralı "kuralı iptal ediyor" diye yanlış tanılandı ve kaldırıldı; asıl motorda
ölçülünce geçişin **oynadığı** görüldü (9999px → 1049px → 20px) ve kural geri
kondu.

**İki betik var ve ikisi de asıl motorda koşuyor:** `scripts/olc-webkit.py`
**sayıyı** verir (JS sonucunu JSON'a çevirip basar), `scripts/goruntu-webkit.py`
**resmi** (`WebKit2.WebView.get_snapshot` → PNG). Yazı tipinin gerçekten
yüklendiği, bir çizicinin gerçekten çizdiği, kutu-çizim karakterlerinin
hücreye oturduğu yalnızca ikincisinde görülür.

```bash
python3 scripts/goruntu-webkit.py http://localhost:1420/sayfa.html cikti.png 2500 1280 800
```

**Ölçmeden önce `tabs_context` ile bölmenin görünür olduğunu doğrula**, ya da
doğrudan `scripts/olc-webkit.py` kullan. Betik `document.timeline.currentTime`
farkını da döndürüyor: 200 ms beklemede fark ~0 çıkıyorsa **ölçüm çöptür.**

```bash
python3 scripts/olc-webkit.py http://localhost:1420/sayfa.html olcum.js 1800
```

`olcum.js` bir `async` gövde; son ifadesi JSON'a çevrilip basılıyor. İki uç
not: `evaluate_javascript` **Promise döndüremiyor** (`Unsupported result type`),
o yüzden sonuç `window.__sonuc`'a yazılıp yoklanıyor; ve enjekte edilen
betiğin **tamamlama değeri düz bir dizge olmalı**, IIFE'nin Promise'i değil.

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

⚠️ **Kullanıcının canlı verisine bağlı bir test, testtir ama kırılgandır.**
`bots::tests::diskteki_gercek_botlar_hala_okunuyor` gerçek `bots.json`'u
okuyor — doğru bir fikir, çünkü göç ancak gerçek dosyada sınanır. Ama içine
*"koşumu olan botun tek session'ı olur"* diye bir varsayım sızmıştı ve o,
yalnızca **göçün kendi kurduğu** session için doğru. Kullanıcı ikinci bir
session açar açmaz test kırmızıya döndü (2026-09-12) ve **kod doğruydu**.
Ölçüt şu: diske bakan bir test **değişmeyecek** olanı sabitlesin (dosya
ayrıştırılıyor mu, varsayılanlar düşüyor mu, koşum kayboluyor mu);
davranışın kendisi **sentetik** bir kayıtla sınansın. `goc`'un iki dalının
da kendi sentetik testi zaten vardı ve dişleri görülmüştü.

## Çalışma tarzı

- Her aşamadan sonra **fiilen çalıştırıp test et**, sonra commit.
- Ajan koşumu **kota yakar**. Geliştirirken ucuz `shell_run` işleri kullan
  (`sleep 3; echo ok`); gerçek `claude -p` yalnızca bir kez ve kullanıcı
  haberdarken.
- Dosya düzenleme komutu önerirken `nano` kullanma; kullanıcının `edit`
  takma adı var.
