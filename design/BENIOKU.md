# design/ — kodun tasarım sözleşmesi

Buradaki `*.dc.html` dosyaları **Ledger** tasarımının ekran ekran ayrılmış
hâli. Kaynak: Claude Design projesi
`8794d0d1-189f-4c8b-ad90-732dcac791f6`, dosya `Pcbridge Redesign.dc.html`.

Kod bunlardan sapamaz; sapmaların listesi CLAUDE.md'de
*Tasarım kanunu → "Tuvalden bilinçli sapmalar"* başlığında.

| Dosya | Ekran |
|---|---|
| `01-Session.dc.html` | Session açılışı |
| `02-Dokum.dc.html` | Sohbet dökümü |
| `03-Terminal.dc.html` | Terminal ızgarası |
| `04-MasaustuIzni.dc.html` | Sistem · masaüstü izni |
| `05-Baglanti.dc.html` | Sistem · bağlantı ve ajanlar |
| `06-BotForge.dc.html` | Bot düzenleyici |
| `07-KenarDurumlari.dc.html` | Kenar çubuğu durumları |
| `08-IlkAcilis.dc.html` | İlk açılış |

⚠️ **Sekiz ekran da koyu.** Uygulamadaki aydınlık palet türetilmiştir;
sayıları CLAUDE.md'nin kontrast tablosunda.

⚠️ Artboard'lar `support.js`'i (Claude Design tuval çalışma zamanı) ve
Google Fonts `<link>`'ini kullanıyor çünkü onlar birer **web sayfası.**
Uygulama ikisini de kullanmaz: yazı tipleri `@fontsource` paketlerinden
gelir ve Tauri CSP'si `font-src 'self' data:`.

## oneriler-2026-09-12/ — **botlar kipi buradan geliyor**

⚠️ **Yukarıdaki sekiz ekran botlar kipi için artık tam yürürlükte değil.**
2026-09-12'de kullanıcı `/design` ile üç yön çizdirdi, dördüncüsünü ("D")
seçti ve dört değişiklikle onayladı (Aşama 26). Kenar çubuğu, sohbet dökümü
ve besteci **bu klasörden** okunur; `02-Dokum` ve `07-KenarDurumlari` o
kısımlar için kayıt hâline geldi.

| Dosya | Ne |
|---|---|
| `Main.dc.html` | **Seçilen tasarım** — D kenar çubuğu + Ayna sohbeti |
| `Ikonlar.dc.html` | Kelime → ikon eşlemesi, on iki kart |
| `Kunye.dc.html` · `Ayna.dc.html` · `Serit.dc.html` · `CListe.dc.html` | Elenen yönler, kayıt |
| `canvas.json` | Tuval yerleşimi ve notlar |

Tuval: <https://claude.ai/code/artifact/4bc541ef-1b15-49d1-8f05-168f68e772d8>

Tohumlanmış tuval sayfası (`botlar-arayuz-yonleri.html`, 2,5 MB düzenleyici
kodu) **depoya girmiyor** — `.gitignore`'da, önceki tasarım yüklerinin
yanında. Kaynak `.dc.html` dosyaları ve `canvas.json`; sayfa onlardan
`seed-canvas.mjs` ile yeniden üretiliyor.

⛔ **Terminal kipi ve ayarlar bu çalışmanın dışındaydı** ve hâlâ yukarıdaki
sekiz ekrandan okunuyor. Tek istisna: çalışma alanı sekmelerinin noktası
kullanıcının ayrı bir kararıyla kareden yuvarlağa döndü (renk duruyor).

## eski-notr-kabuk/

2026-09-08'den önceki tasarım ("Nötr Kabuk") ve onun tuval kaynakları.
**Yürürlükte değil**, kayıt olarak duruyor. O dönemin ölçümleri
[ASAMALAR.md](../ASAMALAR.md) Aşama 12–19'da.
