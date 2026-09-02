//! Ajan çıktısını arayüzün çizebileceği olaylara çevirir.
//!
//! Üç ayrıştırıcı, adları `pcbridge/jobs.py`'dekilerden birebir taşındı:
//!
//! * `claude_stream_json` — satır satır JSON (JSONL). Gerçek satır tipleri
//!   diskteki 38 koşumdan çıkarıldı: `system/init`, `rate_limit_event`,
//!   `assistant` (text · thinking · tool_use), `user` (tool_result), `result`.
//! * `agy_json` — JSONL **değil**, tek bir JSON nesnesi; iş bitince yazılıyor.
//!   Anahtarlar: `conversation_id`, `status` (SUCCESS|ERROR), `response`,
//!   `duration_seconds`, `num_turns`, `usage`, hata varsa `error`.
//! * `plain` — ham metin.
//!
//! `out.log` stdout ve stderr'i birleştirdiği için araya JSON olmayan satır
//! karışabilir; onlar `Raw` olarak geçer, ayrıştırıcı düşmez.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Plain,
    ClaudeStreamJson,
    AgyJson,
}

impl Kind {
    pub fn from_name(s: &str) -> Kind {
        match s {
            "claude_stream_json" => Kind::ClaudeStreamJson,
            "agy_json" => Kind::AgyJson,
            _ => Kind::Plain,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Event {
    /// Ajan oturumu açıldı — `resume_session` için kimlik buradan gelir.
    Session {
        id: String,
        model: Option<String>,
        cwd: Option<String>,
    },
    Text {
        text: String,
    },
    Thinking {
        text: String,
    },
    /// Döküm baloncuğunda bir satır başlar.
    ToolStart {
        id: String,
        /// Türkçe fiil — "Okundu", "Arandı", "Çalıştırıldı"…
        verb: String,
        /// Tek satırlık mono ayrıntı (yol, desen, komut).
        detail: String,
    },
    ToolEnd {
        id: String,
        ok: bool,
    },
    Finished {
        ok: bool,
        turns: Option<u64>,
        duration_ms: Option<u64>,
        cost_usd: Option<f64>,
        error: Option<String>,
    },
    /// Tanınmayan satır ya da `plain` çıktısı.
    Raw {
        text: String,
    },
}

/// Araç adı → döküm baloncuğundaki fiil. Bilinmeyen araç kendi adıyla geçer;
/// uydurmuyoruz.
fn verb(tool: &str) -> String {
    match tool {
        "Read" | "NotebookRead" => "Okundu",
        "Grep" | "Glob" => "Arandı",
        "Write" => "Yazıldı",
        "Edit" | "MultiEdit" | "NotebookEdit" => "Düzenlendi",
        "Bash" | "BashOutput" => "Çalıştırıldı",
        "WebFetch" => "Getirildi",
        "WebSearch" => "Web'de arandı",
        "Task" | "Agent" => "Ajan",
        "TodoWrite" => "Liste",
        "Artifact" => "Yayımlandı",
        other => return other.to_string(),
    }
    .to_string()
}

/// `a/b/c/d/e.txt` → `a/…/e.txt`. Artboard'daki
/// `gnome-extension/…/extension.js` biçimi.
fn kisa_yol(p: &str) -> String {
    if p.len() <= 44 {
        return p.to_string();
    }
    let mutlak = p.starts_with('/');
    let parcalar: Vec<&str> = p.split('/').filter(|s| !s.is_empty()).collect();
    match parcalar.as_slice() {
        [] | [_] => p.to_string(),
        [ilk, .., son] => {
            let kok = if mutlak { "/" } else { "" };
            format!("{kok}{ilk}/…/{son}")
        }
    }
}

fn kirp(s: &str, n: usize) -> String {
    let temiz = s.replace('\n', " ");
    if temiz.chars().count() <= n {
        return temiz;
    }
    let kesilen: String = temiz.chars().take(n).collect();
    format!("{kesilen}…")
}

/// Araç girdisinden tek satırlık ayrıntı. **Girdiden** üretilir; sonuçtan
/// "2 eşleşme" gibi sayı çıkarmıyoruz — ölçmediğimizi yazmıyoruz.
fn detail(tool: &str, input: &serde_json::Value) -> String {
    let s = |k: &str| input.get(k).and_then(|v| v.as_str());

    if let Some(p) = s("file_path").or_else(|| s("notebook_path")) {
        return kisa_yol(p);
    }
    if tool == "Grep" || tool == "Glob" {
        if let Some(pat) = s("pattern") {
            let nerede = s("path").map(|p| format!(" · {}", kisa_yol(p)));
            return format!("\"{}\"{}", kirp(pat, 40), nerede.unwrap_or_default());
        }
    }
    if let Some(c) = s("command") {
        return kirp(c, 64);
    }
    if let Some(u) = s("url") {
        return kirp(u, 56);
    }
    if let Some(q) = s("query").or_else(|| s("prompt")).or_else(|| s("description")) {
        return kirp(q, 56);
    }
    // Son çare: ilk dizge değer.
    if let Some(obj) = input.as_object() {
        for (_, v) in obj {
            if let Some(t) = v.as_str() {
                return kirp(t, 56);
            }
        }
    }
    String::new()
}

pub struct Parser {
    kind: Kind,
    /// Tamamlanmamış son satır (ya da agy_json'da tüm gövde).
    buf: String,
    agy_bitti: bool,
}

impl Parser {
    pub fn new(kind: Kind) -> Self {
        Parser {
            kind,
            buf: String::new(),
            agy_bitti: false,
        }
    }

    /// Yeni gelen metni işler. Yarım kalan satır tamamlanana kadar bekletilir.
    pub fn push(&mut self, chunk: &str) -> Vec<Event> {
        self.buf.push_str(chunk);

        // agy_json satır tabanlı değil: tüm gövde tek nesne. Ayrıştırılabilir
        // hâle gelene kadar biriktir.
        if self.kind == Kind::AgyJson {
            return self.agy_dene();
        }

        let mut out = Vec::new();
        while let Some(i) = self.buf.find('\n') {
            let line: String = self.buf.drain(..=i).collect();
            self.satir(line.trim_end_matches(['\n', '\r']), &mut out);
        }
        out
    }

    /// İş bitti: elde kalan yarım satırı da işle.
    pub fn finish(&mut self) -> Vec<Event> {
        if self.kind == Kind::AgyJson {
            return self.agy_dene();
        }
        let mut out = Vec::new();
        let kalan = std::mem::take(&mut self.buf);
        let kalan = kalan.trim();
        if !kalan.is_empty() {
            self.satir(kalan, &mut out);
        }
        out
    }

    fn agy_dene(&mut self) -> Vec<Event> {
        if self.agy_bitti {
            return Vec::new();
        }
        let metin = self.buf.trim();
        if metin.is_empty() {
            return Vec::new();
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(metin) else {
            return Vec::new(); // henüz tamamlanmadı
        };
        self.agy_bitti = true;

        let mut out = Vec::new();
        if let Some(id) = v.get("conversation_id").and_then(|x| x.as_str()) {
            out.push(Event::Session {
                id: id.to_string(),
                model: None,
                cwd: None,
            });
        }
        if let Some(r) = v.get("response").and_then(|x| x.as_str()) {
            if !r.is_empty() {
                out.push(Event::Text {
                    text: r.to_string(),
                });
            }
        }
        let ok = v.get("status").and_then(|x| x.as_str()) == Some("SUCCESS");
        out.push(Event::Finished {
            ok,
            turns: v.get("num_turns").and_then(|x| x.as_u64()),
            duration_ms: v
                .get("duration_seconds")
                .and_then(|x| x.as_f64())
                .map(|s| (s * 1000.0) as u64),
            cost_usd: None,
            error: v
                .get("error")
                .and_then(|x| x.as_str())
                .map(str::to_string)
                .filter(|s| !s.is_empty()),
        });
        out
    }

    fn satir(&mut self, line: &str, out: &mut Vec<Event>) {
        let line = line.trim();
        if line.is_empty() {
            return;
        }
        if self.kind == Kind::Plain {
            out.push(Event::Raw {
                text: line.to_string(),
            });
            return;
        }

        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else {
            // stdout+stderr birleşik: JSON olmayan satır olağan.
            out.push(Event::Raw {
                text: line.to_string(),
            });
            return;
        };

        match v.get("type").and_then(|t| t.as_str()) {
            Some("system") => {
                if let Some(id) = v.get("session_id").and_then(|x| x.as_str()) {
                    out.push(Event::Session {
                        id: id.to_string(),
                        model: v.get("model").and_then(|x| x.as_str()).map(str::to_string),
                        cwd: v.get("cwd").and_then(|x| x.as_str()).map(str::to_string),
                    });
                }
            }
            // Kota bilgisi arayüzde yeri olmayan bir gürültü.
            Some("rate_limit_event") => {}
            Some("assistant") => icerik(&v, out, true),
            Some("user") => icerik(&v, out, false),
            Some("result") => {
                let hata = v.get("is_error").and_then(|x| x.as_bool()).unwrap_or(false);
                out.push(Event::Finished {
                    ok: !hata,
                    turns: v.get("num_turns").and_then(|x| x.as_u64()),
                    duration_ms: v.get("duration_api_ms").and_then(|x| x.as_u64()),
                    cost_usd: v.get("total_cost_usd").and_then(|x| x.as_f64()),
                    error: v
                        .get("result")
                        .and_then(|x| x.as_str())
                        .filter(|_| hata)
                        .map(str::to_string),
                });
            }
            _ => {}
        }
    }
}

fn icerik(v: &serde_json::Value, out: &mut Vec<Event>, asistan: bool) {
    let Some(parcalar) = v
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_array())
    else {
        return;
    };
    for c in parcalar {
        match c.get("type").and_then(|t| t.as_str()) {
            Some("text") if asistan => {
                if let Some(t) = c.get("text").and_then(|x| x.as_str()) {
                    if !t.trim().is_empty() {
                        out.push(Event::Text {
                            text: t.to_string(),
                        });
                    }
                }
            }
            Some("thinking") if asistan => {
                if let Some(t) = c
                    .get("thinking")
                    .or_else(|| c.get("text"))
                    .and_then(|x| x.as_str())
                {
                    if !t.trim().is_empty() {
                        out.push(Event::Thinking {
                            text: t.to_string(),
                        });
                    }
                }
            }
            Some("tool_use") => {
                let name = c.get("name").and_then(|x| x.as_str()).unwrap_or("araç");
                let bos = serde_json::Value::Null;
                out.push(Event::ToolStart {
                    id: c
                        .get("id")
                        .and_then(|x| x.as_str())
                        .unwrap_or_default()
                        .to_string(),
                    verb: verb(name),
                    detail: detail(name, c.get("input").unwrap_or(&bos)),
                });
            }
            Some("tool_result") => {
                out.push(Event::ToolEnd {
                    id: c
                        .get("tool_use_id")
                        .and_then(|x| x.as_str())
                        .unwrap_or_default()
                        .to_string(),
                    ok: !c
                        .get("is_error")
                        .and_then(|x| x.as_bool())
                        .unwrap_or(false),
                });
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kisa_yol_ortayi_eler() {
        // Eşiğin altındakiler olduğu gibi kalır.
        assert_eq!(kisa_yol("a/b.txt"), "a/b.txt");
        assert_eq!(kisa_yol("/a/b/c/d/uzun/yol/extension.js"), "/a/b/c/d/uzun/yol/extension.js");
        // Artboard'daki biçim.
        assert_eq!(
            kisa_yol("gnome-extension/src/ui/panel/derin/klasor/extension.js"),
            "gnome-extension/…/extension.js"
        );
        // Mutlak yolun baştaki bölü işareti korunur.
        assert_eq!(
            kisa_yol("/home/eymistaken/Belgeler/Pcbridge/pcbridge/desktop/capture.py"),
            "/home/…/capture.py"
        );
    }

    #[test]
    fn claude_akisi_ayristirilir() {
        let mut p = Parser::new(Kind::ClaudeStreamJson);
        let mut ev = p.push(concat!(
            r#"{"type":"system","subtype":"init","session_id":"s1","model":"claude-opus-5","cwd":"/home/x"}"#, "\n",
            r#"{"type":"rate_limit_event","rate_limit_info":{"status":"allowed"}}"#, "\n",
            r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Bakıyorum."}]}}"#, "\n",
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Read","input":{"file_path":"/home/eymistaken/Belgeler/Pcbridge/pcbridge/desktop/capture.py"}}]}}"#, "\n",
            r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","is_error":false}]}}"#, "\n",
            r#"{"type":"result","is_error":false,"num_turns":2,"duration_api_ms":6774,"total_cost_usd":0.118}"#, "\n",
        ));
        ev.retain(|e| !matches!(e, Event::Raw { .. }));

        assert_eq!(ev.len(), 5, "rate_limit_event atılmalı: {ev:?}");
        assert!(matches!(&ev[0], Event::Session { id, model, .. }
            if id == "s1" && model.as_deref() == Some("claude-opus-5")));
        assert!(matches!(&ev[1], Event::Text { text } if text == "Bakıyorum."));
        match &ev[2] {
            Event::ToolStart { id, verb, detail } => {
                assert_eq!(id, "t1");
                assert_eq!(verb, "Okundu");
                assert_eq!(detail, "/home/…/capture.py");
            }
            o => panic!("ToolStart bekleniyordu: {o:?}"),
        }
        assert!(matches!(&ev[3], Event::ToolEnd { id, ok } if id == "t1" && *ok));
        assert!(matches!(&ev[4], Event::Finished { ok: true, turns: Some(2), .. }));
    }

    #[test]
    fn yarim_satir_beklenir() {
        let mut p = Parser::new(Kind::ClaudeStreamJson);
        // Satır ikiye bölünmüş hâlde geliyor — tail offset'ten okurken olağan.
        let bos = p.push(r#"{"type":"assistant","message":{"content":[{"type":"tex"#);
        assert!(bos.is_empty(), "yarım satır olay üretmemeli");
        let ev = p.push("t\",\"text\":\"tamam\"}]}}\n");
        assert_eq!(ev, vec![Event::Text { text: "tamam".into() }]);
    }

    #[test]
    fn json_olmayan_satir_dusurmez() {
        let mut p = Parser::new(Kind::ClaudeStreamJson);
        let ev = p.push("bash: uyarı: bir şey\n{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"hi\"}]}}\n");
        assert_eq!(ev.len(), 2);
        assert!(matches!(&ev[0], Event::Raw { text } if text.starts_with("bash:")));
        assert!(matches!(&ev[1], Event::Text { .. }));
    }

    #[test]
    fn agy_tek_nesne_olarak_okunur() {
        let mut p = Parser::new(Kind::AgyJson);
        // Parça parça gelir; tamamlanana kadar hiçbir şey yayılmaz.
        assert!(p.push(r#"{"conversation_id":"c1","status":"SUC"#).is_empty());
        let ev = p.push(r#"CESS","response":"bitti","num_turns":3,"duration_seconds":1.5}"#);
        assert_eq!(
            ev,
            vec![
                Event::Session { id: "c1".into(), model: None, cwd: None },
                Event::Text { text: "bitti".into() },
                Event::Finished {
                    ok: true,
                    turns: Some(3),
                    duration_ms: Some(1500),
                    cost_usd: None,
                    error: None
                },
            ]
        );
    }

    #[test]
    fn agy_hatasi_isaretlenir() {
        let mut p = Parser::new(Kind::AgyJson);
        let ev = p.push(r#"{"conversation_id":"c2","status":"ERROR","response":"","error":"patladı"}"#);
        assert!(matches!(
            ev.last(),
            Some(Event::Finished { ok: false, error: Some(e), .. }) if e == "patladı"
        ));
    }

    #[test]
    fn plain_her_satiri_gecirir() {
        let mut p = Parser::new(Kind::Plain);
        assert_eq!(
            p.push("arkaplan-bitti\n"),
            vec![Event::Raw { text: "arkaplan-bitti".into() }]
        );
    }

    #[test]
    fn grep_deseni_ayrintiya_girer() {
        let mut p = Parser::new(Kind::ClaudeStreamJson);
        let ev = p.push(
            "{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"tool_use\",\"id\":\"g\",\"name\":\"Grep\",\"input\":{\"pattern\":\"set_pointer_visible\"}}]}}\n",
        );
        assert!(matches!(&ev[0], Event::ToolStart { verb, detail, .. }
            if verb == "Arandı" && detail == "\"set_pointer_visible\""));
    }
}

#[cfg(test)]
mod json_bicimi {
    use super::*;
    #[test]
    fn olaylar_camel_case_serilesir() {
        let j = serde_json::to_string(&Event::Finished {
            ok: true,
            turns: Some(2),
            duration_ms: Some(6774),
            cost_usd: Some(0.118),
            error: None,
        })
        .unwrap();
        assert!(j.contains("\"kind\":\"finished\""), "{j}");
        assert!(j.contains("\"durationMs\":6774"), "{j}");
        assert!(j.contains("\"costUsd\":0.118"), "{j}");

        let t = serde_json::to_string(&Event::ToolStart {
            id: "t1".into(),
            verb: "Okundu".into(),
            detail: "a.rs".into(),
        })
        .unwrap();
        assert!(t.contains("\"kind\":\"toolStart\""), "{t}");
    }
}
