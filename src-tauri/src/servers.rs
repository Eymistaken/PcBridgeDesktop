//! Eklenti MCP sunucuları — `~/.config/pcbridge-desktop/servers.json`.
//!
//! `bots.json`'ın ikizi: aynı dizin, aynı atomik yazma (tmp + fsync + rename),
//! aynı 0600. **Dosyada hiçbir sır durmaz** — bir sunucu kimlik istiyorsa onu
//! ya kendi dosyasında tutar (Gmail böyle) ya da ileride keyring'e `mcp:<id>`
//! hesabı olarak konur.
//!
//! ## pcbridge burada değil
//!
//! pcbridge **gömülü kayıt**: listede görünür ama bu dosyada durmaz, silinemez
//! ve kapatılamaz. Uygulamanın kendisi ona bağlı; bir satır olarak yazılsaydı
//! kullanıcı onu kapatıp uygulamayı işlevsiz bırakabilirdi.
//!
//! ## Neden ikinci bir araç filtresi yok
//!
//! İlk taslak sunucu kaydına `readOnly` ve `toolFilter.deny` koyuyordu. Konmadı:
//! **araç filtresi zaten var** (`Bot.tools`) ve bu depoda aynı işi yapan iki
//! denetimden biri bir kez ölü kaldı (`Bot.desktop`, Aşama 7). Güvenlik yine de
//! sağlanıyor, üç ayrı yerden:
//!
//! - Yeni bir araç hiçbir botun listesine **kendiliğinden girmez**; kullanıcı
//!   BotForge'da açıkça seçer.
//! - `tools::grup` tanımadığı adı **`Write`** sayar, yani `Izin::Sor` kipinde
//!   `send_email` gibi bir araç her çağrıda onay ister.
//! - `Bot.servers` kaba denetim: kod yazan bot Gmail'i hiç görmez.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// pcbridge'in gömülü kimliği. Bir eklenti bu kimliği alamaz.
pub const PCBRIDGE: &str = "pcbridge";

/// Araç adını sunucusundan ayıran ek.
///
/// **Neden önek var:** iki sunucu aynı araç adını verebilir (`search`,
/// `list`…) ve o zaman `call_for_agent` çağrıyı kime yollayacağını bilemez.
/// Önek çakışmayı **yapısal olarak** imkânsız kılıyor. pcbridge'in 33 aracı
/// öneksiz kalıyor: adları `bots.json`'da, `tools.rs`'in gruplarında ve
/// ölçülmüş onlarca koşum kaydında geçiyor, hepsini göç ettirmek kazandırdığı
/// tutarlılıktan pahalı olurdu.
pub const AYIRAC: &str = "__";

/// Modele giden araç adı: `gmail__send_email`.
pub fn onekle(server_id: &str, tool: &str) -> String {
    format!("{server_id}{AYIRAC}{tool}")
}

/// Önekli adı `(sunucu, araç)` diye ayırır. Öneksizse pcbridge'indir.
pub fn coz(name: &str) -> (&str, &str) {
    match name.split_once(AYIRAC) {
        Some((s, t)) if !s.is_empty() && !t.is_empty() => (s, t),
        _ => (PCBRIDGE, name),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Transport {
    /// Çocuk süreç, stdin/stdout üstünde JSON-RPC.
    #[default]
    Stdio,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Server {
    /// **Kimlik bir slug** (`gmail`, `everything`), hex değil: modele giden
    /// araç adının öneki bu ve orada okunur bir şey olmalı. Benzersizliği
    /// `create` sağlıyor.
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub transport: Transport,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    /// Kapalı bir sunucu bağlanmaz ve araçları hiçbir bota gitmez.
    #[serde(default = "acik")]
    pub enabled: bool,
}

fn acik() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerDraft {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default = "acik")]
    pub enabled: bool,
}

#[derive(Debug)]
pub enum ServerError {
    Io(String),
    Bozuk(String),
    Yok(String),
    Gecersiz(String),
}

impl std::fmt::Display for ServerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServerError::Io(d) => write!(f, "#serversIo:{d}"),
            ServerError::Bozuk(d) => write!(f, "#serversCorrupt:{d}"),
            ServerError::Yok(id) => write!(f, "#serverNotFound:{id}"),
            ServerError::Gecersiz(d) => write!(f, "{d}"),
        }
    }
}

