# ASAMALAR.md — PcBridgeDesktop yol haritası

Kurallar, tasarım kanunu ve ölçülmüş gerçekler **[CLAUDE.md](CLAUDE.md)'de** —
yeni oturumda önce onu oku. Bu dosya yalnızca **ne yapılacağını** ve **bitiş
ölçütünü** taşır.

Durum: **Beş aşamanın hepsi bitti ve ölçüldü.** Yol haritası tamam.

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
