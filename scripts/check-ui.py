#!/usr/bin/env python3
"""Run UI regressions in WebKitGTK with native GDK input and mocked IPC.

Start `npm run dev`, then run `/usr/bin/python3 scripts/check-ui.py`.
Optional arguments: --light, --reduced. No model or real bot is invoked.
"""
import json
from pathlib import Path
import sys

import gi

gi.require_version("WebKit2", "4.1")
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib, Gtk, WebKit2

Gtk.Settings.get_default().set_property("gtk-enable-animations", "--reduced" not in sys.argv)
manager = WebKit2.UserContentManager()
manager.register_script_message_handler("nativeInput")
view = WebKit2.WebView(user_content_manager=manager)
window = Gtk.Window(title="PcBridge UI regression checks")
window.set_default_size(1440, 900)
window.add(view)
window.show_all()
status = 1
started = False


def input_received(_manager, message):
    action = json.loads(message.get_js_value().to_string())
    if action["kind"] == "snapshot":
        theme = "light" if "--light" in sys.argv else "dark"
        path = f"/tmp/pcbridge-ui-{theme}-{action['name']}.png"
        def captured(source, result):
            source.get_snapshot_finish(result).write_to_png(path)
        view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, captured)
        return
    device = Gdk.Display.get_default().get_default_seat().get_pointer()
    kind = action["kind"]
    event_type = {"move": Gdk.EventType.MOTION_NOTIFY,
                  "down": Gdk.EventType.BUTTON_PRESS,
                  "up": Gdk.EventType.BUTTON_RELEASE,
                  "keyDown": Gdk.EventType.KEY_PRESS,
                  "keyUp": Gdk.EventType.KEY_RELEASE}[kind]
    # Right and middle clicks are real input paths in the terminal mode: the
    # pane and area menus open on button 3 and an area closes on button 2.
    held_mask = {1: Gdk.ModifierType.BUTTON1_MASK,
                 2: Gdk.ModifierType.BUTTON2_MASK,
                 3: Gdk.ModifierType.BUTTON3_MASK}
    event = Gdk.Event.new(event_type)
    event.window = view.get_window()
    event.send_event = False
    event.time = Gdk.CURRENT_TIME
    if kind.startswith("key"):
        event.set_device(Gdk.Display.get_default().get_default_seat().get_keyboard())
        event.keyval = Gdk.keyval_from_name(action["key"])
        event.hardware_keycode = {"Return": 36, "space": 65, "Tab": 23}[action["key"]]
        event.state = Gdk.ModifierType(0)
        event.group = 0
    else:
        button = action.get("button", 1)
        event.set_device(device)
        event.x, event.y = action["x"], action["y"]
        event.state = held_mask[button] if action.get("held") else Gdk.ModifierType(0)
        if kind != "move":
            event.button = button
    Gtk.main_do_event(event)


manager.connect("script-message-received::nativeInput", input_received)


def checked(_source, result):
    global status
    try:
        value = view.evaluate_javascript_finish(result).to_string()
        if value == "null":
            return
        report = json.loads(value)
        print(json.dumps(report, ensure_ascii=False))
        status = 0 if report.get("passed") else 1
    except Exception as error:
        print(json.dumps({"error": str(error)}))
    Gtk.main_quit()


def poll():
    view.evaluate_javascript("window.__uiResult || null", -1, None, None, None, checked)
    return True


def loaded(_view, event):
    global started
    if event != WebKit2.LoadEvent.FINISHED or started:
        return
    started = True
    body = Path(__file__).with_suffix(".js").read_text()
    prefix = 'document.documentElement.dataset.theme = "' + ("light" if "--light" in sys.argv else "dark") + '";'
    script = prefix + "(async()=>{" + body + "})().then(r=>window.__uiResult=JSON.stringify(r)).catch(e=>window.__uiResult=JSON.stringify({passed:false,error:String(e),stack:e.stack})); 'started';"
    GLib.timeout_add(400, lambda: (view.evaluate_javascript(script, -1, None, None, None, None), False)[1])
    GLib.timeout_add(300, poll)


view.connect("load-changed", loaded)
view.load_uri("http://localhost:1420/")
GLib.timeout_add_seconds(55, lambda: (print('{"passed":false,"error":"timeout"}'), Gtk.main_quit(), False)[2])
Gtk.main()
window.destroy()
sys.exit(status)
