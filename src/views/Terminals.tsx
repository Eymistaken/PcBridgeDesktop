import { useMemo } from "react";

import Term from "../ui/Term";
import { IconClose, IconLayout } from "../ui/Icon";
import { ptyClose } from "../lib/ipc";
import type { TerminalsView, TmuxSession } from "../lib/types";

interface Props {
  view: TerminalsView;
  /** Bölmelerde gösterilecek oturumlar, sırayla. */
  panes: string[];
  onPanes: (p: string[]) => void;
  onReload: () => void;
}

const SAYI_ADI = ["Bölme yok", "Tek bölme", "İki bölme", "Üç bölme", "Dört bölme"];

/** Artboard'daki dört yerleşim. Üçüncüsü: solda tam, sağda ikiye bölünmüş. */
function gridStil(n: number): React.CSSProperties {
  switch (n) {
    case 1:
      return { gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "minmax(0, 1fr)" };
    case 2:
      return {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "minmax(0, 1fr)",
      };
    case 3:
      return {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(2, minmax(0, 1fr))",
        gridTemplateAreas: '"a b" "a c"',
      };
    default:
      return {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(2, minmax(0, 1fr))",
      };
  }
}

export default function Terminals({ view, panes, onPanes, onReload }: Props) {
  const byName = useMemo(
    () => Object.fromEntries(view.sessions.map((s) => [s.name, s])),
    [view.sessions],
  );

  /**
   * Yerleşim ayrı bir durum **değil**: `panes` tek doğru kaynak. Ayrı tutulunca
   * kenar çubuğundan açılan oturumu hedef sayı hemen geri kırpıyordu.
   */
  function yerlesim(n: number) {
    if (n === panes.length) return;
    if (n < panes.length) {
      // Fazla bölmeleri kapat — oturumlar ölmez.
      panes.slice(n).forEach((s) => void ptyClose(s).catch(() => {}));
      onPanes(panes.slice(0, n));
      return;
    }
    const bosta = view.sessions.map((s) => s.name).filter((x) => !panes.includes(x));
    if (bosta.length === 0) return; // doldurulacak oturum yok
    onPanes([...panes, ...bosta.slice(0, n - panes.length)]);
  }

  async function kapat(name: string) {
    // Bölmeyi kapatmak oturumu ÖLDÜRMEZ.
    await ptyClose(name).catch(() => {});
    onPanes(panes.filter((p) => p !== name));
    onReload();
  }

  return (
    <>
      <div className="main__head">
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {SAYI_ADI[Math.min(panes.length, 4)]}
        </span>
        <div style={{ flexGrow: 1 }} />
        <div className="layout" role="group" aria-label="Yerleşim">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={panes.length === n}
              aria-label={`${n} bölme`}
              title={`${n} bölme`}
              onClick={() => yerlesim(n)}
            >
              <IconLayout n={n} on={panes.length === n} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid" style={gridStil(panes.length)}>
        {panes.length === 0 && (
          <div className="chat__bos">
            <span style={{ fontSize: 14, fontWeight: 500 }}>Açık bölme yok</span>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Soldaki listeden bir oturuma tıkla ya da artıya basıp yeni bir tane aç. Her bölme
              gerçek bir <span className="mono">tmux</span> oturumudur.
            </span>
          </div>
        )}
        {panes.map((name, i) => (
          <Pane
            key={name}
            session={byName[name]}
            name={name}
            area={panes.length === 3 ? ["a", "b", "c"][i] : undefined}
            onClose={() => void kapat(name)}
            onOpened={onReload}
          />
        ))}
      </div>
    </>
  );
}

function Pane({
  name,
  session,
  area,
  onClose,
  onOpened,
}: {
  name: string;
  session?: TmuxSession;
  area?: string;
  onClose: () => void;
  onOpened: () => void;
}) {
  const calisiyor = session?.command && session.command !== "bash";
  return (
    <div className="pane" style={area ? { gridArea: area } : undefined}>
      <div className="phead">
        <span
          className="dot"
          style={{ background: calisiyor ? "var(--run)" : "var(--ok)" }}
        />
        <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
          {name}
        </span>
        {session?.command && (
          <span className="mono muted" style={{ fontSize: 12 }}>
            {session.command}
          </span>
        )}
        <div style={{ flexGrow: 1 }} />
        {session?.attached && (
          <span className="muted" style={{ fontSize: 11.5 }}>
            PC'de de açık
          </span>
        )}
        <button
          type="button"
          className="ib"
          style={{ width: 26, height: 26 }}
          title="Bölmeyi kapat (oturum yaşamaya devam eder)"
          aria-label={`${name} bölmesini kapat`}
          onClick={onClose}
        >
          <IconClose />
        </button>
      </div>
      <Term session={name} onOpened={onOpened} />
    </div>
  );
}
