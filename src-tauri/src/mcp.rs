//! pcbridge MCP sunucusuna Streamable HTTP istemcisi.
//!
//! Token bu modülde yalnızca `secrets::get()`'ten alınıp doğrudan taşıyıcının
//! `auth_header` alanına verilir; hiçbir hataya, loga veya frontend'e geçmez.

use std::time::Duration;

use rmcp::{
    RoleClient, ServiceExt,
    model::{CallToolRequestParams, CallToolResult, ContentBlock},
    ServiceError,
    service::{ClientInitializeError, RunningService},
    transport::{
        ConfigureCommandExt, DynamicTransportError, StreamableHttpClientTransport,
        TokioChildProcess, streamable_http_client::StreamableHttpClientTransportConfig,
    },
};
use serde::Serialize;

use crate::secrets::{self, SecretError};

const DEFAULT_ENDPOINT: &str = "http://127.0.0.1:8765/mcp";

/// Uç nokta. `PCBRIDGE_MCP_ENDPOINT` ile geçersiz kılınabilir — gerçek token
/// gerektirmeyen uçtan uca denemelerde sahte bir sunucuya bağlanmak için.
/// Süreç ömrü boyunca bir kez okunur.
pub fn endpoint() -> &'static str {
    static EP: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    EP.get_or_init(|| {
        std::env::var("PCBRIDGE_MCP_ENDPOINT")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_ENDPOINT.to_string())
    })
}

/// El sıkışma + ilk iki çağrının toplam süre sınırı. Sunucu asılırsa arayüz
/// süresiz beklemesin.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

/// Hata sınıflandırma yoklamasının süre sınırı — yalnızca başarısızlık
/// yolunda, bir kez.
const PROBE_TIMEOUT: Duration = Duration::from_secs(5);

// ───────────────────────────── türler ─────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentModel {
    pub id: String,
    pub efforts: Vec<String>,
    pub default_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub description: String,
    pub available: bool,
    pub path: Option<String>,
    pub default_model: Option<String>,
    pub default_effort: Option<String>,
    pub models: Vec<AgentModel>,
    /// Sunucunun "engelli (secilemez)" dediği modeller.
    pub disabled: Vec<String>,
    /// "yalnizca acikca istenirse" listesi.
    pub opt_in: Vec<String>,
    pub note: Option<String>,
}

/// Ajan döngüsüne dönen araç sonucu.
#[derive(Debug, Clone)]
pub struct AracSonuc {
    /// Modele metin olarak verilecek kısım.
    pub metin: String,
    /// Aracın **kendi** hatası. Bağlantı hatası değil; koşumu düşürmez.
    pub hata: bool,
    /// `data:<mime>;base64,…` biçiminde görüntüler.
    pub gorseller: Vec<String>,
}

/// Tek bir araç sonucundan modele taşınacak en fazla görüntü.
const MAX_GORSEL: usize = 4;

/// Bir MCP aracının modele anlatılabilecek hâli.
///
/// `read_only` sunucunun **ipucu**; pcbridge veriyorsa araç filtresinin
/// gruplaması ondan çıkar, vermiyorsa arayüz kendi ad listesine düşer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDef {
    pub name: String,
    pub description: Option<String>,
    pub input_schema: serde_json::Value,
    pub read_only: Option<bool>,
    /// Aracın grubu. **Burada hesaplanıyor**, arayüzde değil: kipi Rust
    /// uyguluyor ve iki ayrı listenin ayrışması "arayüzde masaüstü yazıyordu
    /// ama sormadan çalıştı" hatasına açık kapı bırakırdı.
    pub group: crate::tools::Grup,
    /// Aracı hangi sunucu veriyor (`pcbridge` ya da bir eklenti kimliği).
    /// Arayüz araçları buna göre öbekliyor; `name` zaten öneki taşıyor ama
    /// ayrıştırmayı iki yerde yapmamak için ayrı alan.
    pub server: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnSnapshot {
    pub endpoint: &'static str,
    pub tool_count: usize,
    pub agents: Vec<Agent>,
    pub default_agent: Option<String>,
    pub default_workdir: Option<String>,
    /// Ayrıştırıcı hiçbir ajan çıkaramadıysa ham metin — arayüz bunu gösterip
    /// sessizce boş kalmaktan kurtulur.
    pub raw_agents: Option<String>,
}

/// `agent_run` çağrısının alanları. Prompt **önceden** birleştirilmiş gelir:
/// `preamble + "\n\n---\n\n" + kullanıcı metni`.
#[derive(Debug, Clone)]
pub struct AgentRunRequest {
    pub prompt: String,
    pub agent: String,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub workdir: String,
    pub resume_session: Option<String>,
    pub timeout: u64,
}

/// Tek ekran görüntüsü. `src` doğrudan `<img src>`'e verilebilen `data:` URL'i.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shot {
    pub src: String,
}

/// `screen_capture` yanıtı. İzin kapalıyken `shots` **boş** gelir ve
/// `note` sunucunun ret gerekçesini taşır — bu bir hata değil, bir cevap.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shots {
    pub shots: Vec<Shot>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", content = "detail", rename_all = "camelCase")]
pub enum ConnError {
    /// Keyring'de token yok — ilk açılış.
    NoToken,
    /// Sunucu 401 döndü: token yanlış.
    Unauthorized,
    /// TCP kurulamadı ya da zaman aşımı.
    Unreachable(String),
    Keyring(String),
    Protocol(String),
}

impl From<SecretError> for ConnError {
    fn from(e: SecretError) -> Self {
        ConnError::Keyring(e.to_string())
    }
}

/// `#kod` biçimi — arayüzde `err.*` sözlüğüne çözülüyor, çözülemezse ham
/// metin olduğu gibi kalıyor (`ipc.ts::kodCoz`). Ajan döngüsü araç çağrısı
/// başarısız olduğunda bu metni **modele** de veriyor.
impl std::fmt::Display for ConnError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConnError::NoToken => write!(f, "#noToken"),
            ConnError::Unauthorized => write!(f, "#unauthorized"),
            ConnError::Unreachable(d) => write!(f, "#unreachable:{d}"),
            ConnError::Keyring(d) => write!(f, "{d}"),
            ConnError::Protocol(d) => write!(f, "#protocol:{d}"),
        }
    }
}

/// Model hatası aynı kanaldan geçer: `to_string()` zaten `#kod` üretiyor ve
/// arayüz `kodCoz` ile `err.*` sözlüğüne çözüyor. Sarmalama yüzünden
/// ayrıntının kaybolduğu bir katman eklenmiyor.
impl From<crate::model::ModelError> for ConnError {
    fn from(e: crate::model::ModelError) -> Self {
        ConnError::Protocol(e.to_string())
    }
}

// ───────────────────────── hata sınıflandırma ─────────────────────────

/// `thiserror` zincirini gezip tüm katmanların `Display` metnini toplar.
fn chain(err: &dyn std::error::Error) -> String {
    let mut parts = vec![err.to_string()];
    let mut cur = err.source();
    while let Some(e) = cur {
        parts.push(e.to_string());
        cur = e.source();
    }
    parts.join(" / ")
}

/// Token bir hataya asla konmamalı; yine de son savunma olarak ayıklıyoruz.
fn scrub(text: String, token: &str) -> String {
    if token.len() >= 6 && text.contains(token) {
        text.replace(token, "<token>")
    } else {
        text
    }
}

