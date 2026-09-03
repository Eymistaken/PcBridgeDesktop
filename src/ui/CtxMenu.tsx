import { useEffect, useRef, useState } from "react";

import { t } from "../lib/i18n";
import type { Dokum, RunCtx } from "../lib/types";

interface Props {
  model: string | null;
  /** Botun bağlam bütçesi (token). */
  budget: number;
  /** Son ölçüm. `null` → koşum yok ya da bu bot `pcbridge-agent` yolunda. */
  ctx: RunCtx | null;
  /** Koşum sürerken elle özetleme kapalı: mesaj listesi diskle aynı değil. */
  busy: boolean;
  /** Özetleme şu an çalışıyor mu. */
  compacting: boolean;
  onCompact: () => void;
}

/** %90'da öneri, %100'de otomatik — eşikler tek yerde. */
export const UYARI = 0.9;

/**
 * Bestecinin altındaki **model · bağlam** düğmesi.
 *
 * Model adı ve doluluk tek bir düğmede: ikisi de "bu koşum neye benziyor"
 * sorusunun parçası ve ayrı iki denetim gereksiz yer kaplardı.
 *
 * **Çubuk renksiz.** Dolu kısım `--text`, boş kısım `--surface-2`; renk
 * yalnızca eşikte geliyor (%90 `--run`, %100 `--fail`). Bu bir aksan değil
 * **durum**: bağlam taşmak üzere.
 *
 * Doluluk yalnızca yerel modelde var. `pcbridge-agent` koşumlarının `ctx`'i
 * yok — `usage` bize hiç gelmiyor — ve uydurma bir sayı göstermektense çubuk
 * hiç çizilmiyor.
 */
export default function CtxMenu({
  model,
  budget,
  ctx,
  busy,
  compacting,
  onCompact,
}: Props) {
  const [acik, setAcik] = useState(false);
  const kok = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acik) return;
    function tikla(e: MouseEvent) {
      if (!kok.current?.contains(e.target as Node)) setAcik(false);
    }
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") setAcik(false);
    }
    document.addEventListener("mousedown", tikla);
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("mousedown", tikla);
      document.removeEventListener("keydown", tus);
    };
  }, [acik]);

  const oran = ctx && budget > 0 ? ctx.promptTokens / budget : null;
  const durum = oran === null ? null : oran >= 1 ? "fail" : oran >= UYARI ? "run" : null;

  return (
    <div className="permmenu" ref={kok}>
      {acik && (
        <div className="permmenu__pop ctxmenu__pop" role="menu" aria-label={t("ctx.menu")}>
          {ctx && budget > 0 ? (
            <>
              <div className="ctxmenu__ust">
                <span className="ctxmenu__toplam mono">
                  {sayi(ctx.promptTokens)} / {sayi(budget)}
                </span>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {t("ctx.measured")}
                </span>
              </div>
              <Kirilim d={ctx.breakdown} />
            </>
          ) : (
            <div className="ctxmenu__bos">{t("ctx.none")}</div>
          )}

          <button
            type="button"
            className="permmenu__filtre ctxmenu__compact"
            disabled={busy || compacting || !ctx}
            onClick={() => {
              setAcik(false);
              onCompact();
            }}
          >
            <span className="permmenu__metin">
              <span className="permmenu__ad">{t("ctx.compact")}</span>
              <span className="permmenu__ipucu">
                {busy ? t("ctx.compactBusy") : t("ctx.compactHint")}
              </span>
            </span>
          </button>
        </div>
      )}

      <button
        type="button"
        className="permmenu__dugme ctxmenu__dugme"
        aria-haspopup="menu"
        aria-expanded={acik}
        aria-label={t("ctx.menu")}
        onClick={() => setAcik((a) => !a)}
      >
        {model && <span className="mono ctxmenu__model">{model}</span>}
        {oran !== null && (
          <>
            <span className="ctxbar" data-durum={durum ?? undefined}>
              <span className="ctxbar__dolu" style={{ width: `${Math.min(100, oran * 100)}%` }} />
            </span>
            <span className="mono ctxmenu__yuzde">%{Math.round(oran * 100)}</span>
          </>
        )}
        <IconChevron acik={acik} />
      </button>
    </div>
  );
}

/**
 * Dökümün satırları. **Karakterden türeyen her sayı `≈` taşıyor**: toplam
 * ölçülmüş bir token sayısı, bu satırlar değil.
 */
function Kirilim({ d }: { d: Dokum }) {
  // `ek` boş dizge olabilir ama sütun **her zaman çiziliyor**: yoksa o
  // satırın çubuğu 30 px sola kayıyor ve tablo eğri duruyor (ölçüldü).
  const satirlar: { ad: string; kar: number; ek: string }[] = [
    { ad: t("ctx.system"), kar: d.systemChars, ek: "" },
    { ad: t("ctx.tools"), kar: d.toolChars, ek: String(d.tools) },
    { ad: t("ctx.history"), kar: d.historyChars, ek: String(d.messages) },
  ];
  const toplam = satirlar.reduce((n, s) => n + s.kar, 0);

  // Bu alan Aşama 8'de geldi; ondan önceki koşumların `ctx.json`'ında yok ve
  // `serde` sıfıra düşürüyor. Sıfır uzunluklu çubuklar ve "≈0" göstermek
  // ölçülmemiş bir şeyi ölçülmüş gibi gösterirdi.
  if (toplam === 0) {
    return <div className="ctxmenu__bos">{t("ctx.noBreakdown")}</div>;
  }

  return (
    <div className="ctxmenu__kirilim">
      {satirlar.map((s) => (
        <div key={s.ad} className="ctxmenu__satir">
          <span className="ctxmenu__ad">{s.ad}</span>
          <span className="mono muted ctxmenu__adet">{s.ek}</span>
          <span className="ctxmenu__pay">
            <span className="ctxmenu__payDolu" style={{ width: `${(s.kar / toplam) * 100}%` }} />
          </span>
          <span className="mono muted ctxmenu__yaklasik">≈{sayi(Math.round(s.kar / 4))}</span>
        </div>
      ))}
      {d.images > 0 && (
        <div className="ctxmenu__satir">
          <span className="ctxmenu__ad">{t("ctx.images")}</span>
          <span className="mono muted ctxmenu__adet">{d.images}</span>
          <span className="ctxmenu__pay" />
          {/* Görüntü karakter değil: payı çizilmiyor, yalnızca sayılıyor. */}
          <span className="mono muted ctxmenu__yaklasik">—</span>
        </div>
      )}
    </div>
  );
}

/** `14694` → `14,7k` */
function sayi(n: number): string {
  if (n < 1000) return String(n);
  const bin = n / 1000;
  return `${bin < 10 ? bin.toFixed(1).replace(".", ",") : Math.round(bin)}k`;
}

function IconChevron({ acik }: { acik: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ transform: acik ? "rotate(180deg)" : undefined }}
    >
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
