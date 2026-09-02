//! Bot profilleri — `~/.config/pcbridge-desktop/bots.json`.
//!
//! Bot **uygulamanın kendi JSON'unda yaşar.** pcbridge'in `config.toml`'una
//! `[agents.*]` bloğu yazma yeteneği bilinçli olarak yok.
//!
//! Sohbet geçmişi burada **tutulmaz**: her koşum zaten
//! `~/.local/state/pcbridge/jobs/<id>/` altında duruyor ve orası tek doğru
//! kaynak. Bot yalnızca kendi iş kimliklerinin listesini taşır.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Altı hazır ton. **Hex değil ad saklanır** — aynı ton koyu temada
/// `#8D73D1`, aydınlıkta `#6A4FA9`; ham hex yazılsaydı bot aydınlık temada
/// yanlış renkte çıkardı. Renk `var(--av-<ad>)` ile temadan çözülür.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Avatar {
    Mor,
    Mavi,
    Cam,
    Yesil,
    Kehribar,
    Mercan,
}

impl Avatar {
    pub const ALL: [Avatar; 6] = [
        Avatar::Mor,
        Avatar::Mavi,
        Avatar::Cam,
        Avatar::Yesil,
        Avatar::Kehribar,
        Avatar::Mercan,
    ];

    /// Yeni bot için sırayla dönen ton — hepsi aynı görünmesin.
    fn nth(i: usize) -> Avatar {
        Avatar::ALL[i % Avatar::ALL.len()]
    }
}

/// Botun koşumu **kim yürütüyor**.
///
/// `PcbridgeAgent` eski yol: pcbridge bir CLI başlatır, araçlar o CLI'nın
/// kendi MCP yapılandırmasından gelir. `YerelModel` yeni yol: döngü
/// uygulamanın içinde döner, araçları modele biz veririz.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum Backend {
    #[default]
    PcbridgeAgent,
    YerelModel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bot {
    pub id: String,
    pub name: String,
    pub avatar: Avatar,
    /// `list_agents`'tan gelen ajan kimliği. Yerel arka uçta kullanılmaz.
    pub agent: String,
    /// Koşumu kim yürütüyor. **`default` şart:** diskteki mevcut `bots.json`
    /// bu alanı taşımıyor ve olmazsa bütün botlar açılışta kaybolurdu.
    #[serde(default)]
    pub backend: Backend,
    /// Eski yolda ajanın modeli, yerel yolda `/v1/models`'ten seçilen model.
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
    pub workdir: String,
    #[serde(default)]
    pub preamble: String,
    #[serde(default)]
    pub desktop: bool,
    #[serde(default = "varsayilan_timeout")]
    pub timeout: u64,
    /// Bu botun modele gösterilen araçları. **Boş = hiçbiri.** 33 aracın
    /// tamamı küçük bir modeli boğuyor; filtre konfor değil şart.
    #[serde(default)]
    pub tools: Vec<String>,
    /// Bağlam bütçesi (token). Aşılınca geçmiş özetlenir.
    #[serde(default = "varsayilan_butce")]
    pub context_budget: u32,
    /// `resume_session` için — bot başına saklanır.
    #[serde(default)]
    pub session_id: Option<String>,
    /// Bu botun koşumları, eskiden yeniye. Geçmiş bundan kurulur.
    #[serde(default)]
    pub jobs: Vec<String>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
}

fn varsayilan_timeout() -> u64 {
    1800
}

fn varsayilan_butce() -> u32 {
    8192
}

/// Yeni bot yaratırken formdan gelen alanlar. `id`, zaman damgaları ve
/// `jobs` sunucu tarafında konur — istemci uyduramaz.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotDraft {
    pub name: String,
    pub avatar: Avatar,
    pub agent: String,
    #[serde(default)]
    pub backend: Backend,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub workdir: String,
    #[serde(default)]
    pub preamble: String,
    #[serde(default)]
    pub desktop: bool,
    #[serde(default = "varsayilan_timeout")]
    pub timeout: u64,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default = "varsayilan_butce")]
    pub context_budget: u32,
}

#[derive(Debug)]
pub enum BotError {
    Io(String),
    Bozuk(String),
    Yok(String),
    Gecersiz(String),
}

