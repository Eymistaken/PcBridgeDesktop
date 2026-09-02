//! Ajan döngüsü — **uygulamanın içinde**.
//!
//! Model "şu aracı çağır" der → uygulama MCP'yi çağırır → sonucu modele geri
//! verir → döngü. `agent_run` yolundan farkı: burada koşumu biz yürütüyoruz,
//! bir CLI değil. Araçlar modele bizim tarafımızdan veriliyor, o yüzden
//! modelin tarafında hiçbir MCP kurulumu gerekmiyor.
//!
//! **Kabul edilen bedel:** uygulama kapanınca koşum ölür. Yarım kalan koşum
//! açılışta `#appClosed` ile kapatılır (`runs::kapanista_temizle`).

use std::collections::HashMap;
use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;

use crate::bots::Bot;
use crate::jobs::JobMeta;
use crate::model::{self, ChatRequest, Delta, Message, ModelError, ToolCall};
use crate::parse::Event;
use crate::runs;

/// Bir koşumdaki en fazla model gidiş-dönüşü. Model araç çağırmayı bırakmazsa
/// döngü sonsuza kadar dönerdi; bu tavan onu keser ve kullanıcıya söyler.
const MAX_TUR: u32 = 24;

/// Bağlam bütçesinin bu oranı aşılınca sıradaki koşumdan önce özetlenir.
/// Ölçüm sunucunun kendi `usage.prompt_tokens`'ından geliyor, tahminden değil.
const OZET_ESIGI: f64 = 0.75;

/// Özetlenirken **her zaman** korunan son koşum sayısı.
const KORUNAN_KOSUM: usize = 2;

/// Özetleme başarısız olduğunda `Event::Summary.text` yerine geçen kod.
/// Arayüz bunu `err.*` sözlüğünden çözüp insan cümlesine çeviriyor.
const OZET_BASARISIZ: &str = "#summaryFailed";

// ─────────────────────────── kayıt yüzeyi ───────────────────────────

/// Koşumun dışa dokunan yüzü: olaylar, modelin mesajları, bağlam defteri.
///
/// Uygulamada diske **ve** arayüze gider; testte belleğe. Bu ayrım sayesinde
/// döngünün kendisi gerçek model ve gerçek MCP ile, Tauri penceresi
/// açılmadan sınanabiliyor.
pub trait Kayit: Send + Sync {
    fn olay(&self, events: &[Event]);
    fn mesaj(&self, msgs: &[Message]);
    fn ctx(&self, ctx: runs::RunCtx);
}

/// Uygulamadaki kayıt: `events.jsonl` + `job://chunk`.
struct AppKayit {
    app: AppHandle,
    run_id: String,
    bot_id: String,
}

impl Kayit for AppKayit {
    fn olay(&self, events: &[Event]) {
        if events.is_empty() {
            return;
        }
        // Diske yazılmayan olay uygulama kapanınca kaybolur, yollanmayan
        // olay da ekranda hiç görünmez — ikisi tek yerde.
        runs::append(&self.run_id, events);
        crate::jobs::emit_chunk(&self.app, &self.run_id, &self.bot_id, events);
    }
    fn mesaj(&self, msgs: &[Message]) {
        runs::append_messages(&self.run_id, msgs);
    }
    fn ctx(&self, ctx: runs::RunCtx) {
        runs::write_ctx(&self.run_id, &ctx);
    }
}

// ─────────────────────────── koşan işler ───────────────────────────

/// Süren yerel koşumlar. `jobs::Watchers`'ın aksine bu **iptal edilebilir**:
/// orada izleyici dosyayı okuyordu, burada işin kendisi bizde.
#[derive(Default)]
pub struct Runs {
    inner: Arc<Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
}

impl Runs {
    async fn ekle(&self, id: String, handle: tauri::async_runtime::JoinHandle<()>) {
        self.inner.lock().await.insert(id, handle);
    }

    async fn cikar(&self, id: &str) {
        self.inner.lock().await.remove(id);
    }

    /// Koşumu keser. `true` dönerse gerçekten süren bir iş durduruldu.
    ///
    /// Yarıda kesilen MCP çağrısı öksüz kalır — sunucu tarafında iş sürebilir.
    /// Kabul edilen davranış; alternatifi her araç çağrısını iptal edilebilir
    /// yapmaktı ve rmcp bunu vermiyor.
    pub async fn cancel(&self, app: &AppHandle, run_id: &str, bot_id: &str) -> bool {
        let vardi = {
            let mut map = self.inner.lock().await;
            match map.remove(run_id) {
                Some(h) => {
                    h.abort();
                    true
                }
                None => false,
            }
        };

        // Görev yarıda kesildiği için kapanışı burada yapıyoruz: mesaj
        // listesi yarım kalmışsa tamamlanır, meta kapatılır, arayüze haber
        // verilir. `exit_code` 130 = SIGINT; arayüz bunu "durduruldu" diye
        // gösteriyor, hata diye değil (`Chat.tsx::durduruldu`).
        if vardi {
            araclari_yanitsiz_birakma(run_id, "koşum durduruldu");
            runs::append(
                run_id,
                &[Event::Finished {
                    ok: false,
                    turns: None,
                    duration_ms: None,
                    cost_usd: None,
                    error: None,
                }],
            );
            runs::kapat(run_id, "cancelled", 130);
            if let Some(m) = runs::read_meta(run_id) {
                crate::jobs::emit_status(app, run_id, bot_id, &m, true);
            }
        }
        vardi
    }
}

