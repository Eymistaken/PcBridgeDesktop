mod bots;
mod jobs;
mod mcp;
mod parse;
mod pty;
mod secrets;

use bots::{Bot, BotDraft, BotError};
use jobs::{JobMeta, Watchers};
use mcp::{AgentRunRequest, ConnError, ConnSnapshot, McpState};
use parse::Event;
use pty::{PtyError, Ptys, TmuxSession};
use serde::Serialize;

// ─────────────────────────── bağlantı ───────────────────────────

#[tauri::command]
fn endpoint() -> &'static str {
    mcp::endpoint()
}

#[tauri::command]
async fn has_token() -> Result<bool, ConnError> {
    secrets::has_async().await.map_err(ConnError::from)
}

#[tauri::command]
async fn connect(
    state: tauri::State<'_, McpState>,
    token: Option<String>,
) -> Result<ConnSnapshot, ConnError> {
    state.connect(token).await
}

#[tauri::command]
async fn refresh(state: tauri::State<'_, McpState>) -> Result<ConnSnapshot, ConnError> {
    state.refresh().await
}

#[tauri::command]
async fn sign_out(state: tauri::State<'_, McpState>) -> Result<(), ConnError> {
    state.disconnect().await;
    secrets::clear_async().await.map_err(ConnError::from)
}

// ───────────────────────────── botlar ─────────────────────────────

#[tauri::command]
fn list_bots() -> Result<Vec<Bot>, BotError> {
    bots::list()
}

#[tauri::command]
fn create_bot(draft: BotDraft) -> Result<Bot, BotError> {
    bots::create(draft)
}

#[tauri::command]
fn update_bot(id: String, draft: BotDraft) -> Result<Bot, BotError> {
    bots::update(&id, draft)
}

#[tauri::command]
fn delete_bot(id: String) -> Result<(), BotError> {
    bots::delete(&id)
}

/// Yeni bot için sıradaki ton — hepsi aynı renkte olmasın.
#[tauri::command]
fn suggest_avatar() -> bots::Avatar {
    bots::next_avatar()
}

// ─────────────────────────── koşumlar ───────────────────────────

/// Bir botun tek turu: kullanıcının yazdığı + ajanın ürettikleri.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Turn {
    job_id: String,
    /// Kullanıcının yazdığı metin — kalıcı yönerge ayıklanmış hâli.
    prompt: String,
    meta: JobMeta,
    events: Vec<Event>,
}

/// `agent_run`'a giden prompt: kalıcı yönerge + ayraç + kullanıcı metni.
fn prompt_birlestir(preamble: &str, text: &str) -> String {
    let p = preamble.trim();
    if p.is_empty() {
        text.to_string()
    } else {
        format!("{p}\n\n---\n\n{text}")
    }
}

/// Geçmişi gösterirken kalıcı yönergeyi geri ayıklar — kullanıcı kendi
/// yazdığını görsün, her turda tekrarlanan yönergeyi değil.
fn prompt_ayikla(preamble: &str, full: &str) -> String {
    let p = preamble.trim();
    if p.is_empty() {
        return full.to_string();
    }
    let onek = format!("{p}\n\n---\n\n");
    full.strip_prefix(&onek).unwrap_or(full).to_string()
}

/// Botun tüm turlarını diskten kurar. Sohbet geçmişi bots.json'da değil,
/// `jobs/<id>/` altında yaşıyor — tek doğru kaynak orası.
#[tauri::command]
fn bot_history(id: String) -> Result<Vec<Turn>, BotError> {
    let bot = bots::get(&id)?;
    Ok(bot
        .jobs
        .iter()
        .map(|job_id| {
            let (meta, events) = jobs::replay(job_id);
            let prompt = meta
                .prompt
                .as_deref()
                .map(|p| prompt_ayikla(&bot.preamble, p))
                .unwrap_or_default();
            Turn {
                job_id: job_id.clone(),
                prompt,
                meta,
                events,
            }
        })
        .collect())
}

/// Kenar çubuğu satırının ihtiyacı: son koşumun durumu ve son çıktı satırı.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BotSummary {
    id: String,
    job_id: Option<String>,
    status: Option<String>,
    /// Ajanın son söylediği satır — artboard'daki alt metin.
    line: Option<String>,
    at: Option<f64>,
    running: bool,
}

/// Her bot için son koşumun özeti. Tüm `out.log`'lar okunmaz; yalnızca
/// son koşumun kuyruğu.
#[tauri::command]
fn bot_summaries() -> Result<Vec<BotSummary>, BotError> {
    Ok(bots::list()?
        .into_iter()
        .map(|b| {
            let son = b.jobs.last().cloned();
            let meta = son.as_deref().and_then(jobs::read_meta);
            let running = meta.as_ref().map(|m| !m.bitti()).unwrap_or(false);
            BotSummary {
                id: b.id,
                line: son.as_deref().and_then(jobs::last_line),
                at: meta
                    .as_ref()
                    .and_then(|m| m.finished_at.or(m.started_at))
                    .or(Some(b.updated_at as f64)),
                status: meta.and_then(|m| m.status),
                job_id: son,
                running,
            }
        })
        .collect())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Started {
    job_id: String,
}

/// Bota mesaj gönderir: `agent_run` → iş kimliği → dosyadan canlı izleme.
#[tauri::command]
async fn send_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, McpState>,
    watchers: tauri::State<'_, Watchers>,
    id: String,
    text: String,
) -> Result<Started, ConnError> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err(ConnError::Protocol("Boş mesaj gönderilmez.".into()));
    }
    let bot = bots::get(&id).map_err(|e| ConnError::Protocol(e.to_string()))?;

    let job_id = state
        .agent_run(AgentRunRequest {
            prompt: prompt_birlestir(&bot.preamble, &text),
            agent: bot.agent.clone(),
            model: bot.model.clone(),
            effort: bot.effort.clone(),
            workdir: bot.workdir.clone(),
            resume_session: bot.session_id.clone(),
            timeout: bot.timeout,
        })
        .await?;

    bots::record_job(&id, &job_id).map_err(|e| ConnError::Protocol(e.to_string()))?;
    watchers.watch(app, job_id.clone(), id).await;
    Ok(Started { job_id })
}

