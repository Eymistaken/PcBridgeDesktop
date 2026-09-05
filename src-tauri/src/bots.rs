//! Bot profilleri — `~/.config/pcbridge-desktop/bots.json`.
//!
//! Bot **uygulamanın kendi JSON'unda yaşar.** pcbridge'in `config.toml`'una
//! `[agents.*]` bloğu yazma yeteneği bilinçli olarak yok.
//!
//! Sohbet geçmişi burada **tutulmaz**: her koşum zaten
//! `~/.local/state/pcbridge/jobs/<id>/` altında duruyor ve orası tek doğru
//! kaynak. Bot yalnızca kendi iş kimliklerinin listesini taşır.
//!
//! **Bir bot bir sohbet değil.** Bot bir *asistan*: yapılandırması (model,
//! araç filtresi, izin kipi, çalışma dizini) kendisinde durur, işleri ise
//! `Session`'larda. Her session'ın **kendi koşum listesi** var ve bağlam
//! yalnızca ondan kuruluyor (`agent::gecmis_in`) — iki session birbirinin
//! geçmişini hiç görmez. Aynı botun iki session'ı aynı anda koşabilir.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::tools::Izin;

/// Eski altı tonun **hesaplanmış** hue karşılıkları.
///
/// Bugünkü hex'lerden oklch'e çevrilerek bulundu; göç bu yüzden neredeyse
/// kayıpsız — altı renkten dördü birebir aynı, ikisi tek kanalda en fazla
/// 3/255 kayıyor (ölçüldü). Mevcut botlar rengini koruyor.
const ESKI_TONLAR: &[(&str, u16)] = &[
    ("mor", 295),
    ("mavi", 250),
    ("cam", 196),
    ("yesil", 150),
    ("kehribar", 72),
    ("mercan", 30),
];

/// Diskteki avatar alanını okur.
///
/// **Hem sayı hem eski ad kabul ediliyor:** mevcut `bots.json` `"mor"` gibi
/// adlar taşıyor. `Serialize` her zaman sayı yazdığı için göç ilk kayıtta
/// kendiliğinden oluyor. Tanınmayan bir ad `None`'a düşer — yani ada göre
/// türetilir; sessizce yanlış bir renk seçmekten iyi.
fn hue_oku<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Option<u16>, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Ham {
        Sayi(u16),
        Ad(String),
    }

    Ok(match Option::<Ham>::deserialize(d)? {
        None => None,
        Some(Ham::Sayi(n)) => Some(n % 360),
        Some(Ham::Ad(a)) => ESKI_TONLAR
            .iter()
            .find(|(ad, _)| *ad == a)
            .map(|(_, h)| *h),
    })
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

