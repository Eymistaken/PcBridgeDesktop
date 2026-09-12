/**
 * İkonlar: 20px ızgarada inline SVG. Emoji ve dingbat yasak.
 * Çizimler design/*.dc.html'deki path'lerin aynısı.
 */

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function svg(size: number, children: React.ReactNode, extra?: object) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      {...extra}
    >
      {children}
    </svg>
  );
}

export function IconPlus({
  size = 17,
  color = "var(--text)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(size, <path d="M10 4.5v11M4.5 10h11" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
  });
}

export function IconSearch({
  size = 15,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(
    size,
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L17 17" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round" },
  );
}

export function IconCheck({
  size = 14,
  color = "var(--ok)",
  strokeWidth = 2.2,
}: IconProps) {
  return svg(size, <path d="M4.5 10.5l3.5 3.5 7.5-8" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  });
}

export function IconCross({
  size = 14,
  color = "var(--fail)",
  strokeWidth = 2.2,
}: IconProps) {
  return svg(size, <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
  });
}




export function IconStop({ size = 11, color = "var(--fail)" }: IconProps) {
  return svg(size, <rect x="5" y="5" width="10" height="10" rx="2" />, {
    fill: color,
  });
}

export function IconPencil({
  size = 15,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(
    size,
    <>
      <path d="M13.5 3.5l3 3L7 16H4v-3z" />
      <path d="M11.5 5.5l3 3" />
    </>,
    {
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  );
}

/**
 * Silme ikonu **kırmızı değil.**
 *
 * Kanunda renk yalnızca kimlikten ve **durumdan** gelir; `--fail` "bir şey
 * başarısız oldu" demek. Silme düğmesi bir durum değil bir eylem — hover'da
 * yüzey kademesiyle öne çıkıyor, rengiyle değil. Onay penceresi zaten var.
 */
export function IconTrash({
  size = 15,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(
    size,
    <>
      <path d="M4.5 5.5h11M8 5.5V4h4v1.5M6 5.5l.7 10h6.6l.7-10" />
    </>,
    {
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  );
}


/**
 * Katlanır liste oku. **Tek çizim, döndürülüyor:** kapalı için ayrı bir
 * `>` çizmek iki path'i ayrı ayrı bakımda tutmak olurdu ve geçiş
 * (`transform`) tek çizimle kendiliğinden geliyor.
 */
export function IconChevron({
  size = 12,
  color = "var(--text-muted)",
  strokeWidth = 1.6,
  acik = false,
}: IconProps & { acik?: boolean }) {
  return svg(size, <path d="m6 8 4 4 4-4" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { transform: acik ? undefined : "rotate(-90deg)" },
    className: "chevron",
  });
}

export function IconClose({
  size = 12,
  color = "var(--text-muted)",
  strokeWidth = 1.8,
}: IconProps) {
  return svg(size, <path d="M6 6l8 8M14 6l-8 8" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
  });
}




export function IconAttach({
  size = 17,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(
    size,
    <path d="M14.5 9.2 9.7 14a3 3 0 0 1-4.3-4.3l5.4-5.4a2 2 0 0 1 2.9 2.9l-5.4 5.4a1 1 0 0 1-1.4-1.4l4.8-4.8" />,
    {
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  );
}

/** Masaüstü izni — kilit. Kapalıyken kapalı, açıkken açık asma. */
export function IconLock({
  size = 16,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
  open = false,
}: IconProps & { open?: boolean }) {
  return svg(
    size,
    <>
      <rect x="4" y="9" width="12" height="8" rx="2.5" />
      <path
        d={open ? "M7 9V6.5a3 3 0 0 1 5.8-1.1" : "M7 9V6.5a3 3 0 0 1 6 0V9"}
      />
    </>,
    {
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  );
}

/** Ekran görüntüsü. */




export function IconScreen({
  size = 16,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(
    size,
    <>
      <rect x="2.5" y="4" width="15" height="10" rx="2" />
      <path d="M7 17h6" />
    </>,
    {
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  );
}

/** Denetim kaydı — üst üste satırlar. */
export function IconList({
  size = 16,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(size, <path d="M4 6h12M4 10h12M4 14h8" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
  });
}

/**
 * İzin kipi ikonları — üçü de 20px ızgarada, aynı çizgi kalınlığında.
 *
 * Kip **renkle değil biçimle** anlatılıyor: kalkan durur ve sorar, tik geçer,
 * şimşek hiç durmaz. Renk yalnızca kimlikten ve durumdan gelir.
 */

/** `sor` — kalkan: her çağrıda önüne çıkar. */
export function IconShield({
  size = 14,
  color = "currentColor",
  strokeWidth = 1.5,
}: IconProps) {
  return svg(
    size,
    <path d="M10 2.5 4 5v4.5c0 3.4 2.4 6.5 6 8 3.6-1.5 6-4.6 6-8V5l-6-2.5Z" />,
    {
      stroke: color,
      strokeWidth,
      strokeLinejoin: "round",
    },
  );
}

/** `serbest` — şimşek: hiç durmadan geçer. */
export function IconBolt({
  size = 14,
  color = "currentColor",
  strokeWidth = 1.5,
}: IconProps) {
  return svg(size, <path d="M11.5 2.5 5.5 11h4l-1 6.5L14.5 9h-4l1-6.5Z" />, {
    stroke: color,
    strokeWidth,
    strokeLinejoin: "round",
    strokeLinecap: "round",
  });
}

/**
 * Bölmeyi genişlet / geri küçült.
 *
 * **Tek çizim, yönü tersine dönüyor:** iki köşe braketi genişletmede dışa,
 * küçültmede içe bakıyor. `IconChevron` ile aynı gerekçe — iki ayrı path'i
 * ayrı ayrı bakımda tutmak yerine tek bir çizimin yönünü değiştirmek.
 *
 * Renk varsayılanı **kuyu tokenı**: bu düğme bölme başlığında, yani kuyunun
 * içinde duruyor ve `--text-muted` orada aydınlık temada 2.63:1 verirdi.
 */
export function IconZoom({
  size = 14,
  color = "var(--well-muted)",
  strokeWidth = 1.6,
  kucult = false,
}: IconProps & { kucult?: boolean }) {
  return svg(
    size,
    // ⚠️ Braketler **kenarlara** çizilir. İlk denemede (4,9)/(16,11)
    // merkeze yakındı ve 13px'te iki braket birbirine değip bir artı gibi
    // okunuyordu — WebKitGTK görüntüsünde görüldü.
    kucult ? (
      <path d="M8 3v5H3M12 17v-5h5" />
    ) : (
      <path d="M3 8V3h5M17 12v5h-5" />
    ),
    {
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  );
}

/** Klasör — bölme başlığında ve kenar çubuğu satırında dizin değiştirme. */
export function IconFolder({
  size = 13,
  color = "var(--well-muted)",
  strokeWidth = 1.6,
}: IconProps) {
  return svg(
    size,
    <path d="M2.5 6.5h5l1.5 2h8.5v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9Z" />,
    {
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  );
}

/*
 * ── düzen ikonları ───────────────────────────────────────────────
 *
 * ⚠️ **Ledger kanunundan bilinçli sapma.** Kanun bugüne kadar "düzen sırası
 * ikon değil kelime, tasarımdaki gibi" diyordu (`app.css`) ve tasarımın
 * artboard'u `FREE · GRID · COLUMNS · ROWS · MAIN + STACK` yazıyor. Kullanıcı
 * 2026-09-08'de ikon istedi. **Kelimeler silinmedi:** `aria-label` ve `title`
 * olarak duruyorlar, yani ekran okuyucu ve ipucu aynı metni görüyor.
 *
 * Beşi de aynı çerçeveyi paylaşıyor; ayıran şey içindeki bölme çizgileri.
 * Renk `currentColor`: etkin düğme `--text`, ötekiler `--text-muted` ve
 * geçişi CSS yapıyor.
 */
function duzenIkonu(icerik: React.ReactNode, kesikli?: boolean) {
  return svg(
    15,
    <>
      <rect
        x="3"
        y="4.5"
        width="14"
        height="11"
        rx="1.5"
        strokeDasharray={kesikli ? "2.6 2" : undefined}
      />
      {icerik}
    </>,
    { stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" },
  );
}


/*
 * ── kelimenin yerine geçen ikonlar (2026-09-12) ──────────────────────
 *
 * ⚠️ **Ledger'ın "eylemler kelime" kuralı burada geri alındı.** Kullanıcının
 * kararı: *"nerdeyse tüm tuşlarda logo yerine yazı yazmaya kaçılmış… daha
 * görsel odaklı gitsek"*. Kelimeler **silinmedi**, `title` ve `aria-label`'a
 * taşındı — ipucu ve ekran okuyucu aynı metni görmeye devam ediyor.
 *
 * Çizimler `design/oneriler-2026-09-12/Ikonlar.dc.html`'deki path'lerin
 * aynısı; 20px ızgarada, 1.5 kalınlıkta.
 */

/** Bot kipi — anten ve iki göz. Gövde dolgusuz, gözler dolu. */
export function IconBot({
  size = 20,
  color = "currentColor",
  strokeWidth = 1.5,
}: IconProps) {
  return svg(
    size,
    <>
      <rect x="2.9" y="6.6" width="14.2" height="9.8" />
      <path d="M10 6.6V4.4" />
      <circle cx="10" cy="3.3" r="1.2" />
      {/* Gözler dolu: boş bırakınca ikon uzaktan dışa aktarma tepsisine
        * benziyordu (WebKitGTK görüntüsünde büyütülerek görüldü). */}
      <circle cx="7.2" cy="11.2" r="1.15" fill={color} stroke="none" />
      <circle cx="12.8" cy="11.2" r="1.15" fill={color} stroke="none" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Terminal kipi — kabuk isteminin kendisi: `>` ve alt çizgi. */
export function IconTerminal({
  size = 20,
  color = "currentColor",
  strokeWidth = 1.5,
}: IconProps) {
  return svg(
    size,
    <>
      <path d="M4 5.5 8 10l-4 4.5" />
      <path d="M10.5 14.5h5.5" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/**
 * Dışa aktarma — tepsiden **yukarı** çıkan ok.
 *
 * ⚠️ Ok yönü kullanıcının açık isteği (2026-09-12): *"export tuşu aşağı
 * değil yukarı ok olsun"*. Aşağı ok indirme demek; buradaki eylem sohbeti
 * uygulamadan **dışarı** vermek.
 */
export function IconExport({
  size = 18,
  color = "currentColor",
  strokeWidth = 1.5,
}: IconProps) {
  return svg(
    size,
    <>
      <path d="M10 12.5V3.4" />
      <path d="m6.4 7 3.6-3.6L13.6 7" />
      <path d="M4 14.5v2h12v-2" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Gönder — yukarı ok. Bestecideki tek dolu düğme; birincil eylem o. */
export function IconSend({
  size = 17,
  color = "currentColor",
  strokeWidth = 1.6,
}: IconProps) {
  return svg(
    size,
    <>
      <path d="M10 16V4.5" />
      <path d="m5.5 9 4.5-4.5L14.5 9" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Düşünce — iki kıvılcım. Sohbette `DÜŞÜNCE` etiketinin yerine geçti. */
export function IconThought({
  size = 14,
  color = "currentColor",
  strokeWidth = 1.4,
}: IconProps) {
  return svg(
    size,
    <>
      <path d="M10 2.6 11.4 7 15.8 8.4 11.4 9.8 10 14.2 8.6 9.8 4.2 8.4 8.6 7Z" />
      <path d="M15.4 13.2l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5Z" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Araç çağrısı — iki köşeli ayraç ve eğik çizgi. `ARAÇLAR` etiketinin yerine. */
export function IconTool({
  size = 14,
  color = "currentColor",
  strokeWidth = 1.4,
}: IconProps) {
  return svg(
    size,
    <>
      <path d="M7.5 3.5 4 7l3.5 3.5" />
      <path d="M12.5 9.5 16 13l-3.5 3.5" />
      <path d="M11.2 3.6 8.8 16.4" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/**
 * `SERBEST` — bir düzen değil **durum**: ağaç hazır düzenlerin hiçbirine
 * uymuyor.
 *
 * ⚠️ **İçi boş, kesikli çerçeve.** İlk çizimde içinde asimetrik bir bölme
 * vardı ve büyütülmüş görüntüde `ANA + YIĞIN` ile aynı yapıyı gösteriyordu
 * (ikisi de solda büyük + sağda iki). Boş çerçeve doğrudan "hazır düzenlerin
 * hiçbiri" diyor.
 */
export function IconLayFree() {
  return duzenIkonu(null, true);
}

export function IconLayGrid() {
  return duzenIkonu(<path d="M10 4.5v11M3 10h14" />);
}

export function IconLayCols() {
  return duzenIkonu(<path d="M7.7 4.5v11M12.3 4.5v11" />);
}

export function IconLayRows() {
  return duzenIkonu(<path d="M3 8.2h14M3 11.8h14" />);
}

/** Solda tam boy ana bölme, sağda kalanlar üst üste. */
export function IconLayMain() {
  return duzenIkonu(<path d="M10.5 4.5v11M10.5 10h6.5" />);
}
