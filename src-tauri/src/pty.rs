//! Terminal bölmeleri: her bölme gerçek bir **tmux** oturumu.
//!
//! `tmux new-session -A -s <ad>` — `-A` şart: oturum varsa **bağlanır**,
//! yoksa yaratır. Uygulama kapanıp açılınca bölmeler bu sayede geri gelir.
//!
//! Bölmeyi kapatmak yalnızca PTY'yi kapatır; **tmux oturumu yaşamaya devam
//! eder.** Oturumu sonlandırmak ayrı ve açık bir eylemdir (`tmux_kill`).

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use base64::Engine;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

#[derive(Debug)]
pub enum PtyError {
    Spawn(String),
    Yok(String),
    Io(String),
    Gecersiz(String),
}

impl std::fmt::Display for PtyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PtyError::Spawn(d) => write!(f, "#ptySpawn:{d}"),
            PtyError::Yok(n) => write!(f, "#ptyNoPane:{n}"),
            PtyError::Io(d) => write!(f, "#ptyIo:{d}"),
            PtyError::Gecersiz(d) => write!(f, "{d}"),
        }
    }
}

impl serde::Serialize for PtyError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataPayload<'a> {
    session: &'a str,
    /// Ham baytlar base64'te: kaçış dizisi ya da UTF-8 karakteri parça
    /// sınırına denk gelirse dizgeye çevirmek bozardı.
    b64: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExitPayload<'a> {
    session: &'a str,
}

struct Pane {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    dur: Arc<AtomicBool>,
    /// tmux istemcisinin pid'i — düzgün ayrılmak için gerekiyor.
    pid: Option<u32>,
}

/// İstemciyi **tmux'a söyleyerek** ayırır.
///
/// **Ölçüldü:** yalnızca PTY master'ını düşürmek oturumu da öldürüyordu —
/// "bölme kapatmak oturumu öldürmez" ölçütü çiğneniyordu. `detach-client`
/// tmux'un kendi ayrılma yolu ve oturuma dokunamaz. İstemci `-t` ile
/// terminaline göre hedeflenir; `-s <oturum>` kullanılmıyor, çünkü o
/// kullanıcının fiziksel terminalini de düşürürdü.
fn detach(pid: Option<u32>) {
    let Some(pid) = pid else { return };
    let Ok(o) = std::process::Command::new("ps")
        .args(["-o", "tty=", "-p", &pid.to_string()])
        .output()
    else {
        return;
    };
    let tty = String::from_utf8_lossy(&o.stdout).trim().to_string();
    if tty.is_empty() || tty == "?" {
        return;
    }
    let _ = std::process::Command::new("tmux")
        .args(["detach-client", "-t", &format!("/dev/{tty}")])
        .output();
}

#[derive(Default)]
pub struct Ptys {
    inner: Mutex<HashMap<String, Pane>>,
}

/// Oturum adı kuralının tek metni — iki çağıran da bunu döndürüyor.
pub const AD_KURALI: &str = "Oturum adı yalnızca harf, rakam, - _ . içerebilir.";

