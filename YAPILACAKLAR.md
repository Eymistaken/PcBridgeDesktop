# YAPILACAKLAR.md — karar verilmemiş işler

Kurallar ve ölçülmüş gerçekler **[CLAUDE.md](CLAUDE.md)'de**, biten yol haritası
**[ASAMALAR.md](ASAMALAR.md)'de**. Bu dosya henüz aşama olmamış, kararı
verilmemiş işi taşır. Buradaki bir madde ölçülüp bitince ASAMALAR.md'ye taşınır.

> ✅ **Eski bölüm 1 (*Uygulama ajan çalıştırıcısı olsun*) 2026-09-02'de bitti**
> ve **[ASAMALAR.md](ASAMALAR.md)'ye "Aşama 6" olarak taşındı.** Ajan döngüsü
> artık uygulamanın içinde dönüyor; bota `backend` alanı geldi, `agent_run`
> yolu duruyor, bağlam özetleniyor, araç filtresi bot başına.
>
> Kullanıcının o iş için verdiği dört karar da orada kayıtlı.

> ✅ **Aşama 7 (*İzin kipleri*) 2026-09-03'te bitti** ve ASAMALAR.md'ye taşındı.
> Bota `permission` alanı geldi (`sor` · `yazma-serbest` · `serbest`), ölü
> `Bot.desktop` bayrağı kaldırıldı, araç grubu listesi Rust'a taşındı.
> Aynı gün ayrıca: **görüntü artık modele gidiyor**, model sunucusundan
> **bağlam uzunluğu okunuyor**, `<select>` yerine kendi açılır listemiz var.

> ✅ **Aşama 8 (*Arayüz turu*) 2026-09-03'te bitti** ve ASAMALAR.md'ye taşındı.
> Altı başlığın hepsi: besteci altında model · bağlam düğmesi ve döküm,
> compact merdiveni (%75 · %90 · %100), "özetleniyor" bildirimi, katlanabilir
> düşünce kutusu, addan türeyen hue, izin menüsünde idle kapısı anahtarı,
> bot başına tur tavanı (varsayılan 100) ve tavanda soru.
>
> Yolda üç hata bulundu ve düzeltildi: **özet denetim noktası kendi koşumunun
> sonunda siliniyordu**, **kuyu aydınlık temada okunmuyordu** (1.09:1,
> terminal dahil), ve bir test paralel koşumda kararsızdı.

> ✅ **Aşama 9 (*Arayüz cilası ve terminal çizicisi*) 2026-09-03'te bitti**
> ve ASAMALAR.md'ye taşındı. Kullanıcının on beş maddelik listesi: markdown,
> JSON dışa aktarma, üretim hızı (anlık + ortalama), yerel/bulut göstergesi,
> kilit rozetinin düğmeye dönmesi, yumuşak köşeler, gölgeler, hizalamalar,
> tmux durum çubuğunun kapatılması.
>
> Asıl bulgu terminaldeydi: **`@xterm/addon-webgl` WebKitGTK'da hiç
> çizmiyormuş.** Harf ancak bir sonraki tuş tam yeniden çizim tetikleyince
> beliriyordu. Addon kaldırıldı; hız bedeli yok (46 ms / 43 ms) ve kutu-çizim
> karakterleri DOM çizicide de doğru.
>
> ⚠️ İlk turda yanlış yere bakıldı çünkü tarayıcı ölçümü **Chromium**'da
> yapılmıştı. Ders CLAUDE.md'nin "Nasıl ölçülür" bölümünde.

> ✅ **Aşama 10 (*Dışa aktarma, düşünce kutusu, koordinat isabeti*)
> 2026-09-03'te bitti** ve ASAMALAR.md'ye taşındı. Dışa aktarma tuşu bir
> yıldır ölüydü (`dialog:allow-save` eksik, reddi `.catch` yutuyordu);
> düşünce kutusunun iki hatası (34 boş kutu, açınca daralma) ölçülüp
> düzeltildi; ve masaüstü koordinat isabetinin asıl sebebi bulundu —
> ekran görüntüsü 0.667 ölçekle gidiyordu ve model her tıklamada ofset+ölçek
> hesabı yapmak zorundaydı. `olcek_ekle` artık `scale = 0`'ı uygulamanın
> kendisi koyuyor.
>
> ⚠️ Chrome'un erişilebilirlik ağacını açan bayrak (`ScreenReaderEnabled`)
> **çalışıyor** ama kullanıcı istemedi; kapalı kaldı, uygulamaya anahtar
> konmadı.

> ✅ **Aşama 11 (*Tekrar tıklama kapısı, gerçek ekran tablosu, skorlayıcı*)
> 2026-09-04'te bitti** ve ASAMALAR.md'ye taşındı. Önce ölçüldü: diskteki beş
> koşumun 25 tıklamasında ofset hatası **1**, aynı yere tekrar tıklama **8**.
> Yani `scale = 0` işini görmüş, kalan desen başka. Dördüncü kapı kondu
> (aynı bölgeye üçüncü tıklama), prompt ekran tablosunu artık `screen_info`'dan
> üretiyor (kilitliyken de çalışıyor — ölçüldü), ve skorlayıcı depoya girdi.
>
> ⚠️ **Gerçek bir koşumda tetiklendiği görülmedi** — yerel model yasağı sürüyor.
> Bitiş ölçütü aşağıda.

> ⛔ **Eklentiler 2026-09-04'te yazıldı ve aynı gün GERİ ALINDI.**
> Kullanıcının kararı: *"bence plugin eklemek için erken."* İki commit
> (`7e54df2` eklenti kayıt defteri, `d8a485b` Gmail kurulumu) `revert`
> edildi — silinmedi, geçmişte duruyorlar. **Geri getirmek tek komut:**
> `git revert <revert commit'i>`.
>
> Eklentiler bir aşama **değil**; ASAMALAR.md'deki Aşama 12 devinim katmanı.
>
> ⚠️ **Ama ölçümler duruyor** (aşağıda, "Geri alındı — ama bunlar ölçüldü").
> Bu depoda kural ölçmediğini yazmamak; ölçtüğünü de atmamak. İş yeniden
> ele alınırsa bunlar yeniden ölçülmesin.

