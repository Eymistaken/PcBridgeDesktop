import { useCallback, useMemo, useRef, useState } from "react";

import Term from "../ui/Term";
import Picker from "../ui/Picker";
import { IconClose, IconDuzen } from "../ui/Icon";
import { ptyClose } from "../lib/ipc";
import { t } from "../lib/i18n";
import {
  bol,
  bolmeSayisi,
  duzenKur,
  ekle,
  kapat,
  oranYaz,
  oturumlar,
  takas,
  type Dugum,
  type Duzen,
  type Yon,
} from "../lib/agac";
import type { TerminalsView, TmuxSession } from "../lib/types";

const DUZENLER: Duzen[] = ["izgara", "sutunlar", "satirlar", "ana"];

interface Props {
  view: TerminalsView;
  /** Bölme ağacı — `null` ise hiç bölme yok. */
  agac: Dugum | null;
  onAgac: (a: Dugum | null) => void;
  onReload: () => void;
}

/** Sürükleme durumu: hangi bölmeden tutuldu, şu an hangisinin üstünde. */
interface Surukleme {
  kaynak: string;
  hedef: string | null;
  x: number;
  y: number;
  ad: string;
}

export default function Terminals({ view, agac, onAgac, onReload }: Props) {
  const byName = useMemo(
    () => Object.fromEntries(view.sessions.map((s) => [s.name, s])),
    [view.sessions],
  );
  const [surukleme, setSurukleme] = useState<Surukleme | null>(null);
  const kok = useRef<HTMLDivElement>(null);

  const acik = oturumlar(agac);
  const bosta = view.sessions
    .map((s) => s.name)
    .filter((x) => !acik.includes(x));

  /** Bir bölmeyi ikiye böler; yeni bölmeye boştaki ilk oturum gelir. */
  const bolmeBol = useCallback(
    (bolmeId: string, yon: Yon, session: string) => {
      if (!agac) return;
      onAgac(bol(agac, bolmeId, yon, session));
      onReload();
    },
    [agac, onAgac, onReload],
  );

  const bolmeKapat = useCallback(
    async (bolmeId: string, session: string) => {
      if (!agac) return;
      // Bölmeyi kapatmak oturumu **ÖLDÜRMEZ**.
      await ptyClose(session).catch(() => {});
      onAgac(kapat(agac, bolmeId));
      onReload();
    },
    [agac, onAgac, onReload],
  );

  /**
   * Sürükle-takas. HTML5 DnD **kullanılmıyor**: proje sıfır bağımlılıkla
   * yazılmış ve `pointer` olayları WebKitGTK'da denetlenebilir — sürükleme
   * hayaleti, hedef vurgusu ve iptal hepsi bizim elimizde.
   */
  const tutmaBasla = useCallback(
    (e: React.PointerEvent, bolmeId: string, ad: string) => {
      if (e.button !== 0) return;
      const hedefEl = e.currentTarget as HTMLElement;
      hedefEl.setPointerCapture(e.pointerId);
      let basladi = false;
      const bas = { x: e.clientX, y: e.clientY };

      const hareket = (ev: PointerEvent) => {
        // Küçük titremeler sürükleme sayılmasın: başlık aynı zamanda
        // tıklanabilir bir şerit.
        if (!basladi && Math.hypot(ev.clientX - bas.x, ev.clientY - bas.y) < 5)
          return;
        basladi = true;
        const alt = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .find((el) => el.classList.contains("pane")) as
          HTMLElement | undefined;
        const uzerinde = alt?.dataset.bolme ?? null;
        setSurukleme({
          kaynak: bolmeId,
          hedef: uzerinde && uzerinde !== bolmeId ? uzerinde : null,
          x: ev.clientX,
          y: ev.clientY,
          ad,
        });
      };

      const birak = (ev: PointerEvent) => {
        hedefEl.releasePointerCapture(ev.pointerId);
        hedefEl.removeEventListener("pointermove", hareket);
        hedefEl.removeEventListener("pointerup", birak);
        hedefEl.removeEventListener("pointercancel", birak);
        setSurukleme((s) => {
          if (s?.hedef && agac) onAgac(takas(agac, s.kaynak, s.hedef));
          return null;
        });
      };

      hedefEl.addEventListener("pointermove", hareket);
      hedefEl.addEventListener("pointerup", birak);
      hedefEl.addEventListener("pointercancel", birak);
    },
    [agac, onAgac],
  );

  /** Ayraç sürüklemesi: oranı canlı yazıyor. */
  const ayracTut = useCallback(
    (e: React.PointerEvent, bolId: string, yon: Yon) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const ebeveyn = el.parentElement;
      if (!ebeveyn) return;
      el.setPointerCapture(e.pointerId);
      const kutu = ebeveyn.getBoundingClientRect();

      const hareket = (ev: PointerEvent) => {
        const oran =
          yon === "satir"
            ? (ev.clientX - kutu.left) / kutu.width
            : (ev.clientY - kutu.top) / kutu.height;
        if (agac) onAgac(oranYaz(agac, bolId, oran));
      };
      const birak = (ev: PointerEvent) => {
        el.releasePointerCapture(ev.pointerId);
        el.removeEventListener("pointermove", hareket);
        el.removeEventListener("pointerup", birak);
        el.removeEventListener("pointercancel", birak);
      };
      el.addEventListener("pointermove", hareket);
      el.addEventListener("pointerup", birak);
      el.addEventListener("pointercancel", birak);
    },
    [agac, onAgac],
  );

  const sayi = bolmeSayisi(agac);

  return (
    <>
      <div className="main__head">
        <span
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          {t("panes.nOpen", { n: sayi })}
        </span>
        <span className="mono muted" style={{ fontSize: 12 }}>
          {t("panes.hint")}
        </span>
        <div style={{ flexGrow: 1 }} />
        {bosta.length > 0 && (
          <Picker
            chip
            value=""
            options={bosta.map((n) => ({ value: n, label: n }))}
            placeholder={t("panes.add")}
            ariaLabel={t("panes.add")}
            onChange={(n) => {
              // Boştaki oturumu **en sığ** yaprağı bölerek ekliyoruz; yön
              // dönüşümlü, uzun ince şeritler oluşmuyor.
              onAgac(ekle(agac, n));
              onReload();
            }}
          />
        )}
        <div className="layout" role="group" aria-label={t("panes.layout")}>
          {DUZENLER.map((d) => (
            <button
              key={d}
              type="button"
              aria-label={t(`panes.${d}`)}
              title={t(`panes.${d}`)}
              disabled={sayi < 2}
              onClick={() => onAgac(duzenKur(acik, d))}
            >
              <IconDuzen duzen={d} />
            </button>
          ))}
        </div>
      </div>

      <div className="agac" ref={kok}>
        {agac === null ? (
          <div className="chat__bos">
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {t("panes.empty")}
            </span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              {t("panes.emptyHint")}
            </span>
          </div>
        ) : (
          <Dal
            dugum={agac}
            byName={byName}
            bosta={bosta}
            surukleme={surukleme}
            onBol={bolmeBol}
            onKapat={bolmeKapat}
            onTut={tutmaBasla}
            onAyrac={ayracTut}
            onOpened={onReload}
          />
        )}
      </div>

      {/* Sürükleme hayaleti — imleci izliyor, hedef bölme vurgulanıyor. */}
      {surukleme && (
        <div
          className="hayalet mono"
          style={{ left: surukleme.x + 14, top: surukleme.y + 14 }}
        >
          {surukleme.ad}
        </div>
      )}
    </>
  );
}

