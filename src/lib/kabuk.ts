/**
 * Kabuğa doğrudan yazılan tuş dizileri.
 *
 * Tek yerde, çünkü buradaki her karakterin ölçülmüş bir gerekçesi var ve
 * ikinci bir kopya sessizce ayrışır.
 */

/**
 * Kabuk sayılan programlar.
 *
 * `cd` **yalnızca** bunlardan birine gönderilebilir: çalışan bir sürecin
 * çalışma dizini dışarıdan değiştirilemez (Linux'un kuralı), ve bir CLI'nin
 * girdi alanına `cd` yazmak ona bir mesaj göndermek olur.
 *
 * Ölçüldü: `tmux display-message -p '#{pane_current_command}'` bir bölmede
 * `sleep 30` sürerken `sleep` döndürüyor, yani ön plandaki program bu listeyle
 * güvenilir biçimde ayırt edilebiliyor.
 */
export const KABUKLAR = ["bash", "zsh", "sh", "fish", "dash", "ksh"];

/**
 * Kabuğa `cd` yazan dizi.
 *
 * `\x15` = **Ctrl+U** (`unix-line-discard`): yarım kalmış komutu keser ve
 * kill-ring'e koyar. Onsuz yazılan `cd` yarım komutun **arkasına** eklenirdi.
 *
 * Baştaki **boşluk** kasıtlı: bu makinede `HISTCONTROL=ignoreboth`
 * (= `ignorespace:ignoredups`) ve boşlukla başlayan komut kullanıcının
 * geçmişine hiç girmiyor. Ölçüldü.
 *
 * ⚠️ **`\x19` (Ctrl+Y) bilinçli olarak YOK.** Plan yarım komutu `Ctrl+U` …
 * `Ctrl+Y` sarmalıyla geri koymayı öngörüyordu; ölçüm bunun yan etkisini
 * gösterdi: **boş bir satırda `Ctrl+U` kill-ring'i değiştirmiyor**, yani
 * `Ctrl+Y` o durumda kullanıcının **daha önce** kestiği metni yeni prompt'a
 * yapıştırıyor. Gerçek koşumda ölçüldü — `echo ESKI_KESILEN` klasör
 * değiştirdikten sonra prompt'a geldi. Yarım komut yine kill-ring'de duruyor;
 * geri almak isteyen kullanıcı kendi `Ctrl+Y`'sine basıyor.
 *
 * `--` yolun `-` ile başlaması hâlinde `cd`'nin onu seçenek sanmasını
 * engelliyor. Tek tırnak kaçırma bash'in olağan kalıbı: `'` → `'\''`.
 */
export function cdDizisi(yol: string): string {
  return `\x15 cd -- '${yol.replace(/'/g, "'\\''")}'\r`;
}
