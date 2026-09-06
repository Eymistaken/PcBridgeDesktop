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
            return Err(PtyError::Gecersiz(
                "Oturum adı yalnızca harf, rakam, - _ . içerebilir.".into(),
            ));
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
