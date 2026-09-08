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

## eski-notr-kabuk/

2026-09-08'den önceki tasarım ("Nötr Kabuk") ve onun tuval kaynakları.
**Yürürlükte değil**, kayıt olarak duruyor. O dönemin ölçümleri
[ASAMALAR.md](../ASAMALAR.md) Aşama 12–19'da.