/// tmux oturum adında yalnızca güvenli karakterler — ad kabuğa değil doğrudan
/// `CommandBuilder`'a gidiyor ama tmux'un kendi ayrıştırması da var.
fn ad_gecerli(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

impl Ptys {
    pub async fn open(
        &self,
        app: AppHandle,
        session: String,
        cols: u16,
        rows: u16,
        workdir: Option<String>,
    ) -> Result<(), PtyError> {
        if !ad_gecerli(&session) {
            return Err(PtyError::Gecersiz(AD_KURALI.into()));
        }
        let mut map = self.inner.lock().await;
        // Zaten açıksa **yeniden bağlan**. Bileşen yeniden kurulduğunda (kip
        // değişimi, HMR) xterm sıfırlanıyor ama tmux ekranın hâlâ doğru
        // olduğunu sanıyor ve yeniden çizmiyor — bölme boş kalıyor. Yeni bir
        // `tmux attach` tam yeniden çizim getirir. Oturum ölmez.
        if let Some(eski) = map.remove(&session) {
            eski.dur.store(true, Ordering::Relaxed);
            detach(eski.pid);
            drop(eski);
        }

        let pair = NativePtySystem::default()
            .openpty(PtySize {
                rows: rows.max(2),
                cols: cols.max(20),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| PtyError::Spawn(e.to_string()))?;

        // İki adım, tek `new-session -A` değil. **Ölçüldü:** `-A` oturumu
        // yaratan istemciye bağlıyor; PTY kapanınca istemci SIGHUP alıyor ve
        // oturum da ölüyor — "bölme kapatmak oturumu öldürmez" ölçütü
        // çiğneniyordu. Önce **ayrık** yaratıp sonra bağlanınca oturumun
        // sahibi sunucu oluyor ve istemcinin ölmesi onu etkilemiyor.
        {
            let mut yarat = std::process::Command::new("tmux");
            yarat.args(["new-session", "-d", "-s", &session]);
            if let Some(d) = workdir.as_deref().filter(|d| !d.is_empty()) {
                yarat.args(["-c", d]);
            }
            // Zaten varsa hata döner; istediğimiz sonuç yine sağlanmış olur.
            let _ = yarat.output();

            // **Durum çubuğu kapalı.** tmux'un yeşil şeridi bizim kabuğumuzda
            // bir işe yaramıyor: oturum adı bölme başlığında zaten yazıyor,
            // saat ve makine adı da öyle. Kanunda "işe yaramayan sayı ve
            // rozet" yasak. Ayar **oturuma özgü** (`-t`), sunucuya değil:
            // kullanıcının kendi terminalindeki öteki oturumlar etkilenmiyor.
            let _ = std::process::Command::new("tmux")
                .args(["set-option", "-t", &session, "status", "off"])
                .output();
        }

        let mut cmd = CommandBuilder::new("tmux");
        cmd.args(["attach-session", "-t", &session]);
        cmd.env("TERM", "xterm-256color");

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| PtyError::Spawn(e.to_string()))?;
        drop(pair.slave);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| PtyError::Spawn(e.to_string()))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| PtyError::Spawn(e.to_string()))?;

        let dur = Arc::new(AtomicBool::new(false));

        // PTY okuması bloklar; ayrı bir iş parçacığında.
        {
            let app = app.clone();
            let session = session.clone();
            let dur = dur.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 8192];
                let engine = base64::engine::general_purpose::STANDARD;
                loop {
                    if dur.load(Ordering::Relaxed) {
                        return;
                    }
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let _ = app.emit(
                                "pty://data",
                                DataPayload {
                                    session: &session,
                                    b64: engine.encode(&buf[..n]),
                                },
                            );
                        }
                        Err(_) => break,
                    }
                }
                if !dur.load(Ordering::Relaxed) {
                    let _ = app.emit("pty://exit", ExitPayload { session: &session });
                }
            });
        }

        let pid = child.process_id();
        // Çocuğu bekleyip zombi bırakmayan ayrı bir iş parçacığı.
        std::thread::spawn(move || {
            let _ = child.wait();
        });

        map.insert(
            session,
            Pane {
                writer,
                master: pair.master,
                dur,
                pid,
            },
        );
        Ok(())
    }

    pub async fn write(&self, session: &str, data: &str) -> Result<(), PtyError> {
        let mut map = self.inner.lock().await;
        let pane = map
            .get_mut(session)
            .ok_or_else(|| PtyError::Yok(session.to_string()))?;
        pane.writer
            .write_all(data.as_bytes())
            .and_then(|_| pane.writer.flush())
            .map_err(|e| PtyError::Io(e.to_string()))
    }

    pub async fn resize(&self, session: &str, cols: u16, rows: u16) -> Result<(), PtyError> {
        let map = self.inner.lock().await;
        let pane = map
            .get(session)
            .ok_or_else(|| PtyError::Yok(session.to_string()))?;
        pane.master
            .resize(PtySize {
                rows: rows.max(2),
                cols: cols.max(20),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| PtyError::Io(e.to_string()))
    }

    /// Bölmeyi kapatır. **tmux oturumu ölmez** — sonraki açılışta `-A` ile
    /// aynı ekrana geri bağlanılır.
    pub async fn close(&self, session: &str) {
        if let Some(pane) = self.inner.lock().await.remove(session) {
            pane.dur.store(true, Ordering::Relaxed);
            // Önce tmux'a "ayrıl" de, sonra PTY'yi bırak.
            detach(pane.pid);
            drop(pane);
        }
    }

    pub async fn acik_olanlar(&self) -> Vec<String> {
        let mut v: Vec<String> = self.inner.lock().await.keys().cloned().collect();
        v.sort();
        v
    }
}