// ─────────────────────────── başlatma ───────────────────────────

/// Bota mesaj gönderir. `send_message`'ın yerel arka uç dalı.
///
/// `agent_run` yolundaki gibi **hemen döner**: koşum arka planda akar,
/// arayüz olayları `job://chunk` ile alır.
pub async fn baslat(
    app: AppHandle,
    mcp: Arc<crate::mcp::McpState>,
    runs_state: Arc<Runs>,
    bot: Bot,
    text: String,
) -> Result<String, ModelError> {
    let cfg = model::read_config();
    if cfg.base_url.is_empty() {
        return Err(ModelError::NoServer);
    }
    let Some(model_id) = bot.model.clone() else {
        return Err(ModelError::Protocol("#noModel".into()));
    };

    let run_id = runs::yeni_id();
    let meta = JobMeta {
        id: run_id.clone(),
        kind: Some("local".into()),
        label: Some(text.chars().take(90).collect()),
        cwd: Some(bot.workdir.clone()),
        parser: None,
        status: Some("running".into()),
        exit_code: None,
        started_at: Some(runs::simdi()),
        finished_at: None,
        agent: Some(model_id.clone()),
        // Kalıcı yönerge **birleştirilmiyor**: o sistem mesajına gidiyor.
        // Kullanıcı ne yazdıysa o saklanıyor.
        prompt: Some(text.clone()),
        resume_session: None,
    };
    runs::write_meta(&meta).map_err(|e| ModelError::Protocol(e.to_string()))?;
    crate::bots::record_job(&bot.id, &run_id).map_err(|e| ModelError::Protocol(e.to_string()))?;

    let rid = run_id.clone();
    let rs = runs_state.clone();
    let handle = tauri::async_runtime::spawn(async move {
        let bot_id = bot.id.clone();
        kos(app.clone(), mcp, bot, rid.clone(), model_id, cfg.base_url, text).await;
        rs.cikar(&rid).await;
        if let Some(m) = runs::read_meta(&rid) {
            crate::jobs::emit_status(&app, &rid, &bot_id, &m, true);
        }
    });
    runs_state.ekle(run_id.clone(), handle).await;

    Ok(run_id)
}

// ─────────────────────────── döngü ───────────────────────────

/// Koşumun dışını kurar: oturum olayı, araçlar, özetleme, bitiş, meta.
/// Asıl tur döngüsü `tur_dongusu`'nde ve o **Tauri'yi hiç görmüyor**.
async fn kos(
    app: AppHandle,
    mcp: Arc<crate::mcp::McpState>,
    bot: Bot,
    run_id: String,
    model_id: String,
    base_url: String,
    text: String,
) {
    let basladi = std::time::Instant::now();
    let bot_id = bot.id.clone();
    let kayit = AppKayit {
        app: app.clone(),
        run_id: run_id.clone(),
        bot_id: bot_id.clone(),
    };

    kayit.olay(&[Event::Session {
        id: run_id.clone(),
        model: Some(model_id.clone()),
        cwd: Some(bot.workdir.clone()),
    }]);

    let kapat = |ok: bool, turlar: u32, hata: Option<String>| {
        kayit.olay(&[Event::Finished {
            ok,
            turns: Some(turlar as u64),
            duration_ms: Some(basladi.elapsed().as_millis() as u64),
            // Yerel model ücretsiz; ölçmediğimiz bir sayıyı uydurmuyoruz.
            cost_usd: None,
            error: hata,
        }]);
        araclari_yanitsiz_birakma(&run_id, "koşum sona erdi");
        runs::kapat(&run_id, if ok { "finished" } else { "failed" }, i64::from(!ok));
    };

    // Araçlar. Filtre boşsa modele hiç araç gösterilmiyor — bu geçerli bir
    // yapılandırma (düz sohbet botu), hata değil.
    let araclar = match arac_listesi(&mcp, &bot).await {
        Ok(a) => a,
        Err(e) => return kapat(false, 0, Some(e.to_string())),
    };

    // Geçmiş + gerekiyorsa özetleme.
    let (mut ozet, mut gecmis_msg) = gecmis(&bot);
    if ozetleme_gerek(&bot) {
        if let Ok((yeni_ozet, dusen, korunan)) =
            ozetle(&base_url, &model_id, &bot, &ozet, &gecmis_msg).await
        {
            let basarisiz = yeni_ozet.is_empty();
            kayit.ctx(runs::RunCtx {
                prompt_tokens: 0,
                summary: Some(yeni_ozet.clone()),
                dropped: dusen,
            });
            kayit.olay(&[Event::Summary {
                text: if basarisiz {
                    OZET_BASARISIZ.to_string()
                } else {
                    yeni_ozet.clone()
                },
                dropped: dusen,
            }]);
            ozet = if basarisiz { None } else { Some(yeni_ozet) };
            gecmis_msg = korunan;
        }
        // Özetleme koşumu düşürmez: tutmazsa geçmiş olduğu gibi gönderilir
        // ve sunucu bağlamı taşırırsa hatayı kullanıcı görür.
    }

    let sonuc = tur_dongusu(
        &kayit,
        &mcp,
        Baglam {
            base_url: &base_url,
            model_id: &model_id,
            sistem: sistem_prompt(&bot, &araclar, ozet.as_deref()),
            araclar,
            gecmis: gecmis_msg,
            text,
        },
    )
    .await;

    kapat(sonuc.ok, sonuc.turlar, sonuc.hata);
}

