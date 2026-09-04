//! Gmail eklentisinin **tek seferlik kurulumu.**
//!
//! `@gongrzhe/server-gmail-autoauth-mcp` kendi OAuth akışını kendi yapıyor ama
//! istemciyi **kullanıcıdan bekliyor**: `~/.gmail-mcp/gcp-oauth.keys.json`.
//! Bu modül o dosyayı kullanıcı adına yazıyor ve sunucunun `auth` komutunu
//! çalıştırıp tarayıcıyı açtırıyor — elle dizin açmak, dosya adı değiştirmek,
//! gizli klasöre kopyalamak kalmıyor.
//!
//! ## Neden istemciyi biz koyamıyoruz
//!
//! Gmail'e bağlanan her uygulamanın Google'da **kayıtlı bir OAuth istemcisi**
//! olmak zorunda. Tek tuşla bağlanan uygulamalarda o istemci ürünün sahibine
//! ait ve ürüne gömülü. PcBridgeDesktop'ın böyle bir kaydı yok, ve bir kullanıcı
//! hesabında proje açmak uygulamanın işi değil. Bu yüzden konsol adımı
//! **bir kez** kullanıcının; sonrası bu modülün.
//!
//! ## ⚠️ Sır burada dosyada duruyor, keyring'de değil
//!
//! "Token yalnızca OS keyring'de" kanunu pcbridge'in **kendi** statik token'ı
//! içindi. Üçüncü taraf bir sunucunun kimlik dosyasını biz yönetmiyoruz: sunucu
//! onu o yoldan okuyor ve başka bir yerden okumuyor. Bunu bilerek kabul
//! ediyoruz ve **panelde açıkça yazıyoruz** — dosyanın yolu ve modu görünür.
//!
//! Buna karşılık sır **hiçbir yere sızmıyor**: geri okunmuyor, arayüze
//! dönmüyor, hata metnine girmiyor, loglanmıyor. Dosya 0600, dizin 0700.
//!
//! Not: "Desktop app" türü bir OAuth istemcisinde `client_secret` zaten gerçek
//! bir sır değil — Google kurulu uygulamaların sır saklayamayacağını kabul
//! ediyor, PKCE tam bunun için var. Yine de dosya 0600 yazılıyor.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::Serialize;

/// Sunucunun `auth` komutuna vereceğimiz süre.
///
/// Kullanıcı tarayıcıda Google hesabını seçip onay ekranını okuyor; bu
/// gerçekten dakikalar sürebiliyor. Süre dolarsa süreç öldürülüyor ve
/// çıktısı kullanıcıya gösteriliyor.
const AUTH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(240);

/// Sunucunun **kendi** varsayılanı (`src/index.ts`'ten okundu). Konsolda
/// oluşturulan istemcinin izin verdiği yönlendirme adresi bu olmalı.
pub const CALLBACK: &str = "http://localhost:3000/oauth2callback";

#[derive(Debug)]
pub enum GmailError {
    Io(String),
    /// `auth` komutu düştü; metin sürecin **kendi** çıktısı.
    Auth(String),
    Gecersiz(String),
}

impl std::fmt::Display for GmailError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GmailError::Io(d) => write!(f, "#gmailIo:{d}"),
            GmailError::Auth(d) => write!(f, "#gmailAuth:{d}"),
            GmailError::Gecersiz(d) => write!(f, "{d}"),
        }
    }
}

impl serde::Serialize for GmailError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