/// rmcp'nin iki sarmalayıcısında taşıyıcı hatası **`#[source]` ile
/// işaretlenmemiş** — `ClientInitializeError::TransportError.error` ve
/// `ServiceError::TransportSend.0`. `source()` zinciri orada kopuyor ve
/// "Connection refused" ya da "Auth required" yüzeye hiç çıkmıyor; hepsi
/// `Protocol`e düşerdi. Köprüyü elle kuruyoruz.
/// rmcp 3.2.0'da ölçüldü — `kapali_port_unreachable_verir` ve
/// `dortyuzbir_unauthorized_verir` testleri tam bunu bekliyor.
fn deep_text(err: &(dyn std::error::Error + 'static)) -> String {
    let mut text = chain(err);

    let inner: Option<&DynamicTransportError> = match err.downcast_ref::<ClientInitializeError>() {
        Some(ClientInitializeError::TransportError { error, .. }) => Some(error),
        _ => match err.downcast_ref::<ServiceError>() {
            Some(ServiceError::TransportSend(e)) => Some(e),
            _ => None,
        },
    };

    if let Some(dt) = inner {
        text.push_str(" / ");
        text.push_str(&chain(dt));
    }
    text
}

/// Bağlantı kurulamadığında **nedenini kesin olarak** saptar.
///
/// rmcp'nin hata zincirine güvenmiyoruz: `ClientInitializeError::TransportError`,
/// `ServiceError::TransportSend` ve `StreamableHttpError::Client` — üçünde de
/// taşıyıcı hatası `#[source]` ile işaretlenmemiş, bu yüzden ne "Connection
/// refused" ne de "Auth required" hiçbir katmanda yüzeye çıkıyor; hepsi
/// `Protocol`e düşerdi (rmcp 3.2.0'da ölçüldü). Onun yerine tek bir düz HTTP
/// isteğiyle durumu doğrudan okuyoruz.
///
/// Gövde bilerek `{}`: pcbridge kimlik denetimini gövdeyi ayrıştırmadan önce
/// yapıyor (ölçüldü — yanlış token boş gövdeyle de 401 veriyor), dolayısıyla
/// bu istek **MCP oturumu açmıyor.**
async fn probe(uri: &str, token: &str) -> Option<ConnError> {
    let res = reqwest::Client::new()
        .post(uri)
        .bearer_auth(token)
        .header("Accept", "application/json, text/event-stream")
        .header("Content-Type", "application/json")
        .body("{}")
        .timeout(PROBE_TIMEOUT)
        .send()
        .await;

    match res {
        Ok(r) if r.status() == 401 || r.status() == 403 => Some(ConnError::Unauthorized),
        Ok(_) => None,
        Err(e) if e.is_connect() => Some(ConnError::Unreachable("#refused".into())),
        Err(e) if e.is_timeout() => Some(ConnError::Unreachable("#timeout".into())),
        // Başka bir ağ hatası: rmcp'nin metnine bırak.
        Err(_) => None,
    }
}

fn classify(err: &(dyn std::error::Error + 'static), token: &str) -> ConnError {
    let text = scrub(deep_text(err), token);
    let low = text.to_lowercase();
    if low.contains("auth required") || low.contains("401") || low.contains("unauthorized") {
        ConnError::Unauthorized
    } else if low.contains("connection refused")
        || low.contains("os error 111")
        || low.contains("connection reset")
        || low.contains("tcp connect")
        || low.contains("dns error")
        || low.contains("timed out")
    {
        ConnError::Unreachable(text)
    } else {
        ConnError::Protocol(text)
    }
}

// ───────────────────────────── bağlantı ─────────────────────────────

/// İş kimliğini yanıt **metninden** biçimine bakarak bulur.
///
/// Ayırıcıya güvenilmez: iki araç iki farklı biçim döndürüyor —
/// `shell_run_background` → ``Baslatildi: `<id>` ``,
/// `agent_run` → ``**<id>** — durum: `running` `` (ilk ters tırnak **durum**,
/// kimlik değil; bu tam olarak bir kez yanlış kimlik kaydettirdi).
///
/// Kimlik biçimi sabit — `pcbridge/jobs.py`: `%Y%m%d-%H%M%S` + `-` +
/// `uuid4().hex[:6]` → `20260902-055719-3d3336`.
fn find_job_id(text: &str) -> Option<String> {
    const N: usize = 22; // 8 + 1 + 6 + 1 + 6
    let b = text.as_bytes();
    if b.len() < N {
        return None;
    }
    for i in 0..=b.len() - N {
        let p = &b[i..i + N];
        let uygun = p[..8].iter().all(u8::is_ascii_digit)
            && p[8] == b'-'
            && p[9..15].iter().all(u8::is_ascii_digit)
            && p[15] == b'-'
            && p[16..].iter().all(u8::is_ascii_hexdigit);
        if !uygun {
            continue;
        }
        // Daha uzun bir dizgenin ortasından kesmeyelim.
        let onceki_bitisik = i > 0 && (b[i - 1].is_ascii_alphanumeric() || b[i - 1] == b'-');
        let sonraki_bitisik = i + N < b.len()
            && (b[i + N].is_ascii_alphanumeric() || b[i + N] == b'-');
        if onceki_bitisik || sonraki_bitisik {
            continue;
        }
        return std::str::from_utf8(p).ok().map(str::to_string);
    }
    None
}

pub struct Conn {
    client: RunningService<RoleClient, ()>,
    /// Yalnızca hata metinlerinden ayıklamak için; hiçbir yere yazılmaz.
    token: String,
}

impl Conn {
    /// pcbridge'e HTTP ile bağlanır.
    ///
    /// `uri` **`&'static` değil**: `with_uri` `impl Into<Arc<str>>` alıyor
    /// (kaynaktan okundu), eski kısıt bizim kendi koyduğumuzdu — araç
    /// adındaki `&'static str` kısıtı gibi.
    async fn open(uri: &str, token: &str) -> Result<Self, ConnError> {
        let config = StreamableHttpClientTransportConfig::with_uri(uri).auth_header(token);
        let transport = StreamableHttpClientTransport::from_config(config);
        let client = match ().serve(transport).await {
            Ok(c) => c,
            Err(e) => {
                let fallback = classify(&e, token);
                return Err(probe(uri, token).await.unwrap_or(fallback));
            }
        };
        Ok(Self {
            client,
            token: token.to_string(),
        })
    }

    /// Bir eklenti sunucusunu **çocuk süreç** olarak başlatır (stdio).
    ///
    /// Taşıyıcı farklı, gerisi aynı: `().serve(..)` her iki taşıyıcıda da
    /// `RunningService<RoleClient, ()>` döndürüyor, yani `call_for_agent`,
    /// `tool_defs` ve `close` olduğu gibi çalışıyor. Ayrı bir bağlantı türü
    /// yazmaya gerek yok.
    ///
    /// **`token` yok.** `scrub` 6 karakterden kısa bir dizgeyi zaten yok
    /// sayıyor, o yüzden boş dizge güvenli bir "temizlenecek sır yok" demek.
    ///
    /// **stderr yutulmuyor:** ayrı bir kanala alınıp son satırı saklanıyor.
    /// `npx` paketi bulamadığında ya da sunucu kimlik dosyasını göremediğinde
    /// söyleyeceği tek şey orada; panel onu gösteriyor.
    async fn child(
        command: &str,
        args: &[String],
    ) -> Result<(Self, Option<tokio::process::ChildStderr>), ConnError> {
        let cmd = tokio::process::Command::new(command).configure(|c| {
            c.args(args);
            // Çocuğun kendi çocukları da bizimle ölsün; `npx` gerçek sunucuyu
            // bir alt süreç olarak başlatıyor.
            c.kill_on_drop(true);
        });
        let (transport, stderr) = TokioChildProcess::builder(cmd)
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| ConnError::Unreachable(e.to_string()))?;

        let client = ().serve(transport).await.map_err(|e| classify(&e, ""))?;
        Ok((
            Self {
                client,
                token: String::new(),
            },
            stderr,
        ))
    }

    /// Bir aracı çağırıp **ham** yanıtı döndürür. Görüntü bloğu gibi metin
    /// olmayan içerik lazım olduğunda gerekiyor.
    async fn call_tool_raw(
        &self,
        name: impl Into<std::borrow::Cow<'static, str>>,
        args: serde_json::Map<String, serde_json::Value>,
    ) -> Result<CallToolResult, ConnError> {
        let mut params = CallToolRequestParams::new(name);
        if !args.is_empty() {
            params = params.with_arguments(args);
        }
        let res = self
            .client
            .call_tool(params)
            .await
            .map_err(|e| classify(&e, &self.token))?;
        if res.is_error.unwrap_or(false) {
            return Err(ConnError::Protocol(scrub(extract_text(&res), &self.token)));
        }
        Ok(res)
    }

    /// Bir aracı çağırıp metin yanıtını döndürür.
    async fn call_text(
        &self,
        name: impl Into<std::borrow::Cow<'static, str>>,
        args: serde_json::Map<String, serde_json::Value>,
    ) -> Result<String, ConnError> {
        Ok(extract_text(&self.call_tool_raw(name, args).await?))
    }

    /// Ajan döngüsü için araç çağrısı. `call_tool_raw`'dan **iki farkı** var:
    ///
    /// 1. `is_error` yukarı fırlatılmaz. Aracın kendi hatası (dosya yok, komut
    ///    çöktü) modele geri verilmesi gereken bir **sonuçtur**; bağlantı
    ///    hatası gibi koşumu düşürmemeli.
    /// 2. Görüntü blokları **modele taşınır** (`data:` URL olarak), atılmaz.
    ///    Görme yeteneği olmayan bir modelde bunlar sunucuda yok sayılır ya da
    ///    hata verir; hangi modelin göreceğini bot yapılandırması belirler.
    async fn call_for_agent(
        &self,
        name: String,
        args: serde_json::Map<String, serde_json::Value>,
    ) -> Result<AracSonuc, ConnError> {
        let mut params = CallToolRequestParams::new(name);
        if !args.is_empty() {
            params = params.with_arguments(args);
        }
        let res = self
            .client
            .call_tool(params)
            .await
            .map_err(|e| classify(&e, &self.token))?;

        let hata = res.is_error.unwrap_or(false);
        let mut metin = scrub(extract_text(&res), &self.token);

        let mut gorseller: Vec<String> = res
            .content
            .iter()
            .filter_map(|c| match c {
                ContentBlock::Image(img) => {
                    Some(format!("data:{};base64,{}", img.mime_type, img.data))
                }
                _ => None,
            })
            .collect();

        // **Tavan var.** Bir araç onlarca görüntü döndürürse bağlam tek
        // hamlede taşar; sunucuya megabaytlarca base64 gitmeden kesiliyor.
        let fazla = gorseller.len().saturating_sub(MAX_GORSEL);
        gorseller.truncate(MAX_GORSEL);
        if fazla > 0 {
            metin.push_str(&format!("\n[{fazla} görüntü daha vardı, gönderilmedi]"));
        }

        if metin.trim().is_empty() && gorseller.is_empty() {
            metin = "(araç boş yanıt döndürdü)".into();
        }
        Ok(AracSonuc {
            metin,
            hata,
            gorseller,
        })
    }

    /// Araçların adı, açıklaması ve girdi şeması. `snapshot()` bunu zaten
    /// çağırıyor ama yalnızca sayısını tutuyordu; şemalar kilobaytlarca
    /// olduğu için `ConnSnapshot`'a konmuyor, ayrı istendiğinde geliyor.
    /// Araçların adı, sunucusu, açıklaması ve girdi şeması.
    ///
    /// `server` pcbridge değilse ad **öneklenir** (`gmail__send_email`): iki
    /// sunucu aynı adı verebilir ve o zaman çağrı kime gideceğini bilemezdi.
    /// Grup **önekten önceki** adla hesaplanıyor — `tools.rs`'in listeleri
    /// pcbridge'in çıplak adlarını tanıyor, önekli hâli hiçbirine uymazdı.
    async fn tool_defs(&self, token: &str, server: &str) -> Result<Vec<ToolDef>, ConnError> {
        let tools = self
            .client
            .list_all_tools()
            .await
            .map_err(|e| classify(&e, token))?;
        Ok(tools
            .into_iter()
            .map(|t| {
                let ham = t.name.to_string();
                let read_only = t.annotations.and_then(|a| a.read_only_hint);
                let pcb = server == crate::servers::PCBRIDGE;
                ToolDef {
                    // Grup **tek yerde** hesaplanıyor: burada. Eklentinin adı
                    // pcbridge'in listelerine hiç sokulmuyor.
                    group: if pcb {
                        crate::tools::grup(&ham, read_only)
                    } else {
                        crate::tools::grup_eklenti(read_only)
                    },
                    name: if pcb {
                        ham
                    } else {
                        crate::servers::onekle(server, &ham)
                    },
                    description: t.description.map(|d| d.to_string()),
                    input_schema: serde_json::Value::Object((*t.input_schema).clone()),
                    read_only,
                    server: server.to_string(),
                }
            })
            .collect())
    }

    async fn snapshot(&self, token: &str) -> Result<ConnSnapshot, ConnError> {
        let tools = self
            .client
            .list_all_tools()
            .await
            .map_err(|e| classify(&e, token))?;

        let result = self
            .client
            .call_tool(CallToolRequestParams::new("list_agents"))
            .await
            .map_err(|e| classify(&e, token))?;

        let text = extract_text(&result);
        let parsed = parse_agents(&text);

        Ok(ConnSnapshot {
            endpoint: endpoint(),
            tool_count: tools.len(),
            raw_agents: if parsed.agents.is_empty() {
                Some(text)
            } else {
                None
            },
            agents: parsed.agents,
            default_agent: parsed.default_agent,
            default_workdir: parsed.default_workdir,
        })
    }

    pub async fn close(self) {
        // Oturumu düzgün kapat; başarısız olursa yapacak bir şey yok.
        let _ = self.client.cancel().await;
    }
}

/// Bağlı olmayan bir eklentiye yapılan çağrının modele dönen yanıtı.
///
/// **`Err` değil `Ok`:** `Err` koşumu düşürür ve bir eklentinin düşmesi
/// koşumu düşürmemeli. Metin modele ne yapacağını söylüyor.
fn eklenti_yok(sunucu: &str, e: Option<ConnError>) -> AracSonuc {
    let neden = e.map(|e| format!(" ({e})")).unwrap_or_default();
    AracSonuc {
        metin: format!(
            "Hata: `{sunucu}` eklentisi şu an bağlı değil, bu araç \
             çalıştırılamıyor{neden}. Kullanıcıya söyle; Eklentiler \
             panelinden bağlaması gerekiyor. Bu aracı tekrar deneme."
        ),
        hata: true,
        gorseller: Vec::new(),
    }
}

/// Çocuk sürecin dışarıya söylediği son şey — ve yaşayıp yaşamadığı.
#[derive(Default)]
struct StderrIzi {
    /// Son boş olmayan satır. Tamamını tutmuyoruz: bazı sunucular her istekte
    /// log basıyor ve bellekte büyürdü. Panelde gösterilecek olan zaten son
    /// satır — `npx` paketi bulamadığında söylediği tek şey.
    son: std::sync::Mutex<Option<String>>,
    /// Süreç öldü mü.
    oldu: std::sync::atomic::AtomicBool,
}

impl StderrIzi {
    fn oldu(&self) -> bool {
        self.oldu.load(std::sync::atomic::Ordering::Relaxed)
    }
    fn son(&self) -> Option<String> {
        self.son.lock().ok()?.clone()
    }
}

/// Çocuğun stderr'ini izler.
///
/// **EOF bedava bir yaşam sinyali.** Süreç dışarıdan öldürülürse stderr
/// kapanıyor ve okuma döngüsü bitiyor; bu, sürecin gittiğini yoklama yapmadan
/// öğrenmenin yolu. Olmasaydı panel ölmüş bir eklenti için "bağlı · 29 araç"
/// yazmaya devam ederdi.
fn izle_stderr(stderr: tokio::process::ChildStderr) -> std::sync::Arc<StderrIzi> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    let iz = std::sync::Arc::new(StderrIzi::default());
    let yaz = iz.clone();
    tokio::spawn(async move {
        let mut satirlar = BufReader::new(stderr).lines();
        while let Ok(Some(l)) = satirlar.next_line().await {
            let l = l.trim().to_string();
            if l.is_empty() {
                continue;
            }
            if let Ok(mut g) = yaz.son.lock() {
                *g = Some(l);
            }
        }
        yaz.oldu.store(true, std::sync::atomic::Ordering::Relaxed);
    });
    iz
}

