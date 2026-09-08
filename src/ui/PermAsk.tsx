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
    <div className="permask oluk" data-cikis={cikiyor || undefined}>
      {/* Etiket durum rengiyle: bekleyen bir soru, olağan bir kıta değil. */}
      <span className="oluk__et" style={{ color: "var(--run)" }}>
        {t("chat.gAsking")}
      </span>
      <div className="permask__box oluk__ic">
        <div className="permask__ust">
          {/* Ham araç kimliği — denetim kaydıyla aynı ad. Çevrilmiş fiil
           * ipucunda: kullanıcı neyi onayladığını hem tam adıyla hem
           * kendi dilinde görebiliyor. */}
          <span className="mono permask__arac" title={tur ? undefined : toolVerb(istek.tool)}>
            {tur ? t("perm.ask.turns.title", { name: botName }) : istek.tool}
          </span>
          {istek.group && (
            <span className="mono muted" style={{ fontSize: 10.5 }}>
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
              {istek.detail && (
                <span className="mono muted" style={{ fontSize: 11.5 }}>
                  {istek.detail}
                </span>
              )}
              <span className="mono muted permask__args">{istek.args}</span>
            </>
          )}
        </div>

        <div className="permask__alt">
          <button type="button" className="btn-primary" onClick={() => onAnswer(true)}>
            {tur ? t("perm.ask.turns.allow") : t("perm.ask.allow")}
          </button>
          <span className="mono muted" style={{ fontSize: 10.5 }}>
            {t("perm.ask.waiting")}
          </span>
          <div style={{ flexGrow: 1 }} />
          <button
            type="button"
            className="btn-quiet btn-quiet--fail"
            onClick={() => onAnswer(false)}
          >
            {tur ? t("perm.ask.turns.deny") : t("perm.ask.deny")}
          </button>
        </div>
      </div>
    </div>
  );
}