fn ev() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// İstemci dosyasının yolu. `GMAIL_OAUTH_PATH` sunucunun **kendi** okuduğu
/// değişken; aynısına bakıyoruz ki kullanıcı onu ayarlamışsa ayrışmayalım.
pub fn oauth_path() -> PathBuf {
    std::env::var_os("GMAIL_OAUTH_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| ev().join(".gmail-mcp/gcp-oauth.keys.json"))
}

/// Yetkilendirme sonrası sunucunun yazdığı dosya — "oturum açık mı"nın kanıtı.
pub fn creds_path() -> PathBuf {
    std::env::var_os("GMAIL_CREDENTIALS_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| ev().join(".gmail-mcp/credentials.json"))
}

/// Kurulumun arayüze anlatılabilecek hâli.
///
/// **Sır dönmüyor.** Yalnızca "dosya var mı" ve yolu; `client_secret` bir kez
/// yazıldıktan sonra bir daha okunmuyor.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailDurum {
    /// İstemci dosyası yerinde mi (konsol adımı yapılmış mı).
    pub has_keys: bool,
    /// Yetkilendirme yapılmış mı (`credentials.json` var mı).
    pub authorized: bool,
    pub oauth_path: String,
    pub credentials_path: String,
    /// Konsolda istemciye tanıtılması gereken yönlendirme adresi.
    pub callback: String,
}

pub fn durum() -> GmailDurum {
    let o = oauth_path();
    let c = creds_path();
    GmailDurum {
        has_keys: o.is_file(),
        authorized: c.is_file(),
        oauth_path: o.to_string_lossy().into_owned(),
        credentials_path: c.to_string_lossy().into_owned(),
        callback: CALLBACK.to_string(),
    }
}

/// Google'ın indirttiği "Desktop app" dosyasının biçimi.
///
/// **Sunucu yalnızca iki alanı okuyor** (`src/index.ts`'ten doğrulandı:
/// `keysContent.installed || keysContent.web`, sonra `keys.client_id` ve
/// `keys.client_secret`). Ötekiler Google'ın dosyasında var ve dosyayı
/// tanıdık kılıyor; yazıyoruz ama sunucu onlara bakmıyor.
#[derive(Serialize)]
struct Installed<'a> {
    client_id: &'a str,
    client_secret: &'a str,
    auth_uri: &'a str,
    token_uri: &'a str,
    redirect_uris: [&'a str; 1],
}

/// İstemci dosyasını yazar. Dizin 0700, dosya 0600.
///
/// ⚠️ **Sır hiçbir hata metnine girmiyor.** Yazma başarısız olursa dönen metin
/// yalnızca işletim sisteminin hatası; `client_secret` ne loglanıyor ne de
/// arayüze geri veriliyor.
pub fn anahtar_yaz(client_id: &str, client_secret: &str) -> Result<(), GmailError> {
    let id = client_id.trim();
    let secret = client_secret.trim();
    if id.is_empty() {
        return Err(GmailError::Gecersiz("#gmailIdEmpty".into()));
    }
    if secret.is_empty() {
        return Err(GmailError::Gecersiz("#gmailSecretEmpty".into()));
    }

    let yol = oauth_path();
    let dizin = yol
        .parent()
        .ok_or_else(|| GmailError::Io("dosyanın dizini yok".into()))?;
    fs::create_dir_all(dizin).map_err(|e| GmailError::Io(e.to_string()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(dizin, fs::Permissions::from_mode(0o700));
    }

    let govde = serde_json::json!({
        "installed": Installed {
            client_id: id,
            client_secret: secret,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            redirect_uris: [CALLBACK],
        }
    });
    let metin = serde_json::to_string_pretty(&govde).map_err(|e| GmailError::Io(e.to_string()))?;

    // `bots.rs` ile aynı desen: tmp + fsync + rename. Yarım yazılmış bir
    // kimlik dosyası sunucuyu anlaşılmaz bir hatayla düşürürdü.
    let tmp = yol.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| GmailError::Io(e.to_string()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            // İçerik yazılmadan **önce**: aradaki pencerede dosya 0644 kalmasın.
            let _ = f.set_permissions(fs::Permissions::from_mode(0o600));
        }
        f.write_all(metin.as_bytes())
            .map_err(|e| GmailError::Io(e.to_string()))?;
        f.sync_all().map_err(|e| GmailError::Io(e.to_string()))?;
    }
    fs::rename(&tmp, &yol).map_err(|e| GmailError::Io(e.to_string()))
}

/// Sunucunun kendi `auth` komutunu çalıştırır; o varsayılan tarayıcıyı açar.
///
/// **Komut dışarıdan veriliyor** — sunucu kaydındaki `command`/`args`. Böylece
/// hem kullanıcı paketi başka bir yoldan çalıştırıyorsa bozulmuyor, hem de
/// test sahte bir `auth` komutuyla bu yolu gerçekten koşturabiliyor.
///
/// Dönen metin sürecin **kendi** çıktısı: tarayıcı açılmadıysa onay adresi
/// orada yazıyor ve kullanıcının görmesi gereken tek şey o.
pub async fn yetkilendir(command: &str, args: &[String]) -> Result<String, GmailError> {
    let mut cmd = tokio::process::Command::new(command);
    cmd.args(args)
        .arg("auth")
        .kill_on_drop(true)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let cocuk = cmd.spawn().map_err(|e| GmailError::Io(e.to_string()))?;
    let cikti = match tokio::time::timeout(AUTH_TIMEOUT, cocuk.wait_with_output()).await {
        Ok(r) => r.map_err(|e| GmailError::Io(e.to_string()))?,
        Err(_) => {
            return Err(GmailError::Auth(format!(
                "{} saniyede tamamlanmadı; tarayıcıdaki onay bitmediyse tekrar deneyin.",
                AUTH_TIMEOUT.as_secs()
            )));
        }
    };

    let metin = format!(
        "{}{}",
        String::from_utf8_lossy(&cikti.stdout),
        String::from_utf8_lossy(&cikti.stderr)
    );
    if !cikti.status.success() {
        return Err(GmailError::Auth(son_satirlar(&metin)));
    }

    // **Çıkış kodu tek başına kanıt değil.** Asıl ölçüt sunucunun kimlik
    // dosyasını yazmış olması; yazmadıysa "bağlandı" demek yalan olurdu.
    if !creds_path().is_file() {
        return Err(GmailError::Auth(format!(
            "Yetkilendirme tamamlanmadı: {} yazılmadı.\n{}",
            creds_path().display(),
            son_satirlar(&metin)
        )));
    }
    Ok(son_satirlar(&metin))
}

/// Çıktının son birkaç satırı — panelde gösterilecek kadarı.
fn son_satirlar(metin: &str) -> String {
    let satirlar: Vec<&str> = metin.lines().filter(|l| !l.trim().is_empty()).collect();
    let bas = satirlar.len().saturating_sub(5);
    satirlar[bas..].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Yazılan dosya sunucunun **gerçekten okuduğu** biçimde mi.
    ///
    /// Biçim `src/index.ts`'ten doğrulandı: kök anahtar `installed` (ya da
    /// `web`), içinde `client_id` ve `client_secret`. Yanlış biçim sunucuyu
    /// anlaşılmaz bir hatayla düşürürdü.
    #[test]
    fn anahtar_dosyasi_sunucunun_bekledigi_bicimde_yazilir() {
        let kok = std::env::temp_dir().join(format!("pcbd-gmail-{}", std::process::id()));
        let _ = fs::remove_dir_all(&kok);
        let yol = kok.join(".gmail-mcp/gcp-oauth.keys.json");
        // SAFETY: yalnızca bu testin geçici dizinini gösteriyor.
        unsafe { std::env::set_var("GMAIL_OAUTH_PATH", &yol) };

        anahtar_yaz("  123.apps.googleusercontent.com  ", " GOCSPX-gizli ").unwrap();

        let v: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&yol).unwrap()).unwrap();
        // Sunucunun okuduğu iki alan.
        assert_eq!(v["installed"]["client_id"], "123.apps.googleusercontent.com");
        assert_eq!(v["installed"]["client_secret"], "GOCSPX-gizli");
        // Yönlendirme adresi sunucunun kendi varsayılanıyla aynı olmalı.
        assert_eq!(v["installed"]["redirect_uris"][0], CALLBACK);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let m = fs::metadata(&yol).unwrap().permissions().mode() & 0o777;
            assert_eq!(m, 0o600, "kimlik dosyası 0600 olmalı, {m:o}");
            let d = fs::metadata(yol.parent().unwrap()).unwrap().permissions().mode() & 0o777;
            assert_eq!(d, 0o700, "dizin 0700 olmalı, {d:o}");
        }

        // Boş alan reddediliyor: sessizce yarım bir dosya yazmak, sunucuyu
        // anlaşılmaz bir hatayla düşürmek olurdu.
        assert!(anahtar_yaz("", "x").is_err());
        assert!(anahtar_yaz("x", "   ").is_err());

        unsafe { std::env::remove_var("GMAIL_OAUTH_PATH") };
        let _ = fs::remove_dir_all(&kok);
    }

    /// `auth` yolu **sahte bir komutla** uçtan uca koşuluyor: ağ yok, Google
    /// yok, ama süreç başlatma · `auth` argümanı · çıktı toplama · başarı
    /// ölçütü hep gerçek.
    ///
    /// **Başarı ölçütü çıkış kodu değil**, sunucunun `credentials.json`'ı
    /// yazmış olması. Bu test iki dalı da sınıyor.
    #[tokio::test]
    async fn auth_komutu_calisir_ve_kanit_dosyaya_bakar() {
        let kok = std::env::temp_dir().join(format!("pcbd-auth-{}", std::process::id()));
        let _ = fs::remove_dir_all(&kok);
        fs::create_dir_all(&kok).unwrap();
        let creds = kok.join("credentials.json");
        // SAFETY: yalnızca bu testin geçici dizinini gösteriyor.
        unsafe { std::env::set_var("GMAIL_CREDENTIALS_PATH", &creds) };

        // 1) Süreç başarılı ama kimlik dosyası yazılmadı → **başarı değil.**
        let bos = kok.join("bos.sh");
        fs::write(&bos, "#!/bin/sh\necho \"acilan adres: https://accounts.google.com/o/oauth2/auth?x=1\"\nexit 0\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&bos, fs::Permissions::from_mode(0o700)).unwrap();
        }
        let e = yetkilendir(bos.to_str().unwrap(), &[]).await.unwrap_err();
        let metin = e.to_string();
        assert!(metin.contains("tamamlanmadı"), "{metin}");
        // Kullanıcının görmesi gereken adres kayboluyor mu.
        assert!(metin.contains("accounts.google.com"), "{metin}");

        // 2) Süreç `credentials.json`'ı yazdı → başarı, ve `auth` argümanı
        //    gerçekten gönderilmiş olmalı.
        let iyi = kok.join("iyi.sh");
        fs::write(
            &iyi,
            format!(
                "#!/bin/sh\necho \"argumanlar: $*\"\nprintf '{{}}' > {}\nexit 0\n",
                creds.display()
            ),
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&iyi, fs::Permissions::from_mode(0o700)).unwrap();
        }
        let cikti = yetkilendir(iyi.to_str().unwrap(), &["paket".to_string()])
            .await
            .expect("başarılı sayılmalıydı");
        assert!(cikti.contains("paket auth"), "auth argümanı gitmedi: {cikti}");

        // 3) Olmayan komut sessizce başarılı sayılmıyor.
        let _ = fs::remove_file(&creds);
        assert!(yetkilendir(&kok.join("yok").to_string_lossy(), &[]).await.is_err());

        unsafe { std::env::remove_var("GMAIL_CREDENTIALS_PATH") };
        let _ = fs::remove_dir_all(&kok);
    }

    #[test]
    fn son_satirlar_bos_satirlari_atar_ve_kirpar() {
        assert_eq!(son_satirlar("a\n\nb\n"), "a\nb");
        let uzun: String = (1..=9).map(|i| format!("s{i}\n")).collect();
        assert_eq!(son_satirlar(&uzun), "s5\ns6\ns7\ns8\ns9");
        assert_eq!(son_satirlar(""), "");
    }
}