// ─────────────────────── tmux_list tablosu ───────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TmuxSession {
    pub name: String,
    /// Oturumda çalışan program — `bash`, `claude`, `journalctl`…
    pub command: String,
    pub workdir: String,
    /// Fiziksel bir terminal de bu oturuma bağlı mı.
    pub attached: bool,
}

/// `tmux_list` markdown tablo döndürüyor, yapısal veri değil:
///
/// ```text
/// | oturum | calisan | dizin | PC'de acik mi |
/// |---|---|---|---|
/// | `bicim-testi` | bash | /tmp | hayir |
/// ```
///
/// Başlık ve ayraç satırları atlanır; tanınmayan satır sessizce geçilir.
pub fn parse_tmux_list(text: &str) -> Vec<TmuxSession> {
    let mut out = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if !line.starts_with('|') {
            continue;
        }
        let hucreler: Vec<&str> = line
            .trim_matches('|')
            .split('|')
            .map(str::trim)
            .collect();
        if hucreler.len() < 4 {
            continue;
        }
        let name = hucreler[0].trim_matches('`').trim();
        // Başlık satırı ve `|---|---|` ayracı elenir.
        if name.is_empty()
            || name.eq_ignore_ascii_case("oturum")
            || name.chars().all(|c| c == '-' || c == ':')
        {
            continue;
        }
        out.push(TmuxSession {
            name: name.to_string(),
            command: hucreler[1].trim_matches('`').to_string(),
            workdir: hucreler[2].trim_matches('`').to_string(),
            attached: matches!(
                hucreler[3].to_lowercase().as_str(),
                "evet" | "yes" | "true"
            ),
        });
    }
    out
}

// ─────────────────── canlı oturum bilgisi (YEREL) ───────────────────
//
// ⚠️ Bu sorgular **MCP'ye gitmiyor.** `terminals()` pcbridge'in `tmux_list`
// aracını çağırıyor ve markdown bir tablo ayrıştırıyor; oradan gelen liste 10
// saniyede bir tazeleniyor. Bölme başlığındaki dizin ve "ön planda ne
// çalışıyor" sorusu ise **anlık** olmak zorunda: kullanıcı klasör değiştirince
// başlık o an güncellenmeli. `attached_counts()` bu deseni zaten taşıyor —
// yerel `tmux` çağrısı ucuz ve pcbridge'in çıktı biçimine bağımlılık
// eklemiyor.

/// Bir bölmenin **o anki** durumu.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PtyInfo {
    /// Bölmede **ön planda** çalışan program — `bash`, `claude`, `node`…
    /// Klasör değiştirme akışı buna bakıyor: kabuk boştaysa `cd` gönderilir.
    pub command: String,
    pub path: String,
    pub window_index: u32,
    /// Oturumdaki pencere sayısı. CLI çalışırken açılan yeni pencere burada
    /// görünür ve başlık `2/3` diye sayaç gösterir.
    pub windows: u32,
    pub window_name: String,
    pub user: String,
    pub host: String,
}

/// tmux'un biçim dizesi — alanlar sekmeyle ayrılıyor.
///
/// ⚠️ `#{session_name}` bir süs değil, **var olma sınaması.** Ölçüldü:
/// `tmux display-message -p -t <olmayan oturum>` hata vermiyor — çıkış kodu
/// **0** ve bütün alanlar **boş** basılıyor, stderr'e de bir şey yazılmıyor.
/// Yalnızca `status.success()`'e bakan ilk sürüm bu yüzden boş bir `PtyInfo`
/// döndürüyordu ve başlıkta `eymistaken@: ` yazacaktı. Oturum adı boş
/// geliyorsa hedef bulunamamıştır.
const INFO_FMT: &str = concat!(
    "#{session_name}\t",
    "#{pane_current_command}\t",
    "#{pane_current_path}\t",
    "#{window_index}\t",
    "#{session_windows}\t",
    "#{window_name}\t",
    "#{host_short}",
);

