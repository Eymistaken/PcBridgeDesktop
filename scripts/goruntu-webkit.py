#!/usr/bin/env python3
"""Sayfanın **asıl motorda** görüntüsünü al.

⚠️ Tarayıcı bölmesi Chromium; uygulama WebKitGTK. Yazı tipinin gerçekten
yüklendiği, bir çizicinin gerçekten çizdiği, kutu-çizim karakterlerinin
hücreye oturduğu **yalnızca burada** görülür. JS'ten piksel okumak yalan
söyleyebiliyor (WebGL tuvalinde çizim tamponu sunumdan sonra siliniyor),
o yüzden derleyiciden geçen asıl çıktı alınıyor: `WebKit2.WebView.get_snapshot`.

Bu, CLAUDE.md "Nasıl ölçülür" madde 1'in görüntü ayağı; `olc-webkit.py`
sayıyı, bu dosya resmi veriyor.

Kullanım:
    python3 scripts/goruntu-webkit.py <url> <cikti.png> [bekleme_ms] [en] [boy]

`npm run dev` ayakta olmalı.
"""
import sys

import gi

gi.require_version("WebKit2", "4.1")
gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

url = sys.argv[1]
cikti = sys.argv[2]
bekleme = int(sys.argv[3]) if len(sys.argv) > 3 else 2000
en = int(sys.argv[4]) if len(sys.argv) > 4 else 1440
boy = int(sys.argv[5]) if len(sys.argv) > 5 else 900

pencere = Gtk.OffscreenWindow()
pencere.set_default_size(en, boy)
gorunum = WebKit2.WebView()
gorunum.set_size_request(en, boy)
pencere.add(gorunum)
pencere.show_all()

kod = 0


def yazildi(kaynak, sonuc):
    global kod
    try:
        yuzey = gorunum.get_snapshot_finish(sonuc)
        yuzey.write_to_png(cikti)
        print(f"{cikti}  {yuzey.get_width()}x{yuzey.get_height()}")
    except GLib.Error as e:
        print(f"görüntü alınamadı: {e}", file=sys.stderr)
        kod = 1
    Gtk.main_quit()


def cek():
    gorunum.get_snapshot(
        WebKit2.SnapshotRegion.FULL_DOCUMENT,
        WebKit2.SnapshotOptions.NONE,
        None,
        yazildi,
    )
    return False


def yuklendi(gv, olay):
    # Yazı tipleri tembel: `load-changed` FINISHED derken yüzler henüz
    # inmemiş olabiliyor ve görüntü yedek yazı tipiyle çıkar.
    if olay == WebKit2.LoadEvent.FINISHED:
        GLib.timeout_add(bekleme, cek)


gorunum.connect("load-changed", yuklendi)
gorunum.load_uri(url)
Gtk.main()
sys.exit(kod)