/// Tur döngüsünün girdisi — tek tek parametre olarak taşınınca imza okunmaz
/// oluyordu.
pub struct Baglam<'a> {
    pub base_url: &'a str,
    pub model_id: &'a str,
    pub sistem: String,
    pub araclar: Vec<model::ToolDef>,
    /// Önceki koşumlardan taşınan mesajlar (özet uygulanmış hâliyle).
    pub gecmis: Vec<Message>,
    /// Kullanıcının bu turda yazdığı.
    pub text: String,
}

pub struct Sonuc {
    pub ok: bool,
    pub turlar: u32,
    pub hata: Option<String>,
}

/// Asıl döngü: model → araçlar → model → …
///
/// Tauri'yi hiç görmüyor; `Kayit` sayesinde gerçek model ve gerçek MCP ile
/// pencere açmadan sınanabiliyor.
pub async fn tur_dongusu(
    kayit: &dyn Kayit,
    mcp: &crate::mcp::McpState,
    baglam: Baglam<'_>,
) -> Sonuc {
    let mut mesajlar = vec![Message::system(baglam.sistem)];
    mesajlar.extend(baglam.gecmis);

    let kullanici = Message::user(baglam.text);
    mesajlar.push(kullanici.clone());
    kayit.mesaj(&[kullanici]);

    let mut tur: u32 = 0;
    let mut son_prompt_tokens: u64 = 0;

    loop {
        tur += 1;
        if tur > MAX_TUR {
            return Sonuc {
                ok: false,
                turlar: tur - 1,
                hata: Some("#turnLimit".into()),
            };
        }

        let istek = ChatRequest::streaming(
            baglam.model_id.to_string(),
            mesajlar.clone(),
            baglam.araclar.clone(),
        );
        let mut akis = match model::chat_stream(baglam.base_url, istek).await {
            Ok(a) => a,
            Err(e) => {
                return Sonuc {
                    ok: false,
                    turlar: tur - 1,
                    hata: Some(e.to_string()),
                };
            }
        };

        let mut metin = String::new();
        let mut cagrilar: Vec<ToolCall> = Vec::new();
        let mut hata: Option<String> = None;

        while let Some(d) = akis.next().await {
            match d {
                Ok(Delta::Text(t)) => {
                    metin.push_str(&t);
                    kayit.olay(&[Event::Text { text: t, delta: true }]);
                }
                Ok(Delta::Reasoning(t)) => {
                    kayit.olay(&[Event::Thinking { text: t, delta: true }])
                }
                Ok(Delta::Tool(tc)) => cagrilar.push(tc),
                Ok(Delta::Usage { prompt, .. }) => son_prompt_tokens = prompt,
                Ok(Delta::Finish(_)) => {}
                Err(e) => {
                    hata = Some(e.to_string());
                    break;
                }
            }
        }

        if let Some(e) = hata {
            // Yarım kalan tur **diske yazılmıyor**: yanıtsız bir `tool_calls`
            // taşıyan `assistant` mesajı sonraki koşumda sunucuyu 400 ile
            // reddettirirdi.
            return Sonuc {
                ok: false,
                turlar: tur,
                hata: Some(e),
            };
        }

        let yanit = Message::assistant(metin.clone(), cagrilar.clone());
        mesajlar.push(yanit.clone());
        kayit.mesaj(&[yanit]);

        if cagrilar.is_empty() {
            kayit.ctx(runs::RunCtx {
                prompt_tokens: son_prompt_tokens,
                summary: None,
                dropped: 0,
            });
            return Sonuc {
                ok: true,
                turlar: tur,
                hata: None,
            };
        }

        // Araçlar **sırayla** yürütülür: `McpState` zaten tek mutex'in
        // arkasında ve sıralı yürütme hata ayıklamayı okunur tutuyor.
        for tc in &cagrilar {
            let sonuc = arac_calistir(kayit, mcp, tc).await;
            let msg = Message::tool(sonuc, tc.id.clone());
            mesajlar.push(msg.clone());
            kayit.mesaj(&[msg]);
        }
    }
}