/// Kabuğun kullanıcı adı. tmux bunu vermiyor; ortamdan okunuyor.
fn kullanici() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_else(|_| "?".into())
}

pub fn info(session: &str) -> Result<PtyInfo, PtyError> {
    if !ad_gecerli(session) {
        return Err(PtyError::Gecersiz(AD_KURALI.into()));
    }
    // `<ad>:` oturumun **aktif** penceresini hedefliyor; `=` öneki tmux'un
    // önek eşleşmesini kapatıyor ki `term1` sorgusu `term10`'a düşmesin.
    let hedef = format!("={session}:");
    let o = std::process::Command::new("tmux")
        .args(["display-message", "-p", "-t", &hedef, INFO_FMT])
        .output()
        .map_err(|e| PtyError::Io(e.to_string()))?;
    if !o.status.success() {
        return Err(PtyError::Yok(session.to_string()));
    }
    let ham = String::from_utf8_lossy(&o.stdout);
    let p: Vec<&str> = ham.trim_end().split('\t').collect();
    if p.len() < 7 {
        return Err(PtyError::Io(format!("tmux biçimi tanınmadı: {ham:?}")));
    }
    // Boş oturum adı = hedef bulunamadı (bkz. `INFO_FMT` yorumu).
    if p[0].is_empty() {
        return Err(PtyError::Yok(session.to_string()));
    }
    Ok(PtyInfo {
        command: p[1].to_string(),
        path: p[2].to_string(),
        // Sayı okunamazsa 0: uydurma bir pencere numarası göstermek yerine
        // arayüz sayacı hiç çizmiyor.
        window_index: p[3].parse().unwrap_or(0),
        windows: p[4].parse().unwrap_or(0),
        window_name: p[5].to_string(),
        user: kullanici(),
        host: p[6].to_string(),
    })
}

/**
Kullanılmayan bir oturum adı üretir: `term1`, `term2`, …

**Ad ile görünen etiket ayrı şeyler.** Bu ad ağacın, `localStorage`'ın, PTY
`HashMap`'inin ve olay yüklerinin anahtarı; kullanıcının kendi `tmux ls`'inde
de böyle görünüyor. Başlıkta yazan `eymistaken@ZorinOS: ~` ise **etiket** ve
onu `pty_info` besliyor.

`taken` ön yüzün ağacındaki adlar: tmux'ta henüz yaratılmamış ama bir bölmeye
atanmış bir ad varsa (bölme açılıyor, `pty_open` daha dönmedi) o da çakışma
sayılıyor.
*/
pub fn free_name(taken: &[String]) -> String {
    for i in 1..1000u32 {
        let ad = format!("term{i}");
        if taken.iter().any(|t| t == &ad) {
            continue;
        }
        let var = std::process::Command::new("tmux")
            .args(["has-session", "-t", &format!("={ad}")])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if !var {
            return ad;
        }
    }
    // Bin oturum açıkken bile bir ad dönmek zorundayız; pid çakışmaz.
    format!("term-{}", std::process::id())
}

