# ASAMALAR.md — PcBridgeDesktop yol haritası

Kurallar, tasarım kanunu ve ölçülmüş gerçekler **[CLAUDE.md](CLAUDE.md)'de** —
yeni oturumda önce onu oku. Bu dosya yalnızca **ne yapılacağını** ve **bitiş
ölçütünü** taşır.

Durum: **Dokuz aşamanın hepsi bitti ve ölçüldü.** Bu dosya artık yapılacak
iş listesi değil, **bitmiş işin kaydı**.

---

## Neden

pcbridge bugün yalnızca bir MCP sunucusu; onu sürmek için bir sohbet penceresi
gerekiyor. Üç somut sıkıntı:

1. **Ajan işleri kör** — `agent_run` bir `job_id` döner, ilerleme için elle
   `job_status` pollanır. Oysa çıktı zaten diskte canlı akıyor.
2. **Terminaller uzakta** — `tmux_capture` saniyede bir ekran metni çeken
   salt-okunur bir ayna.
3. **Bot kavramı yok** — her çağrıda ajan/model/effort/dizin elle yazılıyor.

---

## Mimari (karar verildi)

```
PcBridgeDesktop/
  design/            .dc.html artboard'ları — TASARIM SÖZLEŞMESİ
  src-tauri/src/
    main.rs          Tauri kurulumu, komut kaydı
    mcp.rs           rmcp Streamable HTTP istemcisi -> 127.0.0.1:8765/mcp
    secrets.rs       statik token: keyring crate (GNOME libsecret)
    pty.rs           portable-pty + tmux; her bölme bir PTY
    jobs.rs          jobs/<id>/out.log offset takibi -> frontend olayı
    bots.rs          bot profilleri (JSON)
    parse.rs         claude_stream_json / agy_json adım ayrıştırma
  src/
    styles/tokens.css
    views/{Agents,Terminals}.tsx
    lib/{ipc.ts, types.ts}
```

**Yığın:** Tauri 2 · Rust · React 18 · TypeScript · Vite · xterm.js.
**Bileşen kütüphanesi yok, CSS framework yok** — düz CSS + tokenlar.

**İki panel, üç kip değil.** İlk turda dört sütunlu bir kontrol odası çizildi
ve kullanıcı beğenmedi. Şimdiki kabuk: solda 300px liste, sağda içerik.
Ajan kipinde liste = botlar, terminal kipinde = tmux oturumları.

**Bot modeli** (`~/.config/pcbridge-desktop/bots.json`):

```jsonc
{
  "id": "ulid",
  "name": "Köprü Bakımı",
  "avatar": "mor",              // altı hazır tonun ADI, hex DEĞİL
  "agent": "claude",            // list_agents'tan
  "model": "opus",
  "effort": "high",
  "workdir": "/home/eymistaken/Belgeler/Pcbridge",
  "preamble": "Kalıcı yönerge — her prompt'un başına eklenir",
  "desktop": false,
  "timeout": 1800
}
```

`agent_run(prompt = preamble + "\n\n---\n\n" + kullanıcı metni, agent, model,
effort, workdir, wait_seconds=0)`. `wait_seconds=0`, çünkü akış dosyadan
geliyor. `resume_session` bot başına saklanır.

> **`avatar` neden hex değil:** aynı ton iki temada farklı — mor koyuda
> `#8D73D1`, aydınlıkta `#6A4FA9`. Diske ham hex yazılırsa bot aydınlık temada
> yanlış renkte çıkar. Alan yuva adını tutar (`mor` `mavi` `cam` `yesil`
> `kehribar` `mercan`), renk `var(--av-mor)` ile temadan çözülür. Altı ton
> `src/styles/tokens.css`'te iki temada da tanımlı.

---

## Aşama 1 — Tasarım tuvali ✅ BİTTİ

Beş artboard `design/` altında, tuval yayımlandı:
**https://claude.ai/code/artifact/dd0430d2-3926-4ee4-a0e5-4cfec4ce8b1b**

| Dosya | Ne |
|---|---|
| `Main.dc.html` | Ajan kipi, koyu (birincil) |
| `Light.dc.html` | Ajan kipi, aydınlık varyant |
| `Terminals.dc.html` | Terminal ızgarası, 4 bölme |
| `BotForge.dc.html` | Bot oluşturma formu |
| `Tokens.dc.html` | Tasarım sistemi künyesi — **kodun sözleşmesi** |

Tuvali güncellemek gerekirse: `design/` altındaki dosyaları düzenle, sonra
`design` skill'inin `seed-canvas.mjs` yardımcısıyla yeniden montajla ve **aynı
dosya yolunu** yayımla (URL korunur).

---

## Aşama 2 — İskelet + bağlantı ✅ BİTTİ

1. `git init` + `.gitignore` (`node_modules`, `target`, `dist`).
2. `create-tauri-app` — React + TypeScript + Vite şablonu. **Şablonun örnek
   CSS'ini sil**, `src/styles/tokens.css`'i CLAUDE.md'deki tokenlarla yaz.
3. Tema anahtarı: `:root` koyu (birincil), `:root[data-theme="light"]`
   aydınlık, `@media (prefers-color-scheme: light)` +
   `:root:not([data-theme="dark"])` sistemi takip etsin. Üçü de tanımlı olmazsa
   toggle tek yönlü çalışır.
4. `secrets.rs` — `keyring` crate, servis adı `pcbridge-desktop`, hesap
   `static_token`. İlk açılışta kullanıcı yapıştırır. **Ekrana basma, loglama.**
5. `mcp.rs` — `rmcp` ile Streamable HTTP istemcisi. Tıkanırsan geri dönüş yolu
   düz `reqwest`: Streamable HTTP = JSON-RPC POST + SSE, fazlası değil.
6. Uygulama kabuğu: 300px kenar çubuğu + ana panel, `Main.dc.html`'deki ölçüler.

**Bitiş ölçütü:** uygulama açılıyor, keyring'den token'ı alıyor, `list_agents`
çağırıyor ve `claude` + `antigravity` ekranda görünüyor. Kenar çubuğunun
dibindeki bağlantı şeridi gerçek veriyi gösteriyor.