/// Botun tek bir işi: kendi koşumları, kendi bağlamı.
///
/// **Bağlamın sınırı burası.** `agent::gecmis_in` yalnızca bir session'ın
/// `jobs`'ını okuyor; özet denetim noktası da bu listenin içinde aranıyor.
/// Botun ayarları (model, araçlar, izin kipi) session'a **kopyalanmıyor** —
/// tek yerde durur ve bütün session'lar onu kullanır. Aynı işi yapan iki
/// denetim bu depoda bir kez ölü kaldı.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    /// İlk kullanıcı mesajından türer; kullanıcı sonradan değiştirebilir.
    /// Koşum yapılmamış session'da **boş** kalır — uydurma bir ad yerine
    /// arayüz "Yeni session" yazar.
    #[serde(default)]
    pub title: String,
    /// Bu session'ın koşumları, eskiden yeniye. **Geçmiş bundan kurulur.**
    #[serde(default)]
    pub jobs: Vec<String>,
    /// pcbridge CLI'nın `resume_session`'ı — **session başına**, bot başına
    /// değil: iki session'ın aynı CLI oturumunu sürdürmesi bağlamları
    /// birbirine karıştırırdı.
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bot {
    pub id: String,
    pub name: String,
    /// Kimlik rengi: **hue** (0-359). Açıklık ve doygunluk temadan geliyor
    /// (`--av-l` / `--av-c`), o yüzden hue tek başına yeterli ve harfin
    /// kontrastı hue'dan bağımsız garanti kalıyor — 360 hue'nun hepsinde
    /// AA geçtiği hesaplandı (koyu en düşük 4,62; aydınlık 4,88).
    ///
    /// `None` → **addan türetilir**. Elle seçim yapılınca sayı yazılır.
    /// İkinci bir "elle seçildi mi" bayrağı **yok**: bu depoda aynı işi yapan
    /// iki denetimden biri bir kez ölü kaldı.
    ///
    /// Karma **yalnızca TypeScript'te** (`src/lib/types.ts::hueOf`); iki dilde
    /// iki karma er geç ayrışırdı.
    #[serde(default, deserialize_with = "hue_oku")]
    pub avatar: Option<u16>,
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
    /// Bu botun izin kipi: gördüğü aracı sormadan çalıştırabilir mi.
    ///
    /// **Araç filtresinden ayrı bir soru.** Filtre "neyi görebilir", kip
    /// "gördüğünü sormadan yapabilir mi" der. `default` şart: alanı olmayan
    /// eski botlar `Sor`'a düşer, sessizce serbest kalmazlar.
    #[serde(default)]
    pub permission: Izin,
    #[serde(default = "varsayilan_timeout")]
    pub timeout: u64,
    /// Bu botun modele gösterilen araçları. **Boş = hiçbiri.** 33 aracın
    /// tamamı küçük bir modeli boğuyor; filtre konfor değil şart.
    #[serde(default)]
    pub tools: Vec<String>,
    /// Bağlam bütçesi (token). Aşılınca geçmiş özetlenir.
    #[serde(default = "varsayilan_butce")]
    pub context_budget: u32,
    /// Bir koşumdaki en fazla model gidiş-dönüşü.
    ///
    /// **Bot başına**, çünkü sohbet botuyla masaüstü botunun ihtiyacı aynı
    /// değil: ölçülen bir masaüstü görevi (`local-1a066f56b7d-a88e8c`) tam 24
    /// turda düştü ve hedefe bir tıklama kalmıştı — bak-uygula-bak döngüsü
    /// doğası gereği onlarca adım. `default` şart: eski `bots.json` bu alanı
    /// taşımıyor.
    #[serde(default = "varsayilan_max_tur")]
    pub max_turns: u32,
    /// Masaüstü araçlarına `force=true` eklensin mi.
    ///
    /// pcbridge, kullanıcı klavye/fareye son 60 saniyede dokunduysa **yazma**
    /// eylemlerini reddediyor (`desktop/safety.py:264`). Gerekçe kaynakta
    /// yazılı: telefondan gelen eylemle kullanıcının faresi kavga etmesin.
    /// Ama botu **izleyerek** çalıştıran kullanıcıda kapı hiç açılmıyor.
    ///
    /// **Varsayılan kapalı:** bu bir güvenlik kapısını kaldırmak, bilinçli bir
    /// eylem olmalı. `default` şart, eski `bots.json` alanı taşımıyor.
    #[serde(default)]
    pub force_when_busy: bool,
    /// Bu botun işleri. Sıra kullanıcının değil, `updated_at`'in işi —
    /// arayüz en son dokunulanı öne alıyor.
    #[serde(default)]
    pub sessions: Vec<Session>,
    /// ⚠️ **GÖÇ ALANI — okunur, yazılmaz.**
    ///
    /// Session'lardan önce koşumlar doğrudan botta duruyordu. `read_store`
    /// bunları tek bir session'a taşıyor; `skip_serializing_if` sayesinde
    /// alan **ilk yazmada diskten kendiliğinden düşüyor.** Yeni kod bu alana
    /// hiçbir yerde yazmaz.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub jobs: Vec<String>,
    /// ⚠️ **GÖÇ ALANI** — `resume_session` eskiden bot başınaydı; göçte
    /// birinci session'a taşınıyor. Bkz. yukarıdaki `jobs`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
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

fn varsayilan_max_tur() -> u32 {
    100
}

/// Yeni bot yaratırken formdan gelen alanlar. `id`, zaman damgaları ve
/// `jobs` sunucu tarafında konur — istemci uyduramaz.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotDraft {
    pub name: String,
    #[serde(default, deserialize_with = "hue_oku")]
    pub avatar: Option<u16>,
    pub agent: String,
    #[serde(default)]
    pub backend: Backend,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub workdir: String,
    #[serde(default)]
    pub preamble: String,
    #[serde(default)]
    pub permission: Izin,
    #[serde(default = "varsayilan_timeout")]
    pub timeout: u64,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default = "varsayilan_butce")]
    pub context_budget: u32,
    #[serde(default = "varsayilan_max_tur")]
    pub max_turns: u32,
    #[serde(default)]
    pub force_when_busy: bool,
}

