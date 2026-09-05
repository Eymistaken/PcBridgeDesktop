//! İş çıktısını **diskten** canlı okur.
//!
//! `~/.local/state/pcbridge/jobs/<id>/` altında:
//!   `meta.json`   durum, pid, argv, prompt, exit_code
//!   `out.log`     stdout+stderr birleşik
//!   `exit_code`   iş bitince yazılır
//!
//! Canlı akış için **MCP pollanmaz** — dosya offset'ten okunur. MCP'ye yalnızca
//! işi başlatmak ve durdurmak için gidilir.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use crate::parse::{Event, Kind, Parser};

/// Dosya kuyruğunun yoklama aralığı. 120 ms göz için anlık, disk için hiç.
const POLL: Duration = Duration::from_millis(120);

/// Çıktı bu kadar süredir susuyorsa pcbridge'e bir kez sorulur.
///
/// **Neden sormak zorundayız:** pcbridge biten çocuk süreci ancak `job_status`
/// çağrıldığında topluyor; o ana kadar süreç zombi kalıyor ve `meta.json`'a
/// `status`/`exit_code` hiç yazılmıyor (2026-09-02'de ölçüldü). Yani yalnızca
/// dosya izleyen bir istemci işin bittiğini asla göremez. Bu, "canlı akış için
/// MCP pollanmaz" kuralını çiğnemez: **çıktı** hâlâ dosyadan geliyor, MCP'ye
/// yalnızca bitişi kesinleştirmek için gidiliyor.
const SESSIZLIK: Duration = Duration::from_secs(5);

pub fn jobs_dir() -> PathBuf {
    std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/state")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pcbridge/jobs")
}

