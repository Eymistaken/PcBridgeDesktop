import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Term from "../ui/Term";
import Picker from "../ui/Picker";
import SagMenu, { type MenuYer } from "../ui/SagMenu";
import { IconClose, IconZoom } from "../ui/Icon";
import { ptyClose } from "../lib/ipc";
import { useCikisIcerik } from "../lib/cikis";
import { t } from "../lib/i18n";
import {
  bol,
  bolmeSayisi,
  bicim,
  duzenKur,
  ekle,
  kapat,
  oranYaz,
  oturumlar,
  takas,
  yerlesim,
  type Dugum,
  type Duzen,
  type Kutu,
  type Yon,
} from "../lib/agac";
import { kisaltEv } from "../lib/yol";
import type { PtyInfo, TerminalsView, TmuxSession } from "../lib/types";

const DUZENLER: Duzen[] = ["izgara", "sutunlar", "satirlar", "ana"];

/**
 * Düzen geçişinin süresi + pay.
 *
 * `--dur-slow` 300 ms; 40 ms pay geçişin gerçekten bittiğini garanti ediyor.
 * `transitionend` yerine zamanlayıcı: dört özellik (left/top/width/height)
 * ayrı ayrı ateşliyor ve kutusu hiç değişmeyen bölmeler **hiç**
 * ateşlemiyor — yani olay tek bir "bitti" anı vermiyor.
 */
const GECIS_MS = 340;

/**
 * Kabuk sayılan programlar.
 *
 * Başlıktaki nokta bunlarda `--ok`, ötekilerde `--run` yanıyor: "bir şey
 * çalışıyor" bilgisi ancak kabuk boşta değilse anlamlı. Aynı liste klasör
 * değiştirme akışında da kullanılacak — `cd` yalnızca boşta bir kabuğa
 * gönderilebilir (ölçüldü: `#{pane_current_command}` `sleep 30` sürerken
 * `sleep` döndürüyor).
 */
export const KABUKLAR = ["bash", "zsh", "sh", "fish", "dash", "ksh"];