> ✅ **Aşama 12 (*Devinim katmanı*) 2026-09-05'te bitti** ve ASAMALAR.md'ye
> taşındı. Tokenlar, `:active`, çıkış devinimi, düzen devinimi, akış maskesi,
> tema ve dil takası. Üç yerde spec yanlış çıktı ve düzeltildi — özeti
> aşağıda, "✅ KAPANDI: devinim katmanı".

Sıradaki iş: **karar verilmemiş.** Koordinat ölçümü (yasak kalkınca) ve
aşağıdaki "Bitmemiş kalan uçlar" dışında bekleyen bir taahhüt yok.

---

## Bitmemiş kalan uçlar — Aşama 6'dan

Döngü çalışıyor ve ölçüldü, ama bunlar bilerek dışarıda bırakıldı:

- **Tray'e inme.** Pencere kapanınca sürecin yaşaması. Kullanıcı bu işe dahil
  etmedi; ayrı ve küçük bir iş.
- ~~**Görüntü döndüren araçlar.**~~ ✅ **2026-09-03'te bitti.** Görüntü
  `data:` URL olarak `tool` mesajının içinde modele gidiyor (LM Studio'da
  ölçüldü), tek tur yaşıyor, diske yazılmıyor.
- **Paralel araç çağrısı.** Bir mesajda birden çok çağrı gelirse sırayla
  yürütülüyor. `McpState` tek mutex'in arkasında; gevşetmek isteniyorsa önce
  o ölçülmeli.
- ~~**`Bot.desktop` bayrağı hâlâ okunmuyor.**~~ ✅ **Aşama 7'de kaldırıldı.**
  Yerine `Bot.permission` geldi.
- **`bots.rs` senkron read-modify-write, kilit yok.** Eşzamanlı iki koşum
  `record_job`'da yarışabilir. Aşama 6'dan önce de böyleydi; artık iki koşum
  aynı anda dönmesi daha olası.
- **Markdown çözümleyicisinin birim testi yok** (Aşama 9). Projede JS test
  koşucusu yok; `vitest` eklemek ayrı bir karar. Doğrulama iki temada gözle
  yapıldı ve iç içe liste hatası öyle bulundu.