/// Tek bir araç çağrısı: olayları yayar, sonucu modele verilecek metni döner.
async fn arac_calistir(kayit: &dyn Kayit, mcp: &crate::mcp::McpState, tc: &ToolCall) -> String {
    let (args, arg_hata) = match tc.args() {
        Ok(a) => (a, None),
        Err(e) => (serde_json::Map::new(), Some(e)),
    };

    kayit.olay(&[Event::ToolStart {
        id: tc.id.clone(),
        tool: tc.function.name.clone(),
        detail: crate::parse::detail(&tc.function.name, &serde_json::Value::Object(args.clone())),
    }]);

    // Modelin ürettiği JSON bozuksa araç hiç çağrılmaz; model kendi hatasını
    // görüp düzeltebilsin diye sonuç olarak geri veriliyor.
    if let Some(e) = arg_hata {
        kayit.olay(&[Event::ToolEnd {
            id: tc.id.clone(),
            ok: false,
        }]);
        return format!("Hata: argümanlar okunamadı ({e}).");
    }

    let (metin, arac_hatasi) = match mcp.call_for_agent(tc.function.name.clone(), args).await {
        Ok(r) => r,
        // Bağlantı hatası aracın hatası değil; yine de modele söylenir ki
        // döngü sessizce boş sonuçla devam etmesin.
        Err(e) => (format!("Hata: araç çağrılamadı ({e})."), true),
    };

    kayit.olay(&[Event::ToolEnd {
        id: tc.id.clone(),
        ok: !arac_hatasi,
    }]);
    metin
}

/// Yanıtsız kalmış araç çağrılarına sahte sonuç yazar.
///
/// **Neden gerekli:** koşum araç çağrısıyla araç sonucu arasında kesilirse
/// `messages.jsonl` içinde yanıtsız bir `tool_calls` kalır ve sonraki koşumda
/// sunucu isteği 400 ile reddeder. Sohbeti kurtarmanın yolu boşluğu dürüstçe
/// doldurmak.
fn araclari_yanitsiz_birakma(run_id: &str, neden: &str) {
    let eksikler: Vec<Message> = yanitsizlar(&runs::messages(run_id))
        .into_iter()
        .map(|id| Message::tool(format!("Sonuç yok: {neden}."), id))
        .collect();
    runs::append_messages(run_id, &eksikler);
}

/// Hangi araç çağrısı yanıtsız kaldı? Sırayı koruyor.
fn yanitsizlar(msgs: &[Message]) -> Vec<String> {
    let mut bekleyen: Vec<String> = Vec::new();
    for m in msgs {
        for tc in &m.tool_calls {
            bekleyen.push(tc.id.clone());
        }
        if let Some(id) = &m.tool_call_id {
            bekleyen.retain(|b| b != id);
        }
    }
    bekleyen
}

// ─────────────────────────── araçlar ───────────────────────────

/// Botun filtresinden geçen araçları modelin anlayacağı biçime çevirir.
///
/// **33 araç küçük modeli boğar** — filtre konfor değil şart. Bot hiçbir araç
/// seçmediyse MCP'ye hiç gidilmiyor.
async fn arac_listesi(
    mcp: &crate::mcp::McpState,
    bot: &Bot,
) -> Result<Vec<model::ToolDef>, ModelError> {
    if bot.tools.is_empty() {
        return Ok(Vec::new());
    }
    let hepsi = mcp
        .tools()
        .await
        .map_err(|e| ModelError::Protocol(e.to_string()))?;

    Ok(hepsi
        .into_iter()
        .filter(|t| bot.tools.iter().any(|s| s == &t.name))
        .map(|t| {
            // Şema bir nesne değilse model onu yutmaz; boş bir nesne şeması
            // araç yine de çağrılabilsin diye konuyor.
            let sema = if t.input_schema.is_object() {
                t.input_schema
            } else {
                serde_json::json!({ "type": "object", "properties": {} })
            };
            model::ToolDef::new(t.name, t.description, sema)
        })
        .collect())
}

fn sistem_prompt(bot: &Bot, araclar: &[model::ToolDef], ozet: Option<&str>) -> String {
    let mut s = String::new();
    let yonerge = bot.preamble.trim();
    if !yonerge.is_empty() {
        s.push_str(yonerge);
        s.push_str("\n\n");
    }
    s.push_str(&format!(
        "Bu makinede çalışan bir yardımcısın. Çalışma dizini: {}\n",
        bot.workdir
    ));
    if araclar.is_empty() {
        s.push_str("Araç yok; yalnızca konuşabilirsin.\n");
    } else {
        s.push_str(
            "Bilgiye ihtiyacın olduğunda tahmin etme, aracı çağır. \
             Araç sonucunu gördükten sonra kullanıcıya kendi cümlenle yanıt ver.\n",
        );
    }
    if let Some(o) = ozet.filter(|o| !o.trim().is_empty()) {
        // Özet **sistem mesajının içinde**: kimi sunucu ikinci bir `system`
        // mesajını ya da sohbetin ortasına düşen bir özeti kabul etmiyor.
        s.push_str("\n## Önceki konuşmanın özeti\n");
        s.push_str(o);
        s.push('\n');
    }
    s
}