/// Bir eklentinin arayüze anlatılabilecek hâli.
///
/// Durumların **hepsinin** ayrı bir insan cümlesi olmalı: "bağlanamadı" tek
/// başına kullanıcıya hiçbir şey söylemiyor. `hata` sunucunun stderr'inden
/// gelen son satır — `npx` paketi bulamadığında söylediği tek şey orası.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EklentiSnapshot {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub enabled: bool,
    pub connected: bool,
    pub tool_count: usize,
    pub error: Option<String>,
}

/// Bağlı (ya da bağlanamamış) bir eklenti.
struct Eklenti {
    conn: Option<Conn>,
    tool_count: usize,
    /// Son hata: bağlantı hatası ya da çocuğun stderr'inin son satırı.
    hata: Option<String>,
    /// Sürecin stderr izi: son satır ve öldü mü.
    stderr: Option<std::sync::Arc<StderrIzi>>,
}

impl Eklenti {
    /// Bağlantı **ve** süreç yaşıyor mu.
    fn bagli(&self) -> bool {
        self.conn.is_some() && !self.stderr.as_ref().is_some_and(|s| s.oldu())
    }
}

/// pcbridge bağlantısı **ve** eklenti kayıt defteri.
///
/// ⚠️ **pcbridge ayrı bir alanda duruyor, `HashMap`'e konmadı.** O kritik:
/// uygulamanın kendi özellikleri (`agent_run`, `tmux_*`, `desktop_*`,
/// `screen_capture`) doğrudan ona çağrı yapıyor ve düşmesi bir arıza.
/// Eklentinin düşmesi arıza değil, yalnızca kendi satırının düşmesi. İkisini
/// aynı kaba koymak bu ayrımı ilk gün kaybettirirdi.
#[derive(Default)]
pub struct McpState {
    inner: tokio::sync::Mutex<Option<Conn>>,
    eklentiler: tokio::sync::Mutex<std::collections::HashMap<String, Eklenti>>,
}