- **tmux sunucusunda `escape-time 500`.** ESC ile başlayan her diziyi (ok
  tuşları, Alt bileşimleri, TUI'lerde ESC) yarım saniye geciktiriyor.
  **Sunucu ayarı** — kullanıcının bütün oturumlarını etkilediği için Aşama
  9'da dokunulmadı. `tmux set -s escape-time 10` çözer, kararı kullanıcının.
- ⛔ **Yerel modelle masaüstü testi YAPILMAYACAK — kullanıcı "ben gelene
  kadar" dedi (2026-09-04).** Sebebi bir veri kaybı: model ofseti unutup
  masaüstüne tıkladı, `ctrl+a` + `delete` ile kullanıcının bütün kod
  dizinlerini çöpe attı (kurtarıldı, `shift+delete` olsa kalıcıydı).
  Kapılar kondu ama **gerçek modelle sınanmadı**; sınamayı kullanıcı kendi
  başındayken yapacak. Arayüz ve pcbridge ölçümleri serbest, bot koşumu değil.
- **İki ekranın ofseti hâlâ modelin işi.** Aşama 10 ölçek hesabını kaldırdı
  (`olcek_ekle` → `scale = 0`) ama **ofset toplamayı** kaldırmadı: model
  sağdaki ekranın görüntüsünde gördüğü `x=108`'e `1920` eklemek zorunda.
  - Prompt pcbridge'in araç yanıtıyla **çelişiyordu** ve model yanıtı seçti
    (ölçüm CLAUDE.md'de). Uyumlu hâle getirilince model dört tıklamayı doğru
    yaptı — **ve beşincide unutup masaüstünü sildirdi.**
  - ✅ **Sonucu yakalayan bir kapı kondu** (`agent.rs::tehlike_kapisi`): son
    `screen_capture`'ın dışına düşen `mouse` çağrısı engelleniyor.
    **Kök neden duruyor:** ofset toplamak hâlâ modelin işi.
  - Kalıcı çözüm muhtemelen `screen_capture`'a `monitor`'ü de uygulamanın
    koyması — o zaman tek görüntü gelir ve "hangi resme bakıyorum"
    belirsizliği biter. **Ama hangi monitör?** Odaklı pencereninki doğru
    yanıt, ve uygulama bunu bugün bilmiyor: `window_list` geometri
    döndürmüyor, AT-SPI'a Rust'tan erişim yok. Birincil monitörü varsaymak
    bu makineye özel bir tahmin olurdu. **pcbridge'e ticket:** `window_list`
    pencere geometrisi de döndürsün.
  - ~~⚠️ **Prompt ekran düzenini sabit yazıyor.**~~ ✅ **Aşama 11'de bitti.**
    Tablo `screen_info`'dan geliyor (`ekran_duzeni` → `ekran_listesi`) ve
    okunamazsa makineye özgü hiçbir sayı yazılmıyor. Endişe boşa çıktı:
    **`screen_info` masaüstü kilitliyken de yanıt veriyor**, yani çağrı
    kullanıcıya bir şey sormuyor.
  - ⚠️ **Ofset toplamak hâlâ modelin işi** ve öyle kalıyor. Ölçüm bunun
    artık ana sorun olmadığını söylüyor: 25 tıklamada **1** ofset hatası.
## ✅ KAPANDI: koordinat isabeti — ölçüldü, kapı kondu (Aşama 11)

**2026-09-04'te ölçüldü ve kapatıldı.** Bölüm kayıt olarak duruyor çünkü
ertelenen fikirlerin gerekçesi burada.

### Ölçüm çerçeveyi düzeltti

Diskteki beş masaüstü koşumu, model koşturulmadan, kapının kendi ayrıştırıcısıyla
yeniden oynatıldı:

| | sayı |
|---|---|
| tıklama | 25 |
| ekranın **dışına** düşen (ofset unutulmuş) | **1** |
| daha önce tıklanan bir noktanın 50 px yakınına yeniden tıklama | **8** |

Yani *"model bulduğu koordinatı unutuyor"* teşhisi **25'te 1** vakayı anlatıyor
ve o vaka Aşama 10'un kapısına zaten takılıyor. Baskın desen başka: model
tıklıyor, görüntü alıyor, bakıyor, **birkaç piksel yanına yeniden tıklıyor.**

⚠️ Ayrıca ölçüldü ki modelin elinde **üç bilgilendirme kanalı zaten vardı** ve
üçünü de dinlemedi: `mouse` yanıtı hangi monitöre düştüğünü yazıyor,
`screen_capture` dönüşüm formülünü her seferinde veriyor, ve model 25 tıklama
için 39 ekran görüntüsü alıyor. **Araç yanıtına bilgi eklemek bu modelde tek
başına davranış değiştirmiyor.**

### Yapılan

- **Dördüncü kapı** (`tehlike_kapisi`): aynı bölgeye (50 px) **üçüncü** tıklama
  engelleniyor, somut alternatif söylenerek. İkinci serbest; seri `keyboard`,
  `window_focus`, kaydırma vb. ile sıfırlanıyor, **`screen_capture` sıfırlamıyor**.
- **Ekran tablosu `screen_info`'dan** — prompt artık makineye özgü sayıları
  sabit yazmıyor.
- **Skorlayıcı** (`cargo test --lib skor_kosumlar -- --ignored --nocapture`).

### Ertelenen fikirler ve gerekçeleri

Hiçbiri çürütülmedi; ölçüm başka bir yeri gösterdiği için sıraya alındılar.

- **A — tıklamadan sonra odağı söylemek.** Kullanıcının kararı: yapılmadı.
  Gerekçe ölçüm: bilginin bir biçimi (`monitor 1 (DP-2)`) araç yanıtında zaten
  vardı ve model onu okumadı. Yine de **felaket senaryosunu ikinci kez
  yakalayan** tek fikir bu; `keyboard` yazma tuşlarından önce odağı metinle
  söylemek hâlâ değerli olabilir.
- **B — hedef defteri.** Kullanıcının kararı: **yapmayalım.** Aritmetiği
  modelden çıkarırdı ama ölçüme göre aritmetik 25'te 1 hata yapıyor, ve ilk
  kayıt yanlışsa hata kalıcılaşır — tam da modelin ıskaladığı durumda.
- **C — ölçekli cetvel.** Görüntünün kenarına global değerli cetvel çizmek.
  `image` crate bağımlılığı istiyor ve çözeceği sorun (ofset) küçüldü.
- **D — ✗ çürütüldü:** `mouse`'a `monitor`'ü uygulamanın koyması. Model global
  vermeye devam eder, uygulama bir 1920 daha ekler, ve `x=250` gibi bir değer
  hem geçerli görüntü hem geçerli global koordinat — **ayırt edilemez.**
  ⚠️ Not: `screen_info` *"`monitor` parametresini de verin"* derken
  `screen_capture` *"`monitor` parametresi olmadan"* diyor; pcbridge kendi
  içinde çelişiyor. Bu D'yi diriltmiyor, belirsizlik duruyor.

### Bitiş ölçütü — yasak kalkınca (⛔ bugün yapılamaz)

Sabit görev, felaket koşumunun görevi: *"Chrome'u aç, adres çubuğuna
tr.wikipedia.org yaz, git."* Beş koşum, aynı bot. Sonra skorlayıcı.

**Taban (Aşama 11 öncesi, beş koşum): 25 tıklama · 1 ekran-dışı · 2 tekrar.**
(Ham desen 8; kapının kuralı seri sıfırlamasını saydığı için 2. Karşılaştırma
**kapının sayısıyla** yapılır.)

Düzeldi sayılır:

1. **ekran-dışı = 0** (beş koşumun toplamında),
2. **tekrar** sayısı tabanın altında,
3. en az 4/5 koşum görevi tamamlıyor,
4. kapı tetiklendiğinde model **başka bir yol deniyor** — `⛔` sonrası ilk araç
   çağrısına bakılır; aynı çağrıyı yineliyorsa red metni yeniden yazılmalı.

⚠️ Ölçüm tersini gösterirse ayarlanacak iki düğme: `YAKIN_PX` (50) ve
`TEKRAR_TAVANI` (2). Tavan bilerek **hoşgörülü** seçildi.


### Kullanıcının fikri (2026-09-04): silme bildirimi — **ilerde**

Model bir şey silince kullanıcı **anında görsün**: ekranın sağ altında
*"Masaüstü klasöründe 12 öğe silindi · Detaylar · Geri al"*. Katman şeffaf ve
tıklamayı geçirir, yalnızca bildirimin kendisi etkileşimli.

Kullanıcı **şimdilik eklemeyelim** dedi (`shift+delete` zaten yasak, kapılar
kondu). Kayda geçiyor.

**Neden düşünüldüğünden daha değerli:** kapılar *tuşa* bakıyor, bu *sonuca*
bakar. `keyboard delete` yolunu kapatmak `shell_run rm`'i ya da sağ tık →
Sil'i kapatmıyor. Çöp kutusunu izlemek **silme kaynağından bağımsız** çalışır.

**Nasıl ölçülür / yapılır — ön düşünceler, doğrulanmadı:**

- **Ne silindiğini çöp kutusu söyler.** `~/.local/share/Trash/files` ve
  yanındaki `info/*.trashinfo`; her `.trashinfo` **orijinal yolu** (`Path=`)
  ve silinme zamanını (`DeletionDate=`) taşıyor. Yani "Masaüstünden 12 öğe"
  cümlesi doğrudan kurulabilir, tahmin gerekmez.
- **Geri al zaten var:** `gio trash --restore <yol>` — ya da `.trashinfo`'daki
  `Path=` okunup dosya oraya taşınır. Uygulamanın kendi silme mantığı
  yazmasına gerek yok.
- ⚠️ **`rm` çöpe atmaz, kalıcı siler.** Trash izleme onu **yakalamaz**;
  bildirim "her silmeyi görürsün" diye sunulmamalı.
- **Yalnızca koşum sürerken izle.** Kullanıcının kendi sildiği şeyler
  bildirim üretirse özellik iki günde kapatılır. Sınır net: bot çalışıyorsa
  izle, çalışmıyorsa izleme.
- **Şeffaf katman yerine küçük pencere daha ucuz olabilir.** Tauri'de
  "tıklamayı geçiren ama bir bölgesi tıklanabilir" pencere zahmetli
  (`setIgnoreCursorEvents` ya hep ya hiç). Sağ alt köşede 360x120'lik,
  `decorations: false` + `alwaysOnTop` bir pencere aynı işi görür ve
  input sorunu hiç doğmaz. **Ölçülmedi**, ikisi de denenebilir.
- Tasarım kanunu geçerli: renk yalnızca durumdan, "Geri al" birincil eylem
  (`--text` dolgu, `--bg` metin), köşeler 12/20.

### Bildirim katmanı, genel bir mekanizma olarak — **ilerde**

Kullanıcı (2026-09-04): *"bu bildirim işi hoşuma gitti, pek çok şeye
uyarlanabilir"*. İkinci kullanım hemen çıktı: **`rm` gibi bir komut
çalışmadan önce** bildirim gelsin, ne silineceğini görelim, izin verelim ya
da vermeyelim.

⚠️ **Ama burada yeni bir izin sistemi kurulmuyor — var olan görünür
kılınıyor.** `shell_run` zaten `Grup::Write` ve `Izin::Sor` kipinde zaten
soruluyor (`agent.rs::Kapi`). Eksik olan şu: soru **sohbette** görünüyor.
Kullanıcı başka bir pencerede çalışıyorsa hiç görmez ve koşum "İznini
bekliyor" diye süresiz bekler (zaman aşımı bilerek yok). Ekran üstü bildirim
tam bu boşluğu kapatır.

**"Aynı işi yapan iki denetim koyma" kuralı burada geçerli:** ikinci bir
izin katmanı yazılmayacak, `IzinIstegi` olduğu gibi bildirime taşınacak.
Bir yanıt her iki yerden de gelebilmeli (sohbet baloncuğu ve bildirim), ikisi
aynı `Runs.bekleyen` kuyruğunu kullanmalı — `PermAsk` ile tur tavanı sorusu
zaten öyle yapıyor.

**"Ne silinecek" önizlemesi — yapılabilir ama sınırlı:**

- Basit durum kolay: `rm -rf ~/Masaüstü/app` → hedefi `fs_list` ile sayıp
  *"47 dosya, 6 klasör silinecek"* demek mümkün, ve okuma olduğu için
  zararsız.
- ⚠️ **Kabuk ayrıştırmak genel olarak çözülmez.** Glob, değişken, `&&`, pipe,
  `$(...)` — hepsi doğru sayıyı değiştirir. Önizleme **tahmin** olduğunu
  söylemeli; "şunlar silinecek" değil "şunları silecek gibi görünüyor".
  Yanlış bir kesinlik, hiç önizleme olmamasından kötüdür.
- Hangi komutlar tetiklesin? `rm` tek başına yetmez: `dd`, `mkfs`,
  `truncate`, `> dosya`, `git reset --hard`, `git clean -fd`. Liste
  **dar ve ölçülmüş** tutulmalı — `FORCE_ALIR` / `OLCEK_ALIR` /
  `SILME_TUSLARI` deseninin dördüncüsü.

**Katman tek olmalı.** Silme bildirimi, izin sorusu, "izin süresi doluyor",
"bot yanıt bekliyor" — hepsi aynı bileşeni kullansın. Dört ayrı bildirim
yolu, bir yıl sonra üçü ölü demektir (`Bot.desktop` bayrağı bunu bir kez
yaşattı).

#### Yanıtlanan sorular (2026-09-04) — kayda geçiyor

1. **Defteri kim yönetir?** — Defter **yapılmadı** (kullanıcının kararı).
   Yapılırsa doğrusu: model adlandırır, uygulama saklar ve ikinci kullanımda
   modelin verdiği x/y'yi **ezer**; isim modelin, sayı uygulamanın.
2. **Geçersizleşmeyi kim fark eder?** — **Kimse.** Kullanıcı pencereyi fareyle
   sürüklerse hiçbir olay bunu söylemez. Doğru yaklaşım olayla
   *geçersizleştirmek* değil, kullanımdan önce **doğrulamak** (odağın kayıt
   anındakiyle aynı olduğuna bakmak). Bir defter yazılırsa bu şart.
3. **A tek başına yeter mi?** — **Muhtemelen hayır.** Ölçüldü ki A'nın bir
   biçimi (`mouse` yanıtındaki `monitor N`) zaten vardı ve model dinlemedi.
4. **Nasıl ölçeriz?** — Skorlayıcı yazıldı; ölçüt yukarıda "Bitiş ölçütü".

- **Set-of-Mark (ekran öğelerini numaralayıp modele hazır koordinat vermek).**
  Kullanıcının Aşama 10'da önerdiği fikir. **Bugün yazılmadı** çünkü
  çözeceği sorunun büyük kısmı daha ucuz kalktı, ve kalan kısımda koordinat
  kaynağı yok:
  - AT-SPI'ın konuştuğu her yerde `ui_click` zaten **ıskalayamıyor** (node id
    ile çalışıyor, koordinat kullanmıyor). Orada etiketleme bir şey katmaz.
  - Konuşmadığı yerde (Chrome, Electron) ağaç **hiç yok**, yani etiketlerin
    kutusunu verecek bir kaynak da yok. Chrome için bayrak yolu ölçüldü ve
    çalışıyor ama kullanıcı istemedi.
  - pcbridge'in `ui_dump`'ı koordinat **döndürmüyor** (bilinçli,
    `uitree.py`), ve o depoya dokunulmuyor. Yani uygulamanın kendi AT-SPI
    yardımcı sürecini kurması gerekirdi: ayrı Python süreci, ayrı protokol,
    ayrı zaman aşımı hikâyesi.
  - ⚠️ Ama **extents ölçüldü ve sanıldığından iyi**: gerçek uygulamalarda
    doğru, bozuk düğümler `INT_MIN` ile geliyor ve ayıklanabilir. Yani bir
    gün yazılırsa koordinat kaynağı budur.
  - Gerçek boşluk **canvas ve oyun**: ağacın hiç olmadığı yer. Orası görüntüden
    kutu tespiti (OpenCV/OmniParser sınıfı) ister ve ayrı bir iştir.

  **Karar ölçüme bağlı ve ölçüm henüz eksik.** Aşama 11'in kapısı ısrarı
  kesiyor ama **isabeti artırmıyor** — model hâlâ ıskalıyor, yalnızca artık
  üçüncüde durduruluyor. Yasak kalkıp beş koşum yapıldığında "tekrar" sayısı
  hâlâ yüksekse asıl çözüm burada: koordinatı modele **hazır vermek.**
- **Tur içi özetleme gerçek modelle ölçülmedi.** Aşama 8'de sahte sunucuyla
  uçtan uca sınandı (`butce_tur_icinde_dolunca_ozetlenir`) ama LM Studio o
  oturumda kapalıydı. İlk fırsatta bütçesi kasten küçük bir botla uzun bir
  koşum yapılıp `job://compacting` ve `Devam et.` yolu görülmeli.

---

# ✅ KAPANDI: devinim katmanı (Aşama 12, 2026-09-05)

Kullanıcının *"her tuş basışında, her şeyinde yumuşak profesyonel kaliteli
animasyonlar"* isteği **bitti**. Ayrıntı ve bütün ölçümler
[ASAMALAR.md](ASAMALAR.md), **Aşama 12**. Burada yalnızca sonradan lazım
olacaklar duruyor.

## Bu spec üç yerde yanlıştı — kodda ölçüldü

Yeniden okuyacak biri bunlara aldanmasın:

1. **Menülerin girişi de yoktu.** Spec "açılış `girisAsagi`/`girisSoluk` ile
   geliyor, kapanış yok" diyordu. `.picker__pop`, `.permmenu__pop` ve
   `.ctxmenu__pop` hiçbir `animation` taşımıyordu — **iki yönde de** bir
   karede takılıyorlardı.
2. **Kayan parça hiç kaymıyordu.** Spec onu "çalışıyor, iyi olanın örneği"
   sayıyordu. Kip değişince bütün sol sütun (başlık ve anahtar dahil)
   sökülüp yeniden kuruluyordu; yeni kurulan öğenin önceki `transform`'u
   olmadığı için parça ışınlanıyordu. Kabuk `Shell`'e taşındı.
3. **Elle yazılmış süre sekizdi, yedi değil** — `.ctxbar__dolu`'nun `0.7s`'i
   sayılmamıştı.

## Ölçüm yöntemine dair — bir daha aynı tuzağa düşülmesin

⚠️ **Tarayıcı bölmesi gizliyken viewport 0x0.** `40vh` sıfır çıkıyor,
`scrollHeight` saçmalıyor ve **geçişler hiç ilerlemiyor** — `getComputedStyle`
geçiş boyunca hep başlangıç değerini döndürüyor, yani doğru bir CSS kuralı
"uygulanmadı" gibi görünüyor. Bu bir kez yarım saat yanlış yere baktırdı.
Düzen ve devinim ölçümü **WebKitGTK'da** yapılır; bölme yalnızca göze bakmak
için. Koşucu iskeleti CLAUDE.md "Nasıl ölçülür" §1'de.

## Kapsam dışı kalanlar

⛔ **Terminal, tamamı.** Kullanıcının kararı korundu.

⛔ **View Transition API.** WebKitGTK 4.1'de **var** (varsayıldı değil,
ölçüldü) ama kullanılmadı: bütün belgeyi anlık görüntülüyor ve canlı token
akışı ile xterm tuvali varken bedeli belirsiz. Bir gün denenirse ölçümü
buradan başlasın.