impl std::fmt::Display for BotError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BotError::Io(d) => write!(f, "#botsIo:{d}"),
            BotError::Bozuk(d) => write!(f, "#botsCorrupt:{d}"),
            BotError::Yok(id) => write!(f, "#botNotFound:{id}"),
            BotError::Gecersiz(d) => write!(f, "{d}"),
        }
    }
}

impl serde::Serialize for BotError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

fn simdi() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn config_dir() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pcbridge-desktop")
}

fn path() -> PathBuf {
    config_dir().join("bots.json")
}

#[derive(Serialize, Deserialize)]
struct Store {
    version: u32,
    bots: Vec<Bot>,
}

impl Default for Store {
    fn default() -> Self {
        Store {
            version: 1,
            bots: Vec::new(),
        }
    }
}

fn read_store() -> Result<Store, BotError> {
    let p = path();
    match fs::read_to_string(&p) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| BotError::Bozuk(e.to_string())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Store::default()),
        Err(e) => Err(BotError::Io(e.to_string())),
    }
}

/// Önce geçici dosyaya yazıp `rename` ile yerine koyar: yazma sırasında
/// çökülürse `bots.json` yarım kalmaz.
fn write_store(store: &Store) -> Result<(), BotError> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| BotError::Io(e.to_string()))?;

    let text = serde_json::to_string_pretty(store).map_err(|e| BotError::Io(e.to_string()))?;
    let tmp = dir.join("bots.json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| BotError::Io(e.to_string()))?;
        f.write_all(text.as_bytes())
            .map_err(|e| BotError::Io(e.to_string()))?;
        f.sync_all().map_err(|e| BotError::Io(e.to_string()))?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        // Kalıcı yönerge kişisel olabilir; başkasının okumasına gerek yok.
        let _ = fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600));
    }
    fs::rename(&tmp, path()).map_err(|e| BotError::Io(e.to_string()))
}

/// Yerel kimlik: zaman damgası + adın karması. Sıralanabilir ve çakışmaz.
fn yeni_id(name: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let ns = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut h = DefaultHasher::new();
    name.hash(&mut h);
    ns.hash(&mut h);
    format!("{:011x}-{:06x}", ns / 1_000_000, h.finish() & 0xff_ffff)
}

pub fn list() -> Result<Vec<Bot>, BotError> {
    Ok(read_store()?.bots)
}

pub fn create(draft: BotDraft) -> Result<Bot, BotError> {
    let mut store = read_store()?;
    let dogrulanan = dogrula(draft)?;
    let now = simdi();
    let bot = Bot {
        id: yeni_id(&dogrulanan.name),
        name: dogrulanan.name,
        avatar: dogrulanan.avatar,
        agent: dogrulanan.agent,
        backend: dogrulanan.backend,
        model: dogrulanan.model,
        effort: dogrulanan.effort,
        workdir: dogrulanan.workdir,
        preamble: dogrulanan.preamble,
        desktop: dogrulanan.desktop,
        timeout: dogrulanan.timeout,
        tools: dogrulanan.tools,
        context_budget: dogrulanan.context_budget,
        session_id: None,
        jobs: Vec::new(),
        created_at: now,
        updated_at: now,
    };
    store.bots.push(bot.clone());
    write_store(&store)?;
    Ok(bot)
}

pub fn update(id: &str, draft: BotDraft) -> Result<Bot, BotError> {
    let mut store = read_store()?;
    let d = dogrula(draft)?;
    let bot = store
        .bots
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| BotError::Yok(id.to_string()))?;

    // Ajan ya da arka uç değişirse eski oturumu sürdürmek anlamsız.
    if bot.agent != d.agent || bot.backend != d.backend {
        bot.session_id = None;
    }
    bot.name = d.name;
    bot.avatar = d.avatar;
    bot.agent = d.agent;
    bot.backend = d.backend;
    bot.model = d.model;
    bot.effort = d.effort;
    bot.workdir = d.workdir;
    bot.preamble = d.preamble;
    bot.desktop = d.desktop;
    bot.timeout = d.timeout;
    bot.tools = d.tools;
    bot.context_budget = d.context_budget;
    bot.updated_at = simdi();
    let out = bot.clone();
    write_store(&store)?;
    Ok(out)
}

