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
use crate::tools::{Grup, Izin};

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

/// Bütçe aşıldı ama özetleme yardımcı olamıyor: düşürülebilecek her şey zaten
/// korunan pencerenin dışında ve önemsiz. Kullanıcının bütçeyi büyütmesi
/// gerekiyor — bunu **söylemek** gerekir, yoksa her koşumda sessizce bağlam
/// taşar ve kimse nedenini bilmez.
const BUTCE_YETMIYOR: &str = "#budgetTooSmall";

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

// ─────────────────────────── izin kapısı ───────────────────────────

/// Kullanıcıya götürülen tek bir izin isteği.
///
/// `args` **okunur JSON olarak** taşınıyor: kullanıcı "bu bot `shell_run`
/// çağırmak istiyor" değil, "`rm -rf /tmp/x` çalıştırmak istiyor" görmeli.
/// Onaylanan şeyin ne olduğunu göstermeyen bir onay kutusu onay değildir.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IzinIstegi {
    /// Araç çağrısının kimliği — arayüz isteği doğru baloncuğa bağlar.
    pub id: String,
    pub tool: String,
    pub detail: String,
    pub group: Grup,
    pub args: String,
}

/// İzin isteğini kullanıcıya götüren kapı.
///
/// Metot **sync**: `dyn` ile `async fn` taşımamak için istek kaydedilip
/// yanıtı bekleyecek kanal dönüyor, beklemek çağıranın işi. Böylece
/// `agent.rs` Tauri'den bağımsız kalıyor ve döngü penceresiz sınanabiliyor.
pub trait IzinKapisi: Send + Sync {
    fn sor(&self, run_id: &str, istek: IzinIstegi) -> tokio::sync::oneshot::Receiver<bool>;
}

/// Bir koşumun izin ayarı: kip + kullanıcıya ulaşan kapı.
#[derive(Clone, Copy)]
pub struct Kapi<'a> {
    pub kip: Izin,
    /// Araç adından gruba. Boşsa ad listesine düşülür.
    pub gruplar: &'a HashMap<String, Grup>,
    /// `None` → hiç sorulmaz. Testler ve otomatik yollar böyle koşar.
    pub kapi: Option<&'a dyn IzinKapisi>,
    pub run_id: &'a str,
}

impl Kapi<'_> {
    /// Testte: her şey serbest. Uygulamada kip her zaman botundan geliyor.
    #[cfg(test)]
    pub fn serbest() -> Kapi<'static> {
        static BOS: std::sync::OnceLock<HashMap<String, Grup>> = std::sync::OnceLock::new();
        Kapi {
            kip: Izin::Serbest,
            gruplar: BOS.get_or_init(HashMap::new),
            kapi: None,
            run_id: "",
        }
    }

    fn grubu(&self, tool: &str) -> Grup {
        // Listede yoksa ada bakılır; o da tanımıyorsa `write` — yani sorulur.
        self.gruplar
            .get(tool)
            .copied()
            .unwrap_or_else(|| crate::tools::grup(tool, None))
    }

    /// Bu çağrı çalışabilir mi? Gerekirse kullanıcıya sorar ve **bekler.**
    async fn izin_var_mi(&self, tc: &ToolCall, detail: &str) -> bool {
        let g = self.grubu(&tc.function.name);
        if !self.kip.sorar(g) {
            return true;
        }
        // Kip soruyor ama soracak kimse yok: reddetmek tek dürüst yanıt.
        // Sessizce çalıştırmak, kullanıcının seçtiği kipi yok saymak olurdu.
        let Some(kapi) = self.kapi else {
            return false;
        };
        let rx = kapi.sor(
            self.run_id,
            IzinIstegi {
                id: tc.id.clone(),
                tool: tc.function.name.clone(),
                detail: detail.to_string(),
                group: g,
                args: tc.function.arguments.clone(),
            },
        );
        // Kanal yanıtsız kapanırsa (uygulama kapanıyor, koşum iptal edildi)
        // izin verilmemiş sayılır.
        rx.await.unwrap_or(false)
    }
}

/// Uygulamadaki kayıt: `events.jsonl` + `job://chunk`.
struct AppKayit {
    app: AppHandle,
    run_id: String,
    bot_id: String,
}

/// Uygulamadaki izin kapısı: isteği `Runs`'a yazar ve arayüze yayar.
///
/// Yanıt `answer_permission` komutuyla geliyor. Arayüz cevaplamazsa koşum
/// **bekler** — zaman aşımı yok: sessizce reddetmek kullanıcıya "izin
/// istemedim" yalanını söylerdi, sessizce kabul etmek daha kötüsünü.
struct AppKapi {
    app: AppHandle,
    runs: Arc<Runs>,
    bot_id: String,
}

impl IzinKapisi for AppKapi {
    fn sor(&self, run_id: &str, istek: IzinIstegi) -> tokio::sync::oneshot::Receiver<bool> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let bekleyen = BekleyenIzin {
            run_id: run_id.to_string(),
            bot_id: self.bot_id.clone(),
            istek: istek.clone(),
        };
        if let Ok(mut map) = self.runs.bekleyen.lock() {
            map.insert(
                run_id.to_string(),
                Bekleyen {
                    bot_id: self.bot_id.clone(),
                    istek,
                    yanit: tx,
                },
            );
        }
        let _ = tauri::Emitter::emit(&self.app, "job://permission", bekleyen);
        rx
    }
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
    /// Yanıt bekleyen izin istekleri: koşum kimliği → istek + yanıt kanalı.
    ///
    /// Koşum başına **en fazla bir** istek olur: araçlar sırayla yürütülüyor.
    /// Kilit `std` çünkü hiçbir `await`'in üstünden geçirilmiyor.
    bekleyen: Arc<std::sync::Mutex<HashMap<String, Bekleyen>>>,
}

/// Kullanıcının yanıtını bekleyen tek bir istek.
struct Bekleyen {
    bot_id: String,
    istek: IzinIstegi,
    yanit: tokio::sync::oneshot::Sender<bool>,
}

/// Arayüze giden bekleyen istek — `bot_id` ile birlikte.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BekleyenIzin {
    pub run_id: String,
    pub bot_id: String,
    #[serde(flatten)]
    pub istek: IzinIstegi,
}

impl Runs {
    async fn ekle(&self, id: String, handle: tauri::async_runtime::JoinHandle<()>) {
        self.inner.lock().await.insert(id, handle);
    }

    async fn cikar(&self, id: &str) {
        self.inner.lock().await.remove(id);
        // Koşum bitti: bekleyen bir istek varsa kanalı düşür. `rx.await`
        // hata alır ve izin **verilmemiş** sayılır.
        self.izni_dus(id);
    }

