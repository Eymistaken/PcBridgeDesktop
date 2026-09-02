import { useEffect, useState } from "react";

import { sayac } from "../ui/ConnStrip";
import { IconLock, IconScreen } from "../ui/Icon";
import {
  auditTail,
  desktopLock,
  desktopUnlock,
  errorText,
  screenCapture,
  systemStatus,
} from "../lib/ipc";
import type { AuditRow, ConnError, DesktopState, Shots } from "../lib/types";

/** Artboard'daki dört seçenek. Sunucu 1–120'ye kırpıyor; hepsi aralıkta. */
const SURELER = [5, 15, 30, 60];

interface Props {
  state: DesktopState;
  onState: (s: DesktopState) => void;
}

/**
 * Masaüstü izni paneli.
 *
 * İzin **kapalı başlar** ve süre dolunca kendiliğinden kapanır — geri sayım
 * `desktop_unlock.json`'dan okunuyor, buradaki bir zamanlayıcıdan değil.
 * İki sayı gösteriliyor: kayan kira ve sert tavan. Tek sayı göstermek
 * yanıltıcı olurdu — pcbridge izni son eylemden sonra düşürüyor.
 */
export default function Desktop({ state, onState }: Props) {
  const [dakika, setDakika] = useState(15);
  const [gerekce, setGerekce] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [yanit, setYanit] = useState<string>();
  const [hata, setHata] = useState<string>();

  async function cevir() {
    setMesgul(true);
    setHata(undefined);
    try {
      const r = state.unlocked
        ? await desktopLock()
        : await desktopUnlock(dakika, gerekce.trim() || "PcBridge Desktop'tan açıldı");
      onState(r.state);
      // Sunucunun kendi cümlesi: kayan kirayı en doğru o anlatıyor.
      setYanit(r.message);
    } catch (e) {
      setHata(errorText(e as ConnError));
    } finally {
      setMesgul(false);
    }
  }

  return (
    <>
      <div className="card">
        <span className="h">Masaüstü izni</span>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <button
            type="button"
            className="tgl"
            data-on={state.unlocked ? "1" : undefined}
            role="switch"
            aria-checked={state.unlocked}
            aria-label="Masaüstü kontrolü"
            disabled={mesgul}
            onClick={() => void cevir()}
          >
            <span />
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>
              {state.unlocked ? "Masaüstü kontrolü açık" : "Masaüstü kontrolü kilitli"}
            </span>
            <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              Açıkken ajanlar sanal klavye ve fare kullanabilir. Süre dolunca kendiliğinden
              kapanır; ekran kilitliyken her şey reddedilir.
            </span>
          </div>
          {state.unlocked && (
            <span className="geri" title="Kayan kiranın kalanı">
              <IconLock size={15} color="var(--run)" open />
              {sayac(state.remaining)}
            </span>
          )}
        </div>

        {state.unlocked ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
            {state.hardRemaining > state.remaining && (
              <span className="muted">
                Kayan kira son eylemden sonra düşüyor · sert tavan {sayac(state.hardRemaining)}
              </span>
            )}
            {state.reason && <span className="muted">Gerekçe: {state.reason}</span>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="grp">
              <span className="lbl">Süre</span>
              <div className="seg" role="group" aria-label="İzin süresi">
                {SURELER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={dakika === d}
                    onClick={() => setDakika(d)}
                  >
                    {d} dk
                  </button>
                ))}
              </div>
            </div>
            <div className="grp">
              <span className="lbl">Gerekçe · denetim kaydına yazılır</span>
              <div className="fld">
                <input
                  value={gerekce}
                  placeholder="ne için açılıyor"
                  aria-label="İzin gerekçesi"
                  style={{ flexGrow: 1, fontSize: 13.5 }}
                  onChange={(e) => setGerekce(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {!state.unlocked && state.hardRemaining > 0 && (
          <span className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>
            Sert tavanda {sayac(state.hardRemaining)} kalmıştı ama kayan kira düştü —
            pcbridge ölmüş bir izni diriltmiyor, yeniden açman gerekiyor.
          </span>
        )}

        {!state.known && (
          <span className="muted" style={{ fontSize: 12 }}>
            Durum dosyası okunamadı — kilitli sayılıyor.
          </span>
        )}
        {yanit && (
          <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {yanit}
          </span>
        )}
        {hata && (
          <span style={{ fontSize: 12.5, color: "var(--fail)", lineHeight: 1.5 }}>{hata}</span>
        )}
      </div>

      <Ekran unlocked={state.unlocked} />
      <Durum />
      <Denetim />
    </>
  );
}

// ───────────────────────────── ekran ─────────────────────────────

function Ekran({ unlocked }: { unlocked: boolean }) {
  const [shots, setShots] = useState<Shots>();
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string>();

  // İzin kapanınca eski görüntü ekranda kalmasın — kapalı izin, görüntü yok.
  useEffect(() => {
    if (!unlocked) setShots(undefined);
  }, [unlocked]);

  async function al() {
    setMesgul(true);
    setHata(undefined);
    try {
      setShots(await screenCapture());
    } catch (e) {
      setHata(errorText(e as ConnError));
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="h" style={{ flexGrow: 1 }}>
          Ekran
        </span>
        <button type="button" className="btn-quiet" disabled={mesgul || !unlocked} onClick={() => void al()}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <IconScreen size={15} color="currentColor" />
            {mesgul ? "alınıyor…" : "Görüntü al"}
          </span>
        </button>
      </div>

      {!unlocked && (
        <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          Ekran görüntüsü de izne bağlı — en gizlilik-hassas çıktı bu. İzni açmadan alınamaz.
        </span>
      )}

      {shots && shots.shots.length > 0 && (
        <div className="shots">
          {shots.shots.map((s, i) => (
            <img key={i} src={s.src} alt={`Ekran ${i + 1}`} />
          ))}
        </div>
      )}
      {shots && shots.shots.length === 0 && shots.note && (
        <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          {shots.note}
        </span>
      )}
      {hata && <span style={{ fontSize: 12.5, color: "var(--fail)" }}>{hata}</span>}
    </div>
  );
}

// ─────────────────────────── makine durumu ───────────────────────────

function Durum() {
  const [metin, setMetin] = useState<string>();
  const [hata, setHata] = useState<string>();

  useEffect(() => {
    let iptal = false;
    void systemStatus()
      .then((t) => !iptal && setMetin(t))
      .catch((e) => !iptal && setHata(errorText(e as ConnError)));
    return () => {
      iptal = true;
    };
  }, []);

  return (
    <div className="card">
      <span className="h">Bilgisayar</span>
      {hata && <span style={{ fontSize: 12.5, color: "var(--fail)" }}>{hata}</span>}
      {metin === undefined && !hata && (
        <span className="muted" style={{ fontSize: 12.5 }}>
          okunuyor…
        </span>
      )}
      {metin !== undefined && <Ozet metin={metin} />}
    </div>
  );
}

/**
 * `system_status` markdown döndürüyor, yapısal veri değil. Tanınan üç biçim:
 * `**Başlık**`, `- anahtar: değer`, ``` bloğu. Tanınmayan satır olduğu gibi
 * basılır — biçim değişirse panel boşalmaz, sadece ham görünür.
 */
function Ozet({ metin }: { metin: string }) {
  const parcalar: React.ReactNode[] = [];
  const satirlar = metin.split("\n");
  let blok: string[] | null = null;

  satirlar.forEach((ham, i) => {
    const l = ham.trimEnd();
    if (l.trim().startsWith("```")) {
      if (blok) {
        parcalar.push(
          <pre key={`b${i}`} className="mono well durum__blok">
            {blok.join("\n")}
          </pre>,
        );
        blok = null;
      } else {
        blok = [];
      }
      return;
    }
    if (blok) {
      blok.push(ham);
      return;
    }
    if (!l.trim()) return;

    const baslik = l.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (baslik) {
      // İlk başlık kartın kendi başlığını ("Bilgisayar") tekrarlıyor; iki
      // kere yazılmaz. Sonrakiler bölüm ayırıcısı olarak durur.
      if (parcalar.length === 0) return;
      parcalar.push(
        <span key={i} className="h" style={{ marginTop: 6 }}>
          {baslik[1]}
        </span>,
      );
      return;
    }
    const kalinAlan = l.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (kalinAlan) {
      parcalar.push(<Satir key={i} k={kalinAlan[1]} v={kalinAlan[2]} />);
      return;
    }
    const madde = l.match(/^-\s+([^:]+):\s*(.*)$/);
    if (madde) {
      parcalar.push(<Satir key={i} k={madde[1]} v={madde[2]} />);
      return;
    }
    parcalar.push(
      <span key={i} style={{ fontSize: 13 }}>
        {l.replace(/^-\s+/, "")}
      </span>,
    );
  });

  if (blok) {
    parcalar.push(
      <pre key="son" className="mono well durum__blok">
        {(blok as string[]).join("\n")}
      </pre>,
    );
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{parcalar}</div>;
}

function Satir({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <span className="muted" style={{ fontSize: 12.5, width: 130, flex: "none" }}>
        {k}
      </span>
      {/* Sunucu bazen boş değer gönderiyor (ölçüldü: `bellek` bir kez boş
          geldi). Çıplak boş satır "arayüz bozuk" gibi duruyor; tire
          "sunucu söylemedi" diyor. */}
      <span className="mono" style={{ fontSize: 12.5, minWidth: 0, overflowWrap: "anywhere" }}>
        {v.trim() || "—"}
      </span>
    </div>
  );
}

// ─────────────────────────── denetim kaydı ───────────────────────────

function Denetim() {
  const [rows, setRows] = useState<AuditRow[]>();

  useEffect(() => {
    let iptal = false;
    const yukle = () =>
      void auditTail(40)
        .then((r) => !iptal && setRows(r))
        .catch(() => !iptal && setRows([]));
    yukle();
    // Kayıt dosyadan geliyor; 5 saniyede bir kuyruğu yeniden okumak yeterli.
    const t = setInterval(yukle, 5000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="card">
      <span className="h">Denetim kaydı — pcbridge</span>
      {rows === undefined && (
        <span className="muted" style={{ fontSize: 12.5 }}>
          okunuyor…
        </span>
      )}
      {rows?.length === 0 && (
        <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          Kayıt bulunamadı. pcbridge <span className="mono">audit.log</span>'u başka bir yere
          yazıyor olabilir.
        </span>
      )}
      {rows && rows.length > 0 && (
        <div className="audit">
          {[...rows].reverse().map((r, i) => (
            <div key={`${r.ts}-${i}`} className="audit__row">
              <span className="mono muted audit__ts">{r.ts.slice(11)}</span>
              <span
                className="mono audit__ev"
                style={{
                  color: r.denied ? "var(--text-muted)" : r.error ? "var(--fail)" : "var(--text)",
                }}
              >
                {r.event}
              </span>
              <span className="mono muted audit__d">{r.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