pub fn delete(id: &str) -> Result<(), BotError> {
    let mut store = read_store()?;
    let onceki = store.bots.len();
    store.bots.retain(|b| b.id != id);
    if store.bots.len() == onceki {
        return Err(BotError::Yok(id.to_string()));
    }
    write_store(&store)
}

pub fn get(id: &str) -> Result<Bot, BotError> {
    read_store()?
        .bots
        .into_iter()
        .find(|b| b.id == id)
        .ok_or_else(|| BotError::Yok(id.to_string()))
}

/// Koşum başlayınca iş kimliğini ve (varsa) oturumu bota işler.
pub fn record_job(id: &str, job_id: &str) -> Result<(), BotError> {
    let mut store = read_store()?;
    let bot = store
        .bots
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| BotError::Yok(id.to_string()))?;
    if !bot.jobs.iter().any(|j| j == job_id) {
        bot.jobs.push(job_id.to_string());
    }
    bot.updated_at = simdi();
    write_store(&store)
}

pub fn set_session(id: &str, session_id: Option<String>) -> Result<(), BotError> {
    let mut store = read_store()?;
    let bot = store
        .bots
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| BotError::Yok(id.to_string()))?;
    bot.session_id = session_id;
    write_store(&store)
}

/// Sıradaki botun tonu — hepsi mor olmasın.
pub fn next_avatar() -> Avatar {
    Avatar::nth(read_store().map(|s| s.bots.len()).unwrap_or(0))
}

