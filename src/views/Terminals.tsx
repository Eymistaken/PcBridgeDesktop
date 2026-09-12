import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { open } from "@tauri-apps/plugin-dialog";

import Term from "../ui/Term";
import InlineAd from "../ui/InlineAd";
import Picker from "../ui/Picker";
import SagMenu, { type MenuYer } from "../ui/SagMenu";
import {
  IconClose,
  IconFolder,
  IconLayCols,
  IconLayFree,
  IconLayGrid,
  IconLayMain,
  IconLayRows,
  IconZoom,
} from "../ui/Icon";
import {
  detailText,
  ptyClose,
  ptyInfo,
  ptyWrite,
  tmuxNewWindow,
  tmuxNextWindow,
} from "../lib/ipc";
import { useCikisIcerik } from "../lib/cikis";
import { KABUKLAR, cdDizisi } from "../lib/kabuk";
import { bolmeyeSurukle } from "../lib/surukle";
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
import type { Alan } from "../lib/alanlar";
import { kisaltEv } from "../lib/yol";
import type { PtyInfo, TerminalsView, TmuxSession } from "../lib/types";

const DUZENLER: Duzen[] = ["izgara", "sutunlar", "satirlar", "ana"];

/** Her düzenin ikonu. Adı `aria-label` ve `title` taşıyor. */
const DUZEN_IKONU: Record<Duzen, () => React.ReactElement> = {
  izgara: IconLayGrid,
  sutunlar: IconLayCols,
  satirlar: IconLayRows,
  ana: IconLayMain,
};

/**
 * Düzen geçişinin süresi + pay.
 *
 * `--dur-slow` 300 ms; 40 ms pay geçişin gerçekten bittiğini garanti ediyor.
 * `transitionend` yerine zamanlayıcı: dört özellik (left/top/width/height)
 * ayrı ayrı ateşliyor ve kutusu hiç değişmeyen bölmeler **hiç**
 * ateşlemiyor — yani olay tek bir "bitti" anı vermiyor.
 */
const GECIS_MS = 340;


