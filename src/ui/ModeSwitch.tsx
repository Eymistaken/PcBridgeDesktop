import { t } from "../lib/i18n";
import type { Mode } from "../lib/types";

/**
 * Kip anahtarı — kenar çubuğunun tepesinde, uygulama adının hemen altında.
 *
 * Tek bir yerde duruyor ve iki kipte de aynı yerde: nereye basacağını
 * aramak gerekmiyor. Seçim **altı çizgiyle** anlatılıyor.
 *
 * ⚠️ Buradan iki şey kalktı. Kayan parça (`.modesw__thumb`): ledger'da
 * yüzey kademesi yok, taşıyacağı zemin ortadan kalktı. İkonlar: tasarımda
 * yok ve "Botlar" ile "Terminal" zaten iki kelime — ikon üçüncü kez aynı
 * şeyi söylüyordu.
 *
 * ⚠️ Bileşenin kip değişince **sökülmemesi** şart (kabuk `Shell`'de duruyor):
 * yeni kurulan bir öğe geçiş oynatmaz, alt çizgi de o yüzden kaymaz.
 * Bu Aşama 12'de ölçülerek bulunmuştu.
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
        onClick={() => onMode("agents")}
      >
        {t("mode.bots")}
      </button>
      <button
        type="button"
        aria-pressed={mode === "terminals"}
        title={t("mode.terminalsTitle")}
        onClick={() => onMode("terminals")}
      >
        {t("mode.terminals")}
      </button>
    </div>
  );
}