interface DalProps {
  dugum: Dugum;
  byName: Record<string, TmuxSession>;
  bosta: string[];
  surukleme: Surukleme | null;
  onBol: (bolmeId: string, yon: Yon, session: string) => void;
  onKapat: (bolmeId: string, session: string) => void;
  onTut: (e: React.PointerEvent, bolmeId: string, ad: string) => void;
  onAyrac: (e: React.PointerEvent, bolId: string, yon: Yon) => void;
  onOpened: () => void;
}

function Dal(p: DalProps) {
  const { dugum } = p;
  if (dugum.t === "bolme") {
    return <Bolme {...p} dugum={dugum} />;
  }
  return (
    <div className={`dal dal--${dugum.yon}`}>
      <div className="dal__yan" style={{ flexBasis: `${dugum.oran * 100}%` }}>
        <Dal {...p} dugum={dugum.a} />
      </div>
      <div
        className={`ayrac ayrac--${dugum.yon}`}
        role="separator"
        aria-orientation={dugum.yon === "satir" ? "vertical" : "horizontal"}
        onPointerDown={(e) => p.onAyrac(e, dugum.id, dugum.yon)}
      >
        <i />
      </div>
      <div
        className="dal__yan"
        style={{ flexBasis: `${(1 - dugum.oran) * 100}%` }}
      >
        <Dal {...p} dugum={dugum.b} />
      </div>
    </div>
  );
}