impl serde::Serialize for ServerError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

fn path() -> PathBuf {
    crate::bots::config_dir().join("servers.json")
}

#[derive(Serialize, Deserialize)]
struct Store {
    version: u32,
    servers: Vec<Server>,
}

impl Default for Store {
    fn default() -> Self {
        Store {
            version: 1,
            servers: Vec::new(),
        }
    }
}

fn read_store() -> Result<Store, ServerError> {
    match fs::read_to_string(path()) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| ServerError::Bozuk(e.to_string())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Store::default()),
        Err(e) => Err(ServerError::Io(e.to_string())),
    }
}

/// Önce geçici dosyaya yazıp `rename` ile yerine koyar — `bots.rs` ile aynı.
fn write_store(store: &Store) -> Result<(), ServerError> {
    let dir = crate::bots::config_dir();
    fs::create_dir_all(&dir).map_err(|e| ServerError::Io(e.to_string()))?;

    let text = serde_json::to_string_pretty(store).map_err(|e| ServerError::Io(e.to_string()))?;
    let tmp = dir.join("servers.json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| ServerError::Io(e.to_string()))?;
        f.write_all(text.as_bytes())
            .map_err(|e| ServerError::Io(e.to_string()))?;
        f.sync_all().map_err(|e| ServerError::Io(e.to_string()))?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        // Sır taşımıyor ama komut satırı kişisel yollar içerebiliyor.
        let _ = fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600));
    }
    fs::rename(&tmp, path()).map_err(|e| ServerError::Io(e.to_string()))
}

/// Addan kimlik türetir: `"Gmail"` → `"gmail"`, `"Server Everything"` →
/// `"server-everything"`.
///
/// Araç adının öneki olacağı için **dar tutuluyor**: yalnızca ASCII harf,
/// rakam ve `-`. Türkçe harfler karşılıklarına çevriliyor ki `İzleyici`
/// boş bir kimliğe düşmesin.
fn slug(ad: &str) -> String {
    let mut s = String::new();
    let mut tire = false;
    for c in ad.trim().chars() {
        let d = match c {
            'ç' | 'Ç' => 'c',
            'ğ' | 'Ğ' => 'g',
            'ı' | 'I' => 'i',
            'İ' | 'i' => 'i',
            'ö' | 'Ö' => 'o',
            'ş' | 'Ş' => 's',
            'ü' | 'Ü' => 'u',
            c if c.is_ascii_alphanumeric() => c.to_ascii_lowercase(),
            _ => {
                tire = !s.is_empty();
                continue;
            }
        };
        if tire {
            s.push('-');
            tire = false;
        }
        s.push(d);
    }
    s
}

/// Kimliği benzersiz yapar: `gmail`, `gmail-2`, `gmail-3`…
fn benzersiz(taban: &str, mevcut: &[Server]) -> String {
    let dolu = |k: &str| k == PCBRIDGE || mevcut.iter().any(|s| s.id == k);
    if !dolu(taban) {
        return taban.to_string();
    }
    (2..)
        .map(|n| format!("{taban}-{n}"))
        .find(|k| !dolu(k))
        .unwrap_or_default()
}

fn dogrula(d: ServerDraft) -> Result<ServerDraft, ServerError> {
    let name = d.name.trim().to_string();
    let command = d.command.trim().to_string();
    if name.is_empty() {
        return Err(ServerError::Gecersiz("#serverNameEmpty".into()));
    }
    if command.is_empty() {
        return Err(ServerError::Gecersiz("#serverCommandEmpty".into()));
    }
    if slug(&name).is_empty() {
        // Ad yalnızca noktalama ise kimlik boş kalır ve önek bozulurdu.
        return Err(ServerError::Gecersiz("#serverNameUnusable".into()));
    }
    Ok(ServerDraft {
        name,
        command,
        args: d.args.into_iter().map(|a| a.trim().to_string()).filter(|a| !a.is_empty()).collect(),
        enabled: d.enabled,
    })
}

pub fn list() -> Result<Vec<Server>, ServerError> {
    Ok(read_store()?.servers)
}

