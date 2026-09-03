import { t, toolVerb } from "../lib/i18n";
import type { PendingPermission } from "../lib/types";

interface Props {
  istek: PendingPermission;
  botName: string;
  onAnswer: (allow: boolean) => void;
}

/**
 * Bekleyen izin isteği — bestecinin hemen üstünde.
 *
 * **Argümanlar açıkça yazılır.** "Bu bot `shell_run` çağırmak istiyor" bir onay
 * sorusu değil; kullanıcı `rm -rf /tmp/x` yazdığını görmeli. Ne onaylandığını
 * göstermeyen bir onay kutusu onay değildir.
 *
 * "İzin ver" **birincil eylem** ama renkli değil: `--text` dolgu, `--bg` metin.
 * Renk yalnızca kimlikten ve durumdan gelir; bir onay düğmesi ikisi de değil.
 */
export default function PermAsk({ istek, botName, onAnswer }: Props) {
  return (
    <div className="permask">
      <div className="permask__box">
        <div className="permask__ust">
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>
            {t("perm.ask.title", { name: botName })}
          </span>
          <span className="muted" style={{ fontSize: 11.5 }}>
            {t(`perm.ask.group.${istek.group}`)}
          </span>
        </div>

        <div className="permask__kuyu">
          <span className="mono permask__arac">
            {toolVerb(istek.tool)}
            {istek.detail && <span className="muted"> · {istek.detail}</span>}
          </span>
          <span className="mono muted permask__args">{istek.args}</span>
        </div>

        <div className="permask__alt">
          <span className="muted" style={{ fontSize: 11.5 }}>
            {t("perm.ask.waiting")}
          </span>
          <div style={{ flexGrow: 1 }} />
          <button type="button" className="btn-quiet" onClick={() => onAnswer(false)}>
            {t("perm.ask.deny")}
          </button>
          <button type="button" className="btn-primary" onClick={() => onAnswer(true)}>
            {t("perm.ask.allow")}
          </button>
        </div>
      </div>
    </div>
  );
}
