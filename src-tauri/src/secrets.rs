//! Sırların tek durağı: OS keyring'i.
//!
//! Sır bu modülün dışına **frontend'e doğru** hiç çıkmaz. Dışarıya açılan
//! yüzey `has()`/`set()`/`clear()`; `get()` yalnızca `mcp.rs` ve `model.rs`
//! içindir. Hiçbir yerde loglanmaz, `Debug` ile basılmaz, dosyaya yazılmaz.
//!
//! İki hesap var ve **ayrı** duruyorlar: pcbridge'in statik token'ı ve
//! model sunucusunun isteğe bağlı API anahtarı. Biri silinince öteki durur.

use keyring::v1::{Entry, Error};

const SERVICE: &str = "pcbridge-desktop";

/// pcbridge'in statik token'ı.
pub const TOKEN: &str = "static_token";
/// OpenAI-uyumlu model sunucusunun API anahtarı. Yerel sunucularda genelde
/// gerekmiyor; alan boş bırakılabilir.
pub const MODEL_KEY: &str = "model_api_key";

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
            SecretError::NoStore => write!(f, "#keyringNoStore"),
            SecretError::Locked(d) => write!(f, "#keyringLocked:{d}"),
            SecretError::Other(d) => write!(f, "#keyringOther:{d}"),
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

fn entry(account: &str) -> Result<Entry, SecretError> {
    Entry::new(SERVICE, account).map_err(SecretError::from)
}

/// Sırrı okur. Kayıt yoksa `Ok(None)` — bu bir hata değil, ilk açılıştır.
pub fn get_of(account: &str) -> Result<Option<String>, SecretError> {
    match entry(account)?.get_password() {
        Ok(t) if !t.trim().is_empty() => Ok(Some(t)),
        // Boş dizge kaydedilmiş: kayıt yokmuş gibi davran.
        Ok(_) => Ok(None),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(SecretError::from(e)),
    }
}

pub fn has_of(account: &str) -> Result<bool, SecretError> {
    Ok(get_of(account)?.is_some())
}

pub fn set_of(account: &str, secret: &str) -> Result<(), SecretError> {
    entry(account)?.set_password(secret).map_err(SecretError::from)
}

pub fn clear_of(account: &str) -> Result<(), SecretError> {
    match entry(account)?.delete_credential() {
        Ok(()) => Ok(()),
        // Zaten yoksa istenen sonuç sağlanmış demektir.
        Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(SecretError::from(e)),
    }
}

// Statik token — en sık kullanılan hesap, adı yazılmadan çağrılır.
pub fn get() -> Result<Option<String>, SecretError> {
    get_of(TOKEN)
}

pub fn has() -> Result<bool, SecretError> {
    has_of(TOKEN)
}

pub fn set(token: &str) -> Result<(), SecretError> {
    set_of(TOKEN, token)
}

pub fn clear() -> Result<(), SecretError> {
    clear_of(TOKEN)
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

pub async fn get_of_async(account: &'static str) -> Result<Option<String>, SecretError> {
    tokio::task::spawn_blocking(move || get_of(account))
        .await
        .map_err(join_err)?
}

pub async fn has_of_async(account: &'static str) -> Result<bool, SecretError> {
    tokio::task::spawn_blocking(move || has_of(account))
        .await
        .map_err(join_err)?
}

pub async fn set_of_async(account: &'static str, secret: String) -> Result<(), SecretError> {
    tokio::task::spawn_blocking(move || set_of(account, &secret))
        .await
        .map_err(join_err)?
}

pub async fn clear_of_async(account: &'static str) -> Result<(), SecretError> {
    tokio::task::spawn_blocking(move || clear_of(account))
        .await
        .map_err(join_err)?
}