### Ne ölçüldü (2026-09-02)

| Ölçüm | Nasıl |
|---|---|
| Kabuk, ajanlar, `33 araç · 2 ajan`, iki tema | Sahte MCP sunucusuna karşı — yanıtı gerçek sunucununkiyle **birebir aynı** |
| Anahtarlık yaz → oku → sil | Token yazıldı, uygulama yeniden açılınca **kendiliğinden** onu kullandı, "Kayıtlıyı sil" sonrası açılışta hiç istek yok |
| Gerçek sunucuya ulaşma + 401 | `journalctl` `POST /mcp 401`; arayüz `--fail` renginde hatayı bastı, çökmedi |
| Ulaşılamayan sunucu | `cargo test` — kapalı porta bağlanınca `Unreachable`, `Protocol` değil |
| Sızıntı | Bilinen sahte token uygulama veri dizininde (sqlite'lar dahil ikili tarama), günlüklerde, journal'da ve depoda **yok** |
| Renkler | Ekran görüntüsünden piksel örneklemesi: 5 yüzey × 2 tema, hepsi tokenlarla **birebir** |
| Testler | `cargo test --lib` 7/7 · `tsc --noEmit` temiz · `npm run build` temiz |

**Son adım da geçti (2026-09-02):** gerçek token'la bağlanıldı, şerit
`33 araç · 2 ajan` diyor, `journalctl` **6 × 200 OK** gösterdi.

### Geliştirme kolaylığı

`PCBRIDGE_MCP_ENDPOINT` uç noktayı geçersiz kılar. Gerçek token'a dokunmadan
uçtan uca denemek için sahte bir MCP sunucusuna yöneltmeye yarar.

---

## Aşama 3 — Botlar + Ajan kipi ✅ BİTTİ

1. `bots.rs` — `bots.json` oku/yaz, CRUD, altı avatar tonu.
2. `BotForge.dc.html`'deki form.
3. `agent_run` çağrısı → `job_id`.
4. `jobs.rs` — `jobs/<id>/out.log`'u offset'ten takip et, `meta.json`'dan durum,
   `exit_code` dosyasını bekle. Frontend'e Tauri olayı olarak gönder.
5. `parse.rs` — `claude_stream_json` / `agy_json` / `plain`. Araç çağrıları
   `Main.dc.html`'deki döküm baloncuğuna dönüşür.
6. Çalışan iş şeridi (besteci üstünde) + `job_cancel`.

**Bitiş ölçütü:** bot yaratılıyor, iş başlatılıyor, çıktı canlı akıyor, durdur
çalışıyor. Ekrandaki metin `out.log` ile birebir aynı.

### Ölçüldü (2026-09-02)

| Ölçüm | Nasıl |
|---|---|
| Bot yaratma | Form `list_agents`'tan geliyor: modeller, effort'lar, `fable, best kapalı`. `bots.json` 0600, `"avatar": "mor"` |
| Canlı akış | Cevap ekranda; `out.log`'daki `"1\n2\n3\n4\n5\n"` ile **birebir** |
| Durdurma | `exit 130`, arayüz "durduruldu" diyor (hata değil) |
| `resume_session` | İkinci turda aynı `conversation_id`, `num_turns: 2`, `cache_read_tokens: 12194` |
| Geçmiş | Diskteki `jobs/<id>/` kayıtlarından kuruluyor; hata ve ham stderr ayrı bloklarda |
| Ayrıştırıcı | Diskteki **125 gerçek koşum** (37 claude · 18 agy · 70 plain) testte |

⚠️ Ajanın kendi oturumu dolmuşsa `agent_run` "Failed to authenticate" ile
biter ve bu uygulamanın hatası **değildir** — CLI'a bir kez elle giriş yapmak
gerekir. Doğrulama sırasında `claude` bu durumdaydı; `antigravity` ile yapıldı.

---

## Aşama 4 — Terminal kipi ✅ BİTTİ

1. `pty.rs` — `portable-pty`, her bölme için `tmux new-session -A -s <ad>`.
   `-A` şart: oturum varsa bağlanır, yoksa yaratır → uygulama yeniden açılınca
   bölmeler geri gelir.
2. xterm.js + `Terminals.dc.html`'deki ızgara (1/2/3/4 bölme).
3. Kenar çubuğu oturum listesi — `tmux_list`'ten, "PC'de açık ama burada değil"
   ayrımıyla.
4. Bölme kapatmak sekmeyi kapatır, **oturumu öldürmez.** Ayrı ve açık bir
   "oturumu sonlandır" eylemi (`tmux_kill`).

**Bitiş ölçütü:** dört bölme açılıyor, dördü de gerçek tmux; `tmux ls` hepsini
görüyor; terminalden `tmux attach -t <ad>` ile aynı ekrana girilebiliyor;
uygulama kapanıp açılınca bölmeler geri geliyor.

### Ölçüldü (2026-09-02)

| Ölçüm | Nasıl |
|---|---|
| Dört bölme | Dördü de `tmux ls`'te, her biri tek istemciyle bağlı |
| Aynı ekran | Dışarıdan `tmux send-keys` ile yazılan satır bölmede göründü; bölmeye yazılan satır `tmux_capture` ile dışarıdan okundu |
| Bölme kapatma | Oturum **yaşıyor**, orijinal zaman damgasıyla; kalan istemci yok |
| Yeniden başlatma | Üç bölme aynı yerleşimde geri geldi, **scrollback'teki işaret duruyor** — yeni oturum değil |

Yerleşim ayrı bir durum **değil**: `panes` tek doğru kaynak. Ayrı tutulunca
kenar çubuğundan açılan oturumu hedef sayı geri kırpıyordu.

tmux'un kendi durum çubuğu bölmede görünür — GNOME'un pencere düğmelerini
kendi çizmesi gibi, o da tmux'un kendi arayüzü; kapatılmıyor.

---

## Aşama 5 — Masaüstü izni + cila ✅ BİTTİ

1. `desktop_unlock` / `desktop_lock` için görünür süre anahtarı ve geri sayım.
   Kenar çubuğu şeridinde durum. **Kapalı başlar.**
2. `system_status`, `screen_capture` önizlemesi, `audit.log` kuyruğu.
3. Klavye kısayolları, boş durumlar, hata durumları (401, sunucu kapalı).

**Bitiş ölçütü:** izin açılıp kapanıyor, geri sayım doğru, süre dolunca
kendiliğinden kapanıyor ve arayüz bunu gösteriyor.

### Ölçüldü (2026-09-02)

| Ölçüm | Nasıl |
|---|---|
| Uygulamadan **kilitleme** | Anahtara basıldı → `desktop_unlock.json` `{"until": 0, "hard_until": 0}` oldu, `audit.log`'a aynı saniyede `desktop_lock was_remaining=89` düştü |
| Uygulamadan **açma** | Formda "5 dk" + gerekçe `ISARET-ACILIS-UYGULAMADAN` → gerçek durum dosyasında `hard_until − granted = 300 sn` ve aynı gerekçe |
| Geri sayım | Bilinen bir durum dosyasıyla: `remaining` 50→28→0, `hardRemaining` 15:00→14:38; ikisi de dosyadaki değerlerle birebir |
| **Süre dolması** | İzin kendiliğinden düştü, anahtar kendiliğinden kapandı ve panel "kayan kira düştü, yeniden açman gerekiyor" dedi |
| Ekran önizlemesi | İki monitör de kart içinde çizildi; izin kapalıyken düğme kapalı ve gerekçe metni görünüyor |
| `system_status` | Markdown ayrıştırıldı: alanlar, disk ve GPU blokları, açık terminaller. Boş değer `—` gösteriliyor |
| Denetim kaydı | `audit.log` kuyruğu canlı akıyor; reddedilen çağrılar ayrı renkte |
| Kısayollar | `Ctrl 1/2/0`, `Ctrl N`, `Esc` fiilen basıldı ve çalıştı |
| Tema | Koyu ↔ aydınlık ↔ sistem; her birinde kip değiştirilip geri gelindi, tema korundu |

Bu aşamada kullanıcı isteğiyle eklenenler:

- **Kip anahtarı kenar çubuğunun tepesine taşındı** (`Botlar | Terminal`,
  kayan parçalı). Ana paneldeki iki ikon düğme kaldırıldı — geçiş tek yerde.
- **Terminal görünümü düzeltildi** (aşağıdaki "Terminal çizimi" bölümü).
- **Besteci**: ek düğmesi çalışıyor, çok satırlı, ipucu `Ctrl ↵`.
- **Devinim**: giriş animasyonları + kayan kip parçası,
  `prefers-reduced-motion` saygılı.

⚠️ pcbridge'de görülen: `system_status` bir kez `- bellek:` satırını **boş**
döndürdü. `free -h | awk '/Mem:/…'` Türkçe yerel ayarda `Bellek:` yazdığı için
eşleşmiyor; sunucunun alt süreçlerinde `LANG` boş olduğu için normalde çalışıyor
(ölçüldü). Bu depoda düzeltilmiyor — pcbridge'in işi.

## Aşama 6 — Uygulama ajan çalıştırıcısı ✅ BİTTİ

**Karar 2026-09-02.** Kullanıcının cümlesi: *"ben tool, güç verenin ayrı bir mcp
olmasını istemiyorum. uygulamanın, mcp'nin verdiği gücü arayüz ile az kurulumla
vermesini istiyorum. mcp kalmaya devam edecek. yani hermes gibi olacak uygulama.
toollar kendi içinde olacak."*

Ajan döngüsü artık uygulamanın içinde dönüyor. Model "şu aracı çağır" der →
uygulama MCP'yi çağırır → sonucu modele geri verir → döngü. Kullanıcı yalnızca
bir adres giriyor; modelin tarafında hiçbir kurulum yok.

**Kabul edilen bedel:** uygulama kapanınca koşum ölür. Bu, "stdio kullanılmıyor,
çünkü uygulama kapanınca iş de ölür" kararının bilinçli tersine çevrilmesi;
kullanıcı 2026-09-02'de açıkça kabul etti. Yarım koşum açılışta `#appClosed`
ile kapatılıyor.

**`agent_run` yolu duruyor.** Bota `backend` alanı eklendi
(`pcbridge-agent` | `yerel-model`); iki yürütme yolu yan yana yaşıyor.
Yönlendirme botun arka ucuna değil **koşum kimliğinin önekine** bakıyor
(`local-…` bizim, `%Y%m%d-%H%M%S-…` pcbridge'in) — kullanıcı arka ucu sonradan
değiştirse bile eski geçmiş doğru yerden okunuyor.

### Yeni modüller

| Dosya | İş |
|---|---|
| `model.rs` | OpenAI-uyumlu istemci: `/v1/models`, akışlı `/v1/chat/completions`, SSE ayrıştırıcısı, `model.json` |
| `agent.rs` | Döngü, araç yürütme, özetleme, iptal |
| `runs.rs` | Yerel koşumun diskteki kaydı — `jobs.rs`'in ikizi |

`mcp.rs` üç yerde değişti: `&'static str` araç adı kısıtı kalktı (rmcp zaten
`String` kabul ediyordu), `list_all_tools` sonucundaki şemalar saklanıyor
(ek ağ çağrısı yok), ve ajan için ayrı bir çağrı yüzeyi eklendi — araç hatası
`ConnError` olarak fırlatılmıyor, **modele sonuç olarak** geri veriliyor.

### Ölçüldü (2026-09-02)

- **`ornith-1.5-35b-a3b` akış kipinde araç çağırıyor.** Gerçek koşum:
  `ToolStart { tool: "fs_list", detail: "/tmp" }` → `ToolEnd { ok: true }` →
  model sonucu okuyup Türkçe yanıt verdi. **27,9 saniye.** Test:
  `cargo test --lib gercek_model -- --ignored`.
- **Araç filtresi fiilen kısıtlıyor.** LM Studio'nun kendi kaydında 7 istekte
  yalnızca `fs_list` göründü; seçilmeyen 32 araç modele **hiç gönderilmedi**.
- **`reasoning_content` geliyor** — `delta.content`'ten ayrı bir alan,
  `Event::Thinking`'e çevriliyor.
- **`stream_options.include_usage` destekleniyor**, `prompt_tokens` kesin sayı
  olarak dönüyor. Özetleme eşiği tahminle değil **bu sayıyla** tetikleniyor.
- **`Response::chunk()` reqwest'in `stream` özelliğinin dışında**
  (`reqwest-0.13.4/src/async_impl/response.rs:310`). SSE onunla okunuyor;
  `stream` ve `futures-util` eklenmedi.
- **LM Studio bu makinede Flatpak** (`ai.lmstudio.lm-studio`). Host'taki
  `~/.lmstudio/bin/lms` **ancak GUI açıkken** çalışıyor; kapalıyken
  "daemon is not running" diyor. Doğrulama sırası: uygulamayı aç →
  `lms server start`.

### Bağlam yönetimi — özetleme (kullanıcının seçimi)

Kırpma değil özetleme seçildi. Bir önceki koşumun **ölçülen** `prompt_tokens`'ı
bütçenin %75'ini aşınca, en eski koşumlar modele özetletilip yerlerine tek bir
metin konuyor. Özet o koşumun `ctx.json`'ına yazılıyor ve bir **denetim
noktası** oluyor: bir kez hesaplanır, her koşumda tekrarlanmaz.

- Özet **sistem mesajının içine** giriyor. Ayrı bir `system` mesajı ya da
  sohbetin ortasına düşen bir özet kimi sunucuda reddediliyor.
- Kesme **koşum sınırından** yapılıyor; bir koşumun mesajları araç çağrısıyla
  sonucunu birlikte taşıdığı için çift asla bölünmüyor. Yanıtsız bir
  `tool_calls` sunucuyu 400 ile reddettirirdi — koşum yarıda kesilirse
  (iptal, hata, uygulama kapanışı) eksik sonuçlar dürüstçe dolduruluyor.
- Özetleme **başarısız olursa koşum ölmüyor**: sert kırpmaya düşülüyor ve
  arayüz `#summaryFailed` ile bunu açıkça yazıyor.

**Gerçek modelle ölçüldü** (`cargo test --lib gercek_ozetleme -- --ignored`):
dört turluk bir konuşmanın ilk ikisi özetlendi, **4 mesaj düştü, 4 korundu**,
kesme koşum sınırından oldu ve özet somut bilgiyi (proje adı, kullanılan
diller) korudu. **8 saniye.**

### Araç onayı — bot başına önceden (kullanıcının seçimi)

Koşum sırasında onay sorulmuyor; BotForge'da bot başına araç filtresi var.
Üç grup: **Okuma · Yazma · Masaüstü.** Yazma ve masaüstü **kapalı başlıyor**.
Gruplama önce sunucunun `readOnlyHint`'ine, o yoksa uygulamadaki ad listesine
bakıyor (`src/lib/tools.ts`); tanınmayan bir araç `write` sayılıyor — bilmediğimiz
bir aracı zararsız varsaymak yanlış olurdu.

Bu bir konfor özelliği değil **asıl denetim**: 33 araç küçük modeli boğuyor, ve
güvenilmeyen metin okuyan bir botun elinde kabuk olmamalı.

### Arayüzde ölçüldü (2026-09-02, gözle)

Uygulama açıldı, yerel modelli bir bot kuruldu ve iki temada bakıldı:

- **Bağlantı panelinde "Yerel model sunucusu" kartı**: adres yazılıp **Dene**
  → `bağlandı · 2 model · ornith-1.5-35b-a3b, text-embedding-…`. Sayı gerçek
  `/v1/models`'ten. `model.json` **0600** ve içinde **hiçbir sır yok**
  (`base_url` + `has_key` yalnızca).
- **BotForge yerel kipte**: ajan ve effort alanları kayboluyor, yerine model
  listesi ve araç filtresi geliyor. Filtre **READ 13/13 açık, WRITE 0/10 ve
  DESKTOP 0/10 kapalı** başlıyor. Altbilgi `chat(ornith-1.5-35b-a3b, 13 tools)`
  diyor — `agent_run(...)` değil.
- **Koşum**: "src-tauri/src altında kaç dosya var?" → model `fs_list`'i çağırdı
  ve **12** dedi; doğru. Döküm baloncuğunda ✓ ikonu, fiil (`Read`, `Sessions`)
  ve mono yol göründü.
- **Durdurma**: koşum ortasında **Stop** → şerit kayboldu, `meta.json`
  `status: cancelled` / `exit_code: 130`, ekranda **"stopped"** yazdı (kırmızı
  hata baloncuğu değil). Mesaj listesi sağlam kaldı: **yanıtsız araç çağrısı
  yok**, yani sonraki koşum 400 almaz.
- **Yeniden açılış**: uygulama kapanıp açıldı, geçmiş `runs/` içinden aynen
  geri geldi ve kenar çubuğu son cümleyi gösterdi.
- **İki tema**: renkli düğme yok, renk yalnızca kimlikten (avatar) ve durumdan
  (izin rozeti) geliyor, `Save` `--text` dolgu / `--bg` metin, köşeler 10/20.

⚠️ **Ekranda yakalanan iki hata, düzeltildi:**

1. **Her token alt alta düşüyordu.** `timeline.ts::toBlocks` ardışık `Text`
   olaylarını `\n` ile birleştiriyordu — `agent_run` yolunda doğruydu (her olay
   tam bir bloktu), ama döngü token başına olay yayıyor. `Event::Text` ve
   `Event::Thinking` artık `delta` taşıyor ve birleştirme kuralını **olay**
   söylüyor. Bir birim testi döngünün `delta: true` yaydığını sabitliyor.
2. **Kenar çubuğu "." gösteriyordu.** `runs::last_line` son olaya bakıyordu;
   token akışında o tek bir noktalama işareti. Artık sondan geriye ardışık
   metin olayları birleştiriliyor.

Ayrıca arka uç değiştirilince eski model kimliği (`sonnet`) formda kalıyordu;
bir arka ucun modeli ötekinde hiçbir şey ifade etmediği için anahtar
değişince sıfırlanıyor.

⚠️ **`agent_run` yolu yeniden koşturulmadı.** Yönlendirme gerçek karışık veriyle
doğrulandı — bir `local-` botu ve bir pcbridge botu yan yana, geçmişleri
karışmadan çiziliyor — ama `agent_run` çağrısının kendisi **kota yaktığı için**
ve kullanıcı uykuda olduğu için tetiklenmedi. Çağrının kodu değişmedi.

### Kapsam dışı — bilerek

- **Görüntü döndüren araçlar.** `screen_capture` `data:` URL veriyor ama araç
  sonucundaki görüntü bloğu şimdilik `[N görüntü — bu botta gösterilemiyor]`
  yer tutucusuna düşüyor. "Yerel modelle masaüstü sürmek" ayrı bir hedef.
- **Paralel araç çağrısı.** Bir mesajda birden çok çağrı gelirse **sırayla**
  yürütülüyor.
- **Tray'e inme.** Ayrı iş; kullanıcı bu işe dahil etmedi.

---

## Aşama 7 — İzin kipleri ✅ BİTTİ

*2026-09-03.* Aşama 6'dan sonra kullanıcı bir bota masaüstü işi verdi ve bot
28 paragraf boyunca olmayan bir aracı aradı. Teşhis üç katmanlıydı ve **üçü de
uygulamanın hatasıydı**, modelin değil.

### Bulunan üç hata

1. **Ölü anahtar.** BotForge'da "Masaüstü izni" adında bir anahtar vardı,
   `bots.json`'a `desktop: true` yazıyordu ve **hiçbir yerde okunmuyordu**
   (`grep`: yazan üç satır, okuyan sıfır). İpucu metni de yalan söylüyordu:
   "Açılırsa her koşumda desktop_unlock istenir" — öyle bir kod yoktu.
   Gerçek denetim araç filtresindeki Masaüstü grubuydu ve kapalı kalmıştı.
   Aşama 6 planı bunu *"alan ya filtreye bağlanır ya kaldırılır — ikisinden
   biri, sessizce durmaz"* diye not düşmüş, sonra sessizce durmuştu.
2. **Sistem promptu olmayan aracı aramayı yasaklamıyordu.** Model listede
   bulamadığı `desktop_unlock`'u "başka bir yolu olmalı" diye aradı.
3. **Modele kilit durumu hiç söylenmiyordu.** pcbridge'in hata cümlesi
   "desktop_unlock bekliyor" diyor; model bunu "çağırman gereken bir araç
   var" diye okuyor. Döngünün kaynağı tam olarak o cümleydi.

### Kullanıcının kararı

*"Botun masaüstü iznini açmasına benim izin vermem fikri hoşuma gitmedi.
Otomasyonu baltalıyor."* — Onay **her çağrıda kullanıcıya sormak** değil,
**kip seçmek** olacak. Kip bot ayarlarından ve bestecinin altındaki menüden
değiştirilebilir.

### Kip seti — uygulamanın kendi grup sözlüğü

| Kip | Okuma | Yazma | Masaüstü |
|---|---|---|---|
| `sor` **(varsayılan)** | serbest | **sorar** | **sorar** |
| `yazma-serbest` | serbest | serbest | **sorar** |
| `serbest` | serbest | serbest | serbest |

Okuma **hiçbir kipte** sormaz: onu araç filtresi zaten karara bağladı.
Filtre "bu bot neyi görebilir", kip "gördüğünü sormadan yapabilir mi" der.

### Kurulan şey

- **`tools.rs` (YENİ)** — grup listesi ve `Izin` kipi. Liste **Rust'a taşındı**;
  `tools.ts`'teki ikinci kopya silindi ve ön yüz artık `mcp_tools` yanıtındaki
  `group` alanını okuyor. İki listenin ayrışması "arayüzde masaüstü yazıyordu
  ama sormadan çalıştı" hatasına açık kapıydı.
- **`agent.rs::Kapi`** — araç çağrılmadan önceki izin kapısı. `IzinKapisi`
  trait'i **sync**: isteği kaydedip yanıt kanalını dönüyor, beklemek çağıranın
  işi. Böylece `agent.rs` Tauri'den bağımsız kaldı ve döngü penceresiz
  sınanabiliyor.
- **`Runs.bekleyen`** — koşum başına en fazla bir istek (araçlar sırayla
  yürütülüyor). `answer_permission` ve `pending_permissions` komutları.
- **`PermMenu` + `PermAsk`** — bestecinin altındaki kip menüsü ve bekleyen
  istek kartı. Kart **argümanları tam metin gösteriyor**: ne onaylandığını
  göstermeyen bir onay kutusu onay değildir.
- **Kenar çubuğunda "İznini bekliyor"** — bekleyen koşum süresiz bekliyor ve
  soru yalnızca o botun sohbetinde görünüyor; başka bota bakan kullanıcı
  koşumun neden asılı kaldığını göremezdi.

### Ölçülenler

- **Döngü gerçekten bekliyor.** `dongu_yanit_gelene_kadar_bekler` testi yanıtı
  başka bir görevden gecikmeli veriyor; koşum o süre boyunca duruyor, izin
  gelince araç **çalışıyor**. Hemen yanıt veren bir kapı bu farkı gösteremezdi.
- **Reddedilen çağrı koşumu düşürmüyor.** Modele "kullanıcı izin vermedi,
  aynı çağrıyı tekrarlama" yazılıyor ve model kendi cümlesiyle bitirebiliyor.
- **Kip soruyor ama soracak kimse yoksa reddediliyor.** Sessizce çalıştırmak
  kullanıcının seçtiği kipi yok saymak olurdu.
- **Koşum durdurulunca istek düşüyor** ve kanal kapandığı için reddedilmiş
  sayılıyor; ekranda asılı soru kalmıyor.
- **Diskteki gerçek `bots.json` sağlam okundu.** `desktop` alanı serde
  tarafından yutuluyor, `permission` `sor`'a düşüyor. 1 bot, göç sağlam.
- 96 Rust testi, 0 clippy uyarısı, 282 i18n anahtarı iki sözlükte de tam.

### Aynı gün eklenenler

Kullanıcı izin kiplerini denerken çıkan üç eksik, aynı gün kapatıldı:

- **Görüntü artık modele gidiyor.** `call_for_agent` görüntü bloklarını sayıp
  atmak yerine `data:<mime>;base64,…` olarak taşıyor. Ölçüldü: LM Studio
  görüntüyü **`tool` mesajının içinde** kabul ediyor (ayrı bir `user` mesajı
  gerekmiyor) ve Ornith `#0078DC`'yi "Mavi" diye okudu. Görüntü **tek tur
  yaşıyor** ve **diske yazılmıyor** — biri bağlamı, öteki `messages.jsonl`'i
  korur. Araç başına en fazla 4 görüntü.
- **Bağlam bütçesi model sunucusundan doluyor.** LM Studio'nun standart dışı
  `/api/v0/models` ucu `loaded_context_length` ve `type: "vlm"` veriyor
  (ölçüldü: `ctx=100096`, `vision=true`). Model seçilince bütçe o değere
  çekiliyor, alan düzenlenebilir kalıyor. Uç yoksa hiçbir şey değişmiyor —
  uydurulmuyor.
- **Yerel `<select>` kalktı.** `src/ui/Picker.tsx`; GTK'nın kutusu tasarımın
  dışındaydı. Seçenekler artık `100K context · vision` gibi bilgi de taşıyor.

Ayrıca özetleme düzeltildi (bkz. CLAUDE.md, "Bağlam ve özetleme"): kazanç
tabanı model çağrısından önce, ve yardımcı olamıyorsa `#budgetTooSmall`.

### Kapsam dışı — bilerek

- **Zaman aşımı yok.** Yanıtlanmayan istek koşumu süresiz bekletir. Sessizce
  reddetmek kullanıcıya "izin istemedim" yalanını söylerdi, sessizce kabul
  etmek daha kötüsünü. Kenar çubuğu göstergesi bunun karşılığı.
- **Oturum kipi katmanı yok.** Besteci menüsü botun kendi alanını yazıyor.
  Aynı işi yapan iki denetimden biri er geç ölü kalıyor — bu depoda bir kez
  oldu ve bu aşamanın var olma sebebi o.

---

## Aşama 8 — Arayüz turu ✅ BİTTİ

*2026-09-03.* Kullanıcı Claude Code'un arayüzünü göstererek altı şey istedi.
Hepsi Nötr Kabuk'a çevrilerek yapıldı; birebir kopya değil.

### Kullanıcının kararları

| Konu | Karar |
|---|---|
| Bot rengi | Addan **hue** türesin, açıklık ve doygunluk sabit kalsın |
| Tur tavanı | Bot başına ayar **+** tavanda "devam edeyim mi", varsayılan **100** |
| Düşünce kutusu | Kapalı başlar; kapalıyken son 2-3 satır akar, açılınca kendi içinde kaydırılır |
| Bağlam çubuğu | Görüntü işareti yok; model ve doluluk **tek düğme**, basınca döküm + elle özetleme; %90'da öneri, %100'de otomatik |

### Önce çıkan hata — özet denetim noktası siliniyordu

Bağlam çubuğu ve compact merdiveni bunun üstüne kurulacaktı, o yüzden ilk iş
buydu. `kos` özetlemeden sonra `ctx.json`'a `summary` yazıyor, **aynı koşum**
başarıyla bitince `tur_dongusu` aynı dosyaya `summary: None` yazıyordu;
`write_ctx_in` `fs::write` ile tam üzerine yazıyor. Sonuç: bir sonraki koşumda
`gecmis_in` denetim noktası bulamaz, geçmişin tamamını yeniden yükler, eşik
yine aşılır ve özetleme **her koşumda bir model turu harcayarak** yeniden
çalışır.

Diskte hiç gözlenmemişti: özet taşıyan tek koşum
(`local-1a066e01592-b08137`) iptal edilmiş (`exit_code: 130`) ve token
yazmasına hiç ulaşılmamıştı. Hata gerçekti, yalnızca henüz tetiklenmemişti.

`Kayit::ctx` ikiye ayrıldı — `ctx_olcum` yalnızca ölçümü, `ctx_ozet` yalnızca
işareti yazıyor, ikisi de oku-değiştir-yaz. İkinci tutarsızlık aynı yerdeydi:
işaret **yeni** koşuma yazıldığı için `ozetle_in`'in koruduğu iki koşum bir
sonraki `gecmis_in`'de sessizce düşüyordu; işaret artık korunan pencerenin
ilk koşumuna gidiyor.

### Kurulan şey

- **`CtxMenu` (YENİ)** — besteci altında model · doluluk tek düğme. Çubuk
  renksiz (dolu `--text`, boş `--surface-2`); renk yalnızca eşikte geliyor.
  Menüde döküm: sistem · araçlar · geçmiş · görüntü. Doluluk **yalnızca
  `yerel-model`** botlarında; `agent_run` koşumlarının `ctx`'i yok ve uydurma
  sayı göstermektense çubuk hiç çizilmiyor.
- **`RunCtx.breakdown`** — her turda karakter cinsinden ölçülüyor. Toplam
  sunucunun `usage`'ı ve kesin; kırılım değil, o yüzden arayüz `≈` yazıyor.
- **Compact merdiveni** — %75 koşumlar arası (değişmedi) · %90 boştayken
  "Özetle?" · %100 koşum ortasında otomatik. Sonuncusu tavan 100'e çıktığı
  için şart oldu.
- **`kesme_noktasi`** — tur içi kesme araç çağrısı sınırından. `tool_calls`
  taşıyan bir `assistant` mesajı `tool` yanıtlarından ayrılırsa sunucu 400
  döndürüyor.
- **`job://compacting`** — özetleme başlarken şerit çıkıyor. Diske yazılmıyor:
  anlık durum, kalıcı kayıt zaten özet baloncuğu.
- **`Thinking` (YENİ)** — kapalı başlıyor, son üç satır akıyor, açılınca kendi
  kutusunda kaydırılıyor. `Event::Thinking` bir `ms` alanı kazandı ve turun
  düşünme akışı bitince **metinsiz tek bir kapanış olayı** taşıyor.
- **Bot rengi hue'dan** — `Bot.avatar` artık `Option<u16>`. Karma yalnızca
  TypeScript'te; iki dilde iki karma ayrışırdı. `--av-*` tokenları kalktı,
  yerine `--av-l` / `--av-c`.
- **`Bot.max_turns`** (varsayılan 100) ve tavanda soru — **yeni bir bekleme
  makinesi kurulmadan**, aynı kuyruk ve aynı kart. `IzinIstegi`'ye `kind`
  alanı geldi.
- **`Bot.force_when_busy`** (varsayılan kapalı) — açıkken `force`'u uygulama
  ekliyor, modelden istenmiyor.

### Ölçülenler

- **`force` argümanını 7 araç kabul ediyor, 10 değil.** `pcbridge/tools.py`'den
  okundu: `mouse` · `keyboard` · `ui_click` · `ui_set_text` · `window_focus` ·
  `computer_batch` · `computer_task`. `screen_capture`, `desktop_lock` ve
  `desktop_unlock` böyle bir alan **taşımıyor**; masaüstü grubuna körlemesine
  eklemek onları bozardı. Bir test alt küme olduğunu sabitliyor.
- **360 hue'nun hepsi AA geçiyor.** `--av-l`/`--av-c` sabit olduğu için harfin
  kontrastı hue'dan bağımsız: koyu temada en düşük **4.62**, aydınlıkta
  **4.88**. Altına düşen hue yok.
- **Eski altı tonun göçü neredeyse kayıpsız.** Hue karşılıkları bugünkü
  hex'lerden oklch'e çevrilerek bulundu; dördü birebir aynı, ikisi tek kanalda
  en fazla 3/255 kayıyor.
- **`oklch()` WebKitGTK 4.1'de çalışıyor** — varsayılmadı, ölçüldü:
  `CSS.supports('color','oklch(...)')` true ve `oklch(var(--av-l) var(--av-c)
  250)` doğru çözülüyor.
- **Kuyu aydınlık temada okunmuyordu.** `--well` iki temada da koyu ama metni
  `--text`'ten alıyordu: **1.09:1**. `--text-muted` de 2.63 ile büyük metin
  eşiğinin altındaydı. Terminalin kendisi de buna dahildi. `--well-text`
  (15.72) ve `--well-muted` (6.49) geldi, tema bloklarında yeniden
  tanımlanmıyorlar.
- **Düşünce kutusunun ölçümü düzene bağlı olmak zorunda.** Tek seferlik ölçüm
  kap sıfır genişkeyken yapılıyor, `overflow-wrap: anywhere` yüzünden her
  karakter ayrı satıra düşüyor ve `scrollHeight` **7130px** çıkıyordu; kutu
  boş görünüyordu. `ResizeObserver` çözüyor.
- **Kararsız test bulundu ve düzeltildi.** `:0` ile ayrılıp bırakılan bir portu
  paralel koşan başka bir testin sahte sunucusu kapabiliyordu. Adres
  `127.0.0.1:1` oldu; sekiz ardışık tam koşumda üç hedef de geçiyor.
- **119 Rust testi**, 0 uyarı, `tsc` temiz. İki temada da bileşenler çizdirilip
  gözle bakıldı.

### Yapılmayan

- Kota göstergesi — kullanıcı istemedi, yerel modelde kota diye bir şey yok.
- Tur içi özetlemenin gerçek modelle ölçümü: LM Studio bu oturumda kapalıydı.
  Sahte sunucuyla uçtan uca sınandı (`butce_tur_icinde_dolunca_ozetlenir`);
  gerçek model doğrulaması **açık kalan tek uç**.

---

## Aşama 9 — Arayüz cilası ve terminal çizicisi ✅ BİTTİ

*2026-09-03.* Kullanıcı Aşama 8'i denedikten sonra on beş maddelik bir liste
verdi. On dördü arayüz işiydi; biri gerçek bir hataydı ve **uygulamanın en
eski varsayımlarından birini** yıktı.

### Terminal: "harf bir basım geç geliyor"

Belirti: bir harfe basılınca hiçbir şey olmuyor, **bir sonraki tuşa basılana
kadar o harf asla belirmiyor.** Genel tepki de hantal.

**İlk tur yanlış yere baktı.** Üç katman ölçüldü, hepsi temiz çıktı, ve
"uygulamanın hattı temiz" denip şüphe GTK girdi yöntemine (ölü tuşlu
`tr+intl` düzeni + ibus) yönlendirildi. Kullanıcı aynı düzenle GNOME Terminal
ve Kitty'de hiç gecikme olmadığını söyleyince o hipotez düştü.

**Hatanın sebebi:** tarayıcı ölçümü **Chromium**'da yapılmıştı. Uygulama
WebKitGTK. Grafik yolunu ilgilendiren bir ölçüm asıl motorda yapılmadıkça
hiçbir şey söylemez.

**Gerçek sebep `@xterm/addon-webgl`:** WebKitGTK'da bağlam kuruluyor,
`readPixels` doğru değer veriyor, `isContextLost()` false — **ama kare
sunulmuyor.** Ekran ancak bir girdi olayı tam yeniden çizim tetikleyince
güncelleniyor.

Kanıt: aynı sayfa, aynı 1,5 saniye, hiçbir girdi olayı olmadan alınan
**gerçek widget görüntüsü** (`WebKit2.WebView.get_snapshot`) — WebGL açıkken
tuval bomboş, kapalıyken yazı yerinde. JS'ten piksel okumak WebGL tuvalinde
güvenilmez (çizim tamponu sunumdan sonra siliniyor), o yüzden snapshot.

Addon kaldırıldı, `customGlyphs` `Terminal` seçeneği olarak açıldı.
**İki gerekçesi de düştü:** 2000 satır DOM çizicide 46 ms, WebGL'de 43 ms
(ölçülebilir fark yok) ve kutu-çizim karakterleri DOM çizicide de hücreye tam
oturuyor — TUI çerçevesi çizdirilip görüntüsüne bakıldı, köşeler birleşiyor.

### Kurulan şey

- **Markdown** (`lib/markdown.ts` + `ui/Markdown.tsx`) — model kalın yazmaya,
  liste ve tablo kurmaya çalışıyordu; ham `**` ekranda duruyordu. Kütüphane
  değil odaklı çözümleyici: bu depo kendi açılır listesini de yazdı ve bir
  markdown kütüphanesi otuz küsur geçişli bağımlılık getiriyor. Çözümleyici
  **React öğesi** üretiyor, HTML dizgesi değil — `dangerouslySetInnerHTML`
  hiç yok.
- **Sohbet JSON dışa aktarma** (`export_bot`) — hata bildirmek için. Dosyada
  sır yok.
- **Üretim hızı** — koşarken anlık (son üç saniyenin kayan penceresi, `~`
  ile), bitince ölçülmüş ortalama (`RunCtx.completionTokens` / `genMs`).
  Süreye araç çalıştırma dahil değil; ölçülen şey modelin kendi hızı.
- **Yerel/bulut ve kaynak** — adresten okunuyor; `pcbridge-agent` yolunda
  ajanın adı.
- **Kilit rozeti düğme oldu** — tek tıkla masaüstü iznini aç/kapat. Süre
  seçimi panelde kaldı; sık yapılan şey "şimdi aç"tı ve üç tıklamaydı.
- **Köşeler yumuşadı** (10 → 12, iç içe 7 → 9), açılır yüzeylere renksiz
  gölge, model·bağlam düğmesi sağa, sohbet ve besteci aynı ölçüde (860px).
- **`Ctrl ↵` ipucu kalktı** — yanlıştı, gönderen tuş düz Enter.
- **Silme ikonu kırmızı değil** — kanunda renk durumdan gelir, `--fail`
  "başarısız oldu" demek; silme bir eylem.
- **tmux durum çubuğu kapalı**, oturuma özgü (`-t`), sunucuya değil.

### Ölçülenler

| Katman | Ölçüm | Sonuç |
|---|---|---|
| PTY + tmux yankısı, `Ptys`'in deseniyle | 0,1–0,3 ms | temiz |
| Tauri `emit` (arka plan) → `listen` | 0–1 ms | temiz |
| WebKitGTK `requestAnimationFrame`, boşta | 62 fps | temiz |
| WebKitGTK'da WebGL bağlamı | kuruluyor, `readPixels` doğru | **sunmuyor** |
| xterm `write` → DOM çizici | 50 ms'de ekranda | temiz |
| 2000 satır verim: DOM / WebGL | 46 ms / 43 ms | fark yok |

- Markdown çözümleyicisinde bir hata bulundu ve düzeltildi: iç içe liste
  sıralı listeyi ikiye bölüyor, numaralar 1'den yeniden başlıyordu.
- 119 Rust testi, 0 clippy uyarısı, `tsc` temiz, i18n iki sözlükte de tam.
- Bileşenler iki temada da çizdirilip gözle bakıldı.

### Yapılmayan

- **`escape-time 500`** tmux **sunucu** ayarı; ESC ile başlayan her diziyi
  (ok tuşları, Alt bileşimleri, TUI'lerde ESC) yarım saniye geciktiriyor.
  Kullanıcının bütün oturumlarını etkilediği için dokunulmadı.
- Markdown çözümleyicisinin birim testi. Projede JS test koşucusu yok ve
  eklemek ayrı bir karar; doğrulama iki temada gözle yapıldı.

---

## Doğrulama — her aşamada fiilen

```bash
cd "/home/eymistaken/Masaüstü/app/PcBridgeDesktop" && npm run tauri dev
```

- **Bağlantı:** uygulama açıkken `journalctl --user -u pcbridge -f` istekleri
  göstermeli. Yanlış token ile 401 alındığı da görülmeli.
- **İş:** başlatılan işin `job_id`'si `job_list`'te görünmeli; ekrandaki metin
  `~/.local/state/pcbridge/jobs/<id>/out.log` ile aynı olmalı.
- **Terminal:** açılan oturum `tmux ls` çıktısında olmalı.
- **Yerel model:** LM Studio açık ve `lms server start` yapılmışken
  `cargo test --lib gercek_model -- --ignored --nocapture`. Çıktıda
  `ToolStart` → `ToolEnd { ok: true }` → `Text` sırası görünmeli.
- **Araç filtresi:** `~/.lmstudio/server-logs/` altındaki güncel kayıtta
  `grep -o '"name": "[a-z_]*"'` yalnızca botun seçtiği araçları göstermeli.
- **Tema:** iki temada da ekran görüntüsü alıp **gözle** bak — hiçbir yüzey saf
  siyah/beyaz değil, hiçbir düğme renkli değil, köşeler 10/20/tam.
- **Kontrast:** yeni renk eklendiyse oranı hesapla (AA = 4.5:1 metin).
- **Sızıntı:** `grep -ri "<token parçası>"` uygulama loglarında ve
  `~/.config/pcbridge-desktop/` altında **hiçbir şey** bulmamalı.

## Riskler

- **Kota.** Aşama 3'ün son doğrulaması gerçek bir ajan koşumu gerektiriyor.
  Bir kere kullanıcının günlük limitini bitirdi (2026-08-03).
- **rmcp API'si.** Rust MCP SDK'sı 2026-07-28 spesifikasyonunda; API'nin şu anki
  şekli koda dökülürken doğrulanacak. Geri dönüş yolu düz `reqwest`.
- **xterm.js + Wayland ölçekleme.** İki monitör 1.0 ölçekte, sorun beklenmiyor
  ama ilk PTY açılışında font metriği ve `fit` eklentisi kontrol edilmeli.