interface Props {
  view: TerminalsView;
  /** Bölme başlığının canlı durumu — dizin ve ön plandaki program. */
  infos: Record<string, PtyInfo>;
  /** Kullanıcının elle verdiği etiketler; varsa dinamik başlığın yerine geçer. */
  etiketler: Record<string, string>;
  onEtiket: (session: string, ad: string) => void;
  /** Oturumu **sonlandırır** — bölme kapatmaktan ayrı, geri dönüşü yok. */
  onKill: (session: string) => void;
  /** Bölme ağacı — `null` ise hiç bölme yok. */
  agac: Dugum | null;
  onAgac: Dispatch<SetStateAction<Dugum | null>>;
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

/** Sağ tık menüsünün hedefi. */
interface Menu {
  yer: MenuYer;
  bolmeId: string;
  session: string;
}

export default function Terminals({
  view,
  infos,
  etiketler,
  onEtiket,
  onKill,
  agac,
  onAgac,
  onReload,
}: Props) {
  const byName = useMemo(
    () => Object.fromEntries(view.sessions.map((s) => [s.name, s])),
    [view.sessions],
  );
  const [surukleme, setSurukleme] = useState<Surukleme | null>(null);
  /** Genişletilmiş bölmenin kimliği. Ağaç değişmiyor — yalnızca yerleşim. */
  const [zoom, setZoom] = useState<string | null>(null);
  const kok = useRef<HTMLDivElement>(null);

  /**
   * Düzen geçişi sürüyor mu — `Term`'in ölçümünü bastırmak için.
   *
   * ⚠️ Ayraç sürüklemesi bunu **açmıyor**: orada geçiş zaten kapalı
   * (`data-surukleniyor`) ve `Term`'in kendi 90 ms'lik gecikmesi doğru
   * davranış. Bayrak yalnızca devinimli değişimlerde açılıyor.
   */
  const [menu, setMenu] = useState<Menu | null>(null);
  // Menü kapanırken bir karede yok olmasın; hedef bilgisi devinim boyunca
  // korunuyor — `menu` `null` olur olmaz öğe adları kaybolurdu.
  const {
    icerik: menuIcerik,
    render: menuVar,
    cikiyor: menuCikiyor,
  } = useCikisIcerik(menu);
  /** Etiketi düzenlenen oturum — başlıkta bir alan açılıyor. */
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [gecis, setGecis] = useState(false);
  const gecisZaman = useRef<ReturnType<typeof setTimeout>>(undefined);

  const gecisBaslat = useCallback(() => {
    // Devinim kapalıysa geçiş de yok: ölçümü bastırmak yalnızca gecikme olurdu.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setGecis(true);
    clearTimeout(gecisZaman.current);
    gecisZaman.current = setTimeout(() => setGecis(false), GECIS_MS);
  }, []);

  useEffect(() => () => clearTimeout(gecisZaman.current), []);

  const acik = oturumlar(agac);
  const bosta = view.sessions
    .map((s) => s.name)
    .filter((x) => !acik.includes(x));

  /** Bir bölmeyi ikiye böler; yeni bölmeye boştaki ilk oturum gelir. */
  const bolmeBol = useCallback(
    (bolmeId: string, yon: Yon, session: string) => {
      if (!agac) return;
      // Genişletilmiş bölmeyi bölmek yeni bölmeyi zoom'un **arkasında**
      // bırakırdı; bölmek zoom'dan çıkmak demek.
      setZoom(null);
      gecisBaslat();
      onAgac(bol(agac, bolmeId, yon, session));
      onReload();
    },
    [agac, onAgac, onReload, gecisBaslat],
  );

  const bolmeKapat = useCallback(
    async (bolmeId: string, session: string) => {
      if (!agac) return;
      // Bölmeyi kapatmak oturumu **ÖLDÜRMEZ**.
      await ptyClose(session).catch(() => {});
      setZoom((z) => (z === bolmeId ? null : z));
      gecisBaslat();
      onAgac((current) => (current ? kapat(current, bolmeId) : null));
      onReload();
    },
    [agac, onAgac, onReload, gecisBaslat],
  );

  /**
   * Sürükle-takas. HTML5 DnD **kullanılmıyor**: proje sıfır bağımlılıkla
   * yazılmış ve `pointer` olayları WebKitGTK'da denetlenebilir — sürükleme
   * hayaleti, hedef vurgusu ve iptal hepsi bizim elimizde.
   */
  const tutmaBasla = useCallback(
    (e: React.PointerEvent, bolmeId: string, ad: string) => {
      if (e.button !== 0 || (e.target as Element).closest("button")) return;
      // Genişletilmişken tek bölme görünüyor; takas edilecek bir komşu yok.
      if (zoom) return;
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
          | HTMLElement
          | undefined;
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
          if (s?.hedef && agac) {
            gecisBaslat();
            onAgac(takas(agac, s.kaynak, s.hedef));
          }
          return null;
        });
      };