#[derive(Debug)]
pub enum BotError {
    Io(String),
    Bozuk(String),
    Yok(String),
    /// Session bulunamadı — silinmiş ya da başka bir botun.
    SessionYok(String),
    Gecersiz(String),
}

impl std::fmt::Display for BotError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BotError::Io(d) => write!(f, "#botsIo:{d}"),
            BotError::Bozuk(d) => write!(f, "#botsCorrupt:{d}"),
            BotError::Yok(id) => write!(f, "#botNotFound:{id}"),
            BotError::SessionYok(id) => write!(f, "#sessionNotFound:{id}"),
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
    let mut store: Store = match fs::read_to_string(&p) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| BotError::Bozuk(e.to_string()))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Store::default(),
        Err(e) => return Err(BotError::Io(e.to_string())),
    };
    // Göç **her okumada** yapılıyor, tek yerde: yazan yollar zaten
    // `read_store` → değiştir → `write_store` deseninde, o yüzden ilk
    // yazmada diske de geçiyor. Yalnızca okuyan yollar (`bot_history`)
    // bellekte doğruyu görüyor ve diske dokunmuyor.
    if goc(&mut store) {
        yedekle(&p);
    }
    Ok(store)
}

/// Göçten önce dosyanın bir kopyasını bırakır.
///
/// **Yalnızca bir kez oluyor:** göç tetiklendiği sürece disktekiler hâlâ eski
/// biçimde, ilk yazmadan sonra `goc` bir daha `true` dönmüyor. Kopya varsa
/// üzerine yazılmaz — ikinci bir açılış ilk yedeği ezmesin.
fn yedekle(p: &std::path::Path) {
    let hedef = p.with_extension("json.oncesi");
    if hedef.exists() {
        return;
    }
    let _ = fs::copy(p, &hedef);
}

/// Eski biçimi (`Bot.jobs` + `Bot.session_id`) tek bir session'a taşır.
///
/// Döndürdüğü `bool` "bir şey değişti mi" — yedek yalnızca o zaman alınıyor.
/// **Idempotent:** ikinci çağrıda hiçbir şey yapmaz, çünkü `jobs` boşalmış
/// olur. Başlık burada **uydurulmuyor**; koşumun prompt'unu okumak `runs`'a
/// bağımlılık getirirdi ve göç anında disk okuması yapmak istemiyoruz —
/// arayüz boş başlığı "Yeni session" diye gösteriyor, ilk `record_job` da
/// prompt'tan dolduruyor.
fn goc(store: &mut Store) -> bool {
    let mut degisti = false;
    for bot in &mut store.bots {
        if bot.jobs.is_empty() && bot.session_id.is_none() {
            continue;
        }
        if bot.sessions.is_empty() {
            let jobs = std::mem::take(&mut bot.jobs);
            bot.sessions.push(Session {
                id: yeni_session_id(),
                title: String::new(),
                jobs,
                session_id: bot.session_id.take(),
                created_at: bot.created_at,
                updated_at: bot.updated_at,
            });
        } else {
            // Session'lar zaten var ama eski alanlar da duruyor: bir yerde
            // yarım kalmış bir yazma. Eski alanlar **ölü** — düşürülüyor.
            bot.jobs.clear();
            bot.session_id = None;
        }
        degisti = true;
    }
    degisti
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

/// Session kimliği. `yeni_id`'nin ikizi, ayırt edilsin diye `s-` önekli.
fn yeni_session_id() -> String {
    format!("s-{}", yeni_id("session"))
}

/// İlk kullanıcı mesajından session başlığı.
///
/// İlk **dolu** satır, 48 karakterde kırpılıyor. Kırpma kelime sınırından:
/// yarım kelime bırakmak başlığı okunmaz yapıyor.
fn baslik_uret(text: &str) -> String {
    let satir = text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
    if satir.chars().count() <= 48 {
        return satir.to_string();
    }
    let kesik: String = satir.chars().take(48).collect();
    match kesik.rsplit_once(' ') {
        Some((bas, _)) if bas.chars().count() >= 24 => format!("{bas}…"),
        _ => format!("{kesik}…"),
    }
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
        permission: dogrulanan.permission,
        timeout: dogrulanan.timeout,
        tools: dogrulanan.tools,
        context_budget: dogrulanan.context_budget,
        max_turns: dogrulanan.max_turns,
        force_when_busy: dogrulanan.force_when_busy,
        // **Session boş başlar.** Bir session ancak ilk mesaj gönderilince
        // doğuyor (`ensure_session`); yaratır yaratmaz bir tane açmak, hiç
        // kullanılmayan boş session'lar biriktirirdi.
        sessions: Vec::new(),
        jobs: Vec::new(),
        session_id: None,
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

    // Ajan ya da arka uç değişirse eski CLI oturumunu sürdürmek anlamsız —
    // **bütün** session'larda. Koşum listesi ve başlıklar duruyor; düşen tek
    // şey `resume_session`.
    if bot.agent != d.agent || bot.backend != d.backend {
        for o in &mut bot.sessions {
            o.session_id = None;
        }
    }
    bot.name = d.name;
    bot.avatar = d.avatar;
    bot.agent = d.agent;
    bot.backend = d.backend;
    bot.model = d.model;
    bot.effort = d.effort;
    bot.workdir = d.workdir;
    bot.preamble = d.preamble;
    bot.permission = d.permission;
    bot.timeout = d.timeout;
    bot.tools = d.tools;
    bot.context_budget = d.context_budget;
    bot.max_turns = d.max_turns;
    bot.force_when_busy = d.force_when_busy;
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

// ───────────────────────── session'lar ─────────────────────────

fn bot_mut<'a>(store: &'a mut Store, id: &str) -> Result<&'a mut Bot, BotError> {
    store
        .bots
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| BotError::Yok(id.to_string()))
}