// ─────────────────────────── bağlam ───────────────────────────

/// Botun yerel koşumlarından modelin göreceği geçmişi kurar.
///
/// Bir koşumun `ctx.summary`'si doluysa o koşum bir **denetim noktasıdır**:
/// kendisinden önceki bütün koşumların mesajları yerine o özet geçer. Özet
/// bir kez hesaplanır, her koşumda yeniden üretilmez.
fn gecmis(bot: &Bot) -> (Option<String>, Vec<Message>) {
    let yerel: Vec<&String> = bot.jobs.iter().filter(|j| runs::bizim(j)).collect();

    let mut baslangic = 0usize;
    let mut ozet: Option<String> = None;
    for (i, r) in yerel.iter().enumerate() {
        if let Some(s) = runs::read_ctx(r).summary {
            baslangic = i;
            ozet = if s.trim().is_empty() { None } else { Some(s) };
        }
    }

    let mut msgs = Vec::new();
    for r in &yerel[baslangic..] {
        msgs.extend(runs::messages(r));
    }
    (ozet, msgs)
}

/// Son koşumun **ölçülmüş** `prompt_tokens`'ı bütçenin eşiğini aştı mı?
fn ozetleme_gerek(bot: &Bot) -> bool {
    let Some(son) = bot.jobs.iter().rev().find(|j| runs::bizim(j)) else {
        return false;
    };
    let kullanilan = runs::read_ctx(son).prompt_tokens;
    kullanilan > 0 && kullanilan as f64 > bot.context_budget as f64 * OZET_ESIGI
}

