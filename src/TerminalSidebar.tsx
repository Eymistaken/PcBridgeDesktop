import ConnStrip from "./ui/ConnStrip";
import { IconTrash } from "./ui/Icon";
import { t } from "./lib/i18n";
import { kisaltEv } from "./lib/yol";
import { KABUKLAR } from "./views/Terminals";
import type { DesktopState, PtyInfo, TerminalsView } from "./lib/types";

interface Props {
  view: TerminalsView;
  /** Satırların canlı durumu — dizin ve ön plandaki program. */
  infos: Record<string, PtyInfo>;
  panes: string[];
  desktop: DesktopState;
  onOpenSystem: () => void;
  /** Kilit rozeti — izni tek tıkla açar/kapatır. */
  onToggleDesktop: () => void;
  onOpen: (name: string) => void;
  onKill: (name: string) => void;
}

export default function TerminalSidebar({
  view,
  infos,
  panes,
  desktop,
  onOpenSystem,
  onToggleDesktop,
  onOpen,
  onKill,
}: Props) {
  const burada = view.sessions.filter((s) => panes.includes(s.name));
  const uzakta = view.sessions.filter((s) => !panes.includes(s.name));

  return (
    <>
      {/* ⚠️ Burada bir zamanlar "oturum-adi" yazan bir metin alanı vardı ve
       * kullanıcı her yeni terminal için tmux oturum adını **elle** yazmak
       * zorundaydı. Ad artık sorulmuyor (Rust üretiyor), o yüzden alan da
       * yok: başlıktaki artı doğrudan açıyor. */}
      <div className="side__list">
        {view.sessions.length === 0 && (
          <div className="side__empty">
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("term.noSessions")}</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {t("term.noSessionsHint")}
            </span>
          </div>
        )}

        {burada.length > 0 && (
          <span className="h">{t("term.openHere", { n: burada.length })}</span>
        )}

        {burada.map((s) => (
          <SessionRow
            key={s.name}
            s={s}
            info={infos[s.name]}
            secili
            onOpen={onOpen}
            onKill={onKill}
          />
        ))}

        {uzakta.length > 0 && burada.length > 0 && (
          <span className="h" style={{ paddingTop: 12 }}>{t("term.elsewhere")}</span>
        )}

        {uzakta.map((s) => (
          <SessionRow key={s.name} s={s} onOpen={onOpen} onKill={onKill} />
        ))}

        {view.raw && (
          <pre className="mono muted" style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>
            {view.raw}
          </pre>
        )}
      </div>

      <ConnStrip
        title={`tmux · ${t("term.sessionCount", { n: view.sessions.length })}`}
        sub={t("term.closeKeeps")}
        ok
        desktop={desktop}
        onClick={onOpenSystem}
        onToggleDesktop={onToggleDesktop}
      />
    </>
  );
}

function SessionRow({
  s,
  info,
  secili,
  onOpen,
  onKill,
}: {
  s: { name: string; command: string; workdir: string; attached: boolean };
  /** Yalnızca burada açık olan bölmelerde var — canlı dizin ve program. */
  info?: PtyInfo;
  secili?: boolean;
  onOpen: (n: string) => void;
  onKill: (n: string) => void;
}) {
  const komut = info?.command ?? s.command;
  /**
   * Satırda **etiket** yazıyor, tmux adı ipucunda.
   *
   * Burada açık olmayan oturumlarda `info` yok (yerel sorgu yalnızca açık
   * bölmeler için yapılıyor); orada `tmux_list`'ten gelen dizin kullanılıyor.
   */
  const etiket = info
    ? `${info.user}@${info.host}: ${kisaltEv(info.path)}`
    : s.workdir
      ? kisaltEv(s.workdir)
      : s.name;
  return (
    <div
      className="row"
      role="option"
      tabIndex={0}
      aria-selected={!!secili}
      onClick={() => onOpen(s.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(s.name);
        }
      }}
    >
      {/* Çip botunkiyle aynı 9px kare; burada rengi kimlikten değil
       * **durumdan** geliyor. Burada açık olmayan oturum içi boş. */}
      <span
        className="tile"
        data-uzak={secili ? undefined : "1"}
        style={
          secili
            ? {
                background:
                  komut && !KABUKLAR.includes(komut) ? "var(--run)" : "var(--ok)",
              }
            : undefined
        }
      />
      <span
        className="row__name row__name--mono"
        title={t("panes.tmuxName", { name: s.name })}
      >
        {etiket}
      </span>
      <span className="row__mark">
        {[komut, s.attached ? t("term.alsoOnPc") : null]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <div className="row__ops">
        <button
          type="button"
          className="ib"
          style={{ width: 22, height: 22 }}
          title={t("term.kill")}
          aria-label={t("term.killNamed", { name: s.name })}
          onClick={(e) => {
            e.stopPropagation();
            onKill(s.name);
          }}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}
