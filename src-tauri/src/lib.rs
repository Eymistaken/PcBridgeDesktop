mod agent;
mod bots;
mod desktop;
mod jobs;
mod mcp;
mod model;
mod parse;
mod pty;
mod runs;
mod secrets;
mod tools;

use agent::Runs;
use bots::{Backend, Bot, BotDraft, BotError};
use desktop::{AuditRow, DesktopState};
use jobs::{JobMeta, Watchers};
use mcp::{AgentRunRequest, ConnError, ConnSnapshot, McpState, Shots, ToolDef};
use model::{ModelConfig, ModelError, ModelInfo};
use parse::Event;
use pty::{PtyError, Ptys, TmuxSession};
use serde::Serialize;
use std::sync::Arc;

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
    state: tauri::State<'_, Arc<McpState>>,
    token: Option<String>,
) -> Result<ConnSnapshot, ConnError> {
    state.connect(token).await
}

#[tauri::command]
async fn refresh(state: tauri::State<'_, Arc<McpState>>) -> Result<ConnSnapshot, ConnError> {
    state.refresh().await
}

#[tauri::command]
async fn sign_out(state: tauri::State<'_, Arc<McpState>>) -> Result<(), ConnError> {
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
            // Yönlendirme **önekle**, botun arka ucuyla değil: kullanıcı
            // arka ucu sonradan değiştirse bile eski geçmiş doğru okunur.
            let (meta, events) = if runs::bizim(job_id) {
                runs::replay(job_id)
            } else {
                jobs::replay(job_id)
            };
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
            let yerel = son.as_deref().map(runs::bizim).unwrap_or(false);
            let meta = son
                .as_deref()
                .and_then(|j| if yerel { runs::read_meta(j) } else { jobs::read_meta(j) });
            let running = meta.as_ref().map(|m| !m.bitti()).unwrap_or(false);
            BotSummary {
                id: b.id,
                line: son
                    .as_deref()
                    .and_then(|j| if yerel { runs::last_line(j) } else { jobs::last_line(j) }),
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

/// Botun son yerel koşumundan bağlam defteri — besteci altındaki bar bunu
/// gösteriyor.
///
/// **Yalnızca yerel koşumların `ctx`'i var** (`runs::bizim`): `agent_run`
/// yolunda koşumu pcbridge yürütüyor ve `usage` bize hiç gelmiyor. O botlarda
/// bar çizilmiyor, uydurma bir sayı gösterilmiyor.
#[tauri::command]
fn bot_ctx(id: String) -> Result<Option<runs::RunCtx>, BotError> {
    let bot = bots::get(&id)?;
    Ok(bot
        .jobs
        .iter()
        .rev()
        .find(|j| runs::bizim(j))
        .map(|j| runs::read_ctx(j)))
}

/// Kullanıcının açıkça istediği özetleme.
///
/// Otomatik yoldan iki farkı var. **Kazanç tabanı uygulanmıyor:** taban,
/// hiçbir şey kazandırmayan bir özetlemenin kendiliğinden çalışmasını
/// engellemek için var; kullanıcı düğmeye bastıysa karar onun. Ama düşecek
/// mesaj yoksa yine reddediliyor ve nedeni söyleniyor — sessizce hiçbir şey
/// yapmayan bir düğme daha kötü olurdu.
///
/// **Koşum sürerken çağrılmamalı:** akıştaki mesaj listesi o sırada diskle
/// aynı değil. Arayüz düğmeyi kapatıyor, burada da kontrol ediliyor.
#[tauri::command]
async fn compact_bot(
    runs_state: tauri::State<'_, Arc<Runs>>,
    id: String,
) -> Result<u32, BotError> {
    let bot = bots::get(&id)?;
    if bot.jobs.iter().any(|j| runs_state.suruyor_mu(j)) {
        return Err(BotError::Gecersiz("#compactWhileRunning".into()));
    }
    agent::elle_ozetle(&bot)
        .await
        .map_err(|e| BotError::Gecersiz(e.to_string()))
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
    state: tauri::State<'_, Arc<McpState>>,
    watchers: tauri::State<'_, Watchers>,
    runs_state: tauri::State<'_, Arc<Runs>>,
    id: String,
    text: String,
) -> Result<Started, ConnError> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err(ConnError::Protocol("#emptyMessage".into()));
    }
    let bot = bots::get(&id).map_err(|e| ConnError::Protocol(e.to_string()))?;

    // Yerel yolda koşum uygulamanın içinde dönüyor: pcbridge'e yalnızca
    // araç çağrıları için gidiliyor, `agent_run` hiç çağrılmıyor.
    if bot.backend == Backend::YerelModel {
        let job_id = agent::baslat(
            app,
            state.inner().clone(),
            runs_state.inner().clone(),
            bot,
            text,
        )
        .await?;
        return Ok(Started { job_id });
    }

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
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<McpState>>,
    runs_state: tauri::State<'_, Arc<Runs>>,
    bot_id: String,
    job_id: String,
) -> Result<String, ConnError> {
    if runs::bizim(&job_id) {
        return Ok(if runs_state.cancel(&app, &job_id, &bot_id).await {
            "#runCancelled".into()
        } else {
            // Koşum zaten bitmişti; kullanıcıya yalan söylemiyoruz.
            "#runNotRunning".into()
        });
    }
    state.job_cancel(job_id).await
}