#[tauri::command]
async fn cancel_job(
    state: tauri::State<'_, McpState>,
    job_id: String,
) -> Result<String, ConnError> {
    state.job_cancel(job_id).await
}

/// Uygulama açılışında yarım kalmış işleri yeniden izlemeye alır.
#[tauri::command]
async fn resume_watches(
    app: tauri::AppHandle,
    watchers: tauri::State<'_, Watchers>,
) -> Result<Vec<String>, BotError> {
    let mut devam = Vec::new();
    for bot in bots::list()? {
        for job_id in &bot.jobs {
            let bitti = jobs::read_meta(job_id).map(|m| m.bitti()).unwrap_or(true);
            if !bitti {
                watchers
                    .watch(app.clone(), job_id.clone(), bot.id.clone())
                    .await;
                devam.push(job_id.clone());
            }
        }
    }
    Ok(devam)
}

// ───────────────────────── terminaller ─────────────────────────

/// Kenar çubuğu listesi: makinedeki tüm oturumlar + hangileri burada açık.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalsView {
    sessions: Vec<TmuxSession>,
    /// Bu uygulamada bölmesi açık olanlar.
    open_here: Vec<String>,
    /// Ayrıştırıcı tabloyu okuyamadıysa ham metin.
    raw: Option<String>,
}

#[tauri::command]
async fn terminals(
    state: tauri::State<'_, McpState>,
    ptys: tauri::State<'_, Ptys>,
) -> Result<TerminalsView, ConnError> {
    let text = state.tmux_list().await?;
    let mut sessions = pty::parse_tmux_list(&text);
    let open_here = ptys.acik_olanlar().await;

    // "PC'de de açık" yalnızca BİZDEN BAŞKASI da bağlıysa doğrudur.
    let counts = pty::attached_counts();
    for s in &mut sessions {
        let bizim = if open_here.iter().any(|n| n == &s.name) { 1 } else { 0 };
        s.attached = counts.get(&s.name).copied().unwrap_or(0) > bizim;
    }

    Ok(TerminalsView {
        raw: if sessions.is_empty() && !text.contains("oturum yok") {
            Some(text)
        } else {
            None
        },
        sessions,
        open_here,
    })
}

/// Bölmeyi açar: `tmux new-session -A -s <ad>` — varsa bağlanır, yoksa yaratır.
#[tauri::command]
async fn pty_open(
    app: tauri::AppHandle,
    ptys: tauri::State<'_, Ptys>,
    session: String,
    cols: u16,
    rows: u16,
    workdir: Option<String>,
) -> Result<(), PtyError> {
    ptys.open(app, session, cols, rows, workdir).await
}

#[tauri::command]
async fn pty_write(
    ptys: tauri::State<'_, Ptys>,
    session: String,
    data: String,
) -> Result<(), PtyError> {
    ptys.write(&session, &data).await
}

#[tauri::command]
async fn pty_resize(
    ptys: tauri::State<'_, Ptys>,
    session: String,
    cols: u16,
    rows: u16,
) -> Result<(), PtyError> {
    ptys.resize(&session, cols, rows).await
}

/// Bölmeyi kapatır. **Oturum yaşamaya devam eder.**
#[tauri::command]
async fn pty_close(ptys: tauri::State<'_, Ptys>, session: String) -> Result<(), PtyError> {
    ptys.close(&session).await;
    Ok(())
}

/// Oturumu **sonlandırır** — bölme kapatmaktan ayrı, geri dönüşü yok.
#[tauri::command]
async fn tmux_kill(
    state: tauri::State<'_, McpState>,
    ptys: tauri::State<'_, Ptys>,
    session: String,
) -> Result<String, ConnError> {
    ptys.close(&session).await;
    state.tmux_kill(session).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(McpState::default())
        .manage(Watchers::default())
        .manage(Ptys::default())
        .invoke_handler(tauri::generate_handler![
            endpoint,
            has_token,
            connect,
            refresh,
            sign_out,
            list_bots,
            create_bot,
            update_bot,
            delete_bot,
            suggest_avatar,
            bot_history,
            bot_summaries,
            send_message,
            cancel_job,
            resume_watches,
            terminals,
            pty_open,
            pty_write,
            pty_resize,
            pty_close,
            tmux_kill,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması çalıştırılamadı");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_birlestirilip_geri_ayiklanir() {
        let pre = "Türkçe cevap ver.";
        let full = prompt_birlestir(pre, "merhaba");
        assert_eq!(full, "Türkçe cevap ver.\n\n---\n\nmerhaba");
        assert_eq!(prompt_ayikla(pre, &full), "merhaba");
    }

    #[test]
    fn yonerge_yoksa_prompt_degismez() {
        assert_eq!(prompt_birlestir("  ", "merhaba"), "merhaba");
        assert_eq!(prompt_ayikla("", "merhaba"), "merhaba");
    }

    #[test]
    fn onek_tutmuyorsa_prompt_bozulmaz() {
        // Yönerge sonradan değiştiyse eski turun metni olduğu gibi kalmalı.
        assert_eq!(prompt_ayikla("yeni yönerge", "eski tam metin"), "eski tam metin");
    }
}
