import { useState } from "react";

import InlineAd from "./InlineAd";
import SagMenu, { type MenuYer } from "./SagMenu";
import { IconPlus } from "./Icon";
import { useCikisIcerik } from "../lib/cikis";
import { t } from "../lib/i18n";
import { avatarVar, hueOf } from "../lib/types";
import type { Alan } from "../lib/alanlar";

interface Props {
  alanlar: Alan[];
  etkin: string;
  /** Alan başına açık bölme sayısı — sekme kaç terminal taşıdığını yazıyor. */
  sayilar: Record<string, number>;
  onSec: (id: string) => void;
  onEkle: () => void;
  onAdlandir: (id: string, ad: string) => void;
  onSil: (id: string) => void;
}

/**
 * Çalışma alanı sekmeleri — terminal kenar çubuğunun tepesinde.
 *
 * Ledger'da kutu yok: etkin sekme bir **yüzey kademesiyle** değil altındaki
 * cetvelle işaretleniyor (`--line-3`), ötekiler `--line`'da kalıyor. Aynı
 * gösterge düzen ikonları sırasında da kullanılıyor; ikinci bir dil
 * icat edilmedi.
 *
 * ⚠️ **Metin `--text-muted`'ten `--text`'e çıkıyor, dolgu kademesine
 * çıkmıyor.** Kontrast tablosu: `--text-muted` `--field-h` üstünde 4.44 ile
 * AA altında. Kanun bunu açıkça yasaklıyor ve palet değişse de tuzak
 * değişmiyor.
 *
 * ⛔ **FLIP kullanılmadı.** `flip.ts` `offsetTop` okuyor, yani yalnızca dikey
 * yeniden sıralamayı devindiriyor; sekmeler yatay ve her birinin `offsetTop`'u
 * aynı. Bağlamak ölü kod olurdu — bu depoda okunmayan bir denetim bir kez
 * kullanıcıyı yanılttı. Yatay FLIP gerekirse `flip.ts` genişletilir, ikinci
 * bir uygulama yazılmaz.
 *
 * Renk **addan türüyor** (`hueOf`), botlardaki formülün aynısı. Ayrı bir hue
 * alanı yok: bu depoda okunmayan bir alan bir kez ölü kaldı, ve adı
 * değiştirmek zaten rengi değiştirmenin en kısa yolu.
 */
export default function AlanSekmeleri({
  alanlar,
  etkin,
  sayilar,
  onSec,
  onEkle,
  onAdlandir,
  onSil,
}: Props) {
  const [menu, setMenu] = useState<{ yer: MenuYer; id: string } | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const {
    icerik: menuIcerik,
    render: menuVar,
    cikiyor: menuCikiyor,
  } = useCikisIcerik(menu);

  return (
    <>
      {/* Artı **kaydırılan şeridin dışında.** İlk sürümde içindeydi ve üç
        * alanla bile taşıp görünmez oluyordu (WebKitGTK görüntüsünde
        * görüldü); yatay çubuk da gizli olduğu için erişilemez hale
        * geliyordu. */}
      <div className="sekmeler">
        <div className="sekmeler__kaydir" role="tablist" aria-label={t("area.tabs")}>
          {alanlar.map((a) => {
            const n = sayilar[a.id] ?? 0;
            return duzenlenen === a.id ? (
              <InlineAd
                key={a.id}
                deger={a.ad}
                sinif="sekme__alan"
                ipucu={a.ad}
                etiket={t("area.renameLabel", { name: a.ad })}
                onBitti={(v) => {
                  onAdlandir(a.id, v);
                  setDuzenlenen(null);
                }}
                onIptal={() => setDuzenlenen(null)}
              />
            ) : (
              <button
                key={a.id}
                type="button"
                role="tab"
                className="sekme"
                aria-selected={a.id === etkin}
                data-etkin={a.id === etkin || undefined}
                title={t("area.tabTitle", { name: a.ad, n })}
                onClick={() => onSec(a.id)}
                onDoubleClick={() => setDuzenlenen(a.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onSec(a.id);
                  setMenu({ yer: { x: e.clientX, y: e.clientY }, id: a.id });
                }}
              >
                <span
                  className="tile"
                  aria-hidden="true"
                  style={{ background: avatarVar(hueOf(a.ad)) }}
                />
                <span className="sekme__ad">{a.ad}</span>
                {n > 0 && <span className="sekme__n">{n}</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="ib sekme__arti"
          title={t("area.new")}
          aria-label={t("area.new")}
          onClick={onEkle}
        >
          <IconPlus />
        </button>
      </div>

      {menuVar && menuIcerik && (
        <SagMenu
          yer={menuIcerik.yer}
          cikiyor={menuCikiyor}
          ariaLabel={t("area.menu")}
          onKapat={() => setMenu(null)}
          ogeler={[
            {
              ad: t("menu.rename"),
              onSec: () => setDuzenlenen(menuIcerik.id),
            },
            {
              ad: t("area.close"),
              ayrac: true,
              // Son alan silinmiyor: sekmesiz bir terminal kipi çizilemez.
              kapali: alanlar.length < 2,
              onSec: () => onSil(menuIcerik.id),
            },
          ]}
        />
      )}
    </>
  );
}
