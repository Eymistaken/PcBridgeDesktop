# AÇIK SORUN — Türkçe karakterler terminalde katlanıyor

**Durum: ÇÖZÜLMEDİ.** 0.7.1'deki düzeltme denendi ve **işe yaramadı**;
kullanıcı kurup denedi, belirti aynı.

## Belirti

Herhangi bir terminal bölmesinde (CLI de olsa düz kabuk da olsa) `ö ç ı ğ`
gibi bir karaktere **bir kez** basmak ekrana birden çok karakter yazıyor.
Üstüne, **her silip yeniden yazmada satır bir karakter daha uzuyor** —
kullanıcının deyimiyle "katlanarak stackleniyor". Ekran görüntüsündeki desen:
tek bir `ö` basımı → `öööGöööö`.

ASCII karakterlerde görülmüyor.

## Ne bulundu (ve neden yetmedi)

xterm'in **iki göndericisi** var: `_keyDown` (tuşun kendisi) ve `_inputEvent`
(yardımcı metin alanına düşen `insertText`). İkincisinin yineleme koruması:

```js
(!e.composed || !this._keyDownSeen)
```

`e.composed` gerçek kullanıcı girdisinde her zaman `true`, yani koruma tamamen
`_keyDownSeen`'e bakıyor — ve **`_keyUp` onu sıfırlıyor**
(`_keyUp(e){this._keyDownSeen=!1,…}`). Yani `input` olayı `keyup`'tan **sonra**
gelirse koruma çalışmıyor ve harf ikinci kez gönderiliyor. Hipotez: ibus
Türkçe düzende ASCII olmayan tuşu eşzamansız işliyor, `input` gerçekten sonra
geliyor.

Katlanmanın açıklaması da buna oturuyordu: her tuş **iki** karakter yazıyor,
her geri silme **bir** tanesini siliyor.

**Bu mekanizma WebKitGTK'da gerçek xterm 6.0.0 üstünde ölçüldü** — ama
**sentetik olay dizisiyle**, ibus'la değil:

| olay sırası | gönderilen | |
|---|---|---|
| Türkçe, `input` `keyup`'tan **sonra**, yamasız | `ööççıığğ` | ikili |
| aynısı, **yamalı** | `öçığ` | düzeliyor |
| Türkçe, `input` `keyup`'tan **önce** | `öçığ` | doğru |
| **ASCII**, geç sıra, yamasız | `aabbccdd` | ASCII de ikileniyor |
| büyük harf muafiyeti (65–90), yamalı / yamasız | `AB` / `AB` | yama bozmuyor |
| gerçek IME derlemesi (`中文`, keyCode 229), yamalı | `中文` | yama bozmuyor |

Yama `src/ui/Term.tsx`'te duruyor: `onKey` yalnızca `_keyDown`/`_keyPress`
veriyi kendisi gönderdiğinde ateşliyor (aynı dalda), o yüzden ateşledikten
sonra gelen aynı içerikli `insertText` kapta ve **yakalama evresinde**
durduruluyor.

⚠️ **Sentetik dizide çalışan yama gerçek klavyede çalışmadı.** Yani
**gerçek ibus'un ürettiği olay dizisi benim yeniden kurduğumdan farklı.**
Kalan iş bu diziyi *ölçmek*; kod okumakla buraya kadar gelinebiliyor.

## Elenmiş olanlar

- **Çıktı yolu temiz.** `"öçığşüÖÇİĞŞÜ ok"` **her olası bayt kesiminde** ikiye
  bölünüp `atob` + `TextDecoder({stream:true})` + `term.write` üstünden
  yazıldı: bozulan kesim **yok**. Bayt bayt yazmak da metni birebir veriyor.
  Sorun PTY→ekran yönünde **değil**, girdi yönünde.
- **Rust tarafı temiz:** `pty.rs` `engine.encode(&buf[..n])` ve
  `data.as_bytes()` — bayt bazlı, çok baytlı karakteri bozmuyor.
- **`ptybus.ts` çift dağıtım yapmıyor:** tek `listen`, `Set` ile dağıtım.
- **xterm sürümü:** `6.0.0` **en son kararlı**; npm'de `6.1.0` yalnızca beta
  (300+ beta). Yükseltmek bir çözüm yolu değil.

## Sıradaki adım — gerçek olay dizisini ölçmek

Tahminle daha ileri gidilmemeli. Yapılacak: `Term.tsx`'e **geçici** bir iz
kaydı konup gerçek klavyeyle bir kez üretilecek. Konsol görünmüyor, ama
`localStorage`'a yazılırsa **diskten okunabiliyor**:

```
~/.local/share/com.pcbridge.desktop/localstorage/*.localstorage   (sqlite, ItemTable)
```

Kaydedilecekler, tuş başına sırayla: `keydown` · `keypress` · `keyup` ·
`beforeinput` · `input` (+ `inputType`, `data`, `isComposing`, `composed`) ·
`compositionstart/update/end`, her birinde `performance.now()` ve o andaki
`textarea.value`, artı `onData`'nın ne gönderdiği. Bir kez `ö` basıp bir kez
silip yeniden yazmak yetiyor.

Dizi görülünce hangi göndericinin fazladan ateşlediği kesinleşir; bugünkü
yama ya düzeltilir ya kaldırılır.

## Denenmemesi gerekenler (gerekçeleriyle)

- ⛔ **`onData` seviyesinde yineleme ayıklamak.** Orada iki **özdeş** olay
  görünüyor; gerçekten iki kez basılmış bir harften ayırt edilemez.
- ⛔ **Yardımcı metin alanını elle temizlemek.** xterm onu yalnızca Enter,
  Ctrl+C ve odak kaybında boşaltıyor, yani yazdıkça biriktiriyor (ölçüldü).
  Ama `_handleAnyTextareaChanges`'in bekleyen bir farkı varsa alanın kısalması
  ona **geri silme** (`DEL`) gibi görünür.
- ⛔ **Ölçümü Chromium'da (tarayıcı bölmesinde) yapmak.** Uygulama WebKitGTK;
  girdi yolunu ilgilendiren hiçbir ölçüm orada geçerli değil.
