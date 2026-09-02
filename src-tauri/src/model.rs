//! OpenAI-uyumlu model sunucusu istemcisi.
//!
//! Tek protokol: `/v1/models` ve `/v1/chat/completions`. LM Studio, Ollama,
//! llama.cpp ve vLLM hepsi bunu sunuyor, dört entegrasyon değil bir tane
//! yazılıyor. Bu makinede **LM Studio ile ölçüldü** (2026-09-02).
//!
//! Sunucu ayarı tek ve geneldir — bot başına değil. `model.json` yalnızca
//! adresi taşır; **hiçbir sır dosyada durmaz**, isteğe bağlı API anahtarı
//! keyring'e `model_api_key` hesabı olarak gider.
//!
//! Akış `Response::chunk()` ile okunuyor; reqwest'in `stream` özelliği
//! gerekmiyor (`response.rs:310` özellik kapısının dışında).

use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// Sunucuya ilk bağlanma (model listesi) için tavan.
const PROBE_TIMEOUT: Duration = Duration::from_secs(10);

/// Yerel modeller yavaş: 35B'lik bir MoE ilk token'ı dakikalarca
/// bekletebiliyor. Bu, **tek bir isteğin** tavanı; koşumun tamamı değil.
const CHAT_TIMEOUT: Duration = Duration::from_secs(600);

/// Bağlantı havuzu ve TLS oturumu yeniden kullanılsın diye tek istemci.
/// `mcp.rs:193`'teki "her çağrıda `Client::new()`" hatası tekrarlanmıyor.
fn client() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(reqwest::Client::new)
}

// ─────────────────────────── hata ───────────────────────────

/// `ConnError` deseninin ikizi: `#kod` dizgeleri arayüzde `err.*` anahtarına
/// çözülüyor (`ipc.ts::kodCoz`), çözülemezse ham metin olduğu gibi kalıyor.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", content = "detail", rename_all = "camelCase")]
pub enum ModelError {
    /// Adres hiç girilmemiş.
    NoServer,
    /// Sunucuya ulaşılamadı — kapalı, yanlış port, ağ yok.
    Unreachable(String),
    /// 401/403 — anahtar yanlış ya da eksik.
    Unauthorized,
    /// Sunucu yanıt verdi ama beklenmeyen bir şey söyledi.
    Protocol(String),
    /// Keyring'in kendisiyle ilgili sorun.
    Keyring(String),
}

impl std::fmt::Display for ModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModelError::NoServer => write!(f, "#modelNoServer"),
            ModelError::Unreachable(d) => write!(f, "#modelUnreachable:{d}"),
            ModelError::Unauthorized => write!(f, "#modelUnauthorized"),
            ModelError::Protocol(d) => write!(f, "#modelProtocol:{d}"),
            ModelError::Keyring(d) => write!(f, "{d}"),
        }
    }
}

impl From<crate::secrets::SecretError> for ModelError {
    fn from(e: crate::secrets::SecretError) -> Self {
        ModelError::Keyring(e.to_string())
    }
}

/// reqwest hatasını sınıflandırır. Adres ya da anahtar metne sızmasın diye
/// yalnızca hatanın kendi cümlesi taşınıyor.
fn classify(e: &reqwest::Error) -> ModelError {
    if e.is_timeout() {
        return ModelError::Unreachable("zaman aşımı".into());
    }
    if e.is_connect() {
        return ModelError::Unreachable("bağlanılamadı".into());
    }
    ModelError::Unreachable(e.to_string())
}

// ─────────────────────────── yapılandırma ───────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    /// `http://127.0.0.1:1234/v1` gibi. Sondaki eğik çizgi normalleştirilir.
    pub base_url: String,
    /// Anahtarın kendisi **değil**, yalnızca var olup olmadığı. Arayüz
    /// alanı doldurulmuş göstersin diye; sır hiçbir zaman diske yazılmaz.
    #[serde(default)]
    pub has_key: bool,
}

#[derive(Serialize, Deserialize)]
struct Store {
    version: u32,
    #[serde(default)]
    base_url: String,
    #[serde(default)]
    has_key: bool,
}

fn path() -> PathBuf {
    crate::bots::config_dir().join("model.json")
}

