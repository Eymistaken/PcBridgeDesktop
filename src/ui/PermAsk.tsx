import { t, toolVerb } from "../lib/i18n";
import type { PendingPermission } from "../lib/types";

interface Props {
  istek: PendingPermission;
  botName: string;
  onAnswer: (allow: boolean) => void;
  /** Kapanış devinimi sürerken `true` — `useCikis` söküme kadar bunu verir. */
  cikiyor?: boolean;
}

/**
 * Bekleyen izin isteği — bestecinin hemen üstünde.
 *
 * **İki soruyu da bu kart soruyor:** bir araç çağrısının onayı ve tur tavanına
 * gelmiş bir koşumun devam edip etmeyeceği. İkisi de aynı kuyruktan
 * (`Runs.bekleyen`) ve aynı komuttan (`answer_permission`) geçiyor; ikinci bir
 * bekleme makinesi kurulmadı — bu depoda aynı işi yapan iki denetimden biri
 * bir kez ölü kaldı.
 *
 * **Argümanlar açıkça yazılır.** "Bu bot `shell_run` çağırmak istiyor" bir onay
 * sorusu değil; kullanıcı `rm -rf /tmp/x` yazdığını görmeli. Ne onaylandığını
 * göstermeyen bir onay kutusu onay değildir.
 *
 * Onay **birincil eylem** ama renkli değil: `--text` dolgu, `--bg` metin.
 * Renk yalnızca kimlikten ve durumdan gelir; bir onay düğmesi ikisi de değil.
 */
export default function PermAsk({ istek, botName, onAnswer, cikiyor }: Props) {
  const tur = istek.kind === "tur";
  return (
    <div className="permask" data-cikis={cikiyor || undefined}>
      <div className="permask__box">
        <div className="permask__ust">
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>
            {tur
              ? t("perm.ask.turns.title", { name: botName })
              : t("perm.ask.title", { name: botName })}
          </span>
          {istek.group && (
            <span className="muted" style={{ fontSize: 11.5 }}>
              {t(`perm.ask.group.${istek.group}`)}
            </span>
          )}
        </div>

        <div className="permask__kuyu">
          {tur ? (
            // Tavan sorusunda gösterilecek argüman yok; sorulan şey koşumun
            // kendisi. Sayı yine de yazılıyor: "devam et" derken neyi
            // uzattığını bilmek gerekiyor.
            <span style={{ fontSize: 13, lineHeight: 1.55 }}>
              {t("perm.ask.turns.body", { n: istek.detail })}
            </span>
          ) : (
            <>
              <span className="mono permask__arac">
                {toolVerb(istek.tool)}
                {istek.detail && <span className="muted"> · {istek.detail}</span>}
              </span>
              <span className="mono muted permask__args">{istek.args}</span>
            </>
          )}
        </div>

        <div className="permask__alt">
          <span className="muted" style={{ fontSize: 11.5 }}>
            {t("perm.ask.waiting")}
          </span>
          <div style={{ flexGrow: 1 }} />
          <button type="button" className="btn-quiet" onClick={() => onAnswer(false)}>
            {tur ? t("perm.ask.turns.deny") : t("perm.ask.deny")}
          </button>
          <button type="button" className="btn-primary" onClick={() => onAnswer(true)}>
            {tur ? t("perm.ask.turns.allow") : t("perm.ask.allow")}
          </button>
        </div>
      </div>
    </div>
  );
}