pub fn create(draft: ServerDraft) -> Result<Server, ServerError> {
    let mut store = read_store()?;
    let d = dogrula(draft)?;
    let server = Server {
        id: benzersiz(&slug(&d.name), &store.servers),
        name: d.name,
        transport: Transport::Stdio,
        command: d.command,
        args: d.args,
        enabled: d.enabled,
    };
    store.servers.push(server.clone());
    write_store(&store)?;
    Ok(server)
}

/// Günceller. **Kimlik değişmez:** araç adlarının öneki ve `Bot.servers`
/// ondan türüyor; değiştirmek her botun listesini sessizce kırardı.
pub fn update(id: &str, draft: ServerDraft) -> Result<Server, ServerError> {
    let mut store = read_store()?;
    let d = dogrula(draft)?;
    let s = store
        .servers
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| ServerError::Yok(id.to_string()))?;
    s.name = d.name;
    s.command = d.command;
    s.args = d.args;
    s.enabled = d.enabled;
    let out = s.clone();
    write_store(&store)?;
    Ok(out)
}

pub fn delete(id: &str) -> Result<(), ServerError> {
    let mut store = read_store()?;
    let n = store.servers.len();
    store.servers.retain(|s| s.id != id);
    if store.servers.len() == n {
        return Err(ServerError::Yok(id.to_string()));
    }
    write_store(&store)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn onek_cozulur_ve_pcbridge_oneksiz_kalir() {
        assert_eq!(coz("gmail__send_email"), ("gmail", "send_email"));
        // pcbridge'in araçları öneksiz: adları bots.json'da ve koşum
        // kayıtlarında böyle geçiyor.
        assert_eq!(coz("screen_capture"), (PCBRIDGE, "screen_capture"));
        assert_eq!(onekle("gmail", "send_email"), "gmail__send_email");

        // Yarım önek araç adı sayılır, sunucu adı sayılmaz.
        assert_eq!(coz("__x"), (PCBRIDGE, "__x"));
        assert_eq!(coz("x__"), (PCBRIDGE, "x__"));
        // Araç adının içinde `__` varsa ilk ayıraç bölüyor; ikinci parça
        // olduğu gibi sunucuya gidiyor.
        assert_eq!(coz("a__b__c"), ("a", "b__c"));
    }

    #[test]
    fn slug_onek_olarak_kullanilabilir_kalir() {
        assert_eq!(slug("Gmail"), "gmail");
        assert_eq!(slug("Server Everything"), "server-everything");
        assert_eq!(slug("  Boşluklu   Ad  "), "bosluklu-ad");
        // Türkçe harfler düşmüyor, karşılığına çevriliyor.
        assert_eq!(slug("İzleyici"), "izleyici");
        assert_eq!(slug("Çöp Şeyi"), "cop-seyi");
        // Ayıracı bozacak bir karakter geçemez.
        assert_eq!(slug("a_b"), "a-b");
        assert!(!slug("Gmail (kişisel)").contains(AYIRAC));
        assert_eq!(slug("!!!"), "");
    }

    #[test]
    fn kimlik_pcbridge_ile_carpismaz() {
        let mevcut = vec![Server {
            id: "gmail".into(),
            name: "Gmail".into(),
            transport: Transport::Stdio,
            command: "npx".into(),
            args: vec![],
            enabled: true,
        }];
        assert_eq!(benzersiz("gmail", &mevcut), "gmail-2");
        assert_eq!(benzersiz("baska", &mevcut), "baska");
        // Gömülü kayıt bir eklenti tarafından ele geçirilemez.
        assert_eq!(benzersiz("pcbridge", &[]), "pcbridge-2");
    }

    #[test]
    fn adi_kullanilamaz_taslak_reddedilir() {
        let taslak = |ad: &str, komut: &str| ServerDraft {
            name: ad.into(),
            command: komut.into(),
            args: vec![],
            enabled: true,
        };
        assert!(dogrula(taslak("", "npx")).is_err());
        assert!(dogrula(taslak("Gmail", "  ")).is_err());
        assert!(dogrula(taslak("!!!", "npx")).is_err(), "slug boş kalırdı");
        assert!(dogrula(taslak(" Gmail ", " npx ")).is_ok());
    }
}
