//! Statik token'ın tek durağı: OS keyring'i.
//!
//! Token bu modülün dışına **frontend'e doğru** hiç çıkmaz. Dışarıya açılan
//! yüzey `has()`/`set()`/`clear()`; `get()` yalnızca `mcp.rs` içindir.
//! Hiçbir yerde loglanmaz, `Debug` ile basılmaz, dosyaya yazılmaz.

use keyring::v1::{Entry, Error};

const SERVICE: &str = "pcbridge-desktop";
const ACCOUNT: &str = "static_token";

/// Keyring'in kendisiyle ilgili sorunlar. Token'ın *kendisi* asla taşınmaz.
#[derive(Debug)]
pub enum SecretError {
    /// Kasa hiç kurulamadı — D-Bus yok, gnome-keyring çalışmıyor.
    NoStore,
    /// Kasa var ama açılamadı; genelde kilitli.
    Locked(String),
    Other(String),
}

impl std::fmt::Display for SecretError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SecretError::NoStore => write!(
                f,
                "Anahtarlık bulunamadı. gnome-keyring-daemon'ın 'secrets' bileşeniyle çalıştığından emin ol."
            ),
            SecretError::Locked(d) => write!(f, "Anahtarlığa erişilemedi: {d}"),
            SecretError::Other(d) => write!(f, "Anahtarlık hatası: {d}"),
        }
    }
}

impl From<Error> for SecretError {
    fn from(e: Error) -> Self {
        match e {
            Error::NoDefaultStore => SecretError::NoStore,
            Error::NoStorageAccess(p) => SecretError::Locked(p.to_string()),
            other => SecretError::Other(other.to_string()),
        }
    }
}

fn entry() -> Result<Entry, SecretError> {
    Entry::new(SERVICE, ACCOUNT).map_err(SecretError::from)
}

/// Token'ı okur. Kayıt yoksa `Ok(None)` — bu bir hata değil, ilk açılıştır.
pub fn get() -> Result<Option<String>, SecretError> {
    match entry()?.get_password() {
        Ok(t) if !t.trim().is_empty() => Ok(Some(t)),
        // Boş dizge kaydedilmiş: kayıt yokmuş gibi davran.
        Ok(_) => Ok(None),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(SecretError::from(e)),
    }
}

pub fn has() -> Result<bool, SecretError> {
    Ok(get()?.is_some())
}

pub fn set(token: &str) -> Result<(), SecretError> {
    entry()?.set_password(token).map_err(SecretError::from)
}

pub fn clear() -> Result<(), SecretError> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        // Zaten yoksa istenen sonuç sağlanmış demektir.
        Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(SecretError::from(e)),
    }
}

// ── async sarmalayıcılar ─────────────────────────────────────────────
//
// D-Bus çağrıları bloklar. Kasa kilitliyse GNOME bir kilit açma penceresi
// gösterir ve çağrı kullanıcı yanıtlayana kadar döner — bu, async çalışma
// zamanını saniyelerce tutabilir. Bu yüzden hepsi ayrı bir iş parçacığında.

fn join_err(e: tokio::task::JoinError) -> SecretError {
    SecretError::Other(e.to_string())
}

pub async fn get_async() -> Result<Option<String>, SecretError> {
    tokio::task::spawn_blocking(get).await.map_err(join_err)?
}

pub async fn has_async() -> Result<bool, SecretError> {
    tokio::task::spawn_blocking(has).await.map_err(join_err)?
}

pub async fn set_async(token: String) -> Result<(), SecretError> {
    tokio::task::spawn_blocking(move || set(&token))
        .await
        .map_err(join_err)?
}

pub async fn clear_async() -> Result<(), SecretError> {
    tokio::task::spawn_blocking(clear).await.map_err(join_err)?
}
