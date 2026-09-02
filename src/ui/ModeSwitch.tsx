import { IconBot, IconTerminal } from "./Icon";
import type { Mode } from "../lib/types";

/**
 * Kip anahtarı — kenar çubuğunun tepesinde, uygulama adının hemen altında.
 *
 * Tek bir yerde duruyor ve iki kipte de aynı yerde: nereye basacağını
 * aramak gerekmiyor. Seçim **yükselen yüzeyle** anlatılıyor (`--surface-2`),
 * renkli çubukla değil; kayan parça iki kip arasındaki bağı gösteriyor.
 */
export default function ModeSwitch({
  mode,
  onMode,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
}) {
  return (
    <div className="modesw" data-mode={mode} role="group" aria-label="Kip">
      {/* Kayan parça düğmelerin ALTINDA; metin onun üstünde kalır. */}
      <span className="modesw__thumb" aria-hidden="true" />
      <button
        type="button"
        aria-pressed={mode === "agents"}
        title="Botlar (Ctrl+1)"
        onClick={() => onMode("agents")}
      >
        <IconBot size={16} color="currentColor" strokeWidth={1.7} />
        Botlar
      </button>
      <button
        type="button"
        aria-pressed={mode === "terminals"}
        title="Terminal (Ctrl+2)"
        onClick={() => onMode("terminals")}
      >
        <IconTerminal size={16} color="currentColor" strokeWidth={1.6} />
        Terminal
      </button>
    </div>
  );
}
