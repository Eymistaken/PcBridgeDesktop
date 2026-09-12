import { IconBot, IconTerminal } from "./Icon";
import { t } from "../lib/i18n";
import type { Mode } from "../lib/types";

/**
 * Kip anahtarı — kenar çubuğunun tepesinde, uygulama adının hemen altında.
 *
 * Tek bir yerde duruyor ve iki kipte de aynı yerde: nereye basacağını
 * aramak gerekmiyor.
 *
 * ⚠️ **Kelime ikona, alt çizgi çerçeveye döndü (2026-09-12).** Kullanıcının
 * iki ayrı isteği:
 *
 * 1. *"nerdeyse tüm tuşlarda logo yerine yazı yazmaya kaçılmış… daha görsel
 *    odaklı gitsek"* — "Botlar" ve "Terminal" artık ikon. Kelimeler
 *    `title`/`aria-label`'da duruyor.
 * 2. *"bots ve terminal tuşları böyle küçük olursa basması zor olur. o iki
 *    tuşun olduğu yatay alanı eşit bölüşecek şekilde kendi içlerinde
 *    çerçeveli tuşları olsun"* — iki tuş `1fr 1fr` ızgarada, her biri 36px
 *    yüksekliğinde ve kendi çerçevesiyle.
 *
 * Seçim **çerçevenin bir kademe parlaması ve zeminin kalkmasıyla** anlatılıyor;
 * alt çizgiyle değil, çünkü kenar çubuğunda artık kutular var ve alt çizgi
 * ikinci bir dil olurdu.
 *
 * ⚠️ Bileşenin kip değişince **sökülmemesi** şart (kabuk `Shell`'de duruyor):
 * yeni kurulan bir öğe geçiş oynatmaz. Bu Aşama 12'de ölçülerek bulunmuştu.
 */
export default function ModeSwitch({
  mode,
  onMode,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
}) {
  return (
    <div className="side__modes" role="group" aria-label={t("mode.label")}>
      <button
        type="button"
        aria-pressed={mode === "agents"}
        title={t("mode.botsTitle")}
        aria-label={t("mode.bots")}
        onClick={() => onMode("agents")}
      >
        <IconBot />
      </button>
      <button
        type="button"
        aria-pressed={mode === "terminals"}
        title={t("mode.terminalsTitle")}
        aria-label={t("mode.terminals")}
        onClick={() => onMode("terminals")}
      >
        <IconTerminal />
      </button>
    </div>
  );
}