impl McpState {
    /// Token verilirse onunla dener ve **başarılı olursa** keyring'e yazar;
    /// verilmezse keyring'dekini kullanır.
    pub async fn connect(&self, token: Option<String>) -> Result<ConnSnapshot, ConnError> {
        let from_keyring = token.is_none();
        let token = match token {
            Some(t) => t.trim().to_string(),
            None => secrets::get_async().await?.ok_or(ConnError::NoToken)?,
        };
        if token.is_empty() {
            return Err(ConnError::NoToken);
        }

        let mut guard = self.inner.lock().await;
        if let Some(old) = guard.take() {
            old.close().await;
        }

        let work = async {
            let conn = Conn::open(endpoint(), &token).await?;
            let snap = conn.snapshot(&token).await?;
            Ok::<_, ConnError>((conn, snap))
        };

        let (conn, snap) = match tokio::time::timeout(CONNECT_TIMEOUT, work).await {
            Ok(res) => res?,
            Err(_) => {
                return Err(ConnError::Unreachable(format!(
                    "{} saniyede yanıt yok",
                    CONNECT_TIMEOUT.as_secs()
                )));
            }
        };

        // Yalnızca gerçekten çalıştığı kanıtlandıktan sonra saklanır.
        if !from_keyring {
            secrets::set_async(token.clone()).await?;
        }

        *guard = Some(conn);
        Ok(snap)
    }

    /// Kurulu bağlantıyla tazeler; bağlantı yoksa yeniden kurar.
    pub async fn refresh(&self) -> Result<ConnSnapshot, ConnError> {
        let token = secrets::get_async().await?.ok_or(ConnError::NoToken)?;
        {
            let guard = self.inner.lock().await;
            if let Some(conn) = guard.as_ref() {
                return conn.snapshot(&token).await;
            }
        }
        self.connect(None).await
    }

