//! Masaüstü izni — pcbridge'in `desktop_unlock` / `desktop_lock` kapısı.
//!
//! **İzin durumu diskte yaşıyor**, MCP'de değil:
//! `~/.local/state/pcbridge/desktop_unlock.json` →
//! `{"until": <unix>, "hard_until": <unix>, "reason": …, "granted": <unix>}`.
//! Geri sayım bu dosyadan okunur; her saniye MCP'ye sorulmaz. Aynı kural
//! `jobs.rs`'te de geçerli: **canlı durum dosyadan, eylem MCP'den.**
//!
//! İki sayı var, biri değil (`pcbridge/desktop/safety.py`):
//!   * `until` **kayan kira** — her masaüstü eyleminden sonra ileri itilir,
//!     eylem gelmezse düşer.
//!   * `hard_until` **sert tavan** — `until` bunun ötesine geçemez.
//!
//! İkisi farklıysa arayüz ikisini de gösterir; tek sayı yanıltıcı olurdu.

use std::path::PathBuf;

use serde::Serialize;

/// `~/.local/state` (ya da `XDG_STATE_HOME`) altındaki pcbridge dizini.
pub fn state_dir() -> PathBuf {
    std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/state")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pcbridge")
}

fn now() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

#[derive(Debug, Clone, Serialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopState {
    pub unlocked: bool,
    /// Kayan kiranın kalanı, saniye. Kilitliyse 0.
    pub remaining: i64,
    /// Sert tavanın kalanı, saniye. `remaining`'den büyükse ikisi de anlamlı.
    pub hard_remaining: i64,
    /// İzni açanın yazdığı gerekçe — denetim kaydına da giden metin.
    pub reason: Option<String>,
    /// İznin açıldığı an (unix). Yoksa dosya eski biçimde.
    pub granted_at: Option<f64>,
    /// Durum dosyası hiç yoksa: pcbridge bu makinede izin durumu yazmamış.
    pub known: bool,
}

/// Durum dosyasını çözümler. Dosya yoksa ya da bozuksa **kilitli** sayılır —
/// bilinmeyen bir durumu "açık" saymak yanlış tarafa hata yapmaktır.
pub fn parse_state(json: &str, simdi: f64) -> DesktopState {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(json) else {
        return DesktopState::default();
    };
    let f = |k: &str| v.get(k).and_then(serde_json::Value::as_f64).unwrap_or(0.0);
    let until = f("until");
    let hard = f("hard_until");
    let remaining = (until - simdi).max(0.0) as i64;
    DesktopState {
        unlocked: remaining > 0,
        remaining,
        hard_remaining: (hard - simdi).max(0.0) as i64,
        reason: v
            .get("reason")
            .and_then(serde_json::Value::as_str)
            .filter(|s| !s.trim().is_empty())
            .map(str::to_string),
        granted_at: v.get("granted").and_then(serde_json::Value::as_f64),
        known: true,
    }
}

pub fn read_state() -> DesktopState {
    match std::fs::read_to_string(state_dir().join("desktop_unlock.json")) {
        Ok(s) => parse_state(&s, now()),
        Err(_) => DesktopState::default(),
    }
}

// ─────────────────────────── denetim kaydı ───────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AuditRow {
    /// `2026-09-02T07:21:47` — pcbridge'in yazdığı biçim, olduğu gibi.
    pub ts: String,
    pub event: String,
    /// Kalan alanların tek satırlık özeti.
    pub detail: String,
    /// `*_denied` — kapının reddettiği çağrı.
    pub denied: bool,
    /// `*_error` — araç patladı.
    pub error: bool,
}

/// Satırın `ts`/`event` dışındaki alanlarını okunur tek satıra indirger.
///
/// **Neden içerik gösterilebilir:** pcbridge yazılan metni değil `chars: 5`
/// gibi sayıları kaydediyor (ölçüldü) — denetim kaydında parola yok.
fn detay(v: &serde_json::Value) -> String {
    let Some(map) = v.as_object() else {
        return String::new();
    };
    let mut parcalar = Vec::new();
    for (k, val) in map {
        if k == "ts" || k == "event" {
            continue;
        }
        let s = match val {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Null => continue,
            other => other.to_string(),
        };
        if s.is_empty() {
            continue;
        }
        // Uzun komutlar şeridi taşırmasın; tamamı zaten dosyada.
        let kisa: String = if s.chars().count() > 90 {
            s.chars().take(89).collect::<String>() + "…"
        } else {
            s
        };
        parcalar.push(format!("{k}: {kisa}"));
    }
    parcalar.join(" · ")
}

/// Dosyanın **sonundan** en çok `n` satır. Tamamı okunmaz: kayıt 700 KB'ı
/// geçebiliyor ve bize yalnızca kuyruğu lazım.
pub fn audit_tail(n: usize) -> Vec<AuditRow> {
    const KUYRUK: u64 = 96 * 1024;
    let path = state_dir().join("audit.log");
    let Ok(mut f) = std::fs::File::open(&path) else {
        return Vec::new();
    };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    let baslangic = len.saturating_sub(KUYRUK);
    use std::io::{Read, Seek, SeekFrom};
    if f.seek(SeekFrom::Start(baslangic)).is_err() {
        return Vec::new();
    }
    let mut buf = Vec::new();
    if f.read_to_end(&mut buf).is_err() {
        return Vec::new();
    }
    let metin = String::from_utf8_lossy(&buf);
    parse_audit(&metin, baslangic > 0, n)
}