/// Oturum başına **bağlı istemci sayısı**.
///
/// `tmux_list` yalnızca "PC'de acik mi" diye bir boolean veriyor; biz bir
/// bölme açtığımızda o boolean bizim yüzümüzden `evet` oluyor ve "PC'de de
/// açık" etiketi anlamını yitiriyor. Sayıyı alıp kendi bölmemizi düşüyoruz.
pub fn attached_counts() -> HashMap<String, u32> {
    let mut out = HashMap::new();
    let Ok(o) = std::process::Command::new("tmux")
        .args(["list-sessions", "-F", "#{session_name}\t#{session_attached}"])
        .output()
    else {
        return out;
    };
    for line in String::from_utf8_lossy(&o.stdout).lines() {
        if let Some((ad, n)) = line.split_once('\t') {
            if let Ok(n) = n.trim().parse::<u32>() {
                out.insert(ad.to_string(), n);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Exercise the real close path without a model, token, or Tauri window.
    #[tokio::test]
    #[ignore = "creates and removes uniquely named tmux test sessions"]
    async fn close_preserves_tmux_sessions() {
        struct SessionGuard(Vec<String>);
        impl Drop for SessionGuard {
            fn drop(&mut self) {
                for name in &self.0 {
                    let _ = std::process::Command::new("tmux")
                        .args(["kill-session", "-t", &format!("={name}")])
                        .output();
                }
            }
        }
        fn tmux(args: &[&str]) -> std::process::Output {
            std::process::Command::new("tmux")
                .args(args)
                .output()
                .unwrap()
        }
        async fn attach(ptys: &Ptys, name: &str) -> Box<dyn portable_pty::Child + Send + Sync> {
            let pair = NativePtySystem::default()
                .openpty(PtySize {
                    rows: 24,
                    cols: 80,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .unwrap();
            let mut command = CommandBuilder::new("tmux");
            command.args(["attach-session", "-t", &format!("={name}")]);
            command.env("TERM", "xterm-256color");
            let child = pair.slave.spawn_command(command).unwrap();
            drop(pair.slave);
            let writer = pair.master.take_writer().unwrap();
            ptys.inner.lock().await.insert(
                name.to_owned(),
                Pane {
                    writer,
                    master: pair.master,
                    pid: child.process_id(),
                    dur: Arc::new(AtomicBool::new(false)),
                },
            );
            for _ in 0..40 {
                let result = tmux(&[
                    "display-message",
                    "-p",
                    "-t",
                    &format!("{name}:"),
                    "#{session_attached}",
                ]);
                if String::from_utf8_lossy(&result.stdout).trim() == "1" {
                    return child;
                }
                tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            }
            panic!("test client did not attach");
        }
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let mut guard = SessionGuard(Vec::new());
        for count in [1, 8] {
            let ptys = Ptys::default();
            let mut children = Vec::new();
            for index in 0..count {
                let name = format!(
                    "pcbridge-close-{}-{stamp}-{count}-{index}",
                    std::process::id()
                );
                assert!(tmux(&["new-session", "-d", "-s", &name, "-c", "/tmp"])
                    .status
                    .success());
                guard.0.push(name.clone());
                children.push((name.clone(), attach(&ptys, &name).await));
            }
            assert_eq!(ptys.acik_olanlar().await.len(), count);
            for (name, child) in &mut children {
                ptys.close(name).await;
                child.wait().unwrap();
                assert!(tmux(&["has-session", "-t", &format!("={name}")])
                    .status
                    .success());
                let attached = tmux(&[
                    "display-message",
                    "-p",
                    "-t",
                    &format!("{name}:"),
                    "#{session_attached}",
                ]);
                assert_eq!(String::from_utf8_lossy(&attached.stdout).trim(), "0");
            }
            assert!(ptys.acik_olanlar().await.is_empty());
            let name = &children[0].0;
            let mut reopened = attach(&ptys, name).await;
            ptys.close(name).await;
            reopened.wait().unwrap();
            assert!(tmux(&["has-session", "-t", &format!("={name}")])
                .status
                .success());
            println!("{count} panes closed; tmux sessions survived and reopened");
        }
    }

    #[test]
    fn gercek_tablo_ayristirilir() {
        // pcbridge'in 2026-09-02'de döndürdüğü çıktı.
        let t = "| oturum | calisan | dizin | PC'de acik mi |\n\
                 |---|---|---|---|\n\
                 | `bicim-testi` | bash | /tmp | hayir |\n\
                 | `kopru` | claude | /home/eymistaken/Belgeler/Pcbridge | evet |";
        let s = parse_tmux_list(t);
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].name, "bicim-testi");
        assert_eq!(s[0].command, "bash");
        assert_eq!(s[0].workdir, "/tmp");
        assert!(!s[0].attached);
        assert_eq!(s[1].name, "kopru");
        assert!(s[1].attached, "'evet' bağlı demek");
    }

    #[test]
    fn oturum_yoksa_bos_doner() {
        assert!(parse_tmux_list("Acik tmux oturumu yok.").is_empty());
        assert!(parse_tmux_list("").is_empty());
    }

    /// `info` gerçek bir tmux oturumunu okuyor mu — ayrıştırıcı dahil.
    ///
    /// Biçim kabukta da doğrulanmıştı; bu test **kod yolunu** sabitliyor:
    /// `INFO_FMT` altı alan veriyor, `split('\t')` altısını da buluyor ve
    /// `window_index`/`session_windows` sayıya çevriliyor.
    #[test]
    #[ignore = "gerçek tmux oturumu yaratıp siliyor"]
    fn info_gercek_oturumu_okur() {
        let ad = format!("pcbridge-info-{}", std::process::id());
        struct Guard(String);
        impl Drop for Guard {
            fn drop(&mut self) {
                let _ = std::process::Command::new("tmux")
                    .args(["kill-session", "-t", &format!("={}", self.0)])
                    .output();
            }
        }
        let _g = Guard(ad.clone());
        assert!(std::process::Command::new("tmux")
            .args(["new-session", "-d", "-s", &ad, "-c", "/tmp"])
            .output()
            .unwrap()
            .status
            .success());

        let i = info(&ad).expect("info okunmalı");
        assert!(
            KABUK_ADLARI.contains(&i.command.as_str()),
            "boşta bir kabuk beklenirdi, gelen: {}",
            i.command
        );
        assert_eq!(i.path, "/tmp");
        assert_eq!(i.windows, 1);
        assert!(!i.user.is_empty(), "USER ortamdan okunmalı");
        assert!(!i.host.is_empty(), "host_short tmux'tan gelmeli");
        println!("{}@{}: {} · {}", i.user, i.host, i.path, i.command);

        // Yeni pencere: sayaç artıyor ve dizin yeni pencerenin dizini.
        let idx = std::process::Command::new("tmux")
            .args([
                "new-window", "-t", &format!("={ad}:"), "-c", "/etc", "-P", "-F",
                "#{window_index}",
            ])
            .output()
            .unwrap();
        let idx: u32 = String::from_utf8_lossy(&idx.stdout).trim().parse().unwrap();
        let i2 = info(&ad).expect("info okunmalı");
        assert_eq!(i2.windows, 2, "pencere sayısı artmalı");
        assert_eq!(i2.window_index, idx, "aktif pencere yeni olan");
        assert_eq!(i2.path, "/etc", "dizin yeni pencerenin dizini");
        println!("pencere {}/{} · {}", i2.window_index, i2.windows, i2.path);

        // Olmayan oturum: hata, panik değil.
        assert!(info("pcbridge-yok-boyle-bir-sey").is_err());
        // Geçersiz ad ayrıştırıcıya hiç gitmiyor.
        assert!(matches!(info("kötü ad"), Err(PtyError::Gecersiz(_))));
    }

    /// Test için kabuk adları — `info` hangi kabuğun altında koşuyorsa.
    const KABUK_ADLARI: &[&str] = &["bash", "zsh", "sh", "fish", "dash", "ksh"];

    /// `free_name` ne ağaçtaki ne tmux'taki bir adı döndürüyor.
    #[test]
    #[ignore = "tmux'a soruyor"]
    fn free_name_cakismaz() {
        let alinmis: Vec<String> = (1..=3).map(|i| format!("term{i}")).collect();
        let ad = free_name(&alinmis);
        assert!(!alinmis.contains(&ad), "ağaçtaki adı döndürmemeli: {ad}");
        assert!(ad_gecerli(&ad), "üretilen ad tmux'ta geçerli olmalı: {ad}");
        // tmux'ta da yok.
        let var = std::process::Command::new("tmux")
            .args(["has-session", "-t", &format!("={ad}")])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        assert!(!var, "tmux'ta var olan bir adı döndürmemeli: {ad}");
        println!("üretilen ad: {ad}");
    }

    #[test]
    fn oturum_adi_dogrulanir() {
        assert!(ad_gecerli("kopru"));
        assert!(ad_gecerli("test-1_a.b"));
        assert!(!ad_gecerli(""));
        assert!(!ad_gecerli("kötü ad"), "boşluk olmaz");
        assert!(!ad_gecerli("a;rm -rf /"), "kabuk karakteri olmaz");
        assert!(!ad_gecerli(&"x".repeat(65)));
    }
}