    /// Bir aracı çağırıp yanıtından iş kimliğini alır.
    async fn baslat(
        &self,
        name: impl Into<std::borrow::Cow<'static, str>>,
        args: serde_json::Map<String, serde_json::Value>,
    ) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        let text = conn.call_text(name, args).await?;
        find_job_id(&text)
            .ok_or_else(|| ConnError::Protocol(format!("#jobIdUnreadable:{text}")))
    }

    pub async fn agent_run(&self, req: AgentRunRequest) -> Result<String, ConnError> {
        let mut a = serde_json::Map::new();
        a.insert("prompt".into(), req.prompt.into());
        a.insert("agent".into(), req.agent.into());
        if let Some(m) = req.model {
            a.insert("model".into(), m.into());
        }
        if let Some(e) = req.effort {
            a.insert("effort".into(), e.into());
        }
        a.insert("workdir".into(), req.workdir.into());
        if let Some(s) = req.resume_session {
            a.insert("resume_session".into(), s.into());
        }
        a.insert("timeout".into(), req.timeout.into());
        // Akış dosyadan geliyor; sunucunun beklemesine gerek yok.
        a.insert("wait_seconds".into(), 0.into());
        self.baslat("agent_run", a).await
    }

    /// Araç tanımları — ajan döngüsü ve BotForge'daki filtre bunu kullanıyor.
    ///
    /// pcbridge'inkiler **öneksiz**, eklentilerinkiler `<id>__<araç>`.
    /// Bağlı olmayan bir eklenti listeye hiçbir şey katmıyor ve **hata
    /// vermiyor**: pcbridge ayakta olduğu sürece bot çalışabilmeli.
    pub async fn tools(&self) -> Result<Vec<ToolDef>, ConnError> {
        let token = secrets::get_async().await?.ok_or(ConnError::NoToken)?;
        let mut out = {
            let guard = self.inner.lock().await;
            let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
            conn.tool_defs(&token, crate::servers::PCBRIDGE).await?
        };

        let ekler = self.eklentiler.lock().await;
        for (id, e) in ekler.iter() {
            let Some(conn) = e.conn.as_ref().filter(|_| e.bagli()) else { continue };
            // Bir eklentinin araç listesi alınamazsa yalnızca o eklenti
            // eksik kalır; pcbridge'in 33 aracı ve koşum etkilenmez.
            if let Ok(mut t) = conn.tool_defs("", id).await {
                out.append(&mut t);
            }
        }
        Ok(out)
    }

    /// Ajan döngüsünün araç çağrısı. Yalnızca **bağlantı** hatası `Err` olur.
    ///
    /// Ad öneki hangi sunucuya gideceğini söylüyor (`servers::coz`); önek
    /// eklentiye ait olduğu için sunucuya **çıplak** adla gidiyor.
    pub async fn call_for_agent(
        &self,
        name: String,
        args: serde_json::Map<String, serde_json::Value>,
    ) -> Result<AracSonuc, ConnError> {
        let (sunucu, arac) = crate::servers::coz(&name);
        if sunucu == crate::servers::PCBRIDGE {
            let guard = self.inner.lock().await;
            let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
            return conn.call_for_agent(name, args).await;
        }

        let (sunucu, arac) = (sunucu.to_string(), arac.to_string());
        let mut ekler = self.eklentiler.lock().await;
        // **Bağlı olmayan eklentiye yapılan çağrı modele anlatılır**, koşumu
        // düşürmez: model aracı listede gördüyse çağırması doğaldır, ve
        // "eklenti bağlı değil" cümlesi ona başka bir yol seçtirir.
        let Some(conn) = ekler
            .get(&sunucu)
            .filter(|e| e.bagli())
            .and_then(|e| e.conn.as_ref())
        else {
            return Ok(eklenti_yok(&sunucu, None));
        };

        match conn.call_for_agent(arac, args).await {
            Ok(r) => Ok(r),
            // **Çağrı hatası ikinci yaşam sinyali.** stderr'in EOF'u tek
            // başına yetmiyor: ölçüldü ki bir eklenti iki süreç açabiliyor ve
            // içteki ölünce dıştaki stderr'i açık tutuyor — satır "bağlı"
            // görünmeye devam ederdi. Çağrının düşmesi kesin bilgi.
            Err(e) => {
                if let Some(k) = ekler.get_mut(&sunucu) {
                    k.conn = None;
                    k.tool_count = 0;
                    k.hata = Some(e.to_string());
                }
                Ok(eklenti_yok(&sunucu, Some(e)))
            }
        }
    }

    /// Kayıt defterinin arayüze giden hâli — kapalı ve düşmüş olanlar dahil.
    pub async fn eklenti_durumlari(&self) -> Vec<EklentiSnapshot> {
        let kayitli = crate::servers::list().unwrap_or_default();
        let ekler = self.eklentiler.lock().await;
        kayitli
            .into_iter()
            .map(|s| {
                let e = ekler.get(&s.id);
                EklentiSnapshot {
                    id: s.id,
                    name: s.name,
                    command: s.command,
                    args: s.args,
                    enabled: s.enabled,
                    connected: e.is_some_and(Eklenti::bagli),
                    // Ölmüş bir sürecin araç sayısını göstermek yalan olurdu.
                    tool_count: e.filter(|e| e.bagli()).map_or(0, |e| e.tool_count),
                    error: e.and_then(|e| {
                        e.hata
                            .clone()
                            .or_else(|| e.stderr.as_ref().and_then(|s| s.son()))
                    }),
                }
            })
            .collect()
    }

    /// Bir eklentiyi başlatır (varsa öncekini kapatarak).
    ///
    /// **Hiçbir hata yukarı fırlamıyor:** eklenti bağlanamazsa durumu
    /// kaydedilip `false` dönüyor. Bir eklentinin düşmesi uygulamanın hatası
    /// değil ve pcbridge'i etkilememeli.
    pub async fn eklenti_bagla(&self, s: &crate::servers::Server) -> bool {
        self.eklenti_kes(&s.id).await;
        if !s.enabled {
            return false;
        }

        let sonuc = tokio::time::timeout(CONNECT_TIMEOUT, Conn::child(&s.command, &s.args)).await;
        let (conn, stderr) = match sonuc {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => {
                self.eklenti_yaz(&s.id, None, 0, Some(e.to_string()), None).await;
                return false;
            }
            Err(_) => {
                self.eklenti_yaz(
                    &s.id,
                    None,
                    0,
                    Some(format!("{} saniyede yanıt yok", CONNECT_TIMEOUT.as_secs())),
                    None,
                )
                .await;
                return false;
            }
        };

        let son_satir = stderr.map(izle_stderr);
        // Araç sayısı **sunucudan** geliyor, gömülü bir sayı değil.
        let sayi = conn.tool_defs("", &s.id).await.map(|t| t.len());
        let (sayi, hata) = match sayi {
            Ok(n) => (n, None),
            Err(e) => (0, Some(e.to_string())),
        };
        self.eklenti_yaz(&s.id, Some(conn), sayi, hata, son_satir).await;
        true
    }

    async fn eklenti_yaz(
        &self,
        id: &str,
        conn: Option<Conn>,
        tool_count: usize,
        hata: Option<String>,
        stderr: Option<std::sync::Arc<StderrIzi>>,
    ) {
        self.eklentiler.lock().await.insert(
            id.to_string(),
            Eklenti {
                conn,
                tool_count,
                hata,
                stderr,
            },
        );
    }

    /// Bir eklentinin bağlantısını kapatır; çocuk süreç `Drop` ile ölüyor.
    pub async fn eklenti_kes(&self, id: &str) {
        let eski = self.eklentiler.lock().await.remove(id);
        if let Some(e) = eski {
            if let Some(c) = e.conn {
                c.close().await;
            }
        }
    }

    /// Açık bütün eklentileri (yeniden) bağlar. Açılışta ve panelden
    /// "yenile" denince çağrılıyor.
    pub async fn eklentileri_bagla(&self) {
        for s in crate::servers::list().unwrap_or_default() {
            if s.enabled {
                self.eklenti_bagla(&s).await;
            }
        }
    }

    /// İşin durumunu sorar. **Yan etkisi asıl amaç:** pcbridge biten çocuğu
    /// ancak bu çağrıda topluyor ve `meta.json`'a `status`/`exit_code`
    /// yazıyor. Sorulmazsa iş diskte sonsuza kadar "sürüyor" görünür.
    pub async fn job_status(&self, job_id: String) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        let mut a = serde_json::Map::new();
        a.insert("job_id".into(), job_id.into());
        conn.call_text("job_status", a).await
    }

    /// Makinedeki tüm tmux oturumları — bölmede açık olmayanlar da dahil.
    pub async fn tmux_list(&self) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        conn.call_text("tmux_list", serde_json::Map::new()).await
    }

    /// Oturumu **sonlandırır** — bölme kapatmaktan ayrı ve açık bir eylem.
    pub async fn tmux_kill(&self, session: String) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        let mut a = serde_json::Map::new();
        a.insert("session".into(), session.into());
        conn.call_text("tmux_kill", a).await
    }

    pub async fn job_cancel(&self, job_id: String) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        let mut a = serde_json::Map::new();
        a.insert("job_id".into(), job_id.into());
        conn.call_text("job_cancel", a).await
    }

    // ───────────────────────── masaüstü izni ─────────────────────────

    /// Süreli izni **açar.** Geri sayım bundan sonra diskten okunur; bu çağrı
    /// yalnızca kapıyı aralar. `minutes` sunucuda 1–120'ye kırpılıyor.
    pub async fn desktop_unlock(&self, minutes: u32, reason: String) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        let mut a = serde_json::Map::new();
        a.insert("minutes".into(), minutes.into());
        if !reason.trim().is_empty() {
            a.insert("reason".into(), reason.into());
        }
        conn.call_text("desktop_unlock", a).await
    }

    /// İzni **erken kapatır.** Süre zaten dolmuşsa da çağrılabilir; sunucu
    /// "zaten kapaliydi" der.
    pub async fn desktop_lock(&self) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        conn.call_text("desktop_lock", serde_json::Map::new()).await
    }

    pub async fn system_status(&self) -> Result<String, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        conn.call_text("system_status", serde_json::Map::new())
            .await
    }

    /// Ekran görüntüsü. **İzin kapalıyken sunucu reddediyor** — yanıtta
    /// görüntü yerine yalnızca metin döner ve `shots` boş kalır.
    pub async fn screen_capture(&self, scale: u32) -> Result<Shots, ConnError> {
        let guard = self.inner.lock().await;
        let conn = guard.as_ref().ok_or(ConnError::NoToken)?;
        let mut a = serde_json::Map::new();
        a.insert("monitor".into(), "all".into());
        a.insert("scale".into(), scale.into());
        a.insert("include_pointer".into(), true.into());
        let res = conn.call_tool_raw("screen_capture", a).await?;
        Ok(Shots {
            note: extract_text(&res),
            shots: res
                .content
                .iter()
                .filter_map(|b| match b {
                    ContentBlock::Image(img) => Some(Shot {
                        // `data:` URL'i burada kuruluyor: frontend'in base64'ü
                        // yeniden çözüp Blob kurmasına gerek yok.
                        src: format!("data:{};base64,{}", img.mime_type, img.data),
                    }),
                    _ => None,
                })
                .collect(),
        })
    }

    pub async fn disconnect(&self) {
        if let Some(conn) = self.inner.lock().await.take() {
            conn.close().await;
        }
    }
}

