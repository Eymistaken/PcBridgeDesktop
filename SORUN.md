# ÇÖZÜLEN SORUN — Türkçe girdiden sonra birikmiş metin yeniden gönderiliyordu

**Güncel durum: YERELDE ÇÖZÜLDÜ, HENÜZ YAYIMLANMADI.** 2026-09-09'da
gerçek Tauri/WebKitGTK penceresinde fiziksel Türkçe klavyeyle doğrulandı.
Kullanıcı `bu c    ümlede olmalı.  ı ç ü ö ş` metninin bozulmadan yazıldığını
onayladı. Bu takip düzeltmesi henüz sürüm artırımı yapılmadan yerel çalışma
ağacında bulunuyor ve GitHub'a gönderilmedi.

## Belirti

0.7.2, tek Türkçe karakterin sabit biçimde katlanması sorununu düzeltti; ancak
bağlama bağlı ikinci bir yol kaldı. Özellikle boşluklar ve Türkçe karakterler
karışık yazıldığında, yeni karakter yerine terminal textarea'sında birikmiş
metnin tamamı yeniden gönderilebiliyordu. Bu nedenle uzun cümlelerin parçaları
satırın sonunda tekrar görünüyordu.

## Gerçek kök neden

Gerçek WebKitGTK/IBus izi şu diziyi gösterdi:

1. Normal boşluk terminale doğru biçimde tek `U+0020` olarak gönderiliyor.
2. WebKit, xterm'in gizli textarea'sındaki bazı boşlukları `U+00A0` (NBSP)
   olarak tutuyor.
3. Türkçe karakter için `keydown`, `keyCode = 229` ve `key = "Unidentified"`
   geliyor. Ardından `insertFromComposition` girdisi ve öncesinde
   `compositionstart` olmayan bir `compositionend` oluşuyor.
4. WebKit yeni karakteri eklerken textarea'daki bir NBSP'yi normal boşluğa
   dönüştürebiliyor.
5. xterm'in `_handleAnyTextareaChanges` yolu eski textarea değerini yeni
   değerden `replace` ile çıkarmaya çalışıyor. Boşluk kod noktası değiştiği
   için eski değer artık eşleşmiyor ve xterm tüm textarea'yı yeni girdi sanıp
   `onData` üzerinden yeniden gönderiyor.

0.7.2'deki yetim `compositionend` filtresi, o olayın ikinci gönderimini
engelliyordu; fakat `keyCode 229` tarafından daha önce zamanlanmış textarea
fark hesabını güvenli hale getirmiyordu. Yeni izde tek karakter beklenirken
24, 26, 28 ve daha uzun karakter dizilerinin gönderildiği görüldü.

## Yapılanlar

- `Term.tsx` içine geçici ve yalnızca geliştirme modunda çalışan ayrıntılı bir
  olay izi eklendi. DOM olayları, textarea değeri/seçimi ve xterm `onData`
  çıktısı gerçek Tauri penceresinde toplandı.
- NBSP'nin normal boşluğa dönüşmesi ile xterm'in birikmiş metni yeniden
  göndermesi arasındaki ilişki doğrulandı.
- Öncesinde `compositionstart` olmayan `compositionend` olayında, olayın kendi
  verisi güvenilir yeni girdi olarak saklanıyor.
- xterm'in zamanlanmış `onData` çağrısı geldiğinde yalnızca bu saklanan veri
  PTY'ye gönderiliyor; xterm'in hatalı tam-textarea farkı gönderilmiyor.
- xterm bekleyen fark hesabını bitirdikten sonra yardımcı textarea temizleniyor.
  Böylece temizleme işlemi erken yapılıp yanlış Backspace üretmiyor ve sonraki
  Türkçe basım eski metinle başlamıyor.
- Gerçek `compositionstart → compositionend` oturumları, ASCII tuşlar ve
  Backspace mevcut yollarından geçmeye devam ediyor.
- Geçici tanılama kodu üretim kaynağından çıkarıldı.

## Regresyon ve doğrulama

- **RED:** textarea `"önce\u00a0"` iken WebKit'in NBSP'yi normal boşluğa
  çevirip yetim `ı` eklemesi → PTY yazımı `["önce ı"]`.
- **GREEN:** aynı olay sırası → PTY yazımı yalnızca `["ı"]`; yardımcı textarea
  gönderimden sonra boş.
- Veri içermeyen, iptal edilmiş bir yetim birleşimin sonraki normal tuşu
  yutmaması ayrı bir regresyonla doğrulandı.
- Odaklı WebKitGTK testi ayrıca art arda Türkçe basımı, gerçek IME birleşimini,
  ASCII ve Backspace davranışını doğruluyor.
- `npm run build` geçti: i18n anahtar kontrolü, TypeScript ve Vite üretim
  derlemesi başarılı.
- Temiz bir `tauri dev` süreci açılarak fiziksel klavyede
  `bu c    ümlede olmalı.  ı ç ü ö ş` yazıldı; kullanıcı bozulmanın
  tekrarlanmadığını onayladı.

## Kalanlar

- Bu Türkçe girdi hatası için kod veya doğrulama işi kalmadı.
- Takip düzeltmesi için henüz sürüm artırımı, paketleme veya GitHub gönderimi
  yapılmadı.
- Tam `scripts/check-ui.py` koşumunda odaklı terminal girdi testi geçiyor;
  `empty terminal centered at multiple widths` ve
  `terminal close, split, drag and concurrent close use native input`
  kontrolleri ayrıca başarısız. Bunlar bu girdi düzeltmesinden önce de vardı ve
  ayrı bir arayüz regresyonu incelemesi gerektiriyor.

## Elenmiş ve yeniden denenmemesi gereken yollar

- PTY çıktı yolu, Rust bayt kodlaması ve `ptybus.ts` dağıtımı temiz.
- `onData` seviyesinde genel metin/yineleme ayıklama yapılmamalı; iki gerçek
  basımı güvenilir biçimde ayıramaz.
- Yardımcı textarea, xterm'in zamanlanmış fark hesabından önce temizlenmemeli;
  xterm bunu Backspace olarak yorumlayabilir.
- Hot reload sonrasında açık terminalin eski `useEffect` dinleyicilerini
  koruyabildiği unutulmamalı; fiziksel girdi doğrulaması temiz uygulama
  süreciyle yapılmalı.
- Chromium ölçümü kullanılmamalı; uygulamanın girdi motoru WebKitGTK.