/// Eski turları modele özetletir.
///
/// Dönüş: `(özet, düşen mesaj sayısı, korunan mesajlar)`. Özet boş dizgeyse
/// özetleme başarısız olmuş ve **sert kırpmaya** düşülmüştür — eski mesajlar
/// yine de atılır, çünkü bağlamı taşıran şey onlardı.
async fn ozetle(
    base_url: &str,
    model_id: &str,
    bot: &Bot,
    onceki_ozet: &Option<String>,
    gecmis_msg: &[Message],
) -> Result<(String, u32, Vec<Message>), ModelError> {
    let yerel: Vec<&String> = bot.jobs.iter().filter(|j| runs::bizim(j)).collect();
    if yerel.len() <= KORUNAN_KOSUM {
        return Err(ModelError::Protocol("özetlenecek koşum yok".into()));
    }

    // **Koşum sınırından** kesiliyor: bir koşumun mesajları araç çağrısıyla
    // sonucunu birlikte taşıdığı için çift asla bölünmüyor.
    let korunan_ids: Vec<&&String> = yerel.iter().rev().take(KORUNAN_KOSUM).collect();
    let mut korunan: Vec<Message> = Vec::new();
    for r in korunan_ids.iter().rev() {
        korunan.extend(runs::messages(r));
    }

    let dusen = gecmis_msg.len().saturating_sub(korunan.len());
    if dusen == 0 {
        return Err(ModelError::Protocol("düşecek mesaj yok".into()));
    }

    let mut dokum = String::new();
    if let Some(o) = onceki_ozet {
        dokum.push_str("Daha önceki özet:\n");
        dokum.push_str(o);
        dokum.push_str("\n\n");
    }
    for m in gecmis_msg.iter().take(dusen) {
        let govde = m.content.clone().unwrap_or_default();
        let arac = if m.tool_calls.is_empty() {
            String::new()
        } else {
            let adlar: Vec<&str> = m.tool_calls.iter().map(|t| t.function.name.as_str()).collect();
            format!(" [araç: {}]", adlar.join(", "))
        };
        if govde.trim().is_empty() && arac.is_empty() {
            continue;
        }
        // Araç çıktıları çok uzun olabiliyor; özetlenecek metnin kendisi
        // bağlamı taşırmasın diye kırpılıyor.
        let kirpik: String = govde.chars().take(1200).collect();
        dokum.push_str(&format!("{}: {}{}\n", m.role, kirpik, arac));
    }

    let istek = ChatRequest::plain(
        model_id.to_string(),
        vec![
            Message::system(
                "Aşağıdaki konuşmayı özetle. Kullanıcının amacını, varılan kararları ve \
                 öğrenilen somut bilgileri koru; yapılan araç çağrılarının sonuçlarından \
                 yalnızca hâlâ geçerli olanları yaz. Yorum ekleme, yalnızca özet ver."
                    .into(),
            ),
            Message::user(dokum),
        ],
    );

    // Başarısızlıkta koşum ölmüyor: boş özetle sert kırpmaya düşülüyor.
    let ozet = model::chat_once(base_url, istek)
        .await
        .unwrap_or_default()
        .trim()
        .to_string();

    Ok((ozet, dusen as u32, korunan))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::FnCall;
    use std::sync::Mutex as StdMutex;

    fn bot(preamble: &str) -> Bot {
        Bot {
            id: "b1".into(),
            name: "test".into(),
            avatar: crate::bots::Avatar::Mor,
            agent: String::new(),
            backend: crate::bots::Backend::YerelModel,
            model: Some("m".into()),
            effort: None,
            workdir: "/tmp/proje".into(),
            preamble: preamble.into(),
            desktop: false,
            timeout: 1800,
            tools: vec!["fs_list".into()],
            context_budget: 8192,
            session_id: None,
            jobs: Vec::new(),
            created_at: 0,
            updated_at: 0,
        }
    }

    fn arac(ad: &str) -> model::ToolDef {
        model::ToolDef::new(ad.into(), None, serde_json::json!({"type":"object"}))
    }

    /// Belleğe yazan kayıt — diske ve Tauri'ye hiç dokunmuyor.
    #[derive(Default)]
    struct VecKayit {
        olaylar: StdMutex<Vec<Event>>,
        mesajlar: StdMutex<Vec<Message>>,
        ctxler: StdMutex<Vec<runs::RunCtx>>,
    }

    impl Kayit for VecKayit {
        fn olay(&self, events: &[Event]) {
            self.olaylar.lock().unwrap().extend_from_slice(events);
        }
        fn mesaj(&self, msgs: &[Message]) {
            self.mesajlar.lock().unwrap().extend_from_slice(msgs);
        }
        fn ctx(&self, ctx: runs::RunCtx) {
            self.ctxler.lock().unwrap().push(ctx);
        }
    }

    // ── saf mantık ──

    #[test]
    fn sistem_promptu_yonergeyi_ve_dizini_tasir() {
        let s = sistem_prompt(&bot("Kısa konuş."), &[arac("fs_list")], None);
        assert!(s.starts_with("Kısa konuş."), "{s}");
        assert!(s.contains("/tmp/proje"), "{s}");
        assert!(s.contains("aracı çağır"), "{s}");
    }

    #[test]
    fn aracsiz_bota_arac_yok_denir() {
        let s = sistem_prompt(&bot(""), &[], None);
        assert!(s.contains("Araç yok"), "{s}");
    }

    #[test]
    fn ozet_sistem_mesajinin_icine_girer() {
        // Ayrı bir `system` mesajı ya da sohbetin ortasına düşen bir özet
        // kimi sunucuda reddediliyor; tek sistem mesajında duruyor.
        let s = sistem_prompt(&bot(""), &[arac("fs_list")], Some("önceki konuşma"));
        assert!(s.contains("## Önceki konuşmanın özeti"), "{s}");
        assert!(s.contains("önceki konuşma"), "{s}");
        let bos = sistem_prompt(&bot(""), &[arac("fs_list")], Some("   "));
        assert!(!bos.contains("Önceki konuşmanın özeti"), "{bos}");
    }

    #[test]
    fn ozetleme_esigi_olculen_sayiya_bakar() {
        let mut b = bot("");
        assert!(!ozetleme_gerek(&b), "koşum yoksa özetleme yok");
        b.context_budget = 1000;
        // pcbridge koşumlarının bizde `ctx`'i yok; sayılmıyorlar.
        b.jobs = vec!["20260902-231500-a1b2c3".into()];
        assert!(!ozetleme_gerek(&b));
    }

    #[test]
    fn yanitsiz_arac_cagrisi_tespit_edilir() {
        let msgs = vec![
            Message::assistant(
                String::new(),
                vec![
                    ToolCall {
                        id: "a".into(),
                        tip: "function".into(),
                        function: FnCall {
                            name: "fs_list".into(),
                            arguments: "{}".into(),
                        },
                    },
                    ToolCall {
                        id: "b".into(),
                        tip: "function".into(),
                        function: FnCall {
                            name: "fs_read".into(),
                            arguments: "{}".into(),
                        },
                    },
                ],
            ),
            Message::tool("sonuç".into(), "a".into()),
        ];
        assert_eq!(yanitsizlar(&msgs), vec!["b".to_string()]);

        // Hepsi yanıtlanmışsa boş.
        let tam = [msgs.clone(), vec![Message::tool("x".into(), "b".into())]].concat();
        assert!(yanitsizlar(&tam).is_empty());
    }

    // ── döngü, sahte sunucuyla ──

    /// Sırayla yanıt veren sahte HTTP sunucusu: ilk istek araç çağrısı,
    /// ikinci istek düz metin. `mcp.rs`'teki gerçek-soket deseni.
    fn sirali_sunucu(yanitlar: Vec<String>) -> u16 {
        use std::io::{BufRead, BufReader, Read, Write};

        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let sira = Arc::new(StdMutex::new(yanitlar.into_iter()));

        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(stream) = stream else { continue };
                let sira = sira.clone();
                std::thread::spawn(move || {
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
                    if len > 0 {
                        let _ = reader.read_exact(&mut vec![0u8; len]);
                    }
                    let govde = sira.lock().unwrap().next().unwrap_or_default();
                    let mut out = &stream;
                    let _ = out.write_all(
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\
                             Content-Length: {}\r\nConnection: close\r\n\r\n{govde}",
                            govde.len()
                        )
                        .as_bytes(),
                    );
                    let _ = out.flush();
                });
            }
        });
        port
    }

    /// İki turluk tam bir koşum: model önce araç çağırıyor, sonuç geri
    /// veriliyor, sonra metinle bitiriyor.
    ///
    /// MCP **bağlı değil** — araç çağrısı hata döndürüyor ve döngünün bunu
    /// modele sonuç olarak verip devam etmesi gerekiyor. Koşumu düşürmemesi
    /// bu testin asıl konusu.
    #[tokio::test]
    async fn dongu_arac_cagirir_sonucu_geri_verir_ve_biter() {
        let tur1 = concat!(
            "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"düşünüyorum\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"c1\",",
            "\"function\":{\"name\":\"fs_list\",\"arguments\":\"{\\\"path\\\":\\\"/tmp\\\"}\"}}]}}]}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"tool_calls\"}]}\n\n",
            "data: [DONE]\n\n",
        );
        let tur2 = concat!(
            "data: {\"choices\":[{\"delta\":{\"content\":\"Bakamadım.\"}}]}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"stop\"}]}\n\n",
            "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":512,\"completion_tokens\":4}}\n\n",
            "data: [DONE]\n\n",
        );
        let port = sirali_sunucu(vec![tur1.to_string(), tur2.to_string()]);
        let base = format!("http://127.0.0.1:{port}/v1");

        let kayit = VecKayit::default();
        let mcp = crate::mcp::McpState::default(); // bağlı değil

        let sonuc = tur_dongusu(
            &kayit,
            &mcp,
            Baglam {
                base_url: &base,
                model_id: "m",
                sistem: "yönerge".into(),
                araclar: vec![arac("fs_list")],
                gecmis: Vec::new(),
                text: "kaç dosya var".into(),
            },
        )
        .await;

        assert!(sonuc.ok, "döngü başarıyla bitmeli: {:?}", sonuc.hata);
        assert_eq!(sonuc.turlar, 2, "bir araç turu + bir metin turu");

        let olaylar = kayit.olaylar.lock().unwrap().clone();
        let kindler: Vec<&str> = olaylar
            .iter()
            .map(|e| match e {
                Event::Thinking { .. } => "thinking",
                Event::ToolStart { .. } => "toolStart",
                Event::ToolEnd { .. } => "toolEnd",
                Event::Text { .. } => "text",
                _ => "?",
            })
            .collect();
        assert_eq!(kindler, vec!["thinking", "toolStart", "toolEnd", "text"]);

        // **Akış parçaları `delta` işaretli olmalı.** Değilse arayüz onları
        // tamamlanmış bloklar sanıp aralarına satır atlar ve her token alt
        // alta düşer — bir kez öyle oldu (`timeline.ts::toBlocks`).
        assert!(
            olaylar.iter().all(|e| match e {
                Event::Text { delta, .. } | Event::Thinking { delta, .. } => *delta,
                _ => true,
            }),
            "döngünün metin ve düşünme olayları delta olmalı: {olaylar:?}"
        );

        // Araç ayrıntısı girdiden üretilmeli — `fs_list`'in `path`'i.
        match &olaylar[1] {
            Event::ToolStart { tool, detail, .. } => {
                assert_eq!(tool, "fs_list");
                assert_eq!(detail, "/tmp");
            }
            other => panic!("toolStart bekleniyordu: {other:?}"),
        }
        // MCP bağlı olmadığı için araç başarısız; ama koşum düşmedi.
        assert!(matches!(olaylar[2], Event::ToolEnd { ok: false, .. }));

        // Mesaj listesi sunucuya götürülebilir durumda: yanıtsız çağrı yok.
        let mesajlar = kayit.mesajlar.lock().unwrap().clone();
        assert!(
            yanitsizlar(&mesajlar).is_empty(),
            "her araç çağrısının sonucu yazılmalı: {mesajlar:?}"
        );
        let roller: Vec<&str> = mesajlar.iter().map(|m| m.role.as_str()).collect();
        assert_eq!(roller, vec!["user", "assistant", "tool", "assistant"]);

        // Ölçülen `prompt_tokens` bağlam defterine yazılmalı: özetleme eşiği
        // tahminle değil bununla tetikleniyor.
        let ctxler = kayit.ctxler.lock().unwrap().clone();
        assert_eq!(ctxler.len(), 1);
        assert_eq!(ctxler[0].prompt_tokens, 512);
    }

    /// Model araç çağırmayı bırakmazsa döngü tur sınırında kesilmeli.
    #[tokio::test]
    async fn tur_siniri_dongunun_sonsuza_donmesini_keser() {
        let hep_arac = concat!(
            "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"c\",",
            "\"function\":{\"name\":\"fs_list\",\"arguments\":\"{}\"}}]}}]}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"tool_calls\"}]}\n\n",
            "data: [DONE]\n\n",
        );
        let port = sirali_sunucu(vec![hep_arac.to_string(); (MAX_TUR + 2) as usize]);
        let base = format!("http://127.0.0.1:{port}/v1");

        let kayit = VecKayit::default();
        let sonuc = tur_dongusu(
            &kayit,
            &crate::mcp::McpState::default(),
            Baglam {
                base_url: &base,
                model_id: "m",
                sistem: "y".into(),
                araclar: vec![arac("fs_list")],
                gecmis: Vec::new(),
                text: "dur durak bilme".into(),
            },
        )
        .await;

        assert!(!sonuc.ok);
        assert_eq!(sonuc.turlar, MAX_TUR);
        assert_eq!(sonuc.hata.as_deref(), Some("#turnLimit"));
    }

    /// Sunucu düşerse koşum hata ile biter ve **yarım mesaj yazılmaz**:
    /// yanıtsız bir `tool_calls` sonraki koşumu 400'e düşürürdü.
    #[tokio::test]
    async fn sunucu_yoksa_kosum_duser_ama_mesaj_listesi_saglam_kalir() {
        let port = {
            let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            l.local_addr().unwrap().port()
        };
        let base = format!("http://127.0.0.1:{port}/v1");

        let kayit = VecKayit::default();
        let sonuc = tur_dongusu(
            &kayit,
            &crate::mcp::McpState::default(),
            Baglam {
                base_url: &base,
                model_id: "m",
                sistem: "y".into(),
                araclar: Vec::new(),
                gecmis: Vec::new(),
                text: "selam".into(),
            },
        )
        .await;

        assert!(!sonuc.ok);
        assert!(sonuc.hata.unwrap().starts_with("#modelUnreachable"));
        let mesajlar = kayit.mesajlar.lock().unwrap().clone();
        assert_eq!(mesajlar.len(), 1, "yalnızca kullanıcı mesajı yazılmalı");
        assert!(yanitsizlar(&mesajlar).is_empty());
    }

    /// **Gerçek model ve gerçek pcbridge ile** uçtan uca. Varsayılan olarak
    /// çalışmaz; ölçüm yapılacağı zaman açıkça istenir:
    ///
    /// ```text
    /// ~/.lmstudio/bin/lms server start
    /// cargo test --lib gercek_model -- --ignored --nocapture
    /// ```
    ///
    /// Token keyring'den okunur; bu test onu **görmez**.
    #[tokio::test]
    #[ignore = "LM Studio ve pcbridge ayakta olmalı"]
    async fn gercek_model_gercek_araci_cagirir() {
        let base = std::env::var("PCBRIDGE_MODEL_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:1234/v1".into());
        let model_id =
            std::env::var("PCBRIDGE_MODEL_ID").unwrap_or_else(|_| "ornith-1.5-35b-a3b".into());

        let mcp = crate::mcp::McpState::default();
        mcp.connect(None).await.expect("pcbridge'e bağlanılamadı");

        let hepsi = mcp.tools().await.expect("araç listesi alınamadı");
        let fs_list = hepsi
            .into_iter()
            .find(|t| t.name == "fs_list")
            .expect("fs_list bulunamadı");
        let araclar = vec![model::ToolDef::new(
            fs_list.name,
            fs_list.description,
            fs_list.input_schema,
        )];

        let kayit = VecKayit::default();
        let sonuc = tur_dongusu(
            &kayit,
            &mcp,
            Baglam {
                base_url: &base,
                model_id: &model_id,
                sistem: "Bu makinede çalışan bir yardımcısın. Çalışma dizini: /tmp. \
                         Bilgiye ihtiyacın olduğunda tahmin etme, aracı çağır."
                    .into(),
                araclar,
                gecmis: Vec::new(),
                text: "/tmp dizininde neler var?".into(),
            },
        )
        .await;

        let olaylar = kayit.olaylar.lock().unwrap().clone();
        for e in &olaylar {
            eprintln!("{e:?}");
        }
        assert!(sonuc.ok, "koşum bitmeli: {:?}", sonuc.hata);

        let cagrildi = olaylar
            .iter()
            .any(|e| matches!(e, Event::ToolStart { tool, .. } if tool == "fs_list"));
        assert!(cagrildi, "model fs_list'i çağırmalıydı");

        let basarili = olaylar
            .iter()
            .any(|e| matches!(e, Event::ToolEnd { ok: true, .. }));
        assert!(basarili, "araç çağrısı başarılı olmalıydı");

        assert!(
            olaylar.iter().any(|e| matches!(e, Event::Text { .. })),
            "model sonunda kendi cümlesiyle yanıt vermeliydi"
        );
    }
}