/// `kirpik`: ilk satır ortadan başlamış olabilir, atılır.
pub fn parse_audit(metin: &str, kirpik: bool, n: usize) -> Vec<AuditRow> {
    let mut satirlar: Vec<&str> = metin.lines().collect();
    if kirpik && !satirlar.is_empty() {
        satirlar.remove(0);
    }
    let mut out: Vec<AuditRow> = satirlar
        .iter()
        .rev()
        .filter_map(|l| serde_json::from_str::<serde_json::Value>(l.trim()).ok())
        .filter_map(|v| {
            let event = v.get("event")?.as_str()?.to_string();
            Some(AuditRow {
                ts: v
                    .get("ts")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                denied: event.ends_with("_denied"),
                error: event.ends_with("_error"),
                detail: detay(&v),
                event,
            })
        })
        .take(n)
        .collect();
    out.reverse();
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acik_izin_iki_sayiyi_da_verir() {
        // Kayan kira 90 sn, sert tavan 900 sn — safety.py'nin yazdığı biçim.
        let s = parse_state(
            r#"{"until": 1090.0, "hard_until": 1900.0, "reason": "deneme", "granted": 1000.0}"#,
            1000.0,
        );
        assert!(s.unlocked);
        assert_eq!(s.remaining, 90);
        assert_eq!(s.hard_remaining, 900);
        assert_eq!(s.reason.as_deref(), Some("deneme"));
        assert_eq!(s.granted_at, Some(1000.0));
    }

    #[test]
    fn kilitli_dosya_kapali_verir() {
        // `gate.lock()` tam olarak bunu yazıyor.
        let s = parse_state(r#"{"until": 0, "hard_until": 0}"#, 1000.0);
        assert!(!s.unlocked);
        assert_eq!(s.remaining, 0);
        assert!(s.known);
    }

    #[test]
    fn suresi_gecmis_izin_kapali() {
        let s = parse_state(r#"{"until": 999.0, "hard_until": 999.0}"#, 1000.0);
        assert!(!s.unlocked);
    }

    #[test]
    fn bozuk_dosya_kilitli_sayilir() {
        // Bilinmeyeni "açık" saymak yanlış tarafa hata yapmak olurdu.
        let s = parse_state("{bu json değil", 1000.0);
        assert!(!s.unlocked);
        assert!(!s.known);
    }

    #[test]
    fn eski_bicimde_sert_tavan_sifir() {
        let s = parse_state(r#"{"until": 1060.0}"#, 1000.0);
        assert!(s.unlocked);
        assert_eq!(s.remaining, 60);
        assert_eq!(s.hard_remaining, 0);
    }

    #[test]
    fn denetim_kaydi_gercek_satirlari_okur() {
        // Diskteki audit.log'dan birebir alınmış satırlar.
        let ham = concat!(
            r#"{"ts": "2026-09-02T06:28:38", "event": "keyboard", "action": "key", "keys": "Return", "forced": true}"#,
            "\n",
            r#"{"ts": "2026-09-02T06:40:55", "event": "ui_dump_denied", "reason": "Masaustu kontrolu su an kilitli."}"#,
            "\n",
            r#"{"ts": "2026-09-02T07:03:15", "event": "desktop_lock", "was_remaining": 0}"#,
            "\n",
        );
        let rows = parse_audit(ham, false, 10);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].event, "keyboard");
        assert!(rows[0].detail.contains("keys: Return"));
        assert!(!rows[0].denied);
        assert!(rows[1].denied);
        assert_eq!(rows[2].event, "desktop_lock");
    }

    #[test]
    fn kirpik_ilk_satir_atilir() {
        let ham = concat!(
            r#"vent": "keyboard", "action": "key"}"#,
            "\n",
            r#"{"ts": "2026-09-02T07:03:15", "event": "desktop_lock"}"#,
            "\n",
        );
        assert_eq!(parse_audit(ham, true, 10).len(), 1);
        // Kırpık olmadığı söylenirse yarım satır zaten JSON'a çevrilemez.
        assert_eq!(parse_audit(ham, false, 10).len(), 1);
    }

    #[test]
    fn kuyruk_sondan_alinir() {
        let ham: String = (0..50)
            .map(|i| format!("{{\"ts\": \"t{i}\", \"event\": \"e{i}\"}}\n"))
            .collect();
        let rows = parse_audit(&ham, false, 3);
        assert_eq!(rows.len(), 3);
        // Sıra eskiden yeniye: son üç satır, doğru sırayla.
        assert_eq!(rows[0].event, "e47");
        assert_eq!(rows[2].event, "e49");
    }

    #[test]
    fn uzun_komut_kisaltilir() {
        let uzun = "x".repeat(200);
        let ham = format!(r#"{{"ts": "t", "event": "shell_run", "cmd": "{uzun}"}}"#);
        let rows = parse_audit(&ham, false, 1);
        assert!(rows[0].detail.ends_with('…'));
        assert!(rows[0].detail.chars().count() < 110);
    }
}