## Açık kalan tek uç

Devinim katmanı **gerçek bir koşumda** görülmedi — akış maskesi diskteki
kayıttan yeniden oynatılarak ölçüldü, canlı modelle değil. Yerel model yasağı
kalkınca bir koşum sırasında maskeye ve dibe kaymaya gözle bakmak iyi olur;
ölçümler zaten yapıldı, bu yalnızca bir teyit.

# Eklentiler (MCP kayıt defteri) — ⛔ ERTELENDİ

> ⛔ **2026-09-04'te yazıldı, aynı gün geri alındı.** Kullanıcı *"plugin
> eklemek için erken"* dedi. Kod geçmişte duruyor (`7e54df2`, `d8a485b`);
> geri getirmek `git revert <revert commit'i>`.
>
> **Neden erken olduğu ayrıca kayda değer:** eklenti bağlamak "zehirli
> üçlü"yü açıyor — bot güvenilmeyen metin okuyor, elinde pcbridge'in shell'i
> ve masaüstü kontrolü var, ve masaüstü kapıları daha **gerçek bir koşumda
> sınanmadı** (Aşama 11, yasak sürüyor). Sıra doğru değildi.
>
> Aşağıdaki tasarım bölümleri (Veri modeli · Arayüz · Rust tarafı) yeniden
> ele alınırsa başlangıç noktası olarak duruyor.

