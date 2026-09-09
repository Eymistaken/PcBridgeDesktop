# ÇÖZÜLEN SORUN — Türkçe karakterler terminalde katlanıyordu

**Güncel durum: ÇÖZÜLDÜ.** Düzeltme 0.7.2'de. 2026-09-09'da gerçek
Tauri/WebKitGTK penceresinde fiziksel Türkçe klavyeyle doğrulandı; kullanıcı
`ö → Backspace → ö` dizisinde katlanmanın kalmadığını onayladı.

## Belirti

Herhangi bir terminal bölmesinde `ö ç ı ğ` gibi bir karaktere bir kez basmak
birden çok karakter yazıyordu. Silip yeniden yazdıkça satır daha da uzuyor;
birikmiş metin yeniden gönderiliyordu. ASCII karakterlerde görülmüyordu.

## Gerçek kök neden

0.7.1'deki hipotez yanlıştı. Sorun, `_keyDown` ile `_inputEvent` arasındaki
geç sıra değildi. Gerçek WebKitGTK/IBus izi şu diziyi gösterdi:

1. `keydown`: `key = "Unidentified"`, `keyCode = 229`
2. `beforeinput` ve `input`: `inputType = "insertFromComposition"`, veri
   Türkçe harf
3. **`compositionstart` olmadan** `compositionend`
4. `onData`: yeni harf
5. `onData`: textarea'da daha önce birikmiş metnin büyük bölümü

xterm, `keyCode 229` için `_handleAnyTextareaChanges` ile textarea farkını
gönderiyor. Aynı fiziksel basımın yetim `compositionend` olayı da
`_finalizeComposition` yolunu çalıştırıyor. Bir `compositionstart` olmadığı
için xterm'in composition başlangıç konumu `0` kalıyor ve sonlandırıcı,
textarea'nın birikmiş kısmını yeniden gönderiyor. Katlanmanın sebebi bu.

Gerçek izde bir `ğ` basımı, önce `"ğ"`, ardından 11 karakterlik eski
birikimi gönderdi. Aynı sıranın textarea `"abc"` ile regresyon tekrarı,
düzeltme öncesinde `["ö", "bcö"]` sonucunu verdi.

## Yapılanlar

- `Term.tsx` içine geçici, yalnızca geliştirme derlemesinde çalışan bir
  olay izi eklendi. DOM olayları, textarea değeri ve `onData` çıktıları gerçek
  Tauri penceresinde ölçüldü.
- Fazladan göndericinin yetim `compositionend` olduğu kanıtlandı.
- 0.7.1'in `beklenen`/`onKey`/`insertText` yaması tamamen kaldırıldı.
- Terminal kabında, xterm'in textarea dinleyicisinden önce çalışan bir
  yakalama dinleyicisi eklendi. Yalnızca öncesinde `compositionstart` olmayan
  `compositionend` durduruluyor; gerçek composition oturumları geçiyor.
- Geçici izleme ve `localStorage` kaydı üretim kodundan tamamen çıkarıldı.
- WebKitGTK regresyonuna şu senaryolar eklendi: bir Türkçe basım, art arda
  iki gerçek Türkçe basım, gerçek `compositionstart → compositionend`, ASCII
  ve Backspace.

## Doğrulama

- **RED:** textarea `"abc"`; yetim Türkçe girdi → `["ö", "bcö"]`.
- **GREEN:** aynı olay sırası → yalnızca `["ö"]`.
- Art arda iki Türkçe basımın ikisi de korunuyor; gerçek tekrar yanlışlıkla
  yineleme sayılmıyor.
- Gerçek IME composition, ASCII ve Backspace regresyonları geçiyor.
- Fiziksel Türkçe klavye testi gerçek Tauri/WebKitGTK penceresinde geçti.

## Kalanlar

- Bu Türkçe girdi sorunu için kalan iş yok.
- Tam `scripts/check-ui.py` koşumunda bu düzeltmenin odaklı testi geçiyor;
  ancak `empty terminal centered at multiple widths` ve
  `terminal close, split, drag and concurrent close use native input`
  kontrolleri ayrıca başarısız. Bunlar bu girdi hatasının kabul ölçütü
  değil; ayrı bir arayüz regresyonu incelemesi gerektiriyor.

## Elenmiş ve yeniden denenmemesi gereken yollar

- PTY çıktı yolu, Rust bayt kodlaması ve `ptybus.ts` dağıtımı temiz.
- `onData` seviyesinde genel yineleme ayıklama yapılmamalı; iki gerçek basımı
  birbirinden ayıramaz.
- Yardımcı textarea elle temizlenmemeli; xterm'in bekleyen fark hesabı bunu
  geri silme olarak yorumlayabilir.
- Chromium ölçümü kullanılmamalı; uygulamanın girdi motoru WebKitGTK.