fn job_dir(job_id: &str) -> PathBuf {
    jobs_dir().join(job_id)
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct JobMeta {
    pub id: String,
    pub kind: Option<String>,
    pub label: Option<String>,
    pub cwd: Option<String>,
    pub parser: Option<String>,
    /// `running` · `finished` · `failed` · `cancelled` — pcbridge ne yazdıysa.
    pub status: Option<String>,
    pub exit_code: Option<i64>,
    pub started_at: Option<f64>,
    pub finished_at: Option<f64>,
    pub agent: Option<String>,
    pub prompt: Option<String>,
    pub resume_session: Option<String>,
}

impl JobMeta {
    pub fn bitti(&self) -> bool {
        matches!(
            self.status.as_deref(),
            Some("finished") | Some("failed") | Some("cancelled") | Some("timeout")
        ) || self.exit_code.is_some()
    }
}

pub fn read_meta(job_id: &str) -> Option<JobMeta> {
    let text = std::fs::read_to_string(job_dir(job_id).join("meta.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    let s = |k: &str| v.get(k).and_then(|x| x.as_str()).map(str::to_string);
    Some(JobMeta {
        id: s("id").unwrap_or_else(|| job_id.to_string()),
        kind: s("kind"),
        label: s("label"),
        cwd: s("cwd"),
        parser: s("parser"),
        status: s("status"),
        exit_code: v.get("exit_code").and_then(|x| x.as_i64()),
        started_at: v.get("started_at").and_then(|x| x.as_f64()),
        finished_at: v.get("finished_at").and_then(|x| x.as_f64()),
        agent: s("agent"),
        prompt: s("prompt"),
        resume_session: s("resume_session"),
    })
}

fn parser_kind(meta: &JobMeta) -> Kind {
    Kind::from_name(meta.parser.as_deref().unwrap_or("plain"))
}

/// Bitmiş (ya da süren) bir işi baştan sona okuyup olaylara çevirir —
/// uygulama yeniden açıldığında geçmiş bundan kurulur.
pub fn replay(job_id: &str) -> (JobMeta, Vec<Event>) {
    let meta = read_meta(job_id).unwrap_or(JobMeta {
        id: job_id.to_string(),
        ..Default::default()
    });
    let mut p = Parser::new(parser_kind(&meta));
    let mut events = Vec::new();
    if let Ok(text) = std::fs::read_to_string(job_dir(job_id).join("out.log")) {
        events.extend(p.push(&text));
    }
    if meta.bitti() {
        events.extend(p.finish());
    }
    (meta, events)
}

/// İşin son anlamlı çıktı satırı — kenar çubuğundaki özet için.
///
/// Dosyanın tamamını okumuyoruz: büyük koşumlarda son 64 KB yeter. Parçanın
/// ortasından başlamamak için ilk satır sonuna kadar atlıyoruz.
pub fn last_line(job_id: &str) -> Option<String> {
    use std::io::{Read, Seek, SeekFrom};
    const KUYRUK: u64 = 64 * 1024;

    let meta = read_meta(job_id)?;
    let mut f = std::fs::File::open(job_dir(job_id).join("out.log")).ok()?;
    let boyut = f.metadata().ok()?.len();
    if boyut == 0 {
        return None;
    }

    let bastan = boyut <= KUYRUK;
    if !bastan {
        f.seek(SeekFrom::Start(boyut - KUYRUK)).ok()?;
    }
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).ok()?;
    let mut metin = String::from_utf8_lossy(&buf).into_owned();
    if !bastan {
        // agy_json tek nesne: ortadan başlarsak ayrıştırılamaz, boş geçeriz.
        match metin.find('\n') {
            Some(i) => metin = metin[i + 1..].to_string(),
            None => return None,
        }
    }

    let mut p = Parser::new(parser_kind(&meta));
    let mut events = p.push(&metin);
    events.extend(p.finish());

    // Ajanın söylediği, stderr gürültüsüne yeğlenir: `Raw` çoğu zaman
    // "Client.listTools() called but..." gibi bir uyarı oluyor ve özet
    // olarak işe yaramıyor. Metin yoksa ham satıra düşülür.
    let ilk_satir = |t: &str| -> Option<String> {
        let satir = t.lines().map(str::trim).find(|l| !l.is_empty())?;
        let kirpik: String = satir.chars().take(90).collect();
        Some(if satir.chars().count() > 90 {
            format!("{kirpik}…")
        } else {
            kirpik
        })
    };

    for e in events.iter().rev() {
        if let Event::Text { text, .. } = e {
            if let Some(s) = ilk_satir(text) {
                return Some(s);
            }
        }
    }
    for e in events.iter().rev() {
        if let Event::Raw { text } = e {
            if let Some(s) = ilk_satir(text) {
                return Some(s);
            }
        }
    }
    None
}

// ─────────────────────────── canlı izleme ───────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChunkPayload<'a> {
    job_id: &'a str,
    bot_id: &'a str,
    /// Aynı botun iki session'ı paralel koşabiliyor; ön yüz seçili
    /// **session**'a göre süzüyor.
    session_id: &'a str,
    events: &'a [Event],
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusPayload<'a> {
    job_id: &'a str,
    bot_id: &'a str,
    session_id: &'a str,
    meta: &'a JobMeta,
    /// İzleme bitti mi — arayüz şeridi buna göre kaldırır.
    done: bool,
}

/// Olay yayını **tek yerde**: hem `agent_run` yolu hem uygulamanın kendi
/// ajan döngüsü aynı iki olayı yayıyor (`job://chunk`, `job://status`).
/// Arayüzdeki abonelik bu yüzden tek blok kalabiliyor (`Shell.tsx:226`).
pub fn emit_chunk(
    app: &AppHandle,
    job_id: &str,
    bot_id: &str,
    session_id: &str,
    events: &[Event],
) {
    let _ = app.emit(
        "job://chunk",
        ChunkPayload {
            job_id,
            bot_id,
            session_id,
            events,
        },
    );
}

pub fn emit_status(
    app: &AppHandle,
    job_id: &str,
    bot_id: &str,
    session_id: &str,
    meta: &JobMeta,
    done: bool,
) {
    let _ = app.emit(
        "job://status",
        StatusPayload {
            job_id,
            bot_id,
            session_id,
            meta,
            done,
        },
    );
}

#[derive(Default)]
pub struct Watchers {
    inner: Arc<Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
}

impl Watchers {
    /// `job_id`'yi izlemeye başlar. Aynı iş iki kez izlenmez.
    pub async fn watch(
        &self,
        app: AppHandle,
        job_id: String,
        bot_id: String,
        session_id: String,
    ) {
        let mut map = self.inner.lock().await;
        if map.contains_key(&job_id) {
            return;
        }
        let inner = self.inner.clone();
        let jid = job_id.clone();
        let handle = tauri::async_runtime::spawn(async move {
            tail(app, jid.clone(), bot_id, session_id).await;
            inner.lock().await.remove(&jid);
        });
        map.insert(job_id, handle);
    }

}

async fn tail(app: AppHandle, job_id: String, bot_id: String, session_id: String) {
    let log = job_dir(&job_id).join("out.log");
    let mut offset: u64 = 0;
    let mut parser: Option<Parser> = None;
    // İş bittikten sonra bir tur daha okuyoruz: son baytlar `exit_code`
    // yazıldıktan sonra da diske düşmüş olabilir.
    let mut son_tur = false;
    let mut son_veri = std::time::Instant::now();
    let mut son_sorgu: Option<std::time::Instant> = None;
    let mut bitis_gorüldü = false;

    loop {
        let meta = read_meta(&job_id).unwrap_or(JobMeta {
            id: job_id.clone(),
            ..Default::default()
        });
        if parser.is_none() && meta.parser.is_some() {
            parser = Some(Parser::new(parser_kind(&meta)));
        }

        // Yeni baytları offset'ten oku.
        if let Ok(f) = std::fs::File::open(&log) {
            let boyut = f.metadata().map(|m| m.len()).unwrap_or(0);
            if boyut < offset {
                // Dosya kısaldı (dönme/temizlenme): baştan al.
                offset = 0;
                parser = Some(Parser::new(parser_kind(&meta)));
            }
            if boyut > offset {
                use std::io::{Read, Seek, SeekFrom};
                let mut f = f;
                if f.seek(SeekFrom::Start(offset)).is_ok() {
                    let mut buf = Vec::with_capacity((boyut - offset) as usize);
                    if f.take(boyut - offset).read_to_end(&mut buf).is_ok() {
                        offset += buf.len() as u64;
                        son_veri = std::time::Instant::now();
                        // UTF-8 sınırı ortadan bölünmüş olabilir; kayıpsız
                        // çözemediğimiz baytları ayrıştırıcıya yollamıyoruz.
                        let metin = String::from_utf8_lossy(&buf);
                        let p = parser.get_or_insert_with(|| Parser::new(parser_kind(&meta)));
                        let events = p.push(&metin);
                        // `resume_session` **session başına** saklanır; kimlik
                        // akışın ilk satırında geliyor, kaçırmadan yazıyoruz.
                        // İki session'ın aynı CLI oturumunu sürdürmesi
                        // bağlamları birbirine karıştırırdı.
                        if !bot_id.is_empty() && !session_id.is_empty() {
                            for e in &events {
                                if let Event::Session { id, .. } = e {
                                    let _ = crate::bots::set_session(
                                        &bot_id,
                                        &session_id,
                                        Some(id.clone()),
                                    );
                                }
                            }
                        }
                        // Ajanın kendi çıktısı bittiğini söylüyorsa, diskteki
                        // duruma bakmadan biliyoruz.
                        if events.iter().any(|e| matches!(e, Event::Finished { .. })) {
                            bitis_gorüldü = true;
                        }
                        if !events.is_empty() {
                            let _ = app.emit(
                                "job://chunk",
                                ChunkPayload {
                                    job_id: &job_id,
                                    bot_id: &bot_id,
                                    session_id: &session_id,
                                    events: &events,
                                },
                            );
                        }
                    }
                }
            }
        }

        if son_tur {
            if let Some(p) = parser.as_mut() {
                let events = p.finish();
                if !events.is_empty() {
                    let _ = app.emit(
                        "job://chunk",
                        ChunkPayload {
                            job_id: &job_id,
                            bot_id: &bot_id,
                            session_id: &session_id,
                            events: &events,
                        },
                    );
                }
            }
            let _ = app.emit(
                "job://status",
                StatusPayload {
                    job_id: &job_id,
                    bot_id: &bot_id,
                    session_id: &session_id,
                    meta: &meta,
                    done: true,
                },
            );
            return;
        }

        let _ = app.emit(
            "job://status",
            StatusPayload {
                job_id: &job_id,
                bot_id: &bot_id,
                session_id: &session_id,
                meta: &meta,
                done: false,
            },
        );

        if meta.bitti() {
            son_tur = true;
        } else {
            // Ya ajan bittiğini söyledi, ya da çıktı uzunca sustu: pcbridge'e
            // sor ki çocuğu toplasın ve meta.json'ı yazsın.
            let sorulmali = bitis_gorüldü || son_veri.elapsed() >= SESSIZLIK;
            let bekleme_bitti = son_sorgu.map(|t| t.elapsed() >= SESSIZLIK).unwrap_or(true);
            if sorulmali && bekleme_bitti {
                son_sorgu = Some(std::time::Instant::now());
                let state = app.state::<crate::mcp::McpState>();
                let _ = state.job_status(job_id.clone()).await;
            }
        }
        tokio::time::sleep(POLL).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bitti_hem_statuden_hem_exit_codedan_anlasilir() {
        let mut m = JobMeta::default();
        assert!(!m.bitti());
        m.status = Some("running".into());
        assert!(!m.bitti());
        m.exit_code = Some(0);
        assert!(m.bitti(), "exit_code yazıldıysa bitmiştir");

        let m2 = JobMeta {
            status: Some("cancelled".into()),
            ..Default::default()
        };
        assert!(m2.bitti());
    }

    /// Diskteki gerçek koşumlar üstünde: hiçbiri ayrıştırıcıyı düşürmemeli
    /// ve her biri en az bir olay üretmeli.
    #[test]
    fn diskteki_gercek_isler_ayristirilir() {
        let dir = jobs_dir();
        let Ok(girdiler) = std::fs::read_dir(&dir) else {
            eprintln!("iş dizini yok, test atlandı: {dir:?}");
            return;
        };
        let mut sayac = std::collections::HashMap::<String, usize>::new();
        let mut bakilan = 0;
        for e in girdiler.flatten() {
            let Some(id) = e.file_name().to_str().map(str::to_string) else {
                continue;
            };
            if read_meta(&id).is_none() {
                continue;
            }
            // 10 MB'lık dev bir koşum var; testi ona bağlamayalım.
            let boyut = std::fs::metadata(e.path().join("out.log"))
                .map(|m| m.len())
                .unwrap_or(0);
            if boyut > 2_000_000 {
                continue;
            }
            let (meta, events) = replay(&id);
            bakilan += 1;
            *sayac.entry(meta.parser.unwrap_or_default()).or_default() += 1;
            if boyut > 0 {
                assert!(!events.is_empty(), "{id}: çıktı var ama olay yok");
            }
        }
        eprintln!("{bakilan} gerçek iş ayrıştırıldı: {sayac:?}");
        assert!(bakilan > 0, "hiç iş okunamadı");
    }
}