/// `bots.rs::write_store` ile aynı atomik yazma: tmp + fsync + 0600 + rename.
fn write_store(store: &Store) -> Result<(), ModelError> {
    let dir = crate::bots::config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| ModelError::Protocol(e.to_string()))?;
    let text = serde_json::to_string_pretty(store).map_err(|e| ModelError::Protocol(e.to_string()))?;
    let tmp = dir.join("model.json.tmp");
    {
        let mut f = std::fs::File::create(&tmp).map_err(|e| ModelError::Protocol(e.to_string()))?;
        f.write_all(text.as_bytes())
            .map_err(|e| ModelError::Protocol(e.to_string()))?;
        f.sync_all().map_err(|e| ModelError::Protocol(e.to_string()))?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp, path()).map_err(|e| ModelError::Protocol(e.to_string()))
}

/// Sondaki eğik çizgiyi atar; `/v1` yazılmamışsa **eklemez** — kullanıcının
/// adresini tahmin ederek düzeltmek, yanlış adreste sessizce başarısız olmaya
/// yol açardı. Panelde ne beklendiği yazıyor.
fn normalize(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

pub fn read_config() -> ModelConfig {
    let store: Store = std::fs::read_to_string(path())
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or(Store {
            version: 1,
            base_url: String::new(),
            has_key: false,
        });
    ModelConfig {
        base_url: store.base_url,
        has_key: store.has_key,
    }
}

/// Adresi ve (verilmişse) anahtarı kaydeder. `key: Some("")` anahtarı siler.
pub async fn save_config(base_url: String, key: Option<String>) -> Result<ModelConfig, ModelError> {
    let base_url = normalize(&base_url);

    let has_key = match key {
        Some(k) if k.trim().is_empty() => {
            crate::secrets::clear_of_async(crate::secrets::MODEL_KEY).await?;
            false
        }
        Some(k) => {
            crate::secrets::set_of_async(crate::secrets::MODEL_KEY, k.trim().to_string()).await?;
            true
        }
        // Dokunulmadı: keyring'e sorulur, dosyadaki bayrağa güvenilmez.
        None => crate::secrets::has_of_async(crate::secrets::MODEL_KEY).await?,
    };

    write_store(&Store {
        version: 1,
        base_url: base_url.clone(),
        has_key,
    })?;
    Ok(ModelConfig { base_url, has_key })
}

async fn api_key() -> Result<Option<String>, ModelError> {
    Ok(crate::secrets::get_of_async(crate::secrets::MODEL_KEY).await?)
}

fn request(
    method: reqwest::Method,
    base: &str,
    yol: &str,
    key: Option<&str>,
) -> Result<reqwest::RequestBuilder, ModelError> {
    if base.is_empty() {
        return Err(ModelError::NoServer);
    }
    let mut r = client().request(method, format!("{base}{yol}"));
    if let Some(k) = key {
        r = r.bearer_auth(k);
    }
    Ok(r)
}

// ─────────────────────────── model listesi ───────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
}

/// `GET /v1/models`. Bağlantıyı denemenin de yolu bu.
pub async fn models(base_url: &str) -> Result<Vec<ModelInfo>, ModelError> {
    let key = api_key().await?;
    let res = request(reqwest::Method::GET, base_url, "/models", key.as_deref())?
        .timeout(PROBE_TIMEOUT)
        .send()
        .await
        .map_err(|e| classify(&e))?;

    if res.status() == 401 || res.status() == 403 {
        return Err(ModelError::Unauthorized);
    }
    if !res.status().is_success() {
        return Err(ModelError::Protocol(format!("HTTP {}", res.status().as_u16())));
    }

    let v: serde_json::Value = res.json().await.map_err(|e| classify(&e))?;
    let dizi = v
        .get("data")
        .and_then(|d| d.as_array())
        .ok_or_else(|| ModelError::Protocol("yanıtta `data` dizisi yok".into()))?;

    Ok(dizi
        .iter()
        .filter_map(|m| m.get("id").and_then(|i| i.as_str()))
        .map(|id| ModelInfo { id: id.to_string() })
        .collect())
}

// ─────────────────────────── sohbet tipleri ───────────────────────────