## Geri alındı — ama bunlar ölçüldü

Kod gitti, ölçüm gitmesin. Yeniden yazılırsa bunlar **yeniden ölçülmesin**:

- **`Conn` ikinci bir taşıyıcıya ikinci bir tür istemiyor.** `().serve(..)`
  hem HTTP hem stdio taşıyıcısında `RunningService<RoleClient, ()>`
  döndürüyor, yani `call_for_agent`, `tool_defs` ve `close` olduğu gibi
  çalışıyor. rmcp özelliği `transport-child-process` (`tokio/process` +
  `process-wrap` çekiyor); **`auth` ve TLS gerekmedi.**
- **`with_uri` `&'static str` istemiyor** (`impl Into<Arc<str>>`, kaynaktan
  okundu). Araç adındaki gibi, o kısıt da bizimdi.
- **Araç adı öneki şart:** ölçülen sunucu `click`, `drag`, `fill` gibi adlar
  veriyor. Öneksiz iki sunucu aynı adı verince çağrının kime gideceği
  belirsiz kalıyor.
- ⚠️ **Bir eklenti birden çok süreç açabiliyor.** `chrome-devtools-mcp` iki
  süreç açıyor ve yalnızca içteki öldürülünce dıştaki stderr'i açık tutuyor.
  Yaşam tespiti bu yüzden **iki sinyalli** olmak zorunda: stderr'in EOF'u
  (ağacın tamamı ölünce) ve çağrının düşmesi (kısmi ölümde). Tek sinyalle
  panel ölmüş bir eklenti için "bağlı · 29 araç" yazmaya devam ediyordu —
  test bunu yakaladı.