fn dogrula(mut d: BotDraft) -> Result<BotDraft, BotError> {
    d.name = d.name.trim().to_string();
    d.workdir = d.workdir.trim().to_string();
    d.agent = d.agent.trim().to_string();

    if d.name.is_empty() {
        return Err(BotError::Gecersiz("#nameRequired".into()));
    }
    // Hangi alanın zorunlu olduğu arka uca göre değişiyor: eski yolda ajan
    // (`agent_run`'a gidiyor), yeni yolda model (`/v1/chat/completions`'a).
    match d.backend {
        Backend::PcbridgeAgent => {
            if d.agent.is_empty() {
                return Err(BotError::Gecersiz("#agentRequired".into()));
            }
        }
        Backend::YerelModel => {
            if d.model.as_deref().map(str::trim).unwrap_or("").is_empty() {
                return Err(BotError::Gecersiz("#modelRequired".into()));
            }
        }
    }
    if d.workdir.is_empty() {
        return Err(BotError::Gecersiz("#workdirRequired".into()));
    }
    if !std::path::Path::new(&d.workdir).is_dir() {
        return Err(BotError::Gecersiz(format!("#workdirMissing:{}", d.workdir)));
    }
    if d.timeout == 0 {
        d.timeout = varsayilan_timeout();
    }
    if d.context_budget == 0 {
        d.context_budget = varsayilan_butce();
    }
    Ok(d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn avatar_ad_olarak_serilesir() {
        let j = serde_json::to_string(&Avatar::Kehribar).unwrap();
        assert_eq!(j, "\"kehribar\"", "hex değil ad saklanmalı");
        let geri: Avatar = serde_json::from_str("\"mor\"").unwrap();
        assert_eq!(geri, Avatar::Mor);
    }

    #[test]
    fn eksik_alanlar_varsayilana_duser() {
        // Elle yazılmış, asgari bir bots.json satırı da okunabilmeli.
        // **Bu test aynı zamanda göç güvencesi:** yeni alanlar `default`
        // almazsa diskteki mevcut botlar açılışta kaybolur.
        let bot: Bot = serde_json::from_str(
            r#"{"id":"a","name":"X","avatar":"cam","agent":"claude","workdir":"/tmp"}"#,
        )
        .unwrap();
        assert_eq!(bot.timeout, 1800);
        assert!(!bot.desktop);
        assert!(bot.jobs.is_empty());
        assert!(bot.session_id.is_none());
        // Arka uç alanı olmayan eski bot eski yolda kalır.
        assert_eq!(bot.backend, Backend::PcbridgeAgent);
        assert!(bot.tools.is_empty(), "araç filtresi boş başlar");
        assert_eq!(bot.context_budget, 8192);
    }

    /// **Göç güvencesi, gerçek dosya üstünde.** Diskteki `bots.json` yeni
    /// alanları taşımıyor; `#[serde(default)]` düşerse bütün botlar açılışta
    /// kaybolur. Dosya yoksa test atlanır — CI'da diskte bot olmayabilir.
    #[test]
    fn diskteki_gercek_botlar_hala_okunuyor() {
        let p = path();
        let Ok(text) = fs::read_to_string(&p) else {
            eprintln!("atlandı: {} yok", p.display());
            return;
        };
        let store: Store = serde_json::from_str(&text)
            .unwrap_or_else(|e| panic!("diskteki bots.json okunamadı — göç kırıldı: {e}"));
        for b in &store.bots {
            // Alan taşımayan eski kayıtlar varsayılana düşmeli; taşıyanlar
            // kendi değerini korumalı. İkisi de sıfır bütçeyle açılmamalı.
            assert!(b.context_budget > 0, "bütçe varsayılana düşmedi: {}", b.name);
            assert!(!b.workdir.is_empty());
        }
        eprintln!("{} bot okundu, göç sağlam", store.bots.len());
    }

    #[test]
    fn arka_uc_kebab_case_serilesir() {
        assert_eq!(
            serde_json::to_string(&Backend::YerelModel).unwrap(),
            "\"yerel-model\""
        );
        assert_eq!(
            serde_json::from_str::<Backend>("\"pcbridge-agent\"").unwrap(),
            Backend::PcbridgeAgent
        );
    }

    #[test]
    fn zorunlu_alan_arka_uca_gore_degisir() {
        let taban = |backend, agent: &str, model: Option<&str>| BotDraft {
            name: "X".into(),
            avatar: Avatar::Mor,
            agent: agent.into(),
            backend,
            model: model.map(str::to_string),
            effort: None,
            workdir: "/tmp".into(),
            preamble: String::new(),
            desktop: false,
            timeout: 0,
            tools: Vec::new(),
            context_budget: 0,
        };

        // Eski yol: ajan şart, model isteğe bağlı.
        assert!(dogrula(taban(Backend::PcbridgeAgent, "", None)).is_err());
        assert!(dogrula(taban(Backend::PcbridgeAgent, "claude", None)).is_ok());

        // Yeni yol: ajan gereksiz, model şart.
        assert!(dogrula(taban(Backend::YerelModel, "", None)).is_err());
        let ok = dogrula(taban(Backend::YerelModel, "", Some("ornith"))).unwrap();
        assert_eq!(ok.context_budget, 8192, "sıfır bütçe varsayılana düşmeli");
        assert_eq!(ok.timeout, 1800);
    }

    #[test]
    fn id_ler_cakismaz() {
        let a = yeni_id("aynı ad");
        let b = yeni_id("aynı ad");
        assert_ne!(a, b);
    }

    #[test]
    fn olmayan_dizin_reddedilir() {
        let d = BotDraft {
            name: "X".into(),
            avatar: Avatar::Mor,
            agent: "claude".into(),
            backend: Backend::PcbridgeAgent,
            model: None,
            effort: None,
            workdir: "/kesinlikle/olmayan/dizin".into(),
            preamble: String::new(),
            desktop: false,
            timeout: 0,
            tools: Vec::new(),
            context_budget: 0,
        };
        assert!(matches!(dogrula(d), Err(BotError::Gecersiz(_))));
    }

    #[test]
    fn bos_ad_reddedilir() {
        let d = BotDraft {
            name: "   ".into(),
            avatar: Avatar::Mor,
            agent: "claude".into(),
            backend: Backend::PcbridgeAgent,
            model: None,
            effort: None,
            workdir: "/tmp".into(),
            preamble: String::new(),
            desktop: false,
            timeout: 1800,
            tools: Vec::new(),
            context_budget: 0,
        };
        assert!(matches!(dogrula(d), Err(BotError::Gecersiz(_))));
    }
}