    /// Bekleyen isteği haritadan çıkarır. Kanalı düşürmek reddetmek demek.
    fn izni_dus(&self, run_id: &str) -> Option<Bekleyen> {
        self.bekleyen.lock().ok()?.remove(run_id)
    }

    /// Testte bekleyen bir istek kurar ve döngünün beklediği kanalı döner.
    #[cfg(test)]
    fn test_bekleyen(&self, run_id: &str, tool: &str) -> tokio::sync::oneshot::Receiver<bool> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.bekleyen.lock().unwrap().insert(
            run_id.to_string(),
            Bekleyen {
                bot_id: "b1".into(),
                istek: IzinIstegi {
                    id: "c1".into(),
                    tool: tool.into(),
                    detail: String::new(),
                    group: Grup::Write,
                    args: "{}".into(),
                },
                yanit: tx,
            },
        );
        rx
    }

    /// Yanıt bekleyen bütün istekler. Arayüz yeniden kurulduğunda (kip
    /// değişimi, HMR, uygulama açılışı) sorulan şeyin kaybolmaması için.
    pub fn bekleyen_izinler(&self) -> Vec<BekleyenIzin> {
        let Ok(map) = self.bekleyen.lock() else {
            return Vec::new();
        };
        map.iter()
            .map(|(run_id, b)| BekleyenIzin {
                run_id: run_id.clone(),
                bot_id: b.bot_id.clone(),
                istek: b.istek.clone(),
            })
            .collect()
    }

    /// Kullanıcının kararını döngüye iletir. `false` dönerse bekleyen istek
    /// yoktu — çift tıklama ya da koşum bu arada bitmiş demek.
    pub fn izni_yanitla(&self, run_id: &str, ver: bool) -> bool {
        match self.izni_dus(run_id) {
            Some(b) => b.yanit.send(ver).is_ok(),
            None => false,
        }
    }

    /// Koşumu keser. `true` dönerse gerçekten süren bir iş durduruldu.
    ///
    /// Yarıda kesilen MCP çağrısı öksüz kalır — sunucu tarafında iş sürebilir.
    /// Kabul edilen davranış; alternatifi her araç çağrısını iptal edilebilir
    /// yapmaktı ve rmcp bunu vermiyor.
    pub async fn cancel(&self, app: &AppHandle, run_id: &str, bot_id: &str) -> bool {
        // Önce bekleyen izin: kanal düşünce döngü `await`'ten reddedilmiş
        // olarak çıkar, sonra `abort()` zaten hepsini keser.
        self.izni_dus(run_id);
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
        kos(
            app.clone(),
            mcp,
            rs.clone(),
            bot,
            rid.clone(),
            model_id,
            cfg.base_url,
            text,
        )
        .await;
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
#[allow(clippy::too_many_arguments)]
async fn kos(
    app: AppHandle,
    mcp: Arc<crate::mcp::McpState>,
    runs_state: Arc<Runs>,
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
    let (araclar, gruplar) = match arac_listesi(&mcp, &bot).await {
        Ok(a) => a,
        Err(e) => return kapat(false, 0, Some(e.to_string())),
    };

    let app_kapi = AppKapi {
        app: app.clone(),
        runs: runs_state,
        bot_id: bot_id.clone(),
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
        else {
            // Özetleme koşumu düşürmez: geçmiş olduğu gibi gönderilir. Ama
            // sessiz kalmaz — bütçe aşılmış ve özetleme bunu çözemiyor.
            kayit.olay(&[Event::Summary {
                text: BUTCE_YETMIYOR.to_string(),
                dropped: 0,
            }]);
        }
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
            kapi: Kapi {
                kip: bot.permission,
                gruplar: &gruplar,
                kapi: Some(&app_kapi),
                run_id: &run_id,
            },
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
    /// İzin kipi ve kullanıcıya ulaşan kapı.
    pub kapi: Kapi<'a>,
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
    let baglam_kapi = baglam.kapi;
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
            let sonuc = arac_calistir(kayit, mcp, &baglam_kapi, tc).await;
            let mut msg = Message::tool(sonuc.metin, tc.id.clone());
            msg.images = sonuc.gorseller;

            if !msg.images.is_empty() {
                eski_gorselleri_dus(&mut mesajlar);
            }

            // Diske görüntüsüz gider: `messages.jsonl` base64 ile şişmemeli.
            kayit.mesaj(&[msg.without_images()]);
            mesajlar.push(msg);
        }
    }
}

/// Tek bir araç çağrısı: izni alır, olayları yayar, sonucu modele verilecek
/// metni döner.
async fn arac_calistir(
    kayit: &dyn Kayit,
    mcp: &crate::mcp::McpState,
    kapi: &Kapi<'_>,
    tc: &ToolCall,
) -> crate::mcp::AracSonuc {
    let (args, arg_hata) = match tc.args() {
        Ok(a) => (a, None),
        Err(e) => (serde_json::Map::new(), Some(e)),
    };
    let detail =
        crate::parse::detail(&tc.function.name, &serde_json::Value::Object(args.clone()));

    kayit.olay(&[Event::ToolStart {
        id: tc.id.clone(),
        tool: tc.function.name.clone(),
        detail: detail.clone(),
    }]);

    // Modelin ürettiği JSON bozuksa araç hiç çağrılmaz; model kendi hatasını
    // görüp düzeltebilsin diye sonuç olarak geri veriliyor.
    if let Some(e) = arg_hata {
        kayit.olay(&[Event::ToolEnd {
            id: tc.id.clone(),
            ok: false,
        }]);
        return crate::mcp::AracSonuc {
            metin: format!("Hata: argümanlar okunamadı ({e})."),
            hata: true,
            gorseller: Vec::new(),
        };
    }

    // **İzin, araç çağrılmadan önce.** `ToolStart` çoktan yayıldı: arayüz
    // isteği o baloncuğa bağlıyor, kullanıcı neyin beklediğini görüyor.
    if !kapi.izin_var_mi(tc, &detail).await {
        kayit.olay(&[Event::ToolEnd {
            id: tc.id.clone(),
            ok: false,
        }]);
        // Model bunu bir arıza sanıp aynı çağrıyı tekrarlamasın diye
        // reddin kullanıcıdan geldiği açıkça yazılıyor.
        return crate::mcp::AracSonuc {
            metin: "Kullanıcı bu aracı çalıştırma iznini vermedi. \
                    Aynı çağrıyı tekrarlama; ya başka bir yol dene ya da \
                    kullanıcıya neye ihtiyacın olduğunu söyle."
                .to_string(),
            hata: true,
            gorseller: Vec::new(),
        };
    }

    let sonuc = match mcp.call_for_agent(tc.function.name.clone(), args).await {
        Ok(r) => r,
        // Bağlantı hatası aracın hatası değil; yine de modele söylenir ki
        // döngü sessizce boş sonuçla devam etmesin.
        Err(e) => crate::mcp::AracSonuc {
            metin: format!("Hata: araç çağrılamadı ({e})."),
            hata: true,
            gorseller: Vec::new(),
        },
    };

    kayit.olay(&[Event::ToolEnd {
        id: tc.id.clone(),
        ok: !sonuc.hata,
    }]);
    sonuc
}