- **Ağ istemeyen bir doğrulama sunucusu var:**
  `~/.npm/_npx/15c61037b1978c83/node_modules/.bin/chrome-devtools-mcp` npx
  önbelleğinde duruyor, kimlik istemiyor, stdio konuşuyor, 29 araç veriyor.
- ⚠️ **Yeni bot varsayılanı "bütün `read` araçları" olarak KALMASINDA sorun
  var** — eklenti geldiği gün. Bir eklentinin salt-okunur aracı (Gmail'in
  `read_email`'i) her yeni bota kendiliğinden girerdi. Kayıt defteri geri
  gelirse bu düzeltme de gelmeli.
- **`Bot.servers` ve sunucuda `readOnly`/`toolFilter` konmamalı.** `Bot.tools`
  önekli adları zaten tutuyor; ikinci bir liste bu depodaki ölü-anahtar
  hatasını (`Bot.desktop`, Aşama 7) tekrarlar.

### Gmail — ölçüldü, kod geri alındı

⚠️ **"Tek tuşla Gmail" teknik bir yetenek değil, bir kayıt meselesi.**
Gmail'e bağlanan her uygulamanın Google'da kayıtlı bir OAuth istemcisi olmak
zorunda. Tek tuşla bağlanan ürünlerde (Claude'un kendi Gmail bağlayıcısı
dahil) o istemci ürünün sahibine ait ve ürüne gömülü. Bu uygulamanın böyle
bir kaydı yok; o yüzden konsol adımı bir kez kullanıcının olurdu.

- **Seçilen sunucu istemciyi taşımıyor** (`GongRzhe/Gmail-MCP-Server`
  deposundan doğrulandı).
- **Dosyanın sözleşmesi `src/index.ts`'ten okundu:**
  `keysContent.installed || keysContent.web`, sonra yalnızca `client_id` ve
  `client_secret`. `redirect_uris` **okunmuyor**; adres kodda sabit
  (`http://localhost:3000/oauth2callback`). Kapsamlar `gmail.modify` +
  `gmail.settings.basic`. Yetkilendirme `<komut> auth`, kimlik
  `~/.gmail-mcp/credentials.json`.
- ⚠️ **Testing kipinde refresh token 7 günde doluyor** (Google'ın kendi
  belgesinden). Yani onay ekranı yayınlanmadıkça haftada bir yeniden
  yetkilendirme gerekir. "In production"a geçmenin Gmail'in restricted
  kapsamlarında ne gerektirdiği **ölçülmedi.**
- **Başarı ölçütü çıkış kodu değil, dosya:** `auth` sıfırla çıkıp hiçbir şey
  yazmayabiliyor.

---

## Neden

`mcp.rs` bugün **tek sunucuya çakılı**: `endpoint()` bir `OnceLock`, `Conn::open`
ve bütün araç çağrıları `&'static str` alıyor, `ConnSnapshot.endpoint` de öyle.
Sonuç: bir bot yalnızca pcbridge'in 33 aracını görebiliyor. Gmail gibi bir MCP
sunucusu bağlanamıyor.

Hedef: arayüzde bir **Eklentiler** bölümü. Kullanıcı oradan Gmail'e oturum açar,
bağlar, ve hangi botun onu göreceğini seçer.

---

## Kapsam

**İçinde:** sunucu kayıt defteri, Eklentiler paneli, Gmail bağlantısı, bot başına
sunucu ve araç filtresi.

**Dışında** (bilerek):

- Uzak makine / çoklu bilgisayar. Her şey `127.0.0.1`'de kalır.
- ~~Uygulamanın kendi ajan döngüsünü yürütmesi. Ajan hâlâ pcbridge'in
  `agent_run`'ıyla koşar.~~ **← 2026-09-02'de çürüdü, bkz. ASAMALAR.md Aşama 6.**
- ~~Uygulamanın MCP toplayıcı (proxy) olması. Uygulama kapanınca çalışan işin
  araçları giderdi — stdio'yu tam da bu yüzden reddetmiştik.~~
  **← 2026-09-02'de çürüdü: bu bedel bilerek kabul edildi.**

---

## Karar verilmemiş: araçları kim tüketiyor

Bağlantıyı uygulama kuruyor, ama işi **ajan** yapıyor ve ajanın argv'sini
pcbridge kuruyor. Bu yüzden iş ikiye ayrılıyor ve ikincisi bu depoda bitmiyor.

> ✅ **Aşama 6 bunun yarısını çözdü.** `backend: "yerel-model"` olan botlarda
> argv diye bir şey yok: araçları modele uygulama veriyor, yani yeni bir MCP
> sunucusunu o botlara bağlamak **yalnızca A'yı** gerektiriyor. B artık
> yalnızca `backend: "pcbridge-agent"` botları için gerekli.

### A — Kayıt defteri + Gmail bağlantısı

Uygulama sunucuyu tanır, başlatır, oturumu yönetir, araç listesini gösterir.
Bu depoda baştan sona yapılabilir. Aşağıdaki bitiş ölçütü bunun.

### B — Bağlantıyı ajana vermek

Claude Code `--mcp-config <dosya>` ve `--strict-mcp-config` kabul ediyor, ayrıca
proje dizinindeki `.mcp.json`'ı okuyor. Yani bot başına üretilmiş bir
yapılandırmayla ajanı başlatmak mümkün — **ama argv'yi pcbridge kuruyor.**

İki yol var, ikisi de bedelli:

| Yol | Bedel |
|---|---|
| `agent_run`'a `mcp_config` alanı eklemek | pcbridge'de iş. **Bu depodan dokunulmaz** — ticket açılır. Temiz yol budur. |
| Botun workdir'ine `.mcp.json` yazmak | pcbridge'e dokunmaz ama kullanıcının reposunu kirletir ve yanlışlıkla commit'lenir. Geçici. |

⚠️ B'ye başlamadan önce **ucuz doğrulama**: Gmail sunucusunu elle `claude`'un
kendi yapılandırmasına ekle ve bir botu koştur. Fikir tutmuyorsa A'nın arayüzü
boşuna yazılmış olmaz, B hiç yazılmaz.

---

## Gmail — seçilen sunucu ve neden

`GongRzhe/Gmail-MCP-Server` (`@gongrzhe/server-gmail-autoauth-mcp`). **stdio**
taşıması ve **kendi OAuth akışını kendi yapıyor.**

Bunun sonucu önemli: rmcp'nin `auth` (oauth2) özelliğini **açmaya gerek yok** ve
TLS gerekmiyor. A yalnızca `transport-child-process` istiyor. Uygulamanın kendi
OAuth akışı yazması, PKCE, loopback redirect, refresh token yenilemesi — hepsi
**uzak HTTP sunucuları eklenene kadar ertelenir.**

> ⛔ **`gmail.rs` yazıldı ve geri alındı** (`d8a485b`). Panel
> `client_id`/`client_secret`'ı alıp `gcp-oauth.keys.json`'ı 0600 yazıyor,
> sunucu kaydını kuruyor ve `auth`'u çalıştırıyordu. Sözleşme sunucunun
> kaynağından okunmuştu; sahte bir `auth` komutuyla iki dal da sınanmıştı.
> **Hiç gerçek bir hesapla koşmadı** ve `~/.gmail-mcp/` hiç oluşmadı.

Yeniden ele alınırsa kullanıcının yapması gereken tek şey **bir kez** şu:

1. Google Cloud Console → yeni proje → **Gmail API'sini etkinleştir**.
2. APIs & Services → Credentials → Create credentials → OAuth client ID →
   uygulama türü **Desktop app**.
3. `client_id` ve `client_secret`'ı panele yapıştırmak.

**Hiç ölçülmemiş olanlar:**

- Gerçek Google akışı: tarayıcı açılıyor mu, `auth` gerçekten
  `credentials.json` yazıyor mu, eklenti 19 aracıyla bağlanıyor mu.
- `npx @gongrzhe/server-gmail-autoauth-mcp` **hiç indirilmedi**; ilk
  yetkilendirmede inecek ve o ilk çalıştırma yavaş olacak.
- ⚠️ **7 günlük refresh token.** Onay ekranı "Testing" durumundayken Google'ın
  verdiği token bir haftada doluyor (Google'ın belgesinden doğrulandı).
  "In production"a geçmenin Gmail'in restricted kapsamlarında ne gerektirdiği
  **ölçülmedi** — ilk hafta dolduğunda görülecek.

Kurulum gerçekleri (sunucunun belgelerinden, ölçülmedi — **ilk iş bunu ölçmek**):

- Google Cloud Console > APIs & Services > Credentials > OAuth client ID,
  **Desktop app** türü. İnen dosya `gcp-oauth.keys.json` adıyla `~/.gmail-mcp/`
  altına konur.
- `npx @gongrzhe/server-gmail-autoauth-mcp auth` varsayılan tarayıcıyı açar.
- Kimlik `~/.gmail-mcp/credentials.json`'a yazılır.
- Sunucu `npx @gongrzhe/server-gmail-autoauth-mcp` ile stdio üstünde koşar.
- 19 araç: `read_email` `search_emails` `list_email_labels` `download_attachment`
  gibi okuma araçlarının yanında `send_email` `delete_email`
  `batch_delete_emails` `create_filter` gibi **yazma** araçları da var.

⚠️ **Bu sunucu sırlarını kendi dosyasında tutuyor, keyring'de değil.**
"Token yalnızca keyring'de" kanunu pcbridge'in statik token'ı içindi; üçüncü
taraf bir sunucunun kendi kimlik dosyasını biz yönetmiyoruz. Bunu bilerek kabul
ediyoruz, ama panelde **açıkça yazıyoruz**: dosyanın yolu ve modu görünür olur.

⚠️ **Varsayılan filtre salt-okunur.** 19 aracın yarısı yazıyor ve
`batch_delete_emails` geri alınamaz. Bir bota yazma aracı verilmesi ayrı ve
bilinçli bir eylem olmalı.

---

## Veri modeli

`~/.config/pcbridge-desktop/servers.json` — `bots.json`'ın ikizi: mod 0600,
atomik yazma (tmp + fsync + rename).

```jsonc
{
  "id": "ulid",
  "name": "Gmail",
  "transport": "stdio",                  // ileride "http"
  "command": "npx",
  "args": ["@gongrzhe/server-gmail-autoauth-mcp"],
  "enabled": true,
  "readOnly": true,                      // yazma araçlarını gizler
  "toolFilter": { "deny": ["send_email", "delete_email", "batch_delete_emails"] }
}
```

`pcbridge` gömülü kayıttır: listede görünür, **silinemez ve kapatılamaz.**

Bot modeline tek alan eklenir:

```jsonc
"servers": ["<sunucu id>", "..."]
```

Dosyada **hiçbir sır durmaz.** İleride bir sunucu bearer token isterse keyring'e
`mcp:<id>` hesabı olarak gider; `secrets.rs` bunu zaten yapıyor, yalnızca hesap
adının parametreleşmesi gerekiyor.

---

## Arayüz — Eklentiler paneli

**Üçüncü kip yok.** Kenar çubuğundaki `Botlar | Terminal` anahtarı iki parça
kalır. Eklentiler, `Ctrl 0` panelinde **Bağlantı** ve **Masaüstü**'nün yanına
üçüncü bir sekmedir.

**Satır anatomisi:** ad · durum noktası · araç sayısı · sağda tek eylem.
Ayırıcı çizgi değil yüzey kademesi (`--surface` üstünde satırlar).

**Durumlar** — hepsinin ayrı ve insan cümlesi olan bir karşılığı olmalı:

| Durum | Ekranda |
|---|---|
| Kurulu değil | `npx` yok ya da paket inmemiş |
| Kimlik dosyası yok | `~/.gmail-mcp/gcp-oauth.keys.json` bekleniyor |
| Oturum açılmamış | tek eylem: **Bağlan** |
| Bağlanıyor | `--run` |
| Bağlı | `--ok`, yanında araç sayısı |
| Yetki düştü | `--fail`, eylem: **Yeniden bağlan** |
| Süreç öldü | `--fail`, stderr'in son satırı görünür |

**Oturum açma tarayıcıda olur, uygulamanın webview'ında değil.** Hem sunucu
zaten tarayıcı açıyor, hem de Google kimliği uygulamanın içinden geçmemeli.

**Tasarım kanununa uyum:**

- **Bağlan** birincil eylemdir: `--text` dolgu, `--bg` metin. Renkli düğme yok.
- Renk yalnızca durumdan gelir (`--run` / `--ok` / `--fail`). Eklentinin
  **kimlik rengi yoktur** — avatar tonları bota ait, sunucuya değil.
- İkonlar 20px ızgarada inline SVG. Gmail logosu **kullanılmaz**.
- `--text-muted` `--surface-2` üstünde kullanılmaz.
- Köşeler 10 (satır, düğme) ve 20 (panel).

**Bağlantı şeridi** bugün `33 araç · 2 ajan` diyor; `2 sunucu · 52 araç · 2 ajan`
olur. ⚠️ **Bir eklentinin düşmesi şeridi kırmızıya çevirmez.** pcbridge kritiktir,
eklenti değildir; yalnızca kendi satırı düşer.

**Boş durum:** hiç eklenti yokken panel ne yazacak — "Eklenti yok" değil, ne işe
yaradığını anlatan bir cümle.

**BotForge'a** bir alan eklenir: bu bot hangi sunucuları görüyor, ve hangi
araçları. Salt-okunur araçlar ayrı gruplanır, yazma araçları ayrı ve kapalı
başlar.

---

## Rust tarafı

- `Conn` → `Registry { HashMap<String, Conn> }`. `&'static str` alışkanlığı
  tamamen kalkar; `mcp.rs`'in 955 satırının belki üçte biri.
- `ConnError` sunucu başına döner. Bugünkü tek hata durumu, "pcbridge kritik /
  eklenti değil" ayrımını taşımıyor.
- `Cargo.toml`: `rmcp`'ye **`transport-child-process`** eklenir.
  `auth` ve TLS **A'da gerekmiyor.**
- ⚠️ `reqwest` şu an `default-features = false`, yalnızca `json`. Uzak HTTPS bir
  sunucu eklendiği gün TLS arka ucu olmayabilir. **Tahmin etme, ölç:** bir
  `#[tokio::test]` ile herhangi bir HTTPS uç noktasına istek at.
- Çocuk süreç yaşam döngüsü: uygulama kapanınca öldürülür, zombi bırakılmaz;
  stderr yutulmaz, panelde hata satırı olur.

---

## Bitiş ölçütü — A

1. Panelden Gmail bağlanıyor, tarayıcıda giriş yapılıyor, satır **bağlı** ve
   gerçek araç sayısını gösteriyor. Sayı gömülü değil, `list_all_tools`'tan.
2. Uygulama kapanıp açılınca **tekrar giriş istemiyor.**
3. Gmail süreci dışarıdan öldürülünce yalnız o satır düşüyor: pcbridge bağlı
   kalıyor, çalışan iş etkilenmiyor, uygulama çökmüyor.
4. `servers.json` 0600 ve içinde **hiçbir sır yok** (`grep` ile bakılır).
5. Bot formunda araç filtresi çalışıyor; yazma araçları varsayılan olarak kapalı.
6. İki temada da ekran görüntüsü alınıp gözle bakıldı: renkli düğme yok, durum
   dışında renk yok, köşeler 10/20.

---

## Riskler

- **Zehirli üçlü.** Gmail bağlandığı anda bot güvenilmeyen metin okuyor; elinde
  pcbridge'in shell'i ve masaüstü kontrolü var. Bir e-postanın gövdesindeki
  "şu komutu çalıştır" satırı ile kullanıcının prompt'u model için aynı şey.
  **Bot başına sunucu listesi bir konfor özelliği değil, asıl denetimdir:**
  kod yazan bot Gmail görmez, mail botu shell görmez.
- **`npx` ilk çalıştırmada ağdan indirir.** Çevrimdışı açılışta eklenti düşer;
  uygulamanın düşmemesi gerekir.
- **Sunucunun kimlik dosyası bizim kanunumuzun dışında.** Yukarıda kabul edildi,
  panelde görünür kılınıyor.
- **19 aracın modelin listesine eklenmesi** araç sayısını 52'ye çıkarır. Bugünkü
  ajanlar (`claude`, `antigravity`) bunu kaldırır; ileride yerel bir model
  bağlanırsa kaldırmaz — filtre o gün zorunlu hale gelir.

---

## Sonraya (bu dosyada kalsın, henüz aşama değil)

- Uzak HTTP MCP sunucuları — rmcp `auth`, PKCE, loopback redirect, keyring'de
  refresh token, ve TLS ölçümü.
- MCP `prompts` ve `resources` — bestecide eğik çizgi komutu olarak.
- Onay kuyruğu: e-postadan gelen metin bir komuta dönüşüyorsa dur ve sor.
- Zamanlanmış iş + bildirim (sabah özeti). Gerisi sağlam olmadan yapılırsa
  yalnızca sessiz bir hata olur.
