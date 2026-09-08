import { useEffect, useRef, useState } from "react";

import ConnStrip from "./ui/ConnStrip";
import Hayalet from "./ui/Hayalet";
import SagMenu, { type MenuYer } from "./ui/SagMenu";
import { IconTrash } from "./ui/Icon";
import { useCikisIcerik } from "./lib/cikis";
import { bolmeyeSurukle } from "./lib/surukle";
import { t } from "./lib/i18n";
import { kisaltEv } from "./lib/yol";
import { KABUKLAR } from "./lib/kabuk";
import type { DesktopState, PtyInfo, TerminalsView } from "./lib/types";

interface Props {
  view: TerminalsView;
  /** Satırların canlı durumu — dizin ve ön plandaki program. */
  infos: Record<string, PtyInfo>;
  /** Elle verilen etiketler; varsa dinamik başlığın yerine geçer. */
  etiketler: Record<string, string>;
  onEtiket: (session: string, ad: string) => void;
  /**
   * Bir oturumu açık bir bölmenin **üstüne** bırakmak: o oturum bölmeye
   * gelir, bölmedeki arka plana düşer.
   */
  onYerlestir: (session: string, bolmeId: string) => void;
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
  etiketler,
  onEtiket,
  onYerlestir,
  panes,
  desktop,
  onOpenSystem,
  onToggleDesktop,
  onOpen,
  onKill,
}: Props) {
  const [menu, setMenu] = useState<{ yer: MenuYer; ad: string } | null>(null);
  const {
    icerik: menuIcerik,
    render: menuVar,
    cikiyor: menuCikiyor,
  } = useCikisIcerik(menu);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [surukleme, setSurukleme] = useState<{
    ad: string;
    x: number;
    y: number;
  } | null>(null);

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
            etiket={etiketler[s.name]}
            duzenleniyor={duzenlenen === s.name}
            secili
            onOpen={onOpen}
            onKill={onKill}
            onDuzenle={setDuzenlenen}
            onEtiket={onEtiket}
            onMenu={(yer) => setMenu({ yer, ad: s.name })}
            onSurukle={setSurukleme}
            onYerlestir={onYerlestir}
          />
        ))}

        {uzakta.length > 0 && burada.length > 0 && (
          <span className="h" style={{ paddingTop: 12 }}>{t("term.elsewhere")}</span>
        )}

        {uzakta.map((s) => (
          <SessionRow
            key={s.name}
            s={s}
            etiket={etiketler[s.name]}
            duzenleniyor={duzenlenen === s.name}
            onOpen={onOpen}
            onKill={onKill}
            onDuzenle={setDuzenlenen}
            onEtiket={onEtiket}
            onMenu={(yer) => setMenu({ yer, ad: s.name })}
            onSurukle={setSurukleme}
            onYerlestir={onYerlestir}
          />
        ))}

        {view.raw && (
          <pre className="mono muted" style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>
            {view.raw}
          </pre>
        )}
      </div>

      {surukleme && (
        <Hayalet ad={surukleme.ad} x={surukleme.x} y={surukleme.y} />
      )}

      {menuVar && menuIcerik && (
        <SagMenu
          yer={menuIcerik.yer}
          cikiyor={menuCikiyor}
          ariaLabel={t("menu.sessionMenu")}
          onKapat={() => setMenu(null)}
          ogeler={[
            {
              ad: t("menu.rename"),
              onSec: () => setDuzenlenen(menuIcerik.ad),
            },
            {
              ad: t("menu.openPane"),
              kapali: panes.includes(menuIcerik.ad),
              onSec: () => onOpen(menuIcerik.ad),
            },
            {
              ad: t("term.kill"),
              ayrac: true,
              onSec: () => onKill(menuIcerik.ad),
            },
          ]}
        />
      )}

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
  etiket,
  duzenleniyor,
  secili,
  onOpen,
  onKill,
  onDuzenle,
  onEtiket,
  onMenu,
  onSurukle,
  onYerlestir,
}: {
  s: { name: string; command: string; workdir: string; attached: boolean };
  /** Yalnızca burada açık olan bölmelerde var — canlı dizin ve program. */
  info?: PtyInfo;
  etiket?: string;
  duzenleniyor: boolean;
  secili?: boolean;
  onOpen: (n: string) => void;
  onKill: (n: string) => void;
  onDuzenle: (n: string | null) => void;
  onEtiket: (session: string, ad: string) => void;
  onMenu: (yer: MenuYer) => void;
  onSurukle: (d: { ad: string; x: number; y: number } | null) => void;
  onYerlestir: (session: string, bolmeId: string) => void;
}) {
  const komut = info?.command ?? s.command;
  /**
   * Satırda **etiket** yazıyor, tmux adı ipucunda.
   *
   * Burada açık olmayan oturumlarda `info` yok (yerel sorgu yalnızca açık
   * bölmeler için yapılıyor); orada `tmux_list`'ten gelen dizin kullanılıyor.
   */
  /**
   * Etiket yokken görünen — ve etiket silinince geri dönülecek — başlık.
   *
   * ⚠️ **Burada açık olmayan oturumda `user@host: dizin` yazılmıyor.**
   * Ölçüldü: o satırların `info`'su yok (yerel sorgu yalnızca açık bölmeler
   * için yapılıyor) ve yalnızca `tmux_list`'ten gelen dizin kalıyordu — iki
   * oturum aynı dizindeyse ikisi de `~` yazıyor ve ayırt edilemiyordu. Orada
   * en ayırt edici bilgi **oturum adının kendisi**: onlar çoğu zaman
   * kullanıcının kendi tmux oturumları ve adları kendi verdiği adlar.
   */
  const dinamik = info
    ? `${info.user}@${info.host}: ${kisaltEv(info.path)}`
    : s.name;
  const gorunen = etiket ?? dinamik;
  return (
    <div
      className="row"
      role="option"
      tabIndex={0}
      aria-selected={!!secili}
      onPointerDown={(e) =>
        bolmeyeSurukle(e, {
          onDegis: (d) => onSurukle({ ad: s.name, x: d.x, y: d.y }),
          onBirak: (hedef, suruklendi) => {
            onSurukle(null);
            if (hedef) onYerlestir(s.name, hedef);
            // Sürüklenmediyse bu bir tıklama: oturumu bölmede aç.
            else if (!suruklendi) onOpen(s.name);
          },
        })
      }
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ x: e.clientX, y: e.clientY });
      }}
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
      {duzenleniyor ? (
        <SatirAlani
          deger={etiket ?? ""}
          session={s.name}
          ipucu={dinamik}
          onBitti={(v) => {
            onEtiket(s.name, v);
            onDuzenle(null);
          }}
          onIptal={() => onDuzenle(null)}
        />
      ) : (
        <span
          className="row__name row__name--mono"
          title={`${info?.path ?? s.workdir ?? ""}\n${t("panes.tmuxName", { name: s.name })}`.trim()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDuzenle(s.name);
          }}
        >
          {/*
           * ⚠️ Bölme başlığındaki aynı düzeltme. 252px'lik sütunda
           * `eymistaken@ZorinOS: ~/…` sığmıyor ve `text-overflow` sonu
           * kırptığı için dört açık satır da `eymistaken@ZorinOS…` diye
           * görünüyordu — birbirinden ayırt edilemez (WebKitGTK görüntüsünde
           * görüldü). Önek `flex-shrink` ile önce eriyor.
           */}
          {etiket || !info ? (
            gorunen
          ) : (
            <>
              <span className="row__kim">
                {info.user}@{info.host}:
              </span>
              <span className="row__yol">{kisaltEv(info.path)}</span>
            </>
          )}
        </span>
      )}
      <span className="row__mark">
        {[
          komut,
          // Dizin yalnızca burada açık OLMAYAN satırlarda: açık olanlarda
          // etiketin kendisi zaten yolu yazıyor.
          !info && s.workdir ? kisaltEv(s.workdir) : null,
          s.attached ? t("term.alsoOnPc") : null,
        ]
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

/**
 * Kenar çubuğu satırındaki etiket alanı.
 *
 * `Terminals.tsx`'teki `EtiketAlani`'nın kardeşi; iki yerde iki alan var çünkü
 * kapları farklı (biri kuyunun içinde, biri kabukta) ve tek bir bileşene
 * indirmek iki sınıf adını da prop'a çevirmek olurdu. Davranış aynı: Enter
 * kaydeder, Escape iptal, boş bırakmak etiketi siler.
 *
 * ⚠️ `stopPropagation`: satırın kendisi tıklanınca oturumu bölmede açıyor ve
 * global kısayol dinleyicisi `window`'da.
 */
function SatirAlani({
  deger,
  session,
  ipucu,
  onBitti,
  onIptal,
}: {
  deger: string;
  session: string;
  /** Alan boşken görünen — yani etiket silinirse satırda yazacak olan. */
  ipucu: string;
  onBitti: (v: string) => void;
  onIptal: () => void;
}) {
  const [v, setV] = useState(deger);
  const alan = useRef<HTMLInputElement>(null);

  useEffect(() => {
    alan.current?.select();
  }, []);

  return (
    <input
      ref={alan}
      className="row__alan mono"
      value={v}
      spellCheck={false}
      autoFocus
      placeholder={ipucu}
      aria-label={t("menu.renameLabel", { name: session })}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onBitti(v);
        else if (e.key === "Escape") onIptal();
      }}
      onBlur={() => onBitti(v)}
    />
  );
}