// ─────────────────────────── metin çıkarma ───────────────────────────

/// `list_agents` yapısal veri döndürmüyor. FastMCP dizge dönüşlerini hem
/// `structuredContent: {"result": …}` hem de bir metin bloğu olarak yolluyor;
/// üç olasılığı da karşılıyoruz.
fn extract_text(result: &CallToolResult) -> String {
    if let Some(v) = result
        .structured_content
        .as_ref()
        .and_then(|v| v.get("result"))
        .and_then(|v| v.as_str())
    {
        return v.to_string();
    }

    let joined = result
        .content
        .iter()
        .filter_map(|b| match b {
            ContentBlock::Text(t) => Some(t.text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("\n");

    // Metin bloğunun kendisi {"result": "…"} sarmalı olabilir.
    if let Ok(serde_json::Value::Object(map)) = serde_json::from_str(joined.trim()) {
        if let Some(serde_json::Value::String(s)) = map.get("result") {
            return s.clone();
        }
    }
    joined
}

// ────────────────────────── ajan ayrıştırma ──────────────────────────

#[derive(Default)]
pub struct ParsedAgents {
    pub agents: Vec<Agent>,
    pub default_agent: Option<String>,
    pub default_workdir: Option<String>,
}

/// `` `…` `` içindeki tüm parçaları sırayla toplar.
fn backticked(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = s;
    while let Some(a) = rest.find('`') {
        let after = &rest[a + 1..];
        match after.find('`') {
            Some(b) => {
                let inner = after[..b].trim();
                if !inner.is_empty() {
                    out.push(inner.to_string());
                }
                rest = &after[b + 1..];
            }
            None => break,
        }
    }
    out
}

/// `- \`sonnet\` — effort: low, medium, high (varsayilan medium)`
fn parse_model_line(line: &str) -> Option<AgentModel> {
    let id = backticked(line).into_iter().next()?;
    let mut efforts = Vec::new();
    let mut default_effort = None;

    if let Some(pos) = line.find("effort:") {
        let tail = &line[pos + "effort:".len()..];
        let (list, paren) = match tail.find('(') {
            Some(i) => (&tail[..i], Some(&tail[i..])),
            None => (tail, None),
        };
        efforts = list
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect();
        if let Some(p) = paren {
            // "(varsayilan medium)"
            default_effort = p
                .trim_matches(|c| c == '(' || c == ')')
                .split_whitespace()
                .nth(1)
                .map(|s| s.trim_end_matches(')').to_string());
        }
    }

    Some(AgentModel {
        id,
        efforts,
        default_effort,
    })
}

/// Sunucunun markdown çıktısını ayrıştırır. Tanınmayan satırlar **sessizce
/// atlanır** — biçim değişirse ajan yine listelenir, bağlantı düşmez.
pub fn parse_agents(text: &str) -> ParsedAgents {
    let mut out = ParsedAgents::default();
    let mut cur: Option<Agent> = None;
    let mut in_models = false;

    for raw in text.lines() {
        let indent = raw.len() - raw.trim_start().len();
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }

        // Ajan başlığı: girintisiz "- `id` — açıklama · ✅ /yol"
        if indent == 0 && line.starts_with("- `") {
            if let Some(a) = cur.take() {
                out.agents.push(a);
            }
            in_models = false;

            let Some(id) = backticked(line).into_iter().next() else {
                continue;
            };
            let after_id = line.split_once('`').and_then(|(_, r)| r.split_once('`'));
            let tail = after_id.map(|(_, r)| r).unwrap_or("");

            // ✅/❌ işaretini bul: açıklama solunda, yol sağında.
            let (marker, available) = match (tail.find('✅'), tail.find('❌')) {
                (Some(i), _) => (Some((i, '✅'.len_utf8())), true),
                (None, Some(i)) => (Some((i, '❌'.len_utf8())), false),
                (None, None) => (None, false),
            };

            let (desc, path) = match marker {
                Some((i, w)) => (
                    tail[..i].trim().trim_end_matches('·').trim(),
                    Some(tail[i + w..].trim().to_string()).filter(|s| !s.is_empty()),
                ),
                None => (tail.trim(), None),
            };

            cur = Some(Agent {
                id,
                description: desc
                    .trim_start_matches('—')
                    .trim_start_matches('-')
                    .trim()
                    .to_string(),
                available,
                path,
                default_model: None,
                default_effort: None,
                models: Vec::new(),
                disabled: Vec::new(),
                opt_in: Vec::new(),
                note: None,
            });
            continue;
        }

        // Girintisiz kuyruk satırları.
        if indent == 0 && !line.starts_with('-') {
            if let Some(v) = line.strip_prefix("ajan belirtilmezse:") {
                out.default_agent = backticked(v).into_iter().next();
            } else if let Some(v) = line.strip_prefix("varsayilan calisma dizini:") {
                out.default_workdir = backticked(v).into_iter().next();
            }
            continue;
        }

        let Some(agent) = cur.as_mut() else { continue };

        // Model satırları modeller: altında ve daha derin girintide.
        if in_models && indent >= 4 && line.starts_with("- `") {
            if let Some(m) = parse_model_line(line) {
                agent.models.push(m);
            }
            continue;
        }

        let Some(field) = line.strip_prefix("- ") else {
            continue;
        };
        in_models = false;

        if field.starts_with("komut:") {
            // Prompt şablonu taşıyor, arayüzde işi yok.
        } else if let Some(v) = field.strip_prefix("varsayilan:") {
            let parts = backticked(v);
            agent.default_model = parts.first().cloned();
            agent.default_effort = parts.get(1).cloned();
        } else if field.starts_with("modeller:") {
            in_models = true;
        } else if let Some(v) = field.strip_prefix("engelli (secilemez):") {
            agent.disabled = backticked(v);
        } else if let Some(v) = field.strip_prefix("yalnizca acikca istenirse:") {
            agent.opt_in = backticked(v);
        } else if let Some(v) = field.strip_prefix("not:") {
            agent.note = Some(v.trim().to_string());
        }
    }

    if let Some(a) = cur {
        out.agents.push(a);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// pcbridge'in 2026-09-01'de gerçekten döndürdüğü çıktı.
    const REAL: &str = "**Tanimli ajanlar**\n\n\
- `claude` — Claude Code - Anthropic's terminal coding agent · ✅ /home/eymistaken/.local/bin/claude\n\
\x20 - komut: `claude -p '{prompt}' --output-format stream-json --verbose --dangerously-skip-permissions`\n\
\x20 - varsayilan: `sonnet` · effort `medium`\n\
\x20 - modeller:\n\
\x20   - `sonnet` — effort: low, medium, high, xhigh, max (varsayilan medium)\n\
\x20   - `opus` — effort: low, medium, high, xhigh, max (varsayilan high)\n\
\x20   - `haiku` — effort: low, medium, high, xhigh, max (varsayilan medium)\n\
\x20 - engelli (secilemez): `fable`, `best`\n\n\
- `antigravity` — Antigravity CLI (agy) - Google's terminal coding agent · ✅ /home/eymistaken/.local/bin/agy\n\
\x20 - varsayilan: `gemini-3.6-flash` · effort `high`\n\
\x20 - modeller:\n\
\x20   - `gemini-3.6-flash` — effort: low, medium, high (varsayilan high)\n\
\x20   - `gemini-3.1-pro` — effort: low, high (varsayilan high)\n\
\x20 - yalnizca acikca istenirse: `claude-sonnet-4-6`, `gpt-oss-120b-medium`\n\
\x20 - not: bu ajanda model verilince effort da zorunlu\n\n\
ajan belirtilmezse: `claude`\n\
varsayilan calisma dizini: `/home/eymistaken`\n";

    #[test]
    fn gercek_ciktiyi_ayristirir() {
        let p = parse_agents(REAL);
        assert_eq!(p.agents.len(), 2);
        assert_eq!(p.default_agent.as_deref(), Some("claude"));
        assert_eq!(p.default_workdir.as_deref(), Some("/home/eymistaken"));

        let c = &p.agents[0];
        assert_eq!(c.id, "claude");
        assert_eq!(c.description, "Claude Code - Anthropic's terminal coding agent");
        assert!(c.available);
        assert_eq!(c.path.as_deref(), Some("/home/eymistaken/.local/bin/claude"));
        assert_eq!(c.default_model.as_deref(), Some("sonnet"));
        assert_eq!(c.default_effort.as_deref(), Some("medium"));
        assert_eq!(c.models.len(), 3);
        assert_eq!(c.models[1].id, "opus");
        assert_eq!(c.models[1].efforts, ["low", "medium", "high", "xhigh", "max"]);
        assert_eq!(c.models[1].default_effort.as_deref(), Some("high"));
        assert_eq!(c.disabled, ["fable", "best"]);
        // `komut:` satırı modele karışmamalı.
        assert!(c.models.iter().all(|m| m.id != "claude -p '{prompt}'"));

        let a = &p.agents[1];
        assert_eq!(a.id, "antigravity");
        assert_eq!(a.models.len(), 2);
        assert_eq!(a.opt_in, ["claude-sonnet-4-6", "gpt-oss-120b-medium"]);
        assert_eq!(a.note.as_deref(), Some("bu ajanda model verilince effort da zorunlu"));
    }

    #[test]
    fn bicim_bozulursa_ajan_yine_cikar() {
        let text = "- `claude` — bir sey\n  - bilinmeyen alan: xyz\n  - modeller:\n";
        let p = parse_agents(text);
        assert_eq!(p.agents.len(), 1);
        assert_eq!(p.agents[0].id, "claude");
        assert!(p.agents[0].models.is_empty());
    }

    #[test]
    fn erisilemeyen_ajan_isaretlenir() {
        let p = parse_agents("- `agy` — yok · ❌ bulunamadi\n");
        assert_eq!(p.agents.len(), 1);
        assert!(!p.agents[0].available);
    }

    #[test]
    fn bos_metin_cokmez() {
        assert!(parse_agents("").agents.is_empty());
    }

    /// Kapalı bir porta bağlanmak `Unreachable` vermeli — `Protocol` değil.
    /// Ayrım önemli: arayüz birine "pcbridge çalışıyor mu?" der, diğerine değil.
    #[tokio::test]
    async fn kapali_port_unreachable_verir() {
        // Serbest bir port kap, sonra bırak: kimse dinlemiyor olsun.
        let port = {
            let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            l.local_addr().unwrap().port()
        };
        let uri: &'static str =
            Box::leak(format!("http://127.0.0.1:{port}/mcp").into_boxed_str());

        match Conn::open(uri, "onemsiz").await {
            Err(ConnError::Unreachable(_)) => {}
            Err(other) => panic!("Unreachable bekleniyordu, gelen: {other:?}"),
            Ok(_) => panic!("kapali porta baglanti kuruldu"),
        }
    }

    /// 401 dönen bir sunucu `Unauthorized` vermeli, ve hata metninde token
    /// **geçmemeli**.
    #[tokio::test]
    async fn dortyuzbir_unauthorized_verir() {
        use std::io::{BufRead, BufReader, Write};

        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(stream) = stream else { continue };
                std::thread::spawn(move || {
                    // İsteği sonuna kadar oku, yoksa yanıtı yazarken karşı
                    // taraf RST alır ve hata "sending request" gibi görünür.
                    let mut reader = BufReader::new(&stream);
                    let mut len = 0usize;
                    loop {
                        let mut line = String::new();
                        if reader.read_line(&mut line).unwrap_or(0) == 0 {
                            return;
                        }
                        let t = line.trim_end();
                        if t.is_empty() {
                            break;
                        }
                        if let Some(v) = t.to_ascii_lowercase().strip_prefix("content-length:") {
                            len = v.trim().parse().unwrap_or(0);
                        }
                    }
                    if len > 0 {
                        let mut body = vec![0u8; len];
                        use std::io::Read;
                        let _ = reader.read_exact(&mut body);
                    }

                    let mut out = &stream;
                    let _ = out.write_all(
                        b"HTTP/1.1 401 Unauthorized\r\n\
                          WWW-Authenticate: Bearer realm=\"t\"\r\n\
                          Content-Length: 0\r\n\
                          Connection: close\r\n\r\n",
                    );
                    let _ = out.flush();
                    let _ = stream.shutdown(std::net::Shutdown::Write);
                });
            }
        });

        let uri: &'static str =
            Box::leak(format!("http://127.0.0.1:{port}/mcp").into_boxed_str());
        const GIZLI: &str = "cok-gizli-token-123";

        match Conn::open(uri, GIZLI).await {
            Err(ConnError::Unauthorized) => {}
            Err(ConnError::Protocol(d)) | Err(ConnError::Unreachable(d)) => {
                assert!(!d.contains(GIZLI), "token hata metnine sizdi: {d}");
                panic!("Unauthorized bekleniyordu, gelen metin: {d}");
            }
            Err(other) => panic!("Unauthorized bekleniyordu, gelen: {other:?}"),
            Ok(_) => panic!("401 donen sunucuya baglanti kuruldu"),
        }
    }

    /// İki aracın **gerçek** yanıt biçimi. `agent_run` biçimi
    /// `pcbridge/tools.py::_fmt_job_summary`'den birebir alındı.
    #[test]
    fn is_kimligi_iki_bicimde_de_bulunur() {
        let shell = "Baslatildi: `20260902-054020-ea66a9`\n                     Durum icin: job_status('20260902-054020-ea66a9')";
        assert_eq!(
            find_job_id(shell).as_deref(),
            Some("20260902-054020-ea66a9")
        );

        let agent = "**20260902-055719-3d3336** — durum: `running`\n                     ajan: claude · model: sonnet · effort: low\n                     komut: `claude -p '…'`\n                     dizin: `/home/eymistaken` · sure: 0s";
        assert_eq!(
            find_job_id(agent).as_deref(),
            Some("20260902-055719-3d3336"),
            "ilk ters tırnak `running` — ona kanmamalı"
        );

        // Uyarı satırı önde olsa da kimlik bulunur.
        let uyarili = "⚠️ **Istenen model `opus` ama calisan `sonnet`.**\n\n                       **20260902-060000-abcdef** — durum: `finished` (exit 0)";
        assert_eq!(
            find_job_id(uyarili).as_deref(),
            Some("20260902-060000-abcdef")
        );
    }

    #[test]
    fn kimlik_yoksa_none_doner() {
        assert_eq!(find_job_id("hiç kimlik yok"), None);
        assert_eq!(find_job_id(""), None);
        // Biçime benzeyen ama daha uzun bir dizgenin ortası alınmamalı.
        assert_eq!(find_job_id("x20260902-055719-3d3336aa"), None);
    }

    /// **Gerçek bir stdio MCP sunucusuyla** uçtan uca: çocuk süreç başlıyor,
    /// araç listesi geliyor, adlar önekleniyor ve çağrı doğru yere gidiyor.
    ///
    /// ```text
    /// cargo test --lib gercek_eklenti -- --ignored --nocapture
    /// ```
    ///
    /// Sunucu `PLUGIN_CMD` ile verilir; varsayılan olarak npx önbelleğindeki
    /// `chrome-devtools-mcp` kullanılıyor — **ağ gerektirmiyor** ve kimlik
    /// istemiyor, yani bu testin çalışması için hiçbir şey indirilmiyor.
    #[tokio::test]
    #[ignore = "gerçek bir stdio MCP sunucusu gerekiyor"]
    async fn gercek_eklenti_baglanir_ve_araclari_oneklenir() {
        let cmd = std::env::var("PLUGIN_CMD").unwrap_or_else(|_| {
            format!(
                "{}/.npm/_npx/15c61037b1978c83/node_modules/.bin/chrome-devtools-mcp",
                std::env::var("HOME").unwrap_or_default()
            )
        });

        let (conn, stderr) = Conn::child(&cmd, &[])
            .await
            .expect("eklenti başlatılamadı");
        // stderr yutulmuyor: bağlanamama sebebinin tek kaynağı orası.
        assert!(stderr.is_some(), "stderr kanalı açık olmalı");

        let araclar = conn.tool_defs("", "dev").await.expect("araç listesi yok");
        assert!(!araclar.is_empty(), "sunucu hiç araç vermedi");
        println!("{} araç", araclar.len());

        for t in &araclar {
            assert!(
                t.name.starts_with("dev__"),
                "eklenti aracı öneksiz kaldı: {}",
                t.name
            );
            assert_eq!(t.server, "dev");
            // **Hiçbir eklenti aracı masaüstü sayılamaz**: o grup pcbridge'in
            // kilidini ve kapılarını anlatıyor.
            assert_ne!(t.group, crate::tools::Grup::Desktop, "{}", t.name);
        }

        // Bu sunucu `click` ve `drag` adında araçlar veriyor — pcbridge'in
        // masaüstü listesindeki adlara yakın. Önek olmasaydı yönlendirme
        // belirsiz kalırdı; `coz` doğru sunucuyu buluyor.
        let ilk = &araclar[0].name;
        let (sunucu, arac) = crate::servers::coz(ilk);
        assert_eq!(sunucu, "dev");
        assert!(!arac.contains(crate::servers::AYIRAC), "{arac}");
        println!("{ilk} → sunucu={sunucu} araç={arac}");

        conn.close().await;
    }

    /// **Bitiş ölçütü 3:** eklenti süreci dışarıdan öldürülünce yalnız o satır
    /// düşer — pcbridge etkilenmez, uygulama çökmez.
    ///
    /// ```text
    /// cargo test --lib eklenti_oldurulunce -- --ignored --nocapture
    /// ```
    ///
    /// `servers.json` **geçici bir dizine** yazılıyor (`XDG_CONFIG_HOME`);
    /// kullanıcının gerçek yapılandırmasına dokunulmuyor.
    #[tokio::test]
    #[ignore = "gerçek bir stdio MCP sunucusu gerekiyor"]
    async fn eklenti_oldurulunce_yalniz_o_satir_duser() {
        let kok = std::env::temp_dir().join(format!("pcbd-eklenti-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&kok);
        std::fs::create_dir_all(&kok).unwrap();
        // SAFETY: bu test `#[ignore]` ve tek başına koşuyor; yalnızca kendi
        // geçici dizinini gösteriyor.
        unsafe { std::env::set_var("XDG_CONFIG_HOME", &kok) };

        let cmd = std::env::var("PLUGIN_CMD").unwrap_or_else(|_| {
            format!(
                "{}/.npm/_npx/15c61037b1978c83/node_modules/.bin/chrome-devtools-mcp",
                std::env::var("HOME").unwrap_or_default()
            )
        });
        crate::servers::create(crate::servers::ServerDraft {
            name: "Dev".into(),
            command: cmd,
            args: vec![],
            enabled: true,
        })
        .expect("sunucu kaydedilemedi");

        // **Sır taşımıyor ve 0600.**
        let dosya = kok.join("pcbridge-desktop/servers.json");
        let metin = std::fs::read_to_string(&dosya).unwrap();
        println!("servers.json:\n{metin}");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&dosya).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600, "servers.json 0600 olmalı, {mode:o}");
        }

        let state = McpState::default();
        state.eklentileri_bagla().await;

        let d = state.eklenti_durumlari().await;
        assert_eq!(d.len(), 1);
        assert!(d[0].connected, "bağlanamadı: {:?}", d[0].error);
        assert!(d[0].tool_count > 0, "araç sayısı sunucudan gelmeli");
        println!("bağlı · {} araç", d[0].tool_count);

        // Süreci **dışarıdan** öldür: gerçek senaryo bu.
        let cikti = std::process::Command::new("pgrep")
            .args(["-f", "chrome-devtools-mcp"])
            .output()
            .expect("pgrep koşmadı");
        let pidler: Vec<String> = String::from_utf8_lossy(&cikti.stdout)
            .lines()
            .map(str::to_string)
            .collect();
        println!("eşleşen pid'ler: {pidler:?} (bizim pid: {})", std::process::id());
        // ⚠️ **Bir eklenti birden çok süreç açabiliyor** — ölçüldü: bu sunucu
        // iki tane açıyor ve yalnızca içteki öldürülünce dıştaki stderr'i
        // açık tutuyor, yani EOF gelmiyor. Gerçek senaryoda ağacın tamamı
        // ölür; kalan durumu çağrı hatası yakalıyor (`call_for_agent`).
        assert!(!pidler.is_empty(), "eklenti süreci bulunamadı");
        for pid in &pidler {
            let st = std::process::Command::new("kill")
                .arg("-9")
                .arg(pid)
                .status();
            println!("kill {pid} → {st:?}");
        }

        // stderr'in EOF'u gelene kadar kısa bir pay.
        for _ in 0..40 {
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            if !state.eklenti_durumlari().await[0].connected {
                break;
            }
        }

        let d = state.eklenti_durumlari().await;
        assert!(!d[0].connected, "ölmüş süreç hâlâ bağlı görünüyor");
        assert_eq!(d[0].tool_count, 0, "ölmüş sürecin araç sayısı yazılmamalı");
        // Kayıt duruyor: satır kaybolmuyor, **düşüyor**.
        assert_eq!(d[0].name, "Dev");

        // Ölmüş eklentiye yapılan çağrı koşumu düşürmüyor, modele anlatılıyor.
        let r = state
            .call_for_agent("dev__list_pages".into(), serde_json::Map::new())
            .await
            .expect("çağrı Err dönmemeli — koşum düşerdi");
        assert!(r.hata);
        assert!(r.metin.contains("bağlı değil"), "{}", r.metin);
        println!("çağrı yanıtı: {}", r.metin);

        // **pcbridge etkilenmiyor.** Eklenti düştü ama pcbridge'e giden yol
        // ayrı bir alanda; oraya yapılan çağrı hâlâ kendi hatasını veriyor
        // ("token yok"), eklentinin hatasını değil.
        let pcb = state
            .call_for_agent("screen_info".into(), serde_json::Map::new())
            .await;
        match pcb {
            Err(ConnError::NoToken) => println!("pcbridge yolu sağlam (bu testte token yok)"),
            Ok(_) => println!("pcbridge yolu sağlam (bağlı)"),
            Err(e) => panic!("pcbridge yolu eklentiden etkilendi: {e}"),
        }

        let _ = std::fs::remove_dir_all(&kok);
    }

    #[test]
    fn scrub_tokeni_siler() {
        let s = scrub("hata: abcdef123 kotu".into(), "abcdef123");
        assert_eq!(s, "hata: <token> kotu");
    }
}