      hedefEl.addEventListener("pointermove", hareket);
      hedefEl.addEventListener("pointerup", birak);
      hedefEl.addEventListener("pointercancel", birak);
    },
    [agac, onAgac, zoom, gecisBaslat],
  );

  /**
   * Ayraç sürüklemesi: oranı canlı yazıyor.
   *
   * Kök öğeye `data-surukleniyor` konuyor ve CSS geçişi o sürece kapanıyor —
   * açık kalsaydı ayraç imleci `--dur-slow` kadar geriden takip ederdi.
   */
  const ayracTut = useCallback(
    (e: React.PointerEvent, bolId: string, yon: Yon) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const tuval = kok.current;
      if (!tuval) return;
      el.setPointerCapture(e.pointerId);
      // Ölçü artık **tuvalin** kendisi: ayraçlar iç içe kutuların değil,
      // hesaplanan dikdörtgenlerin çocuğu.
      const kutu = tuval.getBoundingClientRect();
      tuval.dataset.surukleniyor = "1";

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
        delete tuval.dataset.surukleniyor;
      };
      el.addEventListener("pointermove", hareket);
      el.addEventListener("pointerup", birak);
      el.addEventListener("pointercancel", birak);
    },
    [agac, onAgac],
  );

  const duzenSec = useCallback(
    (d: Duzen) => {
      setZoom(null);
      gecisBaslat();
      onAgac(duzenKur(acik, d));
    },
    [acik, onAgac, gecisBaslat],
  );

  const zoomCevir = useCallback(
    (bolmeId: string) => {
      gecisBaslat();
      setZoom((z) => (z === bolmeId ? null : bolmeId));
    },
    [gecisBaslat],
  );

  const sayi = bolmeSayisi(agac);
  const yer = useMemo(() => yerlesim(agac, zoom), [agac, zoom]);

  /**
   * Çizim sırası **oturum adına göre**, yerleşim sırasına göre değil.
   *
   * `key={session}` React'in öğeyi korumasını sağlıyor; DOM sırasını da
   * kararlı tutmak takasta düğümlerin yer değiştirmesini önlüyor. Bölmeler
   * absolute konumlandığı için görünen sıra zaten kutulardan geliyor.
   */
  const cizim = useMemo(
    () => [...yer.bolmeler].sort((a, b) => (a.session < b.session ? -1 : 1)),
    [yer],
  );

  // Şu anki ağaç hazır düzenlerden birine mi uyuyor? Karşılaştırma
  // `bicim` ile, düğüm kimlikleri dışarıda bırakılarak.
  const suAn = bicim(agac);
  const etkinDuzen = DUZENLER.find((d) => bicim(duzenKur(acik, d)) === suAn);
  const serbest = etkinDuzen === undefined;

  return (
    <>
      <div className="main__head">
        <span className="main__head__ad">{t("panes.nOpen", { n: sayi })}</span>
        <span className="main__head__kunye">{t("panes.hint")}</span>
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
              setZoom(null);
              gecisBaslat();
              onAgac(ekle(agac, n));
              onReload();
            }}
          />
        )}
        {/*
         * Düzen sırası — ikon değil kelime, tasarımdaki gibi.
         *
         * "SERBEST" bir düğme değil **durum**: ağaç hazır düzenlerin
         * hiçbirine uymuyorsa (kullanıcı bölmüş, takas etmiş ya da bir ayracı
         * sürüklemiş) o yanıyor. Basılacak bir şey yok, çünkü zaten oradasın.
         * Eskiden bu satırdaki `aria-pressed` CSS kuralı yazılmıştı ama hiçbir
         * düğme onu taşımıyordu — kural ölüydü, şimdi çalışıyor.
         */}
        <div className="layout" role="group" aria-label={t("panes.layout")}>
          <button type="button" aria-pressed={serbest} disabled>
            {t("panes.serbest")}
          </button>
          {DUZENLER.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={etkinDuzen === d}
              title={t(`panes.${d}`)}
              disabled={sayi < 2}
              onClick={() => duzenSec(d)}
            >
              {t(`panes.${d}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="agac">
        {agac === null ? (
          <div className="chat__bos agac__bos">
            <span className="h">{t("panes.empty")}</span>
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--text-3)",
                maxWidth: 420,
              }}
            >
              {t("panes.emptyHint")}
            </span>
          </div>
        ) : (
          <div className="tuval" ref={kok} data-zoom={zoom ? "1" : undefined}>
            {yer.ayraclar.map((a) => (
              <div
                key={a.id}
                className={`ayrac ayrac--${a.yon}`}
                role="separator"
                aria-orientation={a.yon === "satir" ? "vertical" : "horizontal"}
                style={
                  a.yon === "satir"
                    ? {
                        left: `${a.kutu.x}%`,
                        top: `${a.kutu.y}%`,
                        height: `${a.kutu.h}%`,
                      }
                    : {
                        left: `${a.kutu.x}%`,
                        top: `${a.kutu.y}%`,
                        width: `${a.kutu.w}%`,
                      }
                }
                onPointerDown={(e) => ayracTut(e, a.id, a.yon)}
              >
                <i />
              </div>
            ))}
            {cizim.map((b) => (
              <Bolme
                key={b.session}
                bolmeId={b.id}
                session={b.session}
                kutu={b.kutu}
                zoomlu={zoom === b.id}
                gecis={gecis}
                oturum={byName[b.session]}
                info={infos[b.session]}
                eklenecek={bosta[0]}
                hedef={surukleme?.hedef === b.id}
                kaynak={surukleme?.kaynak === b.id}
                onBol={bolmeBol}
                onKapat={bolmeKapat}
                onZoom={zoomCevir}
                onTut={tutmaBasla}
                onOpened={onReload}
                etiket={etiketler[b.session]}
                duzenleniyor={duzenlenen === b.session}
                onDuzenle={setDuzenlenen}
                onEtiket={onEtiket}
                onMenu={(yer) =>
                  setMenu({ yer, bolmeId: b.id, session: b.session })
                }
              />
            ))}
          </div>
        )}
      </div>

      {menuVar && menuIcerik && (
        <SagMenu
          yer={menuIcerik.yer}
          cikiyor={menuCikiyor}
          ariaLabel={t("menu.paneMenu")}
          onKapat={() => setMenu(null)}
          ogeler={[
            {
              ad: t("menu.rename"),
              onSec: () => setDuzenlenen(menuIcerik.session),
            },
            {
              // ⚠️ `panes.zoom` bir **ipucu** metni ("tuvali kaplar; ötekiler
              // ölçüsünü korur") ve menüde satırı taşırıyordu. Menünün kendi
              // kısa anahtarı var.
              ad: zoom === menuIcerik.bolmeId ? t("menu.zoomOut") : t("menu.zoom"),
              onSec: () => zoomCevir(menuIcerik.bolmeId),
            },
            {
              ad: t("panes.splitRight"),
              ayrac: true,
              kapali: !bosta[0],
              onSec: () =>
                bosta[0] && bolmeBol(menuIcerik.bolmeId, "satir", bosta[0]),
            },
            {
              ad: t("panes.splitDown"),
              kapali: !bosta[0],
              onSec: () =>
                bosta[0] && bolmeBol(menuIcerik.bolmeId, "sutun", bosta[0]),
            },
            {
              ad: t("menu.closePane"),
              ayrac: true,
              onSec: () =>
                void bolmeKapat(menuIcerik.bolmeId, menuIcerik.session),
            },
            { ad: t("term.kill"), onSec: () => onKill(menuIcerik.session) },
          ]}
        />
      )}

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

interface BolmeProps {
  bolmeId: string;
  session: string;
  kutu: Kutu;
  zoomlu: boolean;
  gecis: boolean;
  oturum?: TmuxSession;
  info?: PtyInfo;
  eklenecek?: string;
  hedef: boolean;
  kaynak: boolean;
  onBol: (bolmeId: string, yon: Yon, session: string) => void;
  onKapat: (bolmeId: string, session: string) => void;
  onZoom: (bolmeId: string) => void;
  onTut: (e: React.PointerEvent, bolmeId: string, ad: string) => void;
  onOpened: () => void;
  etiket?: string;
  duzenleniyor: boolean;
  onDuzenle: (session: string | null) => void;
  onEtiket: (session: string, ad: string) => void;
  onMenu: (yer: MenuYer) => void;
}

function Bolme({
  bolmeId,
  session,
  kutu,
  zoomlu,
  gecis,
  oturum,
  info,
  eklenecek,
  hedef,
  kaynak,
  onBol,
  onKapat,
  onZoom,
  onTut,
  onOpened,
  etiket,
  duzenleniyor,
  onDuzenle,
  onEtiket,
  onMenu,
}: BolmeProps) {
  /**
   * Ön planda ne çalışıyor. Kaynak **yerel** `pty_info`; `tmux_list`'ten
   * gelen `oturum.command` 10 saniye eski olabiliyor ve yedek olarak duruyor.
   */
  const komut = info?.command ?? oturum?.command ?? "";
  const calisiyor = komut !== "" && !KABUKLAR.includes(komut);

  /**
   * Başlıkta yazan şey **etiket**, tmux adı değil: `eymistaken@ZorinOS: ~yol`
   * — GNOME Terminal'in biçimi, kullanıcının istediği. Teknik ad (`term1`)
   * ipucunda ve erişilebilirlik etiketlerinde duruyor.
   */
  /** Etiket yokken görünen — ve etiket silinince geri dönülecek — başlık. */
  const dinamik = info
    ? `${info.user}@${info.host}: ${kisaltEv(info.path)}`
    : session;
  const gorunen = etiket ?? dinamik;

  return (
    <div
      className="yer"
      data-zoom={zoomlu || undefined}
      style={{
        left: `${kutu.x}%`,
        top: `${kutu.y}%`,
        width: `${kutu.w}%`,
        height: `${kutu.h}%`,
      }}
    >
      <div
        className="pane"
        data-bolme={bolmeId}
        data-hedef={hedef || undefined}
        data-kaynak={kaynak || undefined}
      >
        <div
          className="phead"
          onPointerDown={(e) => onTut(e, bolmeId, session)}
          onContextMenu={(e) => {
            // ⚠️ Yalnızca **başlıkta**. xterm'in içine konmuyor: orada sağ
            // tık xterm'in kendi seçim/yapıştırma davranışı.
            e.preventDefault();
            onMenu({ x: e.clientX, y: e.clientY });
          }}
          title={t("panes.dragHint")}
        >
          <span
            className="dot"
            style={{ background: calisiyor ? "var(--run)" : "var(--ok)" }}
          />
          {/* ⚠️ Kırpılan **etiket**, çalışan komut değil. İlk sürümde etiket
           * `flex: none` idi ve uzun bir dizin komutu "clau…" diye kesiyordu
           * (WebKitGTK görüntüsünde görüldü). Hangi CLI koştuğu kritik bilgi;
           * dizinin kuyruğu değil. Tam yol ipucunda. */}
          {duzenleniyor ? (
            <EtiketAlani
              deger={etiket ?? ""}
              session={session}
              ipucu={dinamik}
              onBitti={(v) => {
                onEtiket(session, v);
                onDuzenle(null);
              }}
              onIptal={() => onDuzenle(null)}
            />
          ) : (
            <span
              className="phead__ad"
              title={`${info?.path ?? ""}\n${t("panes.tmuxName", { name: session })}`.trim()}
              onDoubleClick={() => onDuzenle(session)}
            >
              {gorunen}
            </span>
          )}
          {/* Çalışan komut ve dizin — başlığın kalan yerini alıyor, kırpılıyor.
           * Kuyunun içindeyiz: renk `--well-muted`, `--text-muted` burada
           * aydınlık temada 2.63:1 verirdi. */}
          <span className="phead__alt">{komut}</span>
          {oturum?.attached && (
            <span className="phead__uzak">{t("term.alsoOnPc")}</span>
          )}
          <button
            type="button"
            className="pb"
            title={zoomlu ? t("panes.zoomOut") : t("panes.zoom")}
            aria-label={t("panes.zoomNamed", { name: session })}
            aria-pressed={zoomlu}
            onClick={() => onZoom(bolmeId)}
          >
            <IconZoom kucult={zoomlu} />
          </button>
          <button
            type="button"
            className="pb"
            disabled={!eklenecek}
            title={t("panes.splitRight")}
            aria-label={t("panes.splitRight")}
            onClick={() => eklenecek && onBol(bolmeId, "satir", eklenecek)}
          >
            <IconSplit yon="satir" />
          </button>
          <button
            type="button"
            className="pb"
            disabled={!eklenecek}
            title={t("panes.splitDown")}
            aria-label={t("panes.splitDown")}
            onClick={() => eklenecek && onBol(bolmeId, "sutun", eklenecek)}
          >
            <IconSplit yon="sutun" />
          </button>
          <button
            type="button"
            className="pb"
            title={t("panes.close")}
            aria-label={t("panes.closeNamed", { name: session })}
            onClick={() => void onKapat(bolmeId, session)}
          >
            <IconClose />
          </button>
        </div>
        {/* ⚠️ `onExit` bir yıl boyunca **bağlı değildi**: `pty://exit` olayı
         * `ptybus`'a kadar geliyor ve orada düşüyordu, yani tmux oturumu
         * ölünce bölme ekranda ölü olarak kalıyordu. Bölmeyi kapatmak olayı
         * yaymıyor (`pty.rs` `dur` bayrağı), o yüzden buraya yalnızca gerçek
         * ölüm düşüyor. */}
        <Term
          session={session}
          dondur={gecis}
          onOpened={onOpened}
          onExit={() => void onKapat(bolmeId, session)}
        />
      </div>
    </div>
  );
}

/**
 * Etiket düzenleme alanı.
 *
 * **Boş bırakmak etiketi siler** ve dinamik başlığı (`user@host: ~dizin`)
 * geri getirir — GNOME Terminal'in davranışı.
 *
 * ⚠️ `stopPropagation` şart: bu alan bölme başlığında duruyor ve uygulamanın
 * global kısayol dinleyicisi `window`'da. Onsuz `Ctrl+N` yazarken yeni bir
 * terminal açılırdı. (Dinleyici `INPUT`'u zaten süzüyor ama Escape'i
 * süzmüyor.)
 */
function EtiketAlani({
  deger,
  session,
  ipucu,
  onBitti,
  onIptal,
}: {
  deger: string;
  session: string;
  /** Alan boşken görünen — yani etiket silinirse başlıkta yazacak olan. */
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
      className="phead__alan mono"
      value={v}
      spellCheck={false}
      autoFocus
      placeholder={ipucu}
      aria-label={t("menu.renameLabel", { name: session })}
      onChange={(e) => setV(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onBitti(v);
        else if (e.key === "Escape") onIptal();
      }}
      onBlur={() => onBitti(v)}
    />
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
