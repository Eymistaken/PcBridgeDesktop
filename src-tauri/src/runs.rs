//! Uygulamanın kendi koşumlarının diskteki kaydı — `jobs.rs`'in ikizi.
//!
//! `$XDG_STATE_HOME/pcbridge-desktop/runs/<id>/` altında:
//!   `meta.json`     durum, prompt, model, exit_code — `JobMeta` ile aynı şekil
//!   `events.jsonl`  satır başına bir `Event`
//!
//! **Neden ayrı bir dizin:** pcbridge'in `jobs/` dizini sunucunun; oraya biz
//! yazmayız. Yerel koşumun `out.log`'u da yok — ajanın ham çıktısı değil,
//! zaten olaylara çevrilmiş hâli saklanıyor.
//!
//! Yönlendirme **koşum kimliğinin önekiyle** yapılıyor, botun arka ucuyla
//! değil: kullanıcı botun arka ucunu sonradan değiştirse bile eski geçmiş
//! doğru yerden okunur.

use std::io::Write;
use std::path::{Path, PathBuf};

use crate::jobs::JobMeta;
use crate::parse::Event;

/// Yerel koşumların kimlik öneki. `jobs.rs` bunu hiç görmez.
pub const ONEK: &str = "local-";

/// Bu kimlik bizim mi, pcbridge'in mi?
pub fn bizim(job_id: &str) -> bool {
    job_id.starts_with(ONEK)
}

pub fn runs_dir() -> PathBuf {
    std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/state")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pcbridge-desktop/runs")
}

/// `local-<epoch ms hex>-<6 hex>`. `bots::yeni_id` ile aynı mantık: zaman
/// damgası sıralanabilirliği, karma çakışmazlığı verir.
pub fn yeni_id() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let ns = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut h = DefaultHasher::new();
    ns.hash(&mut h);
    std::process::id().hash(&mut h);
    format!("{ONEK}{:011x}-{:06x}", ns / 1_000_000, h.finish() & 0xff_ffff)
}

pub fn simdi() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

// ─────────────────────────── meta ───────────────────────────

pub fn read_meta(id: &str) -> Option<JobMeta> {
    read_meta_in(&runs_dir(), id)
}