/// Modele giden araç tanımı. MCP'nin `input_schema`'sı doğrudan `parameters`
/// olur — biçim ölçüldü (`server-logs/2026-08/`, gerçek `tools` dizisi).
#[derive(Debug, Clone, Serialize)]
pub struct ToolDef {
    #[serde(rename = "type")]
    pub tip: &'static str,
    pub function: ToolFn,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolFn {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub parameters: serde_json::Value,
}

impl ToolDef {
    pub fn new(name: String, description: Option<String>, parameters: serde_json::Value) -> Self {
        ToolDef {
            tip: "function",
            function: ToolFn {
                name,
                description,
                parameters,
            },
        }
    }
}

/// Modelin istediği araç çağrısı. `arguments` **dizge**; akışta parça parça
/// gelip birleştiriliyor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub tip: String,
    pub function: FnCall,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FnCall {
    pub name: String,
    pub arguments: String,
}

impl ToolCall {
    /// Argümanları nesneye çevirir. Model bozuk JSON üretebiliyor — hata
    /// yukarı fırlatılmaz, çağrı modele "argümanlar okunamadı" diye döner.
    pub fn args(&self) -> Result<serde_json::Map<String, serde_json::Value>, String> {
        let ham = self.function.arguments.trim();
        if ham.is_empty() {
            return Ok(serde_json::Map::new());
        }
        match serde_json::from_str::<serde_json::Value>(ham) {
            Ok(serde_json::Value::Object(m)) => Ok(m),
            Ok(_) => Err("argümanlar bir nesne değil".into()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// Tek bir sohbet mesajı.
///
/// Enum değil düz struct: bu tip hem tele hem **diske** gidiyor
/// (`messages.jsonl`), ve `untagged` bir enum geri okunurken varyantları
/// karıştırırdı — araç çağrısı olmayan bir `assistant` ile bir `user` aynı
/// şekle sahip olurdu.
///
/// `content` `null` olabilir: araç çağıran bir `assistant` mesajında metin
/// olmayabiliyor ve şartname alanı **nullable ama zorunlu** sayıyor, bu
/// yüzden atlanmıyor, açıkça `null` yazılıyor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    #[serde(default)]
    pub content: Option<String>,
    /// Boşsa hiç yazılmaz — kimi sunucu boş diziyi reddediyor.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCall>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl Message {
    fn yeni(role: &str, content: Option<String>) -> Self {
        Message {
            role: role.to_string(),
            content,
            tool_calls: Vec::new(),
            tool_call_id: None,
        }
    }
    pub fn system(content: String) -> Self {
        Message::yeni("system", Some(content))
    }
    pub fn user(content: String) -> Self {
        Message::yeni("user", Some(content))
    }
    pub fn assistant(content: String, tool_calls: Vec<ToolCall>) -> Self {
        let mut m = Message::yeni(
            "assistant",
            if content.is_empty() { None } else { Some(content) },
        );
        m.tool_calls = tool_calls;
        m
    }
    pub fn tool(content: String, tool_call_id: String) -> Self {
        let mut m = Message::yeni("tool", Some(content));
        m.tool_call_id = Some(tool_call_id);
        m
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<ToolDef>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_options: Option<StreamOptions>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct StreamOptions {
    pub include_usage: bool,
}

impl ChatRequest {
    /// Akışlı istek. `include_usage` **ölçülerek** eklendi: LM Studio
    /// destekliyor ve `prompt_tokens`'ı kesin sayı olarak veriyor — özetleme
    /// eşiği tahminle değil bu sayıyla tetikleniyor.
    pub fn streaming(model: String, messages: Vec<Message>, tools: Vec<ToolDef>) -> Self {
        ChatRequest {
            model,
            messages,
            tools,
            stream: true,
            stream_options: Some(StreamOptions {
                include_usage: true,
            }),
        }
    }

    /// Akışsız istek — özetleme için. Özet parça parça gösterilmiyor.
    pub fn plain(model: String, messages: Vec<Message>) -> Self {
        ChatRequest {
            model,
            messages,
            tools: Vec::new(),
            stream: false,
            stream_options: None,
        }
    }
}

// ─────────────────────────── SSE ayrıştırıcısı ───────────────────────────

/// Akıştan çıkan tek bir olay.
#[derive(Debug, Clone, PartialEq)]
pub enum Delta {
    /// Yanıt metninin bir parçası.
    Text(String),
    /// Düşünme parçası — `reasoning_content` alanı (sunucular arasında
    /// standart değil; yoksa hiç gelmez).
    Reasoning(String),
    /// Tamamlanmış araç çağrısı; akışın sonunda birleştirilmiş hâliyle.
    Tool(ToolCall),
    /// `finish_reason` — `stop`, `tool_calls`, `length`…
    Finish(String),
    /// Son çerçevedeki `usage.prompt_tokens`.
    Usage { prompt: u64, completion: u64 },
}

/// Akışta biriken, henüz tamamlanmamış araç çağrısı. Argümanlar kırık JSON
/// dizgesi olarak parça parça geliyor; `index` ile anahtarlanıyor çünkü `id`
/// yalnızca ilk parçada var.
#[derive(Default, Clone)]
struct Biriken {
    id: String,
    name: String,
    args: String,
}

/// Satır tabanlı SSE ayrıştırıcısı. Sözleşme `parse::Parser`'ınkiyle aynı:
/// `push` yarım satırı bekletir, `finish` kalanı boşaltır.
#[derive(Default)]
pub struct Sse {
    buf: String,
    /// index → biriken araç çağrısı. `BTreeMap` çünkü sıra korunmalı.
    araclar: std::collections::BTreeMap<u64, Biriken>,
    bitti: bool,
}

impl Sse {
    pub fn new() -> Self {
        Sse::default()
    }

    pub fn push(&mut self, chunk: &str) -> Vec<Delta> {
        self.buf.push_str(chunk);
        let mut out = Vec::new();
        // Son parça yarım kalabilir: son satır sonuna kadarını işle, gerisini
        // tamponda bırak.
        while let Some(i) = self.buf.find('\n') {
            let satir: String = self.buf[..i].trim_end_matches('\r').to_string();
            self.buf.drain(..=i);
            self.satir(&satir, &mut out);
        }
        out
    }

    /// Akış kapandı: `[DONE]` gelmemiş olsa bile biriken araç çağrılarını
    /// yayınla. Yerel sunucuların bir kısmı `[DONE]` yollamadan kapatıyor.
    pub fn finish(&mut self) -> Vec<Delta> {
        let mut out = Vec::new();
        let kalan = std::mem::take(&mut self.buf);
        if !kalan.trim().is_empty() {
            self.satir(kalan.trim(), &mut out);
        }
        self.bosalt(&mut out);
        out
    }

    fn satir(&mut self, satir: &str, out: &mut Vec<Delta>) {
        let satir = satir.trim();
        if satir.is_empty() || satir.starts_with(':') {
            return; // ayırıcı ya da yorum (keep-alive)
        }
        let Some(gövde) = satir.strip_prefix("data:") else {
            return; // `event:` / `id:` — bu protokolde kullanılmıyor
        };
        let gövde = gövde.trim();
        if gövde == "[DONE]" {
            self.bosalt(out);
            self.bitti = true;
            return;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(gövde) else {
            return; // yarım ya da bozuk çerçeve: akış düşmez
        };
        self.cerceve(&v, out);
    }

    fn cerceve(&mut self, v: &serde_json::Value, out: &mut Vec<Delta>) {
        if let Some(u) = v.get("usage").filter(|u| !u.is_null()) {
            let n = |k: &str| u.get(k).and_then(|x| x.as_u64()).unwrap_or(0);
            out.push(Delta::Usage {
                prompt: n("prompt_tokens"),
                completion: n("completion_tokens"),
            });
        }

        let Some(secim) = v.get("choices").and_then(|c| c.as_array()).and_then(|a| a.first()) else {
            return;
        };

        if let Some(d) = secim.get("delta") {
            if let Some(t) = d.get("content").and_then(|c| c.as_str()) {
                if !t.is_empty() {
                    out.push(Delta::Text(t.to_string()));
                }
            }
            // Sunucular arasında standart değil; ikisi de görülüyor.
            let akil = d
                .get("reasoning_content")
                .or_else(|| d.get("reasoning"))
                .and_then(|c| c.as_str());
            if let Some(t) = akil {
                if !t.is_empty() {
                    out.push(Delta::Reasoning(t.to_string()));
                }
            }
            if let Some(tc) = d.get("tool_calls").and_then(|c| c.as_array()) {
                for parca in tc {
                    self.arac_parcasi(parca);
                }
            }
        }

        if let Some(r) = secim.get("finish_reason").and_then(|f| f.as_str()) {
            // Araç çağrıları burada tamamlanır: `finish_reason` geldiğinde
            // argüman dizgesinin tamamı birikmiş olur.
            self.bosalt(out);
            out.push(Delta::Finish(r.to_string()));
        }
    }

    fn arac_parcasi(&mut self, parca: &serde_json::Value) {
        let idx = parca.get("index").and_then(|i| i.as_u64()).unwrap_or(0);
        let b = self.araclar.entry(idx).or_default();
        if let Some(id) = parca.get("id").and_then(|i| i.as_str()) {
            if !id.is_empty() {
                b.id = id.to_string();
            }
        }
        if let Some(f) = parca.get("function") {
            if let Some(n) = f.get("name").and_then(|n| n.as_str()) {
                if !n.is_empty() {
                    b.name.push_str(n);
                }
            }
            if let Some(a) = f.get("arguments").and_then(|a| a.as_str()) {
                b.args.push_str(a);
            }
        }
    }

    fn bosalt(&mut self, out: &mut Vec<Delta>) {
        for (i, b) in std::mem::take(&mut self.araclar) {
            if b.name.is_empty() {
                continue; // adı olmayan çağrı yürütülemez
            }
            out.push(Delta::Tool(ToolCall {
                // Sunucu kimlik vermediyse indeksten türet: `tool_call_id`
                // eşleşmesi buna dayanıyor, boş bırakılamaz.
                id: if b.id.is_empty() {
                    format!("call_{i}")
                } else {
                    b.id
                },
                tip: "function".into(),
                function: FnCall {
                    name: b.name,
                    arguments: b.args,
                },
            }));
        }
    }
}

// ─────────────────────────── sohbet çağrıları ───────────────────────────

/// Akışlı sohbet. `next()` çağrıldıkça olay döndürür, akış bitince `None`.
pub struct ChatStream {
    res: reqwest::Response,
    sse: Sse,
    kuyruk: std::collections::VecDeque<Delta>,
    kapandi: bool,
}

impl ChatStream {
    pub async fn next(&mut self) -> Option<Result<Delta, ModelError>> {
        loop {
            if let Some(d) = self.kuyruk.pop_front() {
                return Some(Ok(d));
            }
            if self.kapandi {
                return None;
            }
            match self.res.chunk().await {
                Ok(Some(baytlar)) => {
                    // Çok baytlı bir karakter parça sınırına denk gelebilir;
                    // `from_utf8_lossy` yerine tamponlamak gerekirdi ama SSE
                    // çerçeveleri satır sonunda kesildiği için pratikte
                    // bölünme yalnızca satır ortasında olur ve tampon zaten
                    // dizge biriktiriyor. Yine de kayıpsız olsun diye
                    // ayrıştırıcıya lossy veriliyor: bozuk bayt tek çerçeveyi
                    // düşürür, akışı değil.
                    let metin = String::from_utf8_lossy(&baytlar);
                    self.kuyruk.extend(self.sse.push(&metin));
                }
                Ok(None) => {
                    self.kapandi = true;
                    self.kuyruk.extend(self.sse.finish());
                }
                Err(e) => {
                    self.kapandi = true;
                    return Some(Err(classify(&e)));
                }
            }
        }
    }
}

async fn gonder(base_url: &str, req: &ChatRequest) -> Result<reqwest::Response, ModelError> {
    let key = api_key().await?;
    let res = request(
        reqwest::Method::POST,
        base_url,
        "/chat/completions",
        key.as_deref(),
    )?
    .header("Accept", "text/event-stream, application/json")
    .timeout(CHAT_TIMEOUT)
    .json(req)
    .send()
    .await
    .map_err(|e| classify(&e))?;

    if res.status() == 401 || res.status() == 403 {
        return Err(ModelError::Unauthorized);
    }
    if !res.status().is_success() {
        let kod = res.status().as_u16();
        // Sunucunun kendi cümlesi hatanın tek yararlı kısmı — 400'ler
        // genelde "bu model araç çağırmayı desteklemiyor" diyor.
        let govde = res.text().await.unwrap_or_default();
        let kirpik: String = govde.chars().take(300).collect();
        return Err(ModelError::Protocol(if kirpik.trim().is_empty() {
            format!("HTTP {kod}")
        } else {
            format!("HTTP {kod}: {kirpik}")
        }));
    }
    Ok(res)
}

pub async fn chat_stream(base_url: &str, req: ChatRequest) -> Result<ChatStream, ModelError> {
    let res = gonder(base_url, &req).await?;
    Ok(ChatStream {
        res,
        sse: Sse::new(),
        kuyruk: std::collections::VecDeque::new(),
        kapandi: false,
    })
}

/// Akışsız sohbet — yalnızca metin döndürür. Özetleme bunu kullanıyor.
pub async fn chat_once(base_url: &str, req: ChatRequest) -> Result<String, ModelError> {
    let res = gonder(base_url, &req).await?;
    let v: serde_json::Value = res.json().await.map_err(|e| classify(&e))?;
    v.get("choices")
        .and_then(|c| c.as_array())
        .and_then(|a| a.first())
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|t| t.as_str())
        .map(str::to_string)
        .ok_or_else(|| ModelError::Protocol("yanıtta metin yok".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn topla(s: &mut Sse, parcalar: &[&str]) -> Vec<Delta> {
        let mut out = Vec::new();
        for p in parcalar {
            out.extend(s.push(p));
        }
        out.extend(s.finish());
        out
    }

    #[test]
    fn metin_parcalari_sirayla_gelir() {
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &[
                "data: {\"choices\":[{\"delta\":{\"content\":\"Mer\"}}]}\n\n",
                "data: {\"choices\":[{\"delta\":{\"content\":\"haba\"}}]}\n\n",
                "data: [DONE]\n\n",
            ],
        );
        assert_eq!(
            out,
            vec![Delta::Text("Mer".into()), Delta::Text("haba".into())]
        );
    }

    #[test]
    fn cerceve_ortasindan_bolunmus_akis() {
        // Ağdan gelen parça sınırı JSON'un ortasına düşerse ayrıştırıcı
        // düşmemeli; tampon satır sonuna kadar bekler.
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &[
                "data: {\"choices\":[{\"delta\":{\"con",
                "tent\":\"tamam\"}}]}\n\ndata: [DONE]\n\n",
            ],
        );
        assert_eq!(out, vec![Delta::Text("tamam".into())]);
    }

    #[test]
    fn yorum_ve_bos_satirlar_atlanir() {
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &[": keep-alive\n\n\n", "data: {\"choices\":[{\"delta\":{\"content\":\"x\"}}]}\n"],
        );
        assert_eq!(out, vec![Delta::Text("x".into())]);
    }

    #[test]
    fn arac_argumanlari_parcalardan_birlesir() {
        // Ölçülen biçim: `id` yalnızca ilk parçada, `arguments` kırık JSON.
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &[
                r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"fs_list","arguments":""}}]}}]}"#,
                "\n",
                r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"path\""}}]}}]}"#,
                "\n",
                r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\"/tmp\"}"}}]}}]}"#,
                "\n",
                "data: {\"choices\":[{\"finish_reason\":\"tool_calls\"}]}\n",
            ],
        );
        assert_eq!(
            out,
            vec![
                Delta::Tool(ToolCall {
                    id: "call_a".into(),
                    tip: "function".into(),
                    function: FnCall {
                        name: "fs_list".into(),
                        arguments: "{\"path\":\"/tmp\"}".into(),
                    },
                }),
                Delta::Finish("tool_calls".into()),
            ]
        );
    }

    #[test]
    fn iki_arac_cagrisi_sirasini_korur() {
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &[
                r#"data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","function":{"name":"ikinci","arguments":"{}"}}]}}]}"#,
                "\n",
                r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","function":{"name":"birinci","arguments":"{}"}}]}}]}"#,
                "\n[DONE olmadan kapanış]\n",
            ],
        );
        let adlar: Vec<String> = out
            .iter()
            .filter_map(|d| match d {
                Delta::Tool(t) => Some(t.function.name.clone()),
                _ => None,
            })
            .collect();
        assert_eq!(adlar, vec!["birinci".to_string(), "ikinci".to_string()]);
    }

    #[test]
    fn kimliksiz_arac_cagrisina_indeksten_kimlik_uretilir() {
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &[
                r#"data: {"choices":[{"delta":{"tool_calls":[{"index":3,"function":{"name":"x","arguments":"{}"}}]}}]}"#,
                "\ndata: [DONE]\n",
            ],
        );
        match &out[0] {
            Delta::Tool(t) => assert_eq!(t.id, "call_3"),
            other => panic!("araç çağrısı bekleniyordu: {other:?}"),
        }
    }

    #[test]
    fn usage_son_cercevede_okunur() {
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &["data: {\"choices\":[],\"usage\":{\"prompt_tokens\":1234,\"completion_tokens\":56}}\n"],
        );
        assert_eq!(
            out,
            vec![Delta::Usage {
                prompt: 1234,
                completion: 56
            }]
        );
    }

    #[test]
    fn bozuk_cerceve_akisi_dusurmez() {
        let mut s = Sse::new();
        let out = topla(
            &mut s,
            &[
                "data: {bu json değil}\n",
                "data: {\"choices\":[{\"delta\":{\"content\":\"devam\"}}]}\n",
            ],
        );
        assert_eq!(out, vec![Delta::Text("devam".into())]);
    }

    #[test]
    fn arguman_nesnesi_cozulur() {
        let tc = ToolCall {
            id: "x".into(),
            tip: "function".into(),
            function: FnCall {
                name: "fs_list".into(),
                arguments: "{\"path\":\"/tmp\"}".into(),
            },
        };
        let m = tc.args().unwrap();
        assert_eq!(m.get("path").unwrap().as_str(), Some("/tmp"));
    }

    #[test]
    fn bos_arguman_bos_nesne_olur() {
        let tc = ToolCall {
            id: "x".into(),
            tip: "function".into(),
            function: FnCall {
                name: "system_status".into(),
                arguments: String::new(),
            },
        };
        assert!(tc.args().unwrap().is_empty());
    }

    /// İstek gövdesini yutup verilen yanıtı yazan sahte bir HTTP sunucusu.
    /// `mcp.rs`'teki 401 testiyle aynı desen: gerçek soket, kütüphane yok.
    /// Dönen `(port, gövde alıcısı)`.
    fn sahte_sunucu(
        yanit: &'static str,
    ) -> (u16, std::sync::mpsc::Receiver<String>) {
        use std::io::{BufRead, BufReader, Read, Write};

        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = std::sync::mpsc::channel();

        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(stream) = stream else { continue };
                let tx = tx.clone();
                std::thread::spawn(move || {
                    // İstek sonuna kadar okunmazsa karşı taraf RST alır ve
                    // hata "sending request" gibi görünür.
                    let mut reader = BufReader::new(&stream);
                    let mut len = 0usize;
                    loop {
                        let mut line = String::new();
                        if reader.read_line(&mut line).unwrap_or(0) == 0 {
                            return;
                        }
                        let l = line.trim_end();
                        if l.is_empty() {
                            break;
                        }
                        if let Some(v) = l.to_ascii_lowercase().strip_prefix("content-length:") {
                            len = v.trim().parse().unwrap_or(0);
                        }
                    }
                    let mut body = vec![0u8; len];
                    if len > 0 {
                        let _ = reader.read_exact(&mut body);
                    }
                    let _ = tx.send(String::from_utf8_lossy(&body).into_owned());

                    let mut out = &stream;
                    let _ = out.write_all(yanit.as_bytes());
                    let _ = out.flush();
                });
            }
        });
        (port, rx)
    }

    /// Gerçek soket üstünde akış: iki metin parçası, bir araç çağrısı ve
    /// `usage`. Modelsiz ama HTTP'siz de değil — asıl kırılgan yer burası.
    #[tokio::test]
    async fn akis_gercek_soket_ustunde_okunur() {
        let govde = concat!(
            "data: {\"choices\":[{\"delta\":{\"content\":\"Bak\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\"ıyorum\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"c1\",",
            "\"function\":{\"name\":\"fs_list\",\"arguments\":\"{}\"}}]}}]}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"tool_calls\"}]}\n\n",
            "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":42,\"completion_tokens\":7}}\n\n",
            "data: [DONE]\n\n",
        );
        let yanit: &'static str = Box::leak(
            format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\
                 Content-Length: {}\r\nConnection: close\r\n\r\n{govde}",
                govde.len()
            )
            .into_boxed_str(),
        );
        let (port, istekler) = sahte_sunucu(yanit);
        let base = format!("http://127.0.0.1:{port}/v1");

        let istek = ChatRequest::streaming(
            "test-model".into(),
            vec![Message::user("kaç dosya var".into())],
            vec![ToolDef::new(
                "fs_list".into(),
                Some("dizini listeler".into()),
                serde_json::json!({"type":"object","properties":{"path":{"type":"string"}}}),
            )],
        );
        let mut akis = chat_stream(&base, istek).await.expect("akış açılmalı");

        let mut gelen = Vec::new();
        while let Some(d) = akis.next().await {
            gelen.push(d.expect("akışta hata olmamalı"));
        }

        assert_eq!(
            gelen,
            vec![
                Delta::Text("Bak".into()),
                Delta::Text("ıyorum".into()),
                Delta::Tool(ToolCall {
                    id: "c1".into(),
                    tip: "function".into(),
                    function: FnCall {
                        name: "fs_list".into(),
                        arguments: "{}".into(),
                    },
                }),
                Delta::Finish("tool_calls".into()),
                Delta::Usage {
                    prompt: 42,
                    completion: 7
                },
            ]
        );

        // Sunucuya giden gövde ölçülen biçimde mi?
        let govde = istekler.recv().expect("istek gövdesi alınmalı");
        assert!(govde.contains("\"stream\":true"), "{govde}");
        assert!(govde.contains("\"include_usage\":true"), "{govde}");
        assert!(govde.contains("\"type\":\"function\""), "{govde}");
        assert!(govde.contains("\"name\":\"fs_list\""), "{govde}");
    }

    /// Sunucunun hata gövdesi kullanıcıya olduğu gibi gösterilmeli: 400'ler
    /// genelde "bu model araç çağırmayı desteklemiyor" diyor.
    #[tokio::test]
    async fn dortyuz_hatasi_sunucunun_cumlesini_tasir() {
        let govde = r#"{"error":"model does not support tools"}"#;
        let yanit: &'static str = Box::leak(
            format!(
                "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\
                 Content-Length: {}\r\nConnection: close\r\n\r\n{govde}",
                govde.len()
            )
            .into_boxed_str(),
        );
        let (port, _rx) = sahte_sunucu(yanit);
        let base = format!("http://127.0.0.1:{port}/v1");

        let istek = ChatRequest::streaming("m".into(), vec![Message::user("x".into())], vec![]);
        match chat_stream(&base, istek).await.err() {
            Some(ModelError::Protocol(d)) => {
                assert!(d.contains("400"), "{d}");
                assert!(d.contains("does not support tools"), "{d}");
            }
            other => panic!("Protocol hatası bekleniyordu: {other:?}"),
        }
    }

    #[tokio::test]
    async fn kapali_port_unreachable_verir() {
        let port = {
            let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            l.local_addr().unwrap().port()
        };
        let base = format!("http://127.0.0.1:{port}/v1");
        match models(&base).await {
            Err(ModelError::Unreachable(_)) => {}
            other => panic!("Unreachable bekleniyordu: {other:?}"),
        }
    }

    #[tokio::test]
    async fn adres_yoksa_noserver() {
        match models("").await {
            Err(ModelError::NoServer) => {}
            other => panic!("NoServer bekleniyordu: {other:?}"),
        }
    }

    #[test]
    fn adres_sondaki_egik_cizgiden_arindirilir() {
        assert_eq!(normalize("  http://x/v1/  "), "http://x/v1");
        // `/v1` eklenmiyor: kullanıcının adresi tahminle düzeltilmiyor.
        assert_eq!(normalize("http://x"), "http://x");
    }

    #[test]
    fn bos_arac_listesi_istege_yazilmaz() {
        let req = ChatRequest::streaming("m".into(), vec![Message::user("selam".into())], vec![]);
        let j = serde_json::to_string(&req).unwrap();
        assert!(!j.contains("tools"), "boş tools dizisi gönderilmemeli: {j}");
        assert!(j.contains("\"include_usage\":true"));
    }

    #[test]
    fn arac_cagrisiz_assistant_mesajinda_tool_calls_yok() {
        let m = Message::assistant("merhaba".into(), vec![]);
        let j = serde_json::to_string(&m).unwrap();
        assert!(!j.contains("tool_calls"), "{j}");
        assert!(j.contains("\"role\":\"assistant\""));
    }

    #[test]
    fn mesajlar_diskten_aynen_geri_okunur() {
        // `messages.jsonl` modelin belleği; yuvarlak yolculuk bozulursa
        // sohbet sessizce kısalır.
        let msgs = vec![
            Message::system("yönerge".into()),
            Message::user("selam".into()),
            Message::assistant(
                String::new(),
                vec![ToolCall {
                    id: "c1".into(),
                    tip: "function".into(),
                    function: FnCall {
                        name: "fs_list".into(),
                        arguments: "{}".into(),
                    },
                }],
            ),
            Message::tool("iki dosya".into(), "c1".into()),
            Message::assistant("iki dosya var".into(), vec![]),
        ];
        for m in &msgs {
            let j = serde_json::to_string(m).unwrap();
            assert_eq!(&serde_json::from_str::<Message>(&j).unwrap(), m, "{j}");
        }
        // Araç çağıran mesajda metin yoksa `content: null` yazılır.
        let j = serde_json::to_string(&msgs[2]).unwrap();
        assert!(j.contains("\"content\":null"), "{j}");
    }
}