function Bolme({
  dugum,
  byName,
  bosta,
  surukleme,
  onBol,
  onKapat,
  onTut,
  onOpened,
}: DalProps & { dugum: Extract<Dugum, { t: "bolme" }> }) {
  const oturum = byName[dugum.session];
  const calisiyor = oturum?.command && oturum.command !== "bash";
  const hedef = surukleme?.hedef === dugum.id;
  const kaynak = surukleme?.kaynak === dugum.id;
  // Yeni bölmeye konacak oturum; boşta yoksa bölme düğmeleri kapalı.
  const eklenecek = bosta[0];

  return (
    <div
      className="pane"
      data-bolme={dugum.id}
      data-hedef={hedef || undefined}
      data-kaynak={kaynak || undefined}
    >
      <div
        className="phead"
        onPointerDown={(e) => onTut(e, dugum.id, dugum.session)}
        title={t("panes.dragHint")}
      >
        <span
          className="dot"
          style={{ background: calisiyor ? "var(--run)" : "var(--ok)" }}
        />
        <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
          {dugum.session}
        </span>
        {oturum?.command && (
          <span className="mono muted" style={{ fontSize: 12 }}>
            {oturum.command}
          </span>
        )}
        <div style={{ flexGrow: 1 }} />
        {oturum?.attached && (
          <span className="muted" style={{ fontSize: 11.5 }}>
            {t("term.alsoOnPc")}
          </span>
        )}
        <button
          type="button"
          className="pb"
          disabled={!eklenecek}
          title={t("panes.splitRight")}
          aria-label={t("panes.splitRight")}
          onClick={() => eklenecek && onBol(dugum.id, "satir", eklenecek)}
        >
          <IconSplit yon="satir" />
        </button>
        <button
          type="button"
          className="pb"
          disabled={!eklenecek}
          title={t("panes.splitDown")}
          aria-label={t("panes.splitDown")}
          onClick={() => eklenecek && onBol(dugum.id, "sutun", eklenecek)}
        >
          <IconSplit yon="sutun" />
        </button>
        <button
          type="button"
          className="pb"
          title={t("panes.close")}
          aria-label={t("panes.closeNamed", { name: dugum.session })}
          onClick={() => void onKapat(dugum.id, dugum.session)}
        >
          <IconClose />
        </button>
      </div>
      <Term session={dugum.session} onOpened={onOpened} />
    </div>
  );
}

/** Bölme ikonu: dikdörtgen + bölen çizgi. Yön çizginin yönünü söylüyor. */
function IconSplit({ yon }: { yon: Yon }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="4.5"
        width="13"
        height="11"
        rx="2"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
      />
      <path
        d={yon === "satir" ? "M10 4.5v11" : "M3.5 10h13"}
        stroke="var(--text-muted)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