fn read_meta_in(kok: &Path, id: &str) -> Option<JobMeta> {
    let text = std::fs::read_to_string(kok.join(id).join("meta.json")).ok()?;
    // `JobMeta` yalnızca `Serialize`; okurken `jobs::read_meta` gibi elle
    // ayrıştırıyoruz ki bilinmeyen alan sorun çıkarmasın.
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    let s = |k: &str| v.get(k).and_then(|x| x.as_str()).map(str::to_string);
    Some(JobMeta {
        id: s("id").unwrap_or_else(|| id.to_string()),
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

/// Diskteki `meta.json` biçimi **snake_case**'tir — pcbridge'in yazdığıyla
/// aynı. `JobMeta`'nın kendi `Serialize`'ı camelCase çünkü o arayüze giden
/// tel biçimi (`job://status`); ikisi karıştırılırsa `exit_code` yazılıp
/// `exitCode` aranır ve koşum sonsuza kadar "sürüyor" görünür.
fn meta_json(m: &JobMeta) -> serde_json::Value {
    let s = |v: &Option<String>| {
        v.clone()
            .map(serde_json::Value::from)
            .unwrap_or(serde_json::Value::Null)
    };
    serde_json::json!({
        "id": m.id,
        "kind": s(&m.kind),
        "label": s(&m.label),
        "cwd": s(&m.cwd),
        "parser": s(&m.parser),
        "status": s(&m.status),
        "exit_code": m.exit_code,
        "started_at": m.started_at,
        "finished_at": m.finished_at,
        "agent": s(&m.agent),
        "prompt": s(&m.prompt),
        "resume_session": s(&m.resume_session),
    })
}

/// Atomik yazma — `bots::write_store` deseni. Koşum sürerken uygulama
/// çökerse `meta.json` yarım kalmaz.
pub fn write_meta(meta: &JobMeta) -> std::io::Result<()> {
    write_meta_in(&runs_dir(), meta)
}

fn write_meta_in(kok: &Path, meta: &JobMeta) -> std::io::Result<()> {
    let dir = kok.join(&meta.id);
    std::fs::create_dir_all(&dir)?;
    let text = serde_json::to_string_pretty(&meta_json(meta))
        .map_err(|e| std::io::Error::other(e.to_string()))?;
    let tmp = dir.join("meta.json.tmp");
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(text.as_bytes())?;
        f.sync_all()?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        // Prompt kişisel olabilir.
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp, dir.join("meta.json"))
}

/// Koşumu bitmiş olarak işaretler. `exit_code` arayüzün "durduruldu" ile
/// "başarısız"ı ayırmasını sağlıyor (`Chat.tsx::durduruldu`): 130 SIGINT
/// karşılığı, kullanıcının bilerek kestiği şey hata değildir.
pub fn kapat(id: &str, status: &str, exit_code: i64) {
    kapat_in(&runs_dir(), id, status, exit_code)
}

fn kapat_in(kok: &Path, id: &str, status: &str, exit_code: i64) {
    if let Some(mut m) = read_meta_in(kok, id) {
        if m.bitti() {
            return; // zaten kapanmış; ikinci kez yazmıyoruz
        }
        m.status = Some(status.to_string());
        m.exit_code = Some(exit_code);
        m.finished_at = Some(simdi());
        let _ = write_meta_in(kok, &m);
    }
}

// ─────────────────────────── olaylar ───────────────────────────

fn events_path(kok: &Path, id: &str) -> PathBuf {
    kok.join(id).join("events.jsonl")
}

/// Olayları dosyanın sonuna ekler. Her olay tek satır: yarım yazılmış bir
/// satır okunurken atlanır, dosyanın geri kalanı sağlam kalır.
pub fn append(id: &str, events: &[Event]) {
    append_in(&runs_dir(), id, events)
}

fn append_in(kok: &Path, id: &str, events: &[Event]) {
    if events.is_empty() {
        return;
    }
    let dir = kok.join(id);
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let mut govde = String::new();
    for e in events {
        match serde_json::to_string(e) {
            Ok(s) => {
                govde.push_str(&s);
                govde.push('\n');
            }
            Err(_) => continue,
        }
    }
    let ac = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(events_path(kok, id));
    if let Ok(mut f) = ac {
        let _ = f.write_all(govde.as_bytes());
    }
}

/// Koşumu baştan sona okur — geçmiş bundan kurulur.
pub fn replay(id: &str) -> (JobMeta, Vec<Event>) {
    replay_in(&runs_dir(), id)
}

fn replay_in(kok: &Path, id: &str) -> (JobMeta, Vec<Event>) {
    let meta = read_meta_in(kok, id).unwrap_or(JobMeta {
        id: id.to_string(),
        ..Default::default()
    });
    (meta, events_in(kok, id))
}

fn events_in(kok: &Path, id: &str) -> Vec<Event> {
    let Ok(text) = std::fs::read_to_string(events_path(kok, id)) else {
        return Vec::new();
    };
    text.lines()
        .filter(|l| !l.trim().is_empty())
        // Bozuk satır atlanır: yarım yazılmış son satır koşumun tamamını
        // okunamaz yapmamalı.
        .filter_map(|l| serde_json::from_str::<Event>(l).ok())
        .collect()
}

// ─────────────────────── modelin belleği ───────────────────────
//
// `events.jsonl` **arayüzün** gördüğü; `messages.jsonl` **modelin** gördüğü.
// İkisi ayrı çünkü olaylar sunum için kırpılmış (araç ayrıntısı tek satır,
// sonuç yalnızca ok/fail) — o hâliyle modele geri verilemez.

fn messages_path(kok: &Path, id: &str) -> PathBuf {
    kok.join(id).join("messages.jsonl")
}

pub fn append_messages(id: &str, msgs: &[crate::model::Message]) {
    append_messages_in(&runs_dir(), id, msgs)
}

pub(crate) fn append_messages_in(kok: &Path, id: &str, msgs: &[crate::model::Message]) {
    if msgs.is_empty() {
        return;
    }
    if std::fs::create_dir_all(kok.join(id)).is_err() {
        return;
    }
    let mut govde = String::new();
    for m in msgs {
        if let Ok(s) = serde_json::to_string(m) {
            govde.push_str(&s);
            govde.push('\n');
        }
    }
    let ac = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(messages_path(kok, id));
    if let Ok(mut f) = ac {
        let _ = f.write_all(govde.as_bytes());
    }
}

pub fn messages(id: &str) -> Vec<crate::model::Message> {
    messages_in(&runs_dir(), id)
}

pub(crate) fn messages_in(kok: &Path, id: &str) -> Vec<crate::model::Message> {
    let Ok(text) = std::fs::read_to_string(messages_path(kok, id)) else {
        return Vec::new();
    };
    text.lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect()
}

/// Koşumun bağlam defteri.
///
/// `prompt_tokens` sunucunun **ölçtüğü** sayı (`stream_options.include_usage`),
/// tahmin değil; özetleme eşiği buna bakıyor. `summary` doluysa bu koşum bir
/// **denetim noktası**: kendisinden önceki bütün koşumların mesajları yerine
/// o özet geçer.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCtx {
    #[serde(default)]
    pub prompt_tokens: u64,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub dropped: u32,
}

fn ctx_path(kok: &Path, id: &str) -> PathBuf {
    kok.join(id).join("ctx.json")
}

pub(crate) fn read_ctx_in(kok: &Path, id: &str) -> RunCtx {
    std::fs::read_to_string(ctx_path(kok, id))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

/// Yalnızca ölçülen token sayısını günceller, `summary`/`dropped`'a dokunmaz.
///
/// **Bu ayrım bir hatayı kapatıyor.** `write_ctx` dosyanın tamamını
/// değiştiriyor; tur döngüsü koşumun sonunda `summary: None` taşıyan bir
/// `RunCtx` yazınca, aynı koşumun başında konmuş **özet denetim noktası**
/// siliniyordu. Sonraki koşum geçmişin tamamını yeniden yükler, eşik yine
/// aşılır ve özetleme her seferinde bir model turu harcayarak yeniden çalışır.
/// İki yazıcı ayrı olunca üzerine yazmak yapısal olarak imkânsız.
pub fn write_ctx_tokens(id: &str, prompt_tokens: u64) {
    write_ctx_tokens_in(&runs_dir(), id, prompt_tokens)
}

pub(crate) fn write_ctx_tokens_in(kok: &Path, id: &str, prompt_tokens: u64) {
    let mut ctx = read_ctx_in(kok, id);
    ctx.prompt_tokens = prompt_tokens;
    write_ctx_in(kok, id, &ctx);
}

/// Yalnızca denetim noktasını yazar, ölçülen token sayısına dokunmaz.
///
/// Hedef **özetin kapsamadığı en eski koşum**: `gecmis` denetim noktasını
/// bulduğu koşumdan itibaren mesajları taşıyor, yani korunan pencere ancak
/// işaret o pencerenin başındaysa geri gelir.
pub fn write_ctx_summary(id: &str, summary: Option<String>, dropped: u32) {
    write_ctx_summary_in(&runs_dir(), id, summary, dropped)
}

pub(crate) fn write_ctx_summary_in(kok: &Path, id: &str, summary: Option<String>, dropped: u32) {
    let mut ctx = read_ctx_in(kok, id);
    ctx.summary = summary;
    ctx.dropped = dropped;
    write_ctx_in(kok, id, &ctx);
}

pub(crate) fn write_ctx_in(kok: &Path, id: &str, ctx: &RunCtx) {
    if std::fs::create_dir_all(kok.join(id)).is_err() {
        return;
    }
    if let Ok(s) = serde_json::to_string_pretty(ctx) {
        let _ = std::fs::write(ctx_path(kok, id), s);
    }
}

/// Kenar çubuğundaki özet satırı — `jobs::last_line`'ın karşılığı.
pub fn last_line(id: &str) -> Option<String> {
    last_line_in(&runs_dir(), id)
}

fn last_line_in(kok: &Path, id: &str) -> Option<String> {
    let evs = events_in(kok, id);

    // **Tek bir olaya bakmak yetmez.** Döngü metni token token yayıyor;
    // sondaki olay çoğu zaman "." gibi tek bir parça oluyor ve kenar
    // çubuğunda o görünüyordu. Sondan geriye doğru **ardışık** metin
    // olayları birleştirilip son mesajın tamamı kuruluyor.
    let mut son = String::new();
    for e in evs.iter().rev() {
        match e {
            Event::Text { text, .. } => son.insert_str(0, text),
            // Bitiş ve özet metin dizisini bölmez; araç çağrısı ya da
            // düşünme bölerse orada duruyoruz.
            Event::Finished { .. } | Event::Summary { .. } => continue,
            _ if son.is_empty() => continue,
            _ => break,
        }
    }

    let satir = son.lines().map(str::trim).find(|l| !l.is_empty())?;
    let kirpik: String = satir.chars().take(90).collect();
    Some(if satir.chars().count() > 90 {
        format!("{kirpik}…")
    } else {
        kirpik
    })
}

/// Açılışta yarım kalmış koşumları kapatır.
///
/// Yerel koşum **devam ettirilemez**: süreç öldüğünde modelle kurulan tur
/// bellekteydi. Kabul edilen bedelin ("uygulama kapanınca iş ölür") diskteki
/// dürüst kaydı bu. Kimlikler `bots.json`'dan geliyor; `runs/` dizini
/// taranmıyor çünkü sahipsiz bir dizin bir bota ait değildir.
pub fn kapanista_temizle(ids: &[String]) -> Vec<String> {
    kapanista_temizle_in(&runs_dir(), ids)
}

fn kapanista_temizle_in(kok: &Path, ids: &[String]) -> Vec<String> {
    let mut kapatilan = Vec::new();
    for id in ids.iter().filter(|i| bizim(i)) {
        if let Some(m) = read_meta_in(kok, id) {
            if !m.bitti() {
                append_in(
                    kok,
                    id,
                    &[Event::Finished {
                        ok: false,
                        turns: None,
                        duration_ms: None,
                        cost_usd: None,
                        error: Some("#appClosed".into()),
                    }],
                );
                kapat_in(kok, id, "failed", -1);
                kapatilan.push(id.clone());
            }
        }
    }
    kapatilan
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Her test kendi kökünü alıyor. `XDG_STATE_HOME` **değiştirilmiyor**:
    /// o süreç geneli ve `jobs.rs`'in gerçek diski okuyan testiyle çakışırdı.
    fn kok(ad: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("pcbd-{ad}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn kimlik_oneki_yonlendirmeyi_belirler() {
        assert!(bizim(&yeni_id()), "üretilen kimlik `local-` önekli olmalı");
        // pcbridge biçimi: %Y%m%d-%H%M%S-<6 hex>
        assert!(!bizim("20260902-231500-a1b2c3"));
        assert!(!bizim(""));
    }

    #[test]
    fn olaylar_birikir_meta_okunur() {
        let k = kok("olaylar");
        let id = yeni_id();

        write_meta_in(
            &k,
            &JobMeta {
                id: id.clone(),
                status: Some("running".into()),
                prompt: Some("selam".into()),
                started_at: Some(simdi()),
                ..Default::default()
            },
        )
        .unwrap();

        append_in(
            &k,
            &id,
            &[
                Event::Text { text: "ilk satır".into(), delta: true },
                Event::ToolStart {
                    id: "t1".into(),
                    tool: "fs_list".into(),
                    detail: "/tmp".into(),
                },
                Event::ToolEnd { id: "t1".into(), ok: true },
            ],
        );
        append_in(&k, &id, &[Event::Text { text: "son satır".into(), delta: true }]);

        let (m, evs) = replay_in(&k, &id);
        assert_eq!(m.status.as_deref(), Some("running"));
        assert_eq!(m.prompt.as_deref(), Some("selam"));
        assert_eq!(evs.len(), 4, "iki ayrı yazımdan da birikmeli");
        assert_eq!(last_line_in(&k, &id).as_deref(), Some("son satır"));

        let _ = std::fs::remove_dir_all(&k);
    }

    #[test]
    fn yarim_kalan_kosum_acilista_kapatilir() {
        let k = kok("kapanis");
        let id = yeni_id();
        write_meta_in(
            &k,
            &JobMeta {
                id: id.clone(),
                status: Some("running".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(kapanista_temizle_in(&k, std::slice::from_ref(&id)), vec![id.clone()]);

        let (m, evs) = replay_in(&k, &id);
        assert!(m.bitti(), "kapatılan koşum bitmiş sayılmalı");
        assert_eq!(m.exit_code, Some(-1));
        assert!(matches!(
            evs.last(),
            Some(Event::Finished { ok: false, error: Some(e), .. }) if e == "#appClosed"
        ));

        // İkinci çağrı bir şey yapmamalı — koşum zaten kapalı.
        assert!(kapanista_temizle_in(&k, std::slice::from_ref(&id)).is_empty());

        // pcbridge kimliği hiç ellenmez.
        assert!(kapanista_temizle_in(&k, &["20260902-231500-a1b2c3".to_string()]).is_empty());

        let _ = std::fs::remove_dir_all(&k);
    }

    #[test]
    fn bozuk_satir_atlanir_gerisi_okunur() {
        let k = kok("bozuk");
        std::fs::create_dir_all(k.join("local-x")).unwrap();
        std::fs::write(
            k.join("local-x/events.jsonl"),
            "{\"kind\":\"text\",\"text\":\"bir\"}\n{yarım\n{\"kind\":\"text\",\"text\":\"iki\"}\n",
        )
        .unwrap();

        let evs = events_in(&k, "local-x");
        assert_eq!(evs.len(), 2, "bozuk satır atlanmalı, gerisi okunmalı");

        let _ = std::fs::remove_dir_all(&k);
    }

    #[test]
    fn meta_diske_snake_case_yazilir() {
        // Bu testin varlık sebebi: `JobMeta`'nın camelCase `Serialize`'ı
        // diske yazılırsa `exit_code` bir daha okunamaz.
        let k = kok("meta");
        let m = JobMeta {
            id: "local-abc".into(),
            status: Some("finished".into()),
            exit_code: Some(0),
            started_at: Some(1.5),
            ..Default::default()
        };
        write_meta_in(&k, &m).unwrap();

        let ham = std::fs::read_to_string(k.join("local-abc/meta.json")).unwrap();
        assert!(ham.contains("\"exit_code\""), "diskte snake_case olmalı: {ham}");
        assert!(!ham.contains("exitCode"), "camelCase diske sızmamalı: {ham}");

        let geri = read_meta_in(&k, "local-abc").unwrap();
        assert_eq!(geri.exit_code, Some(0));
        assert_eq!(geri.status.as_deref(), Some("finished"));
        assert_eq!(geri.started_at, Some(1.5));

        let _ = std::fs::remove_dir_all(&k);
    }

    #[test]
    fn ozet_olayi_gidip_geliyor() {
        // `Summary` yalnızca bu döngünün ürettiği varyant; JSON'a yazılıp
        // geri okunabildiği sabitlenir — geçmiş buna dayanıyor.
        let e = Event::Summary {
            text: "önceki turlar".into(),
            dropped: 7,
        };
        let j = serde_json::to_string(&e).unwrap();
        assert!(j.contains("\"kind\":\"summary\""), "{j}");
        assert_eq!(serde_json::from_str::<Event>(&j).unwrap(), e);
    }

    /// **İki yazıcı birbirinin üstüne yazmaz.**
    ///
    /// Bu ayrım bir hatayı kapatıyor: tek bir `write_ctx` hem token'ı hem
    /// özeti taşıyordu ve tur döngüsü koşumun sonunda `summary: None` yazınca
    /// aynı koşumun başında konmuş denetim noktası siliniyordu. Sonraki koşum
    /// geçmişin tamamını yeniden yükler, eşik yine aşılır ve özetleme her
    /// koşumda bir model turu harcayarak yeniden çalışırdı.
    #[test]
    fn ctx_yazicilari_birbirinin_ustune_yazmaz() {
        let k = std::env::temp_dir().join(format!("pcbd-ctx-yaz-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&k);
        std::fs::create_dir_all(&k).unwrap();

        // Önce işaret, sonra token: işaret durmalı.
        write_ctx_summary_in(&k, "local-a", Some("önceki konuşmanın özeti".into()), 4);
        write_ctx_tokens_in(&k, "local-a", 5000);
        let c = read_ctx_in(&k, "local-a");
        assert_eq!(c.prompt_tokens, 5000);
        assert_eq!(c.summary.as_deref(), Some("önceki konuşmanın özeti"));
        assert_eq!(c.dropped, 4);

        // Ters sıra da bozmamalı: token, sonra işaret.
        write_ctx_tokens_in(&k, "local-b", 1234);
        write_ctx_summary_in(&k, "local-b", Some("özet".into()), 2);
        let c = read_ctx_in(&k, "local-b");
        assert_eq!(c.prompt_tokens, 1234, "işaret yazması token'ı sıfırlamamalı");
        assert_eq!(c.summary.as_deref(), Some("özet"));

        let _ = std::fs::remove_dir_all(&k);
    }
}
