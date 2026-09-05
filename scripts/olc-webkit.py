#!/usr/bin/env python3
"""Devinim ve düzen ölçümü — **asıl motorda**.

⚠️ Tarayıcı bölmesi Chromium ve **gizliyken devinim saati donuyor**:
`getAnimations()[0].currentTime` 0'da kalıyor, `playState` "running" diyor,
`getComputedStyle` geçiş boyunca hep başlangıç değerini döndürüyor. Doğru bir
CSS kuralı "uygulanmadı" gibi görünüyor. Bu tuzağa 2026-09-05'te ikinci kez
düşüldü (CLAUDE.md "Nasıl ölçülür" madde 1 bunu zaten yazıyordu).

Kullanım:
    python3 scripts/olc-webkit.py <url> <js-dosyası> [bekleme_ms]

JS dosyası bir `async` gövde olarak koşturulur ve son ifadesi JSON'a çevrilip
basılır. `npm run dev` ayakta olmalı.
"""
import json
import sys

import gi

gi.require_version("WebKit2", "4.1")
gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

url = sys.argv[1]
js_yol = sys.argv[2]
bekleme = int(sys.argv[3]) if len(sys.argv) > 3 else 1500
govde = open(js_yol, encoding="utf-8").read()

# ⚠️ `evaluate_javascript` **Promise döndüremiyor** ("Unsupported result type").
# Async gövde bir kez koşturulup sonucu `window.__sonuc`'a yazılıyor; sonra
# ayrı bir çağrıyla yoklanıyor.
baslat = f"""
window.__sonuc = null;
(async () => {{
  try {{
    window.__sonuc = JSON.stringify(await (async () => {{ {govde} }})());
  }} catch (e) {{
    window.__sonuc = JSON.stringify({{ hata: String((e && e.stack) || e) }});
  }}
}})();
"baslatildi";
"""
yokla = "window.__sonuc"

pencere = Gtk.OffscreenWindow()
pencere.set_default_size(1440, 900)
gorunum = WebKit2.WebView()
pencere.add(gorunum)
pencere.show_all()

cikis = 0


def yoklandi(kaynak, sonuc):
    """Sonuç henüz yoksa yeniden yokla; geldiyse bas ve çık."""
    global cikis
    try:
        deger = gorunum.evaluate_javascript_finish(sonuc)
        metin = deger.to_string() if deger else None
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"hata": f"evaluate: {e}"}))
        cikis = 1
        Gtk.main_quit()
        return
    if metin in (None, "null"):
        GLib.timeout_add(120, lambda: (gorunum.evaluate_javascript(yokla, -1, None, None, None, yoklandi), False)[1])
        return
    print(metin)
    Gtk.main_quit()


def basladi(kaynak, sonuc):
    try:
        gorunum.evaluate_javascript_finish(sonuc)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"hata": f"baslat: {e}"}))
        Gtk.main_quit()
        return
    GLib.timeout_add(120, lambda: (gorunum.evaluate_javascript(yokla, -1, None, None, None, yoklandi), False)[1])


def sor(vw):
    vw.evaluate_javascript(baslat, -1, None, None, None, basladi)
    return False


def yuklendi(vw, olay):
    if olay == WebKit2.LoadEvent.FINISHED:
        GLib.timeout_add(bekleme, sor, vw)


gorunum.connect("load-changed", yuklendi)
gorunum.load_uri(url)
# Sonsuza kadar asılı kalmasın.
GLib.timeout_add(bekleme + 20000, lambda: (print(json.dumps({"hata": "zaman aşımı"})), Gtk.main_quit()))
Gtk.main()
sys.exit(cikis)