/// **Görüntü yalnızca bir tur yaşar.** Yeni bir görüntü gelince öncekiler
/// yer tutucuya dönüşür.
///
/// Ekran görüntüsü megabaytlarca base64; her turda hepsi yeniden
/// gönderilseydi bağlam da bant genişliği de birkaç turda tükenirdi. Model
/// **o anki** ekranı görmeli, ekranların tarihçesini değil.
fn eski_gorselleri_dus(mesajlar: &mut [Message]) {
    for eski in mesajlar.iter_mut() {
        if !eski.images.is_empty() {
            *eski = eski.without_images();
        }
    }
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
/// Botun filtresinden geçen araçlar **ve** her birinin grubu.
///
/// Grup burada, sunucunun kendi `read_only` ipucuyla birlikte belirleniyor;
/// izin kapısı onu ikinci kez hesaplamıyor. Böylece arayüzde "masaüstü"
/// görünen bir araç kapıda "yazma" sayılamaz.
async fn arac_listesi(
    mcp: &crate::mcp::McpState,
    bot: &Bot,
) -> Result<(Vec<model::ToolDef>, HashMap<String, Grup>), ModelError> {
    if bot.tools.is_empty() {
        return Ok((Vec::new(), HashMap::new()));
    }
    let hepsi = mcp
        .tools()
        .await
        .map_err(|e| ModelError::Protocol(e.to_string()))?;

    let secili: Vec<_> = hepsi
        .into_iter()
        .filter(|t| bot.tools.iter().any(|s| s == &t.name))
        .collect();
    let gruplar = secili
        .iter()
        .map(|t| (t.name.clone(), crate::tools::grup(&t.name, t.read_only)))
        .collect();

    let defler = secili
        .into_iter()
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
        .collect();
    Ok((defler, gruplar))
}

/// Masaüstü araçları verilmiş bir bota kilidin **o anki** durumunu söyler.
///
/// **Neden gerekli:** kilitliyken pcbridge'in hata cümlesi "desktop_unlock
/// bekliyor" diyor. Model bunu "çağırman gereken bir araç var" diye okuyup
/// elinde olmayan aracı aramaya başlıyor — bir koşum bu yüzden 28 paragraf
/// döndü. Durumu ve kimin açabileceğini baştan söylemek o döngüyü kesiyor.
fn masaustu_notu(araclar: &[model::ToolDef]) -> String {
    masaustu_notu_ile(araclar, &crate::desktop::read_state())
}

/// Kilit durumu dışarıdan verilir: iki dal da makinenin o anki hâline
/// bağlı kalmadan sınanabilsin diye.
fn masaustu_notu_ile(araclar: &[model::ToolDef], d: &crate::desktop::DesktopState) -> String {
    let masaustu: Vec<&str> = araclar
        .iter()
        .map(|t| t.name())
        .filter(|n| crate::tools::grup(n, None) == Grup::Desktop)
        .collect();
    if masaustu.is_empty() {
        return String::new();
    }

    let acabilir = masaustu.contains(&"desktop_unlock");

    let mut s = String::from("\nMasaüstü (ekran, fare, klavye) araçları ayrı bir izne bağlı. ");
    if !d.known {
        s.push_str("İzin durumu okunamıyor; masaüstü aracı hata verirse kullanıcıya söyle.\n");
        return s;
    }
    if d.unlocked {
        s.push_str(&format!(
            "İzin şu an **açık**, yaklaşık {} dakika kaldı.\n",
            d.remaining.max(0) / 60
        ));
        s.push_str(&masaustu_ipuclari());
        return s;
    }
    s.push_str("İzin şu an **kapalı** ve kapalıyken hiçbir masaüstü aracı çalışmaz. ");
    if acabilir {
        s.push_str(
            "Açmak için `desktop_unlock` çağır; süreyi ve gerekçeyi sen verirsin. \
             Kullanıcının izin kipine göre bu çağrı onay isteyebilir.\n",
        );
        s.push_str(&masaustu_ipuclari());
    } else {
        s.push_str(
            "`desktop_unlock` senin araç listende **yok**, yani izni sen açamazsın. \
             Masaüstü işi istenirse kullanıcıdan izni açmasını iste ve bekle; \
             başka bir yol arama.\n",
        );
    }
    s
}

/// Masaüstünü süren bir modelin bu makinede tur tur öğrendiği şeyler.
///
/// **Hepsi ölçülmüş.** Bunlar yazılmadan bir koşum şunları yaşadı: izin
/// ortasında düştü ve model şaşırdı; her eylem "kullanıcı aktif" diye
/// reddedildi ve model gerekçeyi turlarca aradı; ölçekli ekran görüntüsünden
/// koordinat hesaplamaya çalışıp yanlış pencereye tıkladı.
fn masaustu_ipuclari() -> String {
    String::from(
        "\nBu makinede masaüstü hakkında bilinmesi gerekenler:\n\
         - **İzin boşta kalınca düşer** (bu makinede ~90 saniye). Uzun bir işte \
           izin ortada kaybolabilir; araç \"kilitli\" derse şaşırma, yeniden aç \
           ve kaldığın yerden devam et.\n\
         - **Kullanıcı klavye/fareyi kullanıyorsa eylem reddedilir.** Aracın \
           böyle bir seçeneği varsa (`force`) onu kullan; her seferinde \
           baştan denemek tur harcar.\n\
         - **Koordinatlar bütün ekranlar için tektir**, monitör başına değil. \
           Ekran görüntüsü küçültülmüş gelebilir; ondan piksel sayıp koordinat \
           uydurma. Monitör konumlarını `screen_info` söyler.\n\
         - **Önce `ui_dump` dene, sonra ekran görüntüsü.** Ağaç öğeyi adıyla \
           verir ve ıskalamaz; koordinat tahmini son çare. Ağaç boş dönerse \
           (bazı uygulamalar vermiyor) ekran görüntüsüne düş.\n\
         - Bir uygulamayı açmak için `window_focus` kullan; kapalıysa açar.\n",
    )
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
        // **Olmayan aracı aramama kuralı.** Bu satır olmadan küçük bir model,
        // listede bulamadığı bir aracı "başka bir yolu olmalı" diye tur tur
        // aramaya başlıyor ve tur tavanına kadar dönüyor — ölçüldü.
        s.push_str(
            "Kullanabileceğin araçlar yalnızca sana verilen listedekiler. \
             İhtiyacın olan bir araç listede yoksa onu başka bir yoldan \
             aramaya çalışma: kullanıcıya neye ihtiyacın olduğunu söyle ve dur.\n",
        );
        s.push_str(&masaustu_notu(araclar));
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
    gecmis_in(&runs::runs_dir(), bot)
}

fn gecmis_in(kok: &std::path::Path, bot: &Bot) -> (Option<String>, Vec<Message>) {
    let yerel: Vec<&String> = bot.jobs.iter().filter(|j| runs::bizim(j)).collect();

    let mut baslangic = 0usize;
    let mut ozet: Option<String> = None;
    for (i, r) in yerel.iter().enumerate() {
        if let Some(s) = runs::read_ctx_in(kok, r).summary {
            baslangic = i;
            ozet = if s.trim().is_empty() { None } else { Some(s) };
        }
    }

    let mut msgs = Vec::new();
    for r in &yerel[baslangic..] {
        msgs.extend(runs::messages_in(kok, r));
    }
    (ozet, msgs)
}

/// Son koşumun **ölçülmüş** `prompt_tokens`'ı bütçenin eşiğini aştı mı?
fn ozetleme_gerek(bot: &Bot) -> bool {
    ozetleme_gerek_in(&runs::runs_dir(), bot)
}

fn ozetleme_gerek_in(kok: &std::path::Path, bot: &Bot) -> bool {
    let Some(son) = bot.jobs.iter().rev().find(|j| runs::bizim(j)) else {
        return false;
    };
    let kullanilan = runs::read_ctx_in(kok, son).prompt_tokens;
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
    ozetle_in(&runs::runs_dir(), base_url, model_id, bot, onceki_ozet, gecmis_msg).await
}

#[allow(clippy::too_many_arguments)]
async fn ozetle_in(
    kok: &std::path::Path,
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
        korunan.extend(runs::messages_in(kok, r));
    }

    let dusen = gecmis_msg.len().saturating_sub(korunan.len());
    if dusen == 0 {
        return Err(ModelError::Protocol("düşecek mesaj yok".into()));
    }

    // **Kazanç taban kontrolü — model çağrısından önce.**
    //
    // Ölçüldü (2026-09-03): bütçesi 8192 olan bir botta 30 mesajlık bir koşum
    // 12.714 token'a çıktı, ama o koşum korunan pencerenin içindeydi ve
    // dışarıda yalnızca iki satırlık bir selamlaşma kaldı. Özetleme yine de
    // çalıştı: tam bir yerel model turu harcadı, kullanıcıyı bekletti,
    // "Kullanıcının amacı: Selamlaşmak" diyen yanıltıcı bir özet üretti ve
    // ~50 token kazandırdı. Sonraki koşumda aynısı yeniden olacaktı.
    //
    // Hiçbir şey kazandırmayan bir özetleme, özetlememekten kötüdür.
    let dusecek_karakter: usize = gecmis_msg
        .iter()
        .take(dusen)
        .map(|m| m.content.as_deref().map_or(0, str::len))
        .sum();
    // Kaba çeviri; kesin sayı yalnızca sunucudan gelir ve o da ancak istek
    // gönderildikten sonra. Burada gereken kesinlik değil, büyüklük mertebesi.
    let kazanc = dusecek_karakter / 4;
    let taban = (bot.context_budget as usize / 10).max(512);
    if kazanc < taban {
        return Err(ModelError::Protocol(format!(
            "özetleme kazancı düşük ({kazanc} ≈ token, taban {taban})"
        )));
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
            permission: Izin::Sor,
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

    /// Her isteği kaydeden ve önceden kararlaştırılmış yanıtı veren kapı.
    struct SahteKapi {
        ver: bool,
        istekler: StdMutex<Vec<IzinIstegi>>,
    }

    impl SahteKapi {
        fn yeni(ver: bool) -> Self {
            SahteKapi {
                ver,
                istekler: StdMutex::new(Vec::new()),
            }
        }
    }

    impl IzinKapisi for SahteKapi {
        fn sor(&self, _run_id: &str, istek: IzinIstegi) -> tokio::sync::oneshot::Receiver<bool> {
            self.istekler.lock().unwrap().push(istek);
            let (tx, rx) = tokio::sync::oneshot::channel();
            let _ = tx.send(self.ver);
            rx
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

    /// Yalıtık bir kökte `n` sahte yerel koşum kurar ve kimliklerini döner.
    /// Her koşum bir kullanıcı sorusu + bir yanıt taşıyor.
    fn sahte_kosumlar(kok: &std::path::Path, n: usize) -> Vec<String> {
        let mut ids = Vec::new();
        for i in 0..n {
            let id = format!("local-sahte-{i:04}");
            runs::append_messages_in(
                kok,
                &id,
                &[
                    Message::user(format!("{i}. soru: bana bir şey anlat")),
                    Message::assistant(format!("{i}. yanıt: işte bilgi"), vec![]),
                ],
            );
            ids.push(id);
        }
        ids
    }

    #[test]
    fn ozetleme_esigi_olculen_sayiya_bakar() {
        let k = std::env::temp_dir().join(format!("pcbd-esik-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&k);
        std::fs::create_dir_all(&k).unwrap();

        let mut b = bot("");
        assert!(!ozetleme_gerek_in(&k, &b), "koşum yoksa özetleme yok");

        b.context_budget = 1000;
        // pcbridge koşumlarının bizde `ctx`'i yok; sayılmıyorlar.
        b.jobs = vec!["20260902-231500-a1b2c3".into()];
        assert!(!ozetleme_gerek_in(&k, &b));

        // Ölçülen sayı eşiğin altındaysa özetleme yok…
        let ids = sahte_kosumlar(&k, 1);
        b.jobs = ids.clone();
        runs::write_ctx_in(
            &k,
            &ids[0],
            &runs::RunCtx {
                prompt_tokens: 700,
                ..Default::default()
            },
        );
        assert!(!ozetleme_gerek_in(&k, &b), "700 < 1000·0.75");

        // …üstündeyse var.
        runs::write_ctx_in(
            &k,
            &ids[0],
            &runs::RunCtx {
                prompt_tokens: 800,
                ..Default::default()
            },
        );
        assert!(ozetleme_gerek_in(&k, &b), "800 > 1000·0.75");

        let _ = std::fs::remove_dir_all(&k);
    }

    #[test]
    fn ozet_denetim_noktasi_oncesini_degistirir() {
        let k = std::env::temp_dir().join(format!("pcbd-ozet-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&k);
        std::fs::create_dir_all(&k).unwrap();

        let ids = sahte_kosumlar(&k, 5);
        let mut b = bot("");
        b.jobs = ids.clone();

        // Özet yokken bütün koşumlar taşınır: 5 koşum × 2 mesaj.
        let (ozet, msgs) = gecmis_in(&k, &b);
        assert!(ozet.is_none());
        assert_eq!(msgs.len(), 10);

        // 3. koşuma bir özet yazılınca o **denetim noktası** olur: kendisinden
        // öncesi tek bir özetle değişir, kendisi ve sonrası olduğu gibi kalır.
        runs::write_ctx_in(
            &k,
            &ids[2],
            &runs::RunCtx {
                prompt_tokens: 0,
                summary: Some("ilk iki koşumun özeti".into()),
                dropped: 4,
            },
        );
        let (ozet, msgs) = gecmis_in(&k, &b);
        assert_eq!(ozet.as_deref(), Some("ilk iki koşumun özeti"));
        assert_eq!(msgs.len(), 6, "3., 4. ve 5. koşum kalmalı");
        assert!(
            msgs[0].content.as_deref().unwrap().starts_with("2. soru"),
            "kesme koşum sınırından olmalı: {:?}",
            msgs[0].content
        );

        // Boş özet = sert kırpma: metin yok ama denetim noktası yine geçerli.
        runs::write_ctx_in(
            &k,
            &ids[2],
            &runs::RunCtx {
                prompt_tokens: 0,
                summary: Some(String::new()),
                dropped: 4,
            },
        );
        let (ozet, msgs) = gecmis_in(&k, &b);
        assert!(ozet.is_none(), "boş özet metin olarak taşınmamalı");
        assert_eq!(msgs.len(), 6, "kesme yine de uygulanmalı");

        let _ = std::fs::remove_dir_all(&k);
    }

    #[test]
    fn ozetleme_az_kosumda_calismaz() {
        // İki koşum zaten korunuyor; özetlenecek bir şey yok.
        let k = std::env::temp_dir().join(format!("pcbd-az-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&k);
        std::fs::create_dir_all(&k).unwrap();
        let ids = sahte_kosumlar(&k, KORUNAN_KOSUM);
        let mut b = bot("");
        b.jobs = ids;
        let (_, msgs) = gecmis_in(&k, &b);

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let sonuc = rt.block_on(ozetle_in(&k, "http://127.0.0.1:1", "m", &b, &None, &msgs));
        assert!(sonuc.is_err(), "özetlenecek koşum yokken denenmemeli");

        let _ = std::fs::remove_dir_all(&k);
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
                kapi: Kapi::serbest(),
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
                kapi: Kapi::serbest(),
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
                kapi: Kapi::serbest(),
            },
        )
        .await;

        assert!(!sonuc.ok);
        assert!(sonuc.hata.unwrap().starts_with("#modelUnreachable"));
        let mesajlar = kayit.mesajlar.lock().unwrap().clone();
        assert_eq!(mesajlar.len(), 1, "yalnızca kullanıcı mesajı yazılmalı");
        assert!(yanitsizlar(&mesajlar).is_empty());
    }

    /// **Gerçek modelle özetleme.** Kullanıcının bağlam yönetimi için seçtiği
    /// yol bu; ölçmeden "çalışıyor" denemez.
    ///
    /// ```text
    /// cargo test --lib gercek_ozetleme -- --ignored --nocapture
    /// ```
    #[tokio::test]
    #[ignore = "LM Studio ayakta olmalı"]
    async fn gercek_ozetleme_eski_turlari_sikistirir() {
        let base = std::env::var("PCBRIDGE_MODEL_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:1234/v1".into());
        let model_id =
            std::env::var("PCBRIDGE_MODEL_ID").unwrap_or_else(|_| "ornith-1.5-35b-a3b".into());

        let k = std::env::temp_dir().join(format!("pcbd-gercek-ozet-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&k);
        std::fs::create_dir_all(&k).unwrap();

        // Özetlenecek somut bir konuşma: özetin bunları koruması bekleniyor.
        let konusma = [
            ("Projenin adı ne?", "Projenin adı Pcbridge Desktop."),
            ("Hangi dilde yazılmış?", "Arka uç Rust, arayüz TypeScript ve React."),
            ("Kaç aşama bitti?", "Altı aşama bitti."),
            ("Son aşama neydi?", "Ajan döngüsünün uygulamanın içine taşınması."),
        ];
        let mut ids = Vec::new();
        for (i, (soru, yanit)) in konusma.iter().enumerate() {
            let id = format!("local-ozet-{i:04}");
            runs::append_messages_in(
                &k,
                &id,
                &[
                    Message::user((*soru).to_string()),
                    Message::assistant((*yanit).to_string(), vec![]),
                ],
            );
            ids.push(id);
        }

        let mut b = bot("");
        b.jobs = ids.clone();
        let (onceki, msgs) = gecmis_in(&k, &b);
        assert_eq!(msgs.len(), 8);

        let (ozet, dusen, korunan) = ozetle_in(&k, &base, &model_id, &b, &onceki, &msgs)
            .await
            .expect("özetleme çağrısı kurulmalı");

        eprintln!("--- özet ---\n{ozet}\n--- {dusen} mesaj düştü, {} korundu ---", korunan.len());

        assert!(!ozet.trim().is_empty(), "özet boş döndü — sert kırpmaya düşüldü");
        assert_eq!(dusen, 4, "ilk iki koşumun 4 mesajı düşmeli");
        assert_eq!(korunan.len(), 4, "son iki koşum korunmalı");
        assert!(
            korunan[0].content.as_deref().unwrap().starts_with("Kaç aşama"),
            "korunanlar koşum sınırından başlamalı: {:?}",
            korunan[0].content
        );
        // Özet konuşmanın somut bilgisini taşımalı; yalnızca "konuştular"
        // demesi işe yaramaz.
        let kucuk = ozet.to_lowercase();
        assert!(
            kucuk.contains("pcbridge") || kucuk.contains("rust"),
            "özet somut bilgiyi korumalı: {ozet}"
        );

        let _ = std::fs::remove_dir_all(&k);
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
                kapi: Kapi::serbest(),
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

    // ── izin kapısı ──

    /// Modelin bir yazma aracı çağırdığı iki turluk akış.
    fn yazma_cagiran_akis() -> Vec<String> {
        let tur1 = concat!(
            "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"c1\",",
            "\"function\":{\"name\":\"shell_run\",\"arguments\":\"{\\\"command\\\":\\\"rm -rf /tmp/x\\\"}\"}}]}}]}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"tool_calls\"}]}\n\n",
            "data: [DONE]\n\n",
        );
        let tur2 = concat!(
            "data: {\"choices\":[{\"delta\":{\"content\":\"Peki.\"}}]}\n\n",
            "data: {\"choices\":[{\"finish_reason\":\"stop\"}]}\n\n",
            "data: [DONE]\n\n",
        );
        vec![tur1.to_string(), tur2.to_string()]
    }

    async fn kipli_kosum(kip: Izin, kapi: &SahteKapi) -> (Sonuc, Vec<Event>, Vec<Message>) {
        let port = sirali_sunucu(yazma_cagiran_akis());
        let base = format!("http://127.0.0.1:{port}/v1");
        let mut gruplar = HashMap::new();
        gruplar.insert("shell_run".to_string(), Grup::Write);

        let kayit = VecKayit::default();
        let sonuc = tur_dongusu(
            &kayit,
            &crate::mcp::McpState::default(),
            Baglam {
                base_url: &base,
                model_id: "m",
                sistem: "y".into(),
                araclar: vec![arac("shell_run")],
                gecmis: Vec::new(),
                text: "sil".into(),
                kapi: Kapi {
                    kip,
                    gruplar: &gruplar,
                    kapi: Some(kapi),
                    run_id: "local-test",
                },
            },
        )
        .await;
        let olaylar = kayit.olaylar.lock().unwrap().clone();
        let mesajlar = kayit.mesajlar.lock().unwrap().clone();
        (sonuc, olaylar, mesajlar)
    }

    /// **Kipin asıl işi.** `Sor` kipinde yazma aracı kullanıcıya sorulur ve
    /// reddedilirse **çalıştırılmaz**; koşum yine de düzgün biter.
    #[tokio::test]
    async fn sor_kipinde_reddedilen_arac_calismaz() {
        let kapi = SahteKapi::yeni(false);
        let (sonuc, olaylar, mesajlar) = kipli_kosum(Izin::Sor, &kapi).await;

        let istekler = kapi.istekler.lock().unwrap().clone();
        assert_eq!(istekler.len(), 1, "tam bir kez sorulmalı");
        assert_eq!(istekler[0].tool, "shell_run");
        assert_eq!(istekler[0].group, Grup::Write);
        // Kullanıcı **ne onayladığını** görmeli: argümanlar isteğe konuyor.
        assert!(
            istekler[0].args.contains("rm -rf /tmp/x"),
            "argümanlar isteğe taşınmalı: {}",
            istekler[0].args
        );

        assert!(matches!(olaylar[1], Event::ToolEnd { ok: false, .. }));
        let red = mesajlar
            .iter()
            .find(|m| m.role == "tool")
            .expect("modele bir araç sonucu yazılmalı");
        let metin = red.content.as_deref().unwrap();
        assert!(
            metin.contains("Kullanıcı") && metin.contains("vermedi"),
            "reddin kullanıcıdan geldiği modele söylenmeli: {metin}"
        );
        assert!(
            metin.contains("tekrarlama"),
            "model aynı çağrıyı yeniden denememeli: {metin}"
        );
        // Reddedilmek arıza değil: model kendi cümlesiyle bitirebildi.
        assert!(sonuc.ok, "koşum reddedilen araçla da bitmeli: {:?}", sonuc.hata);
    }

    /// `YazmaSerbest` kipinde yazma aracı **hiç sorulmadan** çalışır.
    #[tokio::test]
    async fn yazma_serbest_kipinde_sorulmaz() {
        let kapi = SahteKapi::yeni(false);
        let (sonuc, olaylar, _) = kipli_kosum(Izin::YazmaSerbest, &kapi).await;

        assert!(kapi.istekler.lock().unwrap().is_empty(), "sorulmamalıydı");
        // MCP bağlı değil, o yüzden araç hata veriyor — ama **reddedilmedi**:
        // çağrı gerçekten yapıldı.
        assert!(matches!(olaylar[1], Event::ToolEnd { ok: false, .. }));
        assert!(sonuc.ok);
    }

    /// Kip soruyor ama soracak kimse yoksa **reddedilir**. Sessizce
    /// çalıştırmak kullanıcının seçtiği kipi yok saymak olurdu.
    #[tokio::test]
    async fn kapisiz_sor_kipi_reddeder() {
        let port = sirali_sunucu(yazma_cagiran_akis());
        let base = format!("http://127.0.0.1:{port}/v1");
        let mut gruplar = HashMap::new();
        gruplar.insert("shell_run".to_string(), Grup::Write);

        let kayit = VecKayit::default();
        let sonuc = tur_dongusu(
            &kayit,
            &crate::mcp::McpState::default(),
            Baglam {
                base_url: &base,
                model_id: "m",
                sistem: "y".into(),
                araclar: vec![arac("shell_run")],
                gecmis: Vec::new(),
                text: "sil".into(),
                kapi: Kapi {
                    kip: Izin::Sor,
                    gruplar: &gruplar,
                    kapi: None,
                    run_id: "local-test",
                },
            },
        )
        .await;

        assert!(sonuc.ok);
        let mesajlar = kayit.mesajlar.lock().unwrap().clone();
        let red = mesajlar.iter().find(|m| m.role == "tool").unwrap();
        assert!(red.content.as_deref().unwrap().contains("vermedi"));
    }

    /// Grup haritasında olmayan bir araç **yazma** sayılır, yani sorulur.
    /// Bilmediğimiz bir aracı zararsız varsaymak yanlış olur.
    #[tokio::test]
    async fn haritada_olmayan_arac_sorulur() {
        let kapi = SahteKapi::yeni(true);
        let port = sirali_sunucu(yazma_cagiran_akis());
        let base = format!("http://127.0.0.1:{port}/v1");
        let bos = HashMap::new();

        let kayit = VecKayit::default();
        let _ = tur_dongusu(
            &kayit,
            &crate::mcp::McpState::default(),
            Baglam {
                base_url: &base,
                model_id: "m",
                sistem: "y".into(),
                araclar: vec![arac("shell_run")],
                gecmis: Vec::new(),
                text: "sil".into(),
                kapi: Kapi {
                    kip: Izin::Sor,
                    gruplar: &bos,
                    kapi: Some(&kapi),
                    run_id: "local-test",
                },
            },
        )
        .await;

        assert_eq!(kapi.istekler.lock().unwrap().len(), 1, "bilinmeyen araç sorulmalı");
    }

    // ── sistem promptu: olmayan aracı arama ──

    #[test]
    fn sistem_promptu_olmayan_araci_aramamayi_soyler() {
        // Bir koşum bu satır olmadığı için 28 paragraf döndü: model listede
        // bulamadığı `desktop_unlock`'u "başka bir yolu olmalı" diye aradı.
        let s = sistem_prompt(&bot(""), &[arac("fs_list")], None);
        assert!(s.contains("yalnızca sana verilen listedekiler"), "{s}");
        assert!(s.contains("kullanıcıya neye ihtiyacın olduğunu söyle"), "{s}");
    }

    #[test]
    fn masaustu_araci_yoksa_kilit_notu_da_yok() {
        let s = sistem_prompt(&bot(""), &[arac("fs_list")], None);
        assert!(!s.contains("Masaüstü"), "gereksiz not: {s}");
    }

    /// **Döngü gerçekten bekliyor mu?**
    ///
    /// Yanıtı hemen veren bir kapı, "sorup beklemek" ile "hemen reddetmek"
    /// arasındaki farkı gösteremez. Burada yanıt başka bir görevden, gecikmeli
    /// geliyor: döngü o süre boyunca duruyor, sonra araç **çalışıyor.**
    #[tokio::test]
    async fn dongu_yanit_gelene_kadar_bekler() {
        /// İsteği kanalıyla birlikte dışarı veren kapı.
        struct GecikmeliKapi {
            gonder: StdMutex<Option<tokio::sync::oneshot::Sender<bool>>>,
            soruldu: Arc<tokio::sync::Notify>,
        }
        impl IzinKapisi for GecikmeliKapi {
            fn sor(&self, _r: &str, _i: IzinIstegi) -> tokio::sync::oneshot::Receiver<bool> {
                let (tx, rx) = tokio::sync::oneshot::channel();
                *self.gonder.lock().unwrap() = Some(tx);
                self.soruldu.notify_one();
                rx
            }
        }

        let port = sirali_sunucu(yazma_cagiran_akis());
        let base = format!("http://127.0.0.1:{port}/v1");
        let mut gruplar = HashMap::new();
        gruplar.insert("shell_run".to_string(), Grup::Write);

        let soruldu = Arc::new(tokio::sync::Notify::new());
        let kapi = Arc::new(GecikmeliKapi {
            gonder: StdMutex::new(None),
            soruldu: soruldu.clone(),
        });

        let k2 = kapi.clone();
        let bekleyen = tokio::spawn(async move {
            let kayit = VecKayit::default();
            let sonuc = tur_dongusu(
                &kayit,
                &crate::mcp::McpState::default(),
                Baglam {
                    base_url: &base,
                    model_id: "m",
                    sistem: "y".into(),
                    araclar: vec![arac("shell_run")],
                    gecmis: Vec::new(),
                    text: "sil".into(),
                    kapi: Kapi {
                        kip: Izin::Sor,
                        gruplar: &gruplar,
                        kapi: Some(k2.as_ref()),
                        run_id: "local-bekle",
                    },
                },
            )
            .await;
            let mesajlar = kayit.mesajlar.lock().unwrap().clone();
            (sonuc, mesajlar)
        });

        // Soru gelene kadar bekle, sonra döngünün **gerçekten durduğunu**
        // doğrula: yanıt vermeden koşum bitmemeli.
        soruldu.notified().await;
        assert!(!bekleyen.is_finished(), "yanıt verilmeden koşum bitmemeli");
        tokio::task::yield_now().await;
        assert!(!bekleyen.is_finished(), "döngü hâlâ beklemeli");

        // Şimdi izin ver — döngü devam etmeli.
        kapi.gonder.lock().unwrap().take().unwrap().send(true).unwrap();
        let (sonuc, mesajlar) = bekleyen.await.unwrap();

        assert!(sonuc.ok, "izin verilince koşum bitmeli: {:?}", sonuc.hata);
        let arac_sonucu = mesajlar.iter().find(|m| m.role == "tool").unwrap();
        let metin = arac_sonucu.content.as_deref().unwrap();
        // İzin verildi: bu bir **red mesajı değil**, aracın kendi sonucu.
        // (MCP bağlı olmadığı için hata metni, ama reddedilmedi.)
        assert!(!metin.contains("vermedi"), "izin verilmişti: {metin}");
        assert!(metin.contains("araç çağrılamadı"), "araç gerçekten çağrılmalı: {metin}");
    }

    /// **Kazandırmayan özetleme yapılmaz.**
    ///
    /// Gerçek kayıttan (2026-09-03): bütçesi 8192 olan bir bot 12.714 token'a
    /// çıktı, ama büyük koşum korunan pencerenin içindeydi ve dışarıda
    /// yalnızca iki satırlık bir selamlaşma kaldı. Eski kod yine de tam bir
    /// yerel model turu harcayıp "Kullanıcının amacı: Selamlaşmak" diyen
    /// yanıltıcı bir özet üretti ve ~50 token kazandırdı.
    #[tokio::test]
    async fn kazandirmayan_ozetleme_modele_hic_gitmez() {
        let k = std::env::temp_dir().join(format!("pcbd-taban-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&k);
        std::fs::create_dir_all(&k).unwrap();

        // Üç koşum: ikisi korunuyor, dışarıda kalan tek koşum küçücük.
        let ids = sahte_kosumlar(&k, 3);
        let mut b = bot("");
        b.jobs = ids;
        b.context_budget = 8192;
        let (onceki, msgs) = gecmis_in(&k, &b);

        // Adres kapalı bir port: model çağrısı yapılsaydı **bağlantı hatası**
        // dönerdi. Taban çağrıdan önce kestiği için gerekçe onu söylemeli.
        let rt_sonuc = ozetle_in(&k, "http://127.0.0.1:1", "m", &b, &onceki, &msgs).await;
        let hata = rt_sonuc.unwrap_err().to_string();
        assert!(hata.contains("kazancı düşük"), "taban devreye girmeliydi: {hata}");

        let _ = std::fs::remove_dir_all(&k);
    }

    /// Düşecek metin gerçekten büyükse özetleme çalışır — taban bir duvar
    /// değil, boşa çalışmayı kesen bir eşik.
    #[tokio::test]
    async fn kazanc_buyukse_ozetleme_denenir() {
        let k = std::env::temp_dir().join(format!("pcbd-taban2-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&k);
        std::fs::create_dir_all(&k).unwrap();

        // Düşecek koşumda tabanı aşacak kadar metin var.
        let uzun = "x".repeat(40_000);
        for (i, metin) in [uzun.as_str(), "kısa", "kısa"].iter().enumerate() {
            runs::append_messages_in(
                &k,
                &format!("local-taban-{i:04}"),
                &[
                    Message::user((*metin).to_string()),
                    Message::assistant("peki".into(), vec![]),
                ],
            );
        }
        let mut b = bot("");
        b.jobs = (0..3).map(|i| format!("local-taban-{i:04}")).collect();
        b.context_budget = 8192;
        let (onceki, msgs) = gecmis_in(&k, &b);

        // Taban geçildi ve model çağrısına gidildi. Sunucu kapalı olduğu için
        // özet boş döndü — bu bir hata değil, belgelenmiş sert kırpma yolu:
        // özetleme başarısız olsa da koşum ölmüyor.
        let (ozet, dusen, korunan) = ozetle_in(&k, "http://127.0.0.1:1", "m", &b, &onceki, &msgs)
            .await
            .expect("taban geçilmeliydi, çağrı denenmeliydi");
        assert!(ozet.is_empty(), "sunucu kapalıyken özet boş olmalı");
        assert_eq!(dusen, 2, "uzun koşumun iki mesajı düşmeli");
        assert_eq!(korunan.len(), 4, "son iki koşum korunmalı");

        let _ = std::fs::remove_dir_all(&k);
    }

    #[test]
    fn yeni_gorsel_gelince_eskiler_dusuyor() {
        let gorselli = |metin: &str, id: &str| {
            let mut m = Message::tool(metin.into(), id.into());
            m.images = vec!["data:image/png;base64,AAAA".into()];
            m
        };
        let mut msgs = vec![
            Message::user("ekranı izle".into()),
            gorselli("1. ekran", "c1"),
            Message::assistant("bakıyorum".into(), vec![]),
            gorselli("2. ekran", "c2"),
        ];

        eski_gorselleri_dus(&mut msgs);

        // Hepsi düşer: çağıran bunu **yeni** mesajı listeye eklemeden önce
        // yapıyor, yani ayakta kalan tek görüntü sonradan eklenen oluyor.
        assert!(msgs.iter().all(|m| m.images.is_empty()), "{msgs:?}");
        // Metin kaybolmuyor, yerine iz bırakılıyor.
        let c = msgs[1].content.as_deref().unwrap();
        assert!(c.contains("1. ekran") && c.contains("1 görüntü"), "{c}");
        // Görüntüsüz mesajlara dokunulmuyor.
        assert_eq!(msgs[0].content.as_deref(), Some("ekranı izle"));
    }

    // ── Runs: bekleyen izin durum makinesi ──

    #[tokio::test]
    async fn izin_yaniti_donguyu_cozer() {
        let runs = Runs::default();
        let rx = runs.test_bekleyen("local-1", "shell_run");

        // Arayüz isteği görebilmeli.
        let bekleyenler = runs.bekleyen_izinler();
        assert_eq!(bekleyenler.len(), 1);
        assert_eq!(bekleyenler[0].run_id, "local-1");
        assert_eq!(bekleyenler[0].bot_id, "b1");
        assert_eq!(bekleyenler[0].istek.tool, "shell_run");

        assert!(runs.izni_yanitla("local-1", true));
        assert!(rx.await.unwrap(), "döngüye izin verildiği ulaşmalı");

        // İstek düştü: aynı yanıt ikinci kez gitmiyor.
        assert!(!runs.izni_yanitla("local-1", true), "çift tıklama yutulmalı");
        assert!(runs.bekleyen_izinler().is_empty());
    }

    /// **Koşum durdurulunca izin isteği düşer ve reddedilmiş sayılır.**
    /// Kanal yanıtsız kapanırsa `rx.await` hata verir; döngü bunu `false`
    /// okuyor. Aksi hâlde durdurulan bir koşum ekranda soru bırakırdı.
    #[tokio::test]
    async fn dusen_istek_reddedilmis_sayilir() {
        let runs = Runs::default();
        let rx = runs.test_bekleyen("local-2", "ui_click");

        runs.izni_dus("local-2");
        assert!(rx.await.is_err(), "kanal düşmeli");
        assert!(runs.bekleyen_izinler().is_empty());
    }

    /// Koşum bitince `cikar` bekleyen isteği de temizler.
    #[tokio::test]
    async fn kosum_bitince_bekleyen_istek_temizlenir() {
        let runs = Runs::default();
        let rx = runs.test_bekleyen("local-3", "fs_write");
        runs.cikar("local-3").await;
        assert!(rx.await.is_err());
        assert!(runs.bekleyen_izinler().is_empty());
    }

    /// Yanıt bekleyen istek yokken yanıtlamak sessizce `false` döner —
    /// koşum bu arada bitmiş olabilir, bu bir hata değil.
    #[tokio::test]
    async fn olmayan_istegi_yanitlamak_hata_degil() {
        let runs = Runs::default();
        assert!(!runs.izni_yanitla("local-yok", true));
    }

    fn kilit(unlocked: bool) -> crate::desktop::DesktopState {
        crate::desktop::DesktopState {
            unlocked,
            remaining: if unlocked { 600 } else { 0 },
            hard_remaining: if unlocked { 3600 } else { 0 },
            reason: None,
            granted_at: None,
            known: true,
        }
    }

    #[test]
    fn kilitliyken_kimin_acacagi_yazilir() {
        // `desktop_unlock` listede **yok**: modele "sen açamazsın, iste ve
        // bekle" denmeli. Bu satır olmadan model olmayan aracı arıyordu.
        let s = masaustu_notu_ile(&[arac("ui_click")], &kilit(false));
        assert!(s.contains("kapalı"), "{s}");
        assert!(s.contains("araç listende **yok**"), "{s}");
        assert!(s.contains("başka bir yol arama"), "{s}");

        // Listede **var**: modele kendi açabileceği söylenmeli. Kullanıcının
        // istediği otomasyon tam olarak bu.
        let s = masaustu_notu_ile(&[arac("ui_click"), arac("desktop_unlock")], &kilit(false));
        assert!(s.contains("kapalı"), "{s}");
        assert!(s.contains("`desktop_unlock` çağır"), "{s}");
        assert!(!s.contains("listende **yok**"), "{s}");
    }

    #[test]
    fn masaustu_ipuclari_iki_dalda_da_verilir() {
        // Model bunları turlarca kendi keşfetmeye çalışıyordu: izin boşta
        // düşüyor, kullanıcı aktifken eylem reddediliyor, koordinatlar
        // ekran başına değil global.
        for d in [kilit(true), kilit(false)] {
            let s = masaustu_notu_ile(&[arac("ui_click"), arac("desktop_unlock")], &d);
            assert!(s.contains("boşta kalınca düşer"), "{s}");
            assert!(s.contains("force"), "{s}");
            assert!(s.contains("bütün ekranlar için tektir"), "{s}");
            assert!(s.contains("ui_dump"), "{s}");
        }
        // Masaüstü aracı olmayan bota bu bilgiler gereksiz.
        assert!(!sistem_prompt(&bot(""), &[arac("fs_list")], None).contains("force"));
    }

    #[test]
    fn izin_acikken_kalan_sure_yazilir() {
        let s = masaustu_notu_ile(&[arac("ui_click")], &kilit(true));
        assert!(s.contains("açık"), "{s}");
        assert!(s.contains("10 dakika"), "600 sn → 10 dk: {s}");
        assert!(
            !s.contains("`desktop_unlock` çağır"),
            "açıkken açma talimatı gereksiz: {s}"
        );
    }

    #[test]
    fn kilit_durumu_bilinmiyorsa_uydurulmaz() {
        let mut d = kilit(false);
        d.known = false;
        let s = masaustu_notu_ile(&[arac("ui_click")], &d);
        assert!(s.contains("okunamıyor"), "{s}");
        assert!(!s.contains("kapalı"), "bilinmeyen durum 'kapalı' diye sunulmamalı: {s}");
    }
}