interface Props {
  view: TerminalsView;
  /** Bölme başlığının canlı durumu — dizin ve ön plandaki program. */
  infos: Record<string, PtyInfo>;
  /** Kullanıcının elle verdiği etiketler; varsa dinamik başlığın yerine geçer. */
  etiketler: Record<string, string>;
  onEtiket: (session: string, ad: string) => void;
  /** Oturumu **sonlandırır** — bölme kapatmaktan ayrı, geri dönüşü yok. */
  onKill: (session: string) => void;
  /** Bir oturumun canlı durumunu yeniden okur — `cd`'den hemen sonra. */
  onInfoTazele: (adlar: string[]) => void;
  onHata: (mesaj: string) => void;
  /** Bölme ağacı — `null` ise hiç bölme yok. */
  agac: Dugum | null;
  onAgac: Dispatch<SetStateAction<Dugum | null>>;
  /**
   * Etkin alanın varsayılan klasörü — burada doğan terminaller oradan
   * başlıyor. Seçilmemişse bölme eskisi gibi `~`'da doğuyor.
   */
  dizin?: string;
  /**
   * Çalışma alanları — yalnızca *"alana taşı"* menüsü için.
   *
   * ⚠️ Bu bileşen bir **ağaç** çiziyor ve hangi alanda olduğunu bilmiyor;
   * alan katmanı `Shell`'de duruyor ve sekme değişince buraya yalnızca başka
   * bir `agac` geliyor.
   */
  alanlar: Alan[];
  etkinAlan: string;
  onAlanaTasi: (session: string, hedef: string) => void;
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

/** CLI çalışırken klasör değiştirme onayı. */
interface Onay {
  session: string;
  yol: string;
  komut: string;
}

export default function Terminals({
  view,
  infos,
  etiketler,
  onEtiket,
  onKill,
  onInfoTazele,
  onHata,
  agac,
  onAgac,
  dizin,
  alanlar,
  etkinAlan,
  onAlanaTasi,
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
  const [onay, setOnay] = useState<Onay | null>(null);
  const {
    icerik: onayIcerik,
    render: onayVar,
    cikiyor: onayCikiyor,
  } = useCikisIcerik(onay);
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
   * Başlıktan tutup başka bir bölmeyle **takas**.
   *
   * Sürükleme mekaniği `lib/surukle.ts`'te; kenar çubuğu satırları da aynı
   * yardımcıyı kullanıyor ve iki kopya er geç ayrışırdı.
   */
  const tutmaBasla = useCallback(
    (e: React.PointerEvent, bolmeId: string, ad: string) => {
      // Genişletilmişken tek bölme görünüyor; takas edilecek bir komşu yok.
      if (zoom) return;
      bolmeyeSurukle(e, {
        kaynakBolme: bolmeId,
        onDegis: (d) => setSurukleme({ ...d, kaynak: bolmeId, ad }),
        onBirak: (hedef) => {
          setSurukleme(null);
          if (hedef && agac) {
            gecisBaslat();
            onAgac(takas(agac, bolmeId, hedef));
          }
        },
      });
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

  /**
   * Klasör değiştirme.
   *
   * ⚠️ **`.catch(() => null)` YOK.** CLAUDE.md'de bir yıl süren bir hata
   * kayıtlı: iptali `null` ile bildiren bir API'de `catch` yalnızca gerçek
   * hatayı gizler ve tuş ölü görünür. İptal `typeof !== "string"` ile, hata
   * `try/catch` ile ayrı ayrı ele alınıyor.
   *
   * Karar **o anki** duruma göre: `pty_info` yeniden okunuyor, çünkü
   * kullanıcı klasör kutusunda dolaşırken bölmede bir CLI başlamış olabilir.
   */
  const klasorSec = useCallback(
    async (session: string) => {
      try {
        const secilen = await open({
          directory: true,
          multiple: false,
          defaultPath: infos[session]?.path || undefined,
          title: t("panes.chooseDir"),
        });
        if (typeof secilen !== "string") return; // kullanıcı iptal etti
        const bilgi = await ptyInfo(session);
        if (KABUKLAR.includes(bilgi.command)) {
          await ptyWrite(session, cdDizisi(secilen));
          // 4 saniyelik yoklamayı beklemeden başlık güncellensin.
          onInfoTazele([session]);
        } else {
          setOnay({ session, yol: secilen, komut: bilgi.command });
        }
      } catch (e) {
        onHata(detailText(e));
      }
    },
    [infos, onInfoTazele, onHata],
  );

  /** Onaydaki "yeni pencerede aç". */
  const yeniPencere = useCallback(
    async (o: Onay) => {
      setOnay(null);
      try {
        await tmuxNewWindow(o.session, o.yol);
        onInfoTazele([o.session]);
      } catch (e) {
        onHata(detailText(e));
      }
    },
    [onInfoTazele, onHata],
  );

  /** Onaydaki "yine de gönder" — metin CLI'nin girdi alanına gider. */
  const yineDeGonder = useCallback(
    async (o: Onay) => {
      setOnay(null);
      try {
        await ptyWrite(o.session, cdDizisi(o.yol));
        onInfoTazele([o.session]);
      } catch (e) {
        onHata(detailText(e));
      }
    },
    [onInfoTazele, onHata],
  );

  /** Başlıktaki pencere sayacının eylemi. */
  const sonrakiPencere = useCallback(
    async (session: string) => {
      try {
        await tmuxNextWindow(session);
        onInfoTazele([session]);
      } catch (e) {
        onHata(detailText(e));
      }
    },
    [onInfoTazele, onHata],
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
         * Düzen sırası — **ikonlar.**
         *
         * ⚠️ Kanun bugüne kadar "ikon değil kelime, tasarımdaki gibi" diyordu;
         * kullanıcı 2026-09-08'de tersini istedi ve bu bilinçli bir sapma.
         * **Kelimeler silinmedi:** `aria-label` ve `title` onları taşıyor.
         *
         * "SERBEST" bir düğme değil **durum**: ağaç hazır düzenlerin
         * hiçbirine uymuyorsa (kullanıcı bölmüş, takas etmiş ya da bir ayracı
         * sürüklemiş) o yanıyor. Basılacak bir şey yok, çünkü zaten oradasın.
         */}
        <div className="layout" role="group" aria-label={t("panes.layout")}>
          <button
            type="button"
            aria-pressed={serbest}
            title={t("panes.serbest")}
            aria-label={t("panes.serbest")}
            disabled
          >
            <IconLayFree />
          </button>
          {DUZENLER.map((d) => {
            const Ikon = DUZEN_IKONU[d];
            return (
              <button
                key={d}
                type="button"
                aria-pressed={etkinDuzen === d}
                title={t(`panes.${d}`)}
                aria-label={t(`panes.${d}`)}
                disabled={sayi < 2}
                onClick={() => duzenSec(d)}
              >
                <Ikon />
              </button>
            );
          })}
        </div>
      </div>

      <div className="agac">
        {agac === null ? (
          <div className="chat__bos agac__bos">
            <span className="h">
              {alanlar.length === 0 ? t("panes.noAreas") : t("panes.empty")}
            </span>
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--text-3)",
                maxWidth: 420,
              }}
            >
              {alanlar.length === 0
                ? t("panes.noAreasHint")
                : t("panes.emptyHint")}
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
                hedef={surukleme?.hedef === b.id}
                kaynak={surukleme?.kaynak === b.id}
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
                dizin={dizin}
                onKlasor={klasorSec}
                onPencere={sonrakiPencere}
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
              ad: t("menu.folder"),
              onSec: () => void klasorSec(menuIcerik.session),
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
            // Başka alanlar — bölme buradan kalkıyor, oturum orada açılıyor.
            // Tek alan varken hiçbir satır çıkmıyor: gidecek yer yok.
            ...alanlar
              .filter((a) => a.id !== etkinAlan)
              .map((a, i) => ({
                ad: t("area.moveTo", { name: a.ad }),
                ayrac: i === 0,
                onSec: () => onAlanaTasi(menuIcerik.session, a.id),
              })),
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

      {/*
       * CLI çalışırken klasör değiştirme onayı.
       *
       * Karar kullanıcının: çalışan bir sürecin cwd'si dışarıdan
       * değiştirilemez ve bu bir uygulama eksiği değil. Kutu bunu **açıkça**
       * yazıyor; sessizce yeni pencere açmak ya da metni CLI'ye göndermek
       * ikisi de sürpriz olurdu.
       */}
      {onayVar && onayIcerik && (
        <div
          className="scrim"
          data-cikis={onayCikiyor || undefined}
          role="dialog"
          aria-modal="true"
          aria-label={t("panes.cliTitle")}
        >
          <div className="card" style={{ width: 460, background: "var(--bg)" }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {t("panes.cliAsk", { cmd: onayIcerik.komut })}
            </span>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t("panes.cliBlurb", {
                dir: kisaltEv(onayIcerik.yol),
                cmd: onayIcerik.komut,
              })}
            </span>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => setOnay(null)}
              >
                {t("panes.cliCancel")}
              </button>
              <button
                type="button"
                className="btn-quiet"
                title={t("panes.cliSendHint", { cmd: onayIcerik.komut })}
                onClick={() => void yineDeGonder(onayIcerik)}
              >
                {t("panes.cliSend")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void yeniPencere(onayIcerik)}
              >
                {t("panes.cliNewWindow")}
              </button>
            </div>
          </div>
        </div>
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
  /** Alanın varsayılan klasörü; yalnızca oturum doğarken okunuyor. */
  dizin?: string;
  hedef: boolean;
  kaynak: boolean;
  onKapat: (bolmeId: string, session: string) => void;
  onZoom: (bolmeId: string) => void;
  onTut: (e: React.PointerEvent, bolmeId: string, ad: string) => void;
  onOpened: () => void;
  etiket?: string;
  duzenleniyor: boolean;
  onDuzenle: (session: string | null) => void;
  onEtiket: (session: string, ad: string) => void;
  onMenu: (yer: MenuYer) => void;
  onKlasor: (session: string) => void;
  onPencere: (session: string) => void;
}

function Bolme({
  bolmeId,
  session,
  kutu,
  zoomlu,
  gecis,
  oturum,
  info,
  dizin,
  kaynak,
  onKapat,
  onZoom,
  onTut,
  onOpened,
  etiket,
  duzenleniyor,
  onDuzenle,
  onEtiket,
  onMenu,
  onKlasor,
  onPencere,
}: BolmeProps) {
  /**
   * Ön planda ne çalışıyor. Kaynak **yerel** `pty_info`; `tmux_list`'ten
   * gelen `oturum.command` 10 saniye eski olabiliyor ve yedek olarak duruyor.
   */
  const komut = info?.command ?? oturum?.command ?? "";
  const calisiyor = komut !== "" && !KABUKLAR.includes(komut);

  /**
   * Alanın klasörü **ilk çizimde dondurulur.**
   *
   * tmux `-c`'yi yalnızca `new-session` yolunda okuyor (`pty.rs::open`), yani
   * klasör yalnızca oturum doğarken anlamlı. Canlı prop olarak geçirilseydi
   * alanın klasörünü değiştirmek `Term`'in kurulum efektini yeniden
   * çalıştırırdı (deps `[session, workdir]`) ve **açık bütün bölmeler**
   * sökülüp yeniden kurulurdu.
   */
  const ilkDizin = useRef(dizin);

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
            <InlineAd
              deger={etiket ?? ""}
              sinif="phead__alan"
              ipucu={dinamik}
              etiket={t("menu.renameLabel", { name: session })}
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
              {/*
               * ⚠️ İki parça, tek dizge değil. Ölçüldü: bölme 281px'e
               * düşünce etikete **7–46px** kalıyor ve `text-overflow`
               * **sonu** kırptığı için görünen tek şey `eymistaken@Zorin…`
               * oluyordu — yani her bölmede aynı olan, bilgi değeri sıfır
               * olan kısım. Önek `flex-shrink: 999` ile **önce** kırpılıyor,
               * dizin son ana kadar duruyor.
               *
               * Elle etiket tek parça: kullanıcı ne yazdıysa o, bölünecek
               * bir yapısı yok.
               */}
              {etiket ? (
                gorunen
              ) : info ? (
                <>
                  <span className="phead__kim">
                    {info.user}@{info.host}:
                  </span>
                  <span className="phead__yol">{kisaltEv(info.path)}</span>
                </>
              ) : (
                session
              )}
            </span>
          )}
          {/* Çalışan komut ve dizin — başlığın kalan yerini alıyor, kırpılıyor.
           * Kuyunun içindeyiz: renk `--well-muted`, `--text-muted` burada
           * aydınlık temada 2.63:1 verirdi. */}
          <span className="phead__alt">{komut}</span>
          {oturum?.attached && (
            <span className="phead__uzak">{t("term.alsoOnPc")}</span>
          )}
          {/*
           * Pencere sayacı — yalnızca birden fazla pencere varsa.
           *
           * CLI çalışırken klasör değiştirmek aynı oturumda yeni bir pencere
           * açıyor; bu sayaç geri dönüş yolu. Tasarımın kendi ilkesi gereği
           * tek pencerede **çizilmiyor**: uygulama ölçmediği şeyi yazmıyor,
           * ve "1/1" hiçbir şey söylemiyor.
           */}
          {info && info.windows > 1 && (
            <button
              type="button"
              className="pb phead__pencere mono"
              title={t("panes.nextWindow", {
                i: info.windowIndex + 1,
                n: info.windows,
              })}
              onClick={() => onPencere(session)}
            >
              {t("panes.windowCount", {
                i: info.windowIndex + 1,
                n: info.windows,
              })}
            </button>
          )}
          <button
            type="button"
            className="pb"
            title={t("panes.folder")}
            aria-label={t("panes.folderNamed", { name: session })}
            onClick={() => onKlasor(session)}
          >
            <IconFolder />
          </button>
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
          {/*
           * ⚠️ **Böl düğmeleri buradan kalktı, sağ tık menüsünde duruyor.**
           * Ölçüldü: altı düğme 139px yiyor ve bölme 281px'e düşünce etikete
           * 7px kalıyordu. Klasör düğmesi kullanıcının açık isteği, o kalıyor;
           * bölme daha seyrek bir eylem ve menüde tam adıyla duruyor.
           */}
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
          workdir={ilkDizin.current}
          dondur={gecis}
          onOpened={onOpened}
          onExit={() => void onKapat(bolmeId, session)}
        />
      </div>
    </div>
  );
}