fn oturum_mut<'a>(bot: &'a mut Bot, sid: &str) -> Result<&'a mut Session, BotError> {
    bot.sessions
        .iter_mut()
        .find(|o| o.id == sid)
        .ok_or_else(|| BotError::SessionYok(sid.to_string()))
}

pub fn sessions(bot_id: &str) -> Result<Vec<Session>, BotError> {
    Ok(get(bot_id)?.sessions)
}

pub fn get_session(bot_id: &str, sid: &str) -> Result<Session, BotError> {
    get(bot_id)?
        .sessions
        .into_iter()
        .find(|o| o.id == sid)
        .ok_or_else(|| BotError::SessionYok(sid.to_string()))
}

/// Verilen session'ı doğrular; verilmemişse **yeni bir tane açar**.
///
/// Arayüzde "yeni session" ayrı bir eylem değil: bota girmek zaten boş bir
/// ekran açıyor ve session ilk mesajla doğuyor. Düğmeye basıp yazmayan
/// kullanıcı arkasında boş bir kayıt bırakmasın diye böyle.
pub fn ensure_session(bot_id: &str, sid: Option<&str>) -> Result<String, BotError> {
    if let Some(sid) = sid {
        // Var olduğunu doğrula: silinmiş bir session'a koşum yazmak
        // geçmişi sessizce kaybettirirdi.
        get_session(bot_id, sid)?;
        return Ok(sid.to_string());
    }
    let mut store = read_store()?;
    let bot = bot_mut(&mut store, bot_id)?;
    let now = simdi();
    let yeni = Session {
        id: yeni_session_id(),
        title: String::new(),
        jobs: Vec::new(),
        session_id: None,
        created_at: now,
        updated_at: now,
    };
    let id = yeni.id.clone();
    bot.sessions.push(yeni);
    bot.updated_at = now;
    write_store(&store)?;
    Ok(id)
}

/// Koşum başlayınca iş kimliğini session'a işler.
///
/// Başlık burada doluyor: ilk mesaj session'ın adı olur. Sonraki koşumlar
/// başlığa **dokunmaz** — kullanıcı elle değiştirmişse ezilmesin.
pub fn record_job(bot_id: &str, sid: &str, job_id: &str, prompt: &str) -> Result<(), BotError> {
    let mut store = read_store()?;
    let now = simdi();
    let bot = bot_mut(&mut store, bot_id)?;
    bot.updated_at = now;
    let oturum = oturum_mut(bot, sid)?;
    if !oturum.jobs.iter().any(|j| j == job_id) {
        oturum.jobs.push(job_id.to_string());
    }
    if oturum.title.is_empty() {
        oturum.title = baslik_uret(prompt);
    }
    oturum.updated_at = now;
    write_store(&store)
}

