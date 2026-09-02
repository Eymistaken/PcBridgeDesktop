# Pcbridge Desktop

[English](README.md) · **Türkçe**

[pcbridge](https://github.com/Eymistaken/Pcbridge) MCP sunucusunun masaüstü
istemcisi. Adlandırılmış ajan hazır ayarları, doğrudan diskten akan canlı iş
çıktısı ve gerçek tmux bölmelerinden bir ızgara — tek pencerede.

Linux, x86-64. Tauri 2, React ve Rust ile yazıldı.

> **Durum: erken.** Sürüm 0.1.0. Arayüzde ciddi değişiklikler bekleniyor;
> şimdilik oturmuş saymayın.

## Neden

pcbridge bir MCP sunucusu; onu sürmek için bir sohbet penceresi açık tutmak
gerekiyordu. Üç somut sıkıntı:

- **Ajan işleri kördü.** `agent_run` bir `job_id` döndürüyor ve ilerlemeyi
  görmek için elle `job_status` pollamak gerekiyor — oysa çıktı zaten diskteki
  bir dosyaya akıyor.
- **Terminaller uzaktaydı.** `tmux_capture` saniyede bir ekran metni çeken
  salt-okunur bir ayna.
- **Bot kavramı yoktu.** Ajan, model, effort ve dizin her çağrıda yeniden
  yazılıyordu.

## Ne yapar

**Botlar.** Bir ajanı, modeli, effort'u, çalışma dizinini ve kalıcı yönergeyi
bir ada bağlarsın. Model ve effort listeleri gömülü değil, sunucunun
`list_agents` çıktısından okunuyor. Bot başına bir `session_id` saklandığı için
ikinci mesaj aynı konuşmayı sürdürüyor.

**Canlı çıktı.** İş çıktısı `~/.local/state/pcbridge/jobs/<id>/out.log`
dosyasından bayt konumundan okunuyor — bunun için MCP pollanmıyor. Üç
ayrıştırıcı destekleniyor: `claude_stream_json`, `agy_json` ve `plain`. Araç
çağrıları, düşünme blokları ve kapanış özeti ayrı ayrı çiziliyor.

**Terminal ızgarası.** Her bölme **gerçek bir tmux oturumu.** Bölmeyi kapatmak
oturumu öldürmüyor, uygulamayı kapatmak da öldürmüyor; aynı oturuma başka bir
yerden `tmux attach` ile bağlanabilirsin. Bir, iki, üç ve dört bölmelik
yerleşimler var.

**Masaüstü izni.** pcbridge'in `desktop_unlock` süresi görünür bir anahtar ve
geri sayımla yönetiliyor. Tek sayı değil iki sayı gösteriliyor: kayan kira (her
masaüstü eyleminden sonra ileri itiliyor, eylem gelmezse düşüyor) ve sert tavan.
Yanında `system_status`, ekran önizlemesi ve `audit.log` kuyruğu var.

## Kurulum

Paketler her [yayına](https://github.com/Eymistaken/PcBridgeDesktop/releases)
ekleniyor — bir `.deb` ve bir `.AppImage`, CI'da Ubuntu 22.04 üstünde
derleniyor.

```bash
sudo apt install ./Pcbridge-Desktop_0.1.0_amd64.deb
```

AppImage dahil tüm yönerge ve Ubuntu 24.04 türevlerindeki `libgtk-3-0` konusu:
**[KURULUM.md](KURULUM.md)**.

## Gerekenler

- Çalışan bir [pcbridge](https://github.com/Eymistaken/Pcbridge) sunucusu,
  `http://127.0.0.1:8765/mcp` adresinde. `PCBRIDGE_MCP_ENDPOINT` ile değişir.
- Sunucunun statik token'ı. Uygulama ilk açılışta istiyor.
- Terminal bölmeleri için `tmux`.
- Bir Secret Service sağlayıcısı — örneğin `gnome-keyring-daemon`'ın `secrets`
  bileşeniyle çalışıyor olması.

## Kaynaktan derlemek

```bash
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev \
  libayatana-appindicator3-dev libxdo-dev libssl-dev build-essential curl wget file
npm ci
npm run tauri dev      # geliştirme
npm run tauri build    # paketler src-tauri/target/release/bundle/ altına düşer
```

Testler:

```bash
cd src-tauri && cargo test
```

## Nasıl çalışıyor

```
src/                React arayüzü. Bileşen kütüphanesi yok, CSS çerçevesi yok.
  lib/i18n.ts       İki sözlük ve bir t(). Varsayılan İngilizce.
src-tauri/src/
  mcp.rs            rmcp istemcisi, list_agents ayrıştırıcısı, hata sınıflandırma
  jobs.rs           out.log'u bayt konumundan izler; iş yaşam döngüsü
  parse.rs          claude_stream_json · agy_json · plain
  bots.rs           bots.json — atomik yazma (tmp + fsync + rename), 0600
  pty.rs            portable-pty + tmux
  desktop.rs        desktop_unlock.json, system_status, audit.log
  secrets.rs        OS anahtarlığı; token bu modülden dışarı çıkmaz
design/             Tasarım artboard'ları (*.dc.html) — kodun uyduğu sözleşme
```

Bilinmeye değer iki karar:

**İş, sorulunca bitiyor.** pcbridge biten çocuk süreci ancak `job_status`
çağrıldığında topluyor; o ana kadar süreç zombi kalıyor ve `meta.json`'a
`status` ya da `exit_code` hiç yazılmıyor. Yalnızca dosya izleyen bir istemci
işin bittiğini asla göremez. Bu yüzden `job_status` **bir kez** çağrılıyor:
çıktıda `Finished` görülünce ya da çıktı beş saniye susunca. Çıktının kendisi
hâlâ dosyadan geliyor.

**Bölmeler bağlanır, sahiplenmez.** Bir bölme PTY içinde önce
`tmux new-session -d`, sonra `tmux attach-session` çalıştırıyor; kapanırken
`tmux detach-client` ile ayrılıyor. Tek başına `new-session -A`, oturumu onu
yaratan istemciye bağlıyor ve PTY düşünce oturum da ölüyor.

## Güvenlik

- Statik token **yalnızca** işletim sisteminin anahtarlığında duruyor. Dosyaya
  yazılmıyor, loglanmıyor, ekrana basılmıyor ve arayüze hiç geçmiyor — bütün
  MCP çağrıları Rust'tan yapılıyor.
- pcbridge'in `config.toml` dosyası okunmuyor ve yazılmıyor. `[agents.*]`
  bloğu yazma yeteneği bilinçli olarak yok.
- Botlar uygulamanın kendi dosyasında yaşıyor:
  `~/.config/pcbridge-desktop/bots.json`, kip 0600.
- Masaüstü kontrolü kilitli başlıyor ve süre dolunca kendiliğinden kapanıyor.

## Tasarım

Arayüzün kuralları yazılı ve bağlayıcı: renksiz bir kabuk; renk yalnızca
kimlikten (bot avatarı) ve durumdan (çalışıyor / bitti / başarısız) geliyor.
Sistem aksan rengi yok, gradyan yok, renkli birincil düğme yok. Kontrast
oranları hesaplandı, tahmin edilmedi. [CLAUDE.md](CLAUDE.md)'ye bak.

## Depo belgeleri

[CLAUDE.md](CLAUDE.md) tasarım kanununu ve ölçülmüş gerçekleri tutuyor.
[ASAMALAR.md](ASAMALAR.md) yol haritası ve her aşamanın nasıl doğrulandığı.

## Lisans

[GPL-3.0-or-later](LICENSE) — pcbridge sunucusuyla aynı lisans.