/// Bekleyen bir izin isteğine kullanıcının yanıtı.
///
/// `false` dönmesi hata değil: istek bu arada düşmüş olabilir (koşum bitti,
/// durduruldu, uygulama kapanıyor). Arayüz kartı öylece kaldırır.
#[tauri::command]
async fn answer_permission(
    runs_state: tauri::State<'_, Arc<Runs>>,
    run_id: String,
    allow: bool,
) -> Result<bool, ConnError> {
    Ok(runs_state.izni_yanitla(&run_id, allow))
}

/// Yanıt bekleyen izin istekleri.
///
/// Arayüz yeniden kurulunca (kip değişimi, HMR) yayınlanmış olayı kaçırır;
/// sorulan şey ekrandan silinip koşum sessizce beklerdi.
#[tauri::command]
async fn pending_permissions(
    runs_state: tauri::State<'_, Arc<Runs>>,
) -> Result<Vec<agent::BekleyenIzin>, ConnError> {
    Ok(runs_state.bekleyen_izinler())
}

/// Uygulama açılışında yarım kalmış işleri yeniden izlemeye alır.
#[tauri::command]
async fn resume_watches(
    app: tauri::AppHandle,
    watchers: tauri::State<'_, Watchers>,
) -> Result<Vec<String>, BotError> {
    let mut devam = Vec::new();
    for bot in bots::list()? {
        // Yerel koşum **devam ettirilemez**: süreç öldüğünde modelle kurulan
        // tur bellekteydi. Kabul edilen bedelin diskteki dürüst kaydı bu —
        // yarım koşum `#appClosed` ile kapatılır, sonsuza kadar "sürüyor"
        // görünmez.
        runs::kapanista_temizle(&bot.jobs);

        for job_id in bot.jobs.iter().filter(|j| !runs::bizim(j)) {
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

// ───────────────────────── model sunucusu ─────────────────────────

/// Kayıtlı adres. Anahtarın **kendisi değil**, yalnızca var olup olmadığı
/// dönüyor — sır arayüze hiç çıkmıyor.
#[tauri::command]
fn model_config() -> ModelConfig {
    model::read_config()
}

/// Adresi (ve verilmişse anahtarı) kaydeder. `key: Some("")` anahtarı siler,
/// `None` ise anahtara dokunmaz.
#[tauri::command]
async fn save_model_config(
    base_url: String,
    key: Option<String>,
) -> Result<ModelConfig, ModelError> {
    model::save_config(base_url, key).await
}

/// `GET /v1/models`. Bağlantıyı denemenin de yolu bu: liste geldiyse sunucu
/// ayakta ve anahtar geçerli demektir.
#[tauri::command]
async fn model_models(base_url: Option<String>) -> Result<Vec<ModelInfo>, ModelError> {
    let adres = match base_url {
        Some(u) if !u.trim().is_empty() => u.trim().trim_end_matches('/').to_string(),
        _ => model::read_config().base_url,
    };
    model::models(&adres).await
}

/// Araçların adı, açıklaması ve şeması — BotForge'daki filtre bunu listeliyor.
#[tauri::command]
async fn mcp_tools(state: tauri::State<'_, Arc<McpState>>) -> Result<Vec<ToolDef>, ConnError> {
    state.tools().await
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
    state: tauri::State<'_, Arc<McpState>>,
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
        // Ham metin yalnızca **ayrıştırıcı tökezlediyse** gösterilir: tablo
        // işareti var ama satır çıkmadıysa. "Acik tmux oturumu yok." bir
        // hata değil, boş durum — kenar çubuğu onu zaten kendi cümlesiyle
        // anlatıyor, altına bir de sunucunun cümlesini basmak gürültü.
        raw: if sessions.is_empty() && text.contains('|') {
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
    state: tauri::State<'_, Arc<McpState>>,
    ptys: tauri::State<'_, Ptys>,
    session: String,
) -> Result<String, ConnError> {
    ptys.close(&session).await;
    state.tmux_kill(session).await
}

// ───────────────────────── masaüstü izni ─────────────────────────

/// Geri sayımın kaynağı. **MCP'ye sorulmuyor:** izin durumu diskte
/// (`desktop_unlock.json`) ve saniyede bir dosya okumak, saniyede bir
/// ağ çağrısı yapmaktan hem ucuz hem doğru — süre kendiliğinden dolduğunda
/// sunucu kimseye haber vermiyor.
#[tauri::command]
fn desktop_state() -> DesktopState {
    desktop::read_state()
}

/// pcbridge'in denetim kaydının kuyruğu — ne yapıldığı ve neyin
/// reddedildiği. Dosyanın tamamı okunmaz.
#[tauri::command]
fn audit_tail(n: usize) -> Vec<AuditRow> {
    desktop::audit_tail(n.clamp(1, 500))
}

/// Sunucunun cevabı **ve** ondan sonraki gerçek durum. İkisi de lazım:
/// metin kayan kirayı kullanıcının diliyle anlatıyor, durum ise ölçülmüş
/// gerçek — sunucu istenen dakikayı kırpmış olabilir.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopReply {
    state: DesktopState,
    message: String,
}

/// İzni açar.
#[tauri::command]
async fn desktop_unlock(
    state: tauri::State<'_, Arc<McpState>>,
    minutes: u32,
    reason: String,
) -> Result<DesktopReply, ConnError> {
    let message = state.desktop_unlock(minutes, reason).await?;
    Ok(DesktopReply {
        state: desktop::read_state(),
        message,
    })
}

#[tauri::command]
async fn desktop_lock(state: tauri::State<'_, Arc<McpState>>) -> Result<DesktopReply, ConnError> {
    let message = state.desktop_lock().await?;
    Ok(DesktopReply {
        state: desktop::read_state(),
        message,
    })
}

#[tauri::command]
async fn system_status(state: tauri::State<'_, Arc<McpState>>) -> Result<String, ConnError> {
    state.system_status().await
}

/// Önizleme için ekran görüntüsü. `scale` en uzun kenar; tam çözünürlük
/// IPC'den geçirmek için gereksiz büyük.
#[tauri::command]
async fn screen_capture(state: tauri::State<'_, Arc<McpState>>) -> Result<Shots, ConnError> {
    state.screen_capture(1100).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(McpState::default()))
        .manage(Arc::new(Runs::default()))
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
            bot_history,
            bot_ctx,
            compact_bot,
            bot_summaries,
            send_message,
            cancel_job,
            answer_permission,
            pending_permissions,
            resume_watches,
            model_config,
            save_model_config,
            model_models,
            mcp_tools,
            terminals,
            pty_open,
            pty_write,
            pty_resize,
            pty_close,
            tmux_kill,
            desktop_state,
            desktop_unlock,
            desktop_lock,
            audit_tail,
            system_status,
            screen_capture,
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