pub fn set_session(bot_id: &str, sid: &str, session_id: Option<String>) -> Result<(), BotError> {
    let mut store = read_store()?;
    let bot = bot_mut(&mut store, bot_id)?;
    oturum_mut(bot, sid)?.session_id = session_id;
    write_store(&store)
}

pub fn rename_session(bot_id: &str, sid: &str, title: &str) -> Result<Session, BotError> {
    let mut store = read_store()?;
    let now = simdi();
    let bot = bot_mut(&mut store, bot_id)?;
    let oturum = oturum_mut(bot, sid)?;
    oturum.title = baslik_uret(title);
    oturum.updated_at = now;
    let out = oturum.clone();
    write_store(&store)?;
    Ok(out)
}

/// Session'ı listeden düşürür.
///
/// ⚠️ **Koşum dizinleri silinmiyor.** `runs/<id>/` ayrı bir doğru kaynak ve
/// bu depoda "sahipsiz bir dizin bir bota ait değildir" kuralı var
/// (`runs.rs`); listeden düşen koşumu kimse okumaz. Diski toplamak ayrı bir
/// iş, YAPILACAKLAR.md'de.
pub fn delete_session(bot_id: &str, sid: &str) -> Result<(), BotError> {
    let mut store = read_store()?;
    let bot = bot_mut(&mut store, bot_id)?;
    let onceki = bot.sessions.len();
    bot.sessions.retain(|o| o.id != sid);
    if bot.sessions.len() == onceki {
        return Err(BotError::SessionYok(sid.to_string()));
    }
    bot.updated_at = simdi();
    write_store(&store)
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
    if d.max_turns == 0 {
        d.max_turns = varsayilan_max_tur();
    }
    Ok(d)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **Avatar artık hue saklıyor, ad değil** — ama eski dosya bozulmuyor.
    ///
    /// Hue karşılıkları bugünkü hex'lerden oklch'e çevrilerek hesaplandı;
    /// altı renkten dördü göç sonrası birebir aynı, ikisi tek kanalda en
    /// fazla 3/255 kayıyor. `Serialize` sayı yazdığı için göç ilk kayıtta
    /// kendiliğinden oluyor.
    #[test]
    fn eski_ton_adlari_hue_ya_gocuyor() {
        #[derive(Deserialize)]
        struct Sar {
            #[serde(default, deserialize_with = "hue_oku")]
            avatar: Option<u16>,
        }
        let oku = |j: &str| serde_json::from_str::<Sar>(j).unwrap().avatar;

        assert_eq!(oku(r#"{"avatar":"mor"}"#), Some(295));
        assert_eq!(oku(r#"{"avatar":"kehribar"}"#), Some(72));
        assert_eq!(oku(r#"{"avatar":"mercan"}"#), Some(30));
        // Sayı olduğu gibi, çember dışı sarılıyor.
        assert_eq!(oku(r#"{"avatar":123}"#), Some(123));
        assert_eq!(oku(r#"{"avatar":400}"#), Some(40));
        // Alan yoksa ya da tanınmıyorsa **addan türetilir**; sessizce yanlış
        // bir renk seçmek yerine karma karar veriyor.
        assert_eq!(oku(r#"{}"#), None);
        assert_eq!(oku(r#"{"avatar":null}"#), None);
        assert_eq!(oku(r#"{"avatar":"turuncu"}"#), None);

        // Diske her zaman sayı yazılıyor.
        let bot: Bot = serde_json::from_str(
            r#"{"id":"a","name":"X","avatar":"cam","agent":"c","workdir":"/tmp"}"#,
        )
        .unwrap();
        assert_eq!(bot.avatar, Some(196));
        let j = serde_json::to_string(&bot).unwrap();
        assert!(j.contains("\"avatar\":196"), "sayı yazılmalı: {j}");
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
        // Tavanı olmayan eski bot yeni varsayılana düşer: 24 masaüstü işinde
        // yetmiyordu (ölçüldü, `local-1a066f56b7d-a88e8c`).
        assert_eq!(bot.max_turns, 100);
        // Güvenlik kapısını kaldıran anahtar **kapalı** başlar.
        assert!(!bot.force_when_busy);
        // Kipi olmayan eski bot **sormaya** düşer, serbeste değil.
        assert_eq!(bot.permission, Izin::Sor);
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

        // **Session göçü gerçek dosya üstünde — bellekte, diske yazmadan.**
        // Tek koşum bile kaybolmamalı: kaybolan koşum kaybolan sohbettir.
        let mut gocmus = store;
        let onceki: Vec<Vec<String>> = gocmus
            .bots
            .iter()
            .map(|b| {
                let mut hepsi = b.jobs.clone();
                hepsi.extend(b.sessions.iter().flat_map(|o| o.jobs.iter().cloned()));
                hepsi
            })
            .collect();
        goc(&mut gocmus);
        for (b, eski) in gocmus.bots.iter().zip(&onceki) {
            let sonra: Vec<String> = b.sessions.iter().flat_map(|o| o.jobs.iter().cloned()).collect();
            assert_eq!(&sonra, eski, "{}: koşum listesi göçte değişti", b.name);
            assert!(b.jobs.is_empty(), "{}: eski jobs düşmedi", b.name);
            if !eski.is_empty() {
                assert_eq!(b.sessions.len(), 1, "{}: tek session bekleniyordu", b.name);
            }
        }
        let toplam: usize = onceki.iter().map(Vec::len).sum();
        eprintln!(
            "{} bot, {toplam} koşum — göç sağlam, kayıp yok",
            gocmus.bots.len()
        );
    }

    /// **Göç ucundan uca, diske yazarak — gerçek `bots.json`'un kopyası üstünde.**
    ///
    /// `XDG_CONFIG_HOME` süreç geneli olduğu için `#[ignore]`: paralel koşan
    /// başka bir test aynı değişkeni okuyor. Tek başına çalıştırılır:
    ///
    /// ```bash
    /// cargo test --lib goc_ucundan_uca -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "XDG_CONFIG_HOME'u değiştiriyor — tek başına koşturulur"]
    fn goc_ucundan_uca_diske_yazarak() {
        let kaynak = path();
        let Ok(orijinal) = fs::read_to_string(&kaynak) else {
            eprintln!("atlandı: {} yok", kaynak.display());
            return;
        };

        let kok = std::env::temp_dir().join(format!("pcbd-goc-{}", std::process::id()));
        let _ = fs::remove_dir_all(&kok);
        fs::create_dir_all(kok.join("pcbridge-desktop")).unwrap();
        fs::write(kok.join("pcbridge-desktop/bots.json"), &orijinal).unwrap();
        // SAFETY: test tek başına koşuyor (`#[ignore]`), başka iş parçacığı yok.
        unsafe { std::env::set_var("XDG_CONFIG_HOME", &kok) };

        // 1. Okuma göçü yapıyor ve **yedek bırakıyor.**
        let once = read_store().unwrap();
        let yedek = kok.join("pcbridge-desktop/bots.json.oncesi");
        assert!(yedek.exists(), "göç yedeği yazılmadı");
        assert_eq!(fs::read_to_string(&yedek).unwrap(), orijinal, "yedek bozuk");

        let beklenen: Vec<(String, usize)> = once
            .bots
            .iter()
            .map(|b| (b.name.clone(), b.sessions.iter().map(|o| o.jobs.len()).sum()))
            .collect();
        for b in &once.bots {
            assert!(b.jobs.is_empty(), "{}: eski jobs bellekte kaldı", b.name);
        }

        // 2. Bir yazma yolu göçü diske geçiriyor.
        write_store(&once).unwrap();
        let ham = fs::read_to_string(kok.join("pcbridge-desktop/bots.json")).unwrap();
        let v: serde_json::Value = serde_json::from_str(&ham).unwrap();
        for b in v["bots"].as_array().unwrap() {
            assert!(b.get("jobs").is_none(), "diskte eski jobs kaldı: {b}");
            assert!(b.get("sessionId").is_none(), "diskte eski sessionId kaldı: {b}");
            assert!(b.get("sessions").is_some(), "sessions yazılmadı: {b}");
        }

        // 3. İkinci okuma göç etmiyor ve **yedeği ezmiyor.**
        let sonra = read_store().unwrap();
        let sonraki: Vec<(String, usize)> = sonra
            .bots
            .iter()
            .map(|b| (b.name.clone(), b.sessions.iter().map(|o| o.jobs.len()).sum()))
            .collect();
        assert_eq!(beklenen, sonraki, "ikinci okuma koşum sayısını değiştirdi");
        assert_eq!(fs::read_to_string(&yedek).unwrap(), orijinal, "yedek ezildi");

        // 4. Session CRUD gerçek dosya üstünde.
        let bot_id = sonra.bots[0].id.clone();
        let onceki_sayi = sonra.bots[0].sessions.len();
        let yeni = ensure_session(&bot_id, None).unwrap();
        assert_eq!(sessions(&bot_id).unwrap().len(), onceki_sayi + 1);
        record_job(&bot_id, &yeni, "local-test-0001", "Chrome'u aç ve son videoyu bul").unwrap();
        let o = get_session(&bot_id, &yeni).unwrap();
        assert_eq!(o.jobs, vec!["local-test-0001"]);
        assert_eq!(o.title, "Chrome'u aç ve son videoyu bul", "başlık promptan gelmedi");
        // Var olan session **yeniden yaratılmıyor.**
        assert_eq!(ensure_session(&bot_id, Some(&yeni)).unwrap(), yeni);
        assert_eq!(sessions(&bot_id).unwrap().len(), onceki_sayi + 1);
        delete_session(&bot_id, &yeni).unwrap();
        assert_eq!(sessions(&bot_id).unwrap().len(), onceki_sayi);
        assert!(matches!(
            get_session(&bot_id, &yeni),
            Err(BotError::SessionYok(_))
        ));

        eprintln!(
            "göç ucundan uca sağlam: {} bot, {} koşum, yedek yerinde",
            sonra.bots.len(),
            beklenen.iter().map(|(_, n)| n).sum::<usize>()
        );
        let _ = fs::remove_dir_all(&kok);
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
            avatar: Some(295),
            agent: agent.into(),
            backend,
            model: model.map(str::to_string),
            effort: None,
            workdir: "/tmp".into(),
            preamble: String::new(),
            permission: Izin::Sor,
            timeout: 0,
            tools: Vec::new(),
            context_budget: 0,
        max_turns: 100,
        force_when_busy: false,
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

    /// **Göç: eski `Bot.jobs` tek bir session'a taşınıyor.**
    ///
    /// Dişi var mı diye sınandı: `goc` gövdesi boşaltılınca `sessions` boş
    /// kalıyor ve ilk `assert_eq!` düşüyor.
    #[test]
    fn eski_jobs_tek_sessiona_gocuyor() {
        let mut store: Store = serde_json::from_str(
            r#"{"version":1,"bots":[{"id":"b1","name":"X","agent":"claude",
                "workdir":"/tmp","jobs":["local-aaa","20260902-231500-a1b2c3"],
                "sessionId":"cli-42","createdAt":100,"updatedAt":200}]}"#,
        )
        .unwrap();

        assert!(goc(&mut store), "göç bir şey değiştirmeliydi");
        let b = &store.bots[0];
        assert_eq!(b.sessions.len(), 1);
        // Sıra korunuyor: geçmiş eskiden yeniye kuruluyor.
        assert_eq!(b.sessions[0].jobs, vec!["local-aaa", "20260902-231500-a1b2c3"]);
        // CLI oturumu session'a taşındı, botta kalmadı.
        assert_eq!(b.sessions[0].session_id.as_deref(), Some("cli-42"));
        assert!(b.jobs.is_empty() && b.session_id.is_none());
        // Zaman damgaları botunkinden devralınıyor — uydurulmuyor.
        assert_eq!(b.sessions[0].created_at, 100);
        assert_eq!(b.sessions[0].updated_at, 200);

        // **Idempotent:** ikinci çağrı hiçbir şey yapmaz.
        assert!(!goc(&mut store), "ikinci göç boş dönmeli");
        assert_eq!(store.bots[0].sessions.len(), 1);
    }

    /// Göç alanları **diske yazılmıyor** — `skip_serializing_if` sayesinde
    /// eski biçim ilk kayıtta kendiliğinden düşüyor.
    #[test]
    fn goc_alanlari_diske_yazilmaz() {
        let mut store: Store = serde_json::from_str(
            r#"{"version":1,"bots":[{"id":"b1","name":"X","agent":"c",
                "workdir":"/tmp","jobs":["local-aaa"],"sessionId":"cli-42"}]}"#,
        )
        .unwrap();
        goc(&mut store);
        // ⚠️ Denetim **bot nesnesinin anahtarlarında**: `jobs` ve `sessionId`
        // session'ın içinde de geçiyor ve dizgede aramak orayı yakalıyordu.
        let v: serde_json::Value = serde_json::to_value(&store).unwrap();
        let b = &v["bots"][0];
        assert!(b.get("jobs").is_none(), "botta eski jobs kaldı: {b}");
        assert!(b.get("sessionId").is_none(), "botta eski sessionId kaldı: {b}");
        let o = &b["sessions"][0];
        assert_eq!(o["jobs"][0], "local-aaa", "koşum session'a taşınmadı: {o}");
        assert_eq!(o["sessionId"], "cli-42", "CLI oturumu taşınmadı: {o}");
    }

    /// Session'ı olan ama eski alanları da duran bot: eski alanlar ölü,
    /// düşürülüyor — geçmiş **ikiye bölünmüyor**.
    #[test]
    fn sessionu_olan_botta_eski_alanlar_dusuyor() {
        let mut store: Store = serde_json::from_str(
            r#"{"version":1,"bots":[{"id":"b1","name":"X","agent":"c","workdir":"/tmp",
                "jobs":["local-eski"],
                "sessions":[{"id":"s-1","title":"T","jobs":["local-yeni"]}]}]}"#,
        )
        .unwrap();
        assert!(goc(&mut store));
        let b = &store.bots[0];
        assert_eq!(b.sessions.len(), 1, "ikinci session açılmamalı");
        assert_eq!(b.sessions[0].jobs, vec!["local-yeni"]);
        assert!(b.jobs.is_empty());
    }

    #[test]
    fn baslik_ilk_dolu_satirdan_kirpilarak_uretilir() {
        assert_eq!(baslik_uret("  \n\n Chrome'u aç \n ikinci satır"), "Chrome'u aç");
        assert_eq!(baslik_uret(""), "");
        // 48'i geçince kelime sınırından kırpılıyor — yarım kelime kalmıyor.
        let uzun = "Sağ ekrandaki Chrome penceresine geç ve adres çubuğuna tıkla";
        let b = baslik_uret(uzun);
        assert!(b.ends_with('…') && b.chars().count() <= 49, "{b}");
        assert!(!b.contains("adres ç"), "kelime ortasından kırpılmış: {b}");
        // Boşluksuz uzun dizge kelime sınırı bulamaz; yine de kırpılır.
        let b2 = baslik_uret(&"x".repeat(80));
        assert_eq!(b2.chars().count(), 49);
    }

    #[test]
    fn session_kimlikleri_cakismaz_ve_onekli() {
        let a = yeni_session_id();
        let b = yeni_session_id();
        assert_ne!(a, b);
        assert!(a.starts_with("s-"), "{a}");
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
            avatar: Some(295),
            agent: "claude".into(),
            backend: Backend::PcbridgeAgent,
            model: None,
            effort: None,
            workdir: "/kesinlikle/olmayan/dizin".into(),
            preamble: String::new(),
            permission: Izin::Sor,
            timeout: 0,
            tools: Vec::new(),
            context_budget: 0,
        max_turns: 100,
        force_when_busy: false,
        };
        assert!(matches!(dogrula(d), Err(BotError::Gecersiz(_))));
    }

    #[test]
    fn bos_ad_reddedilir() {
        let d = BotDraft {
            name: "   ".into(),
            avatar: Some(295),
            agent: "claude".into(),
            backend: Backend::PcbridgeAgent,
            model: None,
            effort: None,
            workdir: "/tmp".into(),
            preamble: String::new(),
            permission: Izin::Sor,
            timeout: 1800,
            tools: Vec::new(),
            context_budget: 0,
        max_turns: 100,
        force_when_busy: false,
        };
        assert!(matches!(dogrula(d), Err(BotError::Gecersiz(_))));
    }
}
