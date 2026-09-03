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

export function IconPlus({ size = 17, color = "var(--text)", strokeWidth = 1.7 }: IconProps) {
  return svg(size, <path d="M10 4.5v11M4.5 10h11" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
  });
}

export function IconSearch({ size = 15, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
  return svg(
    size,
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L17 17" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round" },
  );
}

export function IconCheck({ size = 14, color = "var(--ok)", strokeWidth = 2.2 }: IconProps) {
  return svg(size, <path d="M4.5 10.5l3.5 3.5 7.5-8" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  });
}

export function IconCross({ size = 14, color = "var(--fail)", strokeWidth = 2.2 }: IconProps) {
  return svg(size, <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
  });
}

export function IconTerminal({ size = 18, color = "var(--text-muted)", strokeWidth = 1.6 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <path d="M6 8l2.5 2L6 12" />
      <path d="M11 12.5h3" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

export function IconRefresh({ size = 17, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
  return svg(
    size,
    <>
      <path d="M16.2 8.4A6.4 6.4 0 1 0 16.5 12" />
      <path d="M16.5 4v4.5H12" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

export function IconSend({ size = 17, color = "var(--bg)", strokeWidth = 2 }: IconProps) {
  return svg(size, <path d="M10 15.5V4.5M5.5 9L10 4.5 14.5 9" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  });
}

export function IconStop({ size = 11, color = "var(--fail)" }: IconProps) {
  return svg(size, <rect x="5" y="5" width="10" height="10" rx="2" />, { fill: color });
}

export function IconPencil({ size = 15, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
  return svg(
    size,
    <>
      <path d="M13.5 3.5l3 3L7 16H4v-3z" />
      <path d="M11.5 5.5l3 3" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/**
 * Silme ikonu **kırmızı değil.**
 *
 * Kanunda renk yalnızca kimlikten ve **durumdan** gelir; `--fail` "bir şey
 * başarısız oldu" demek. Silme düğmesi bir durum değil bir eylem — hover'da
 * yüzey kademesiyle öne çıkıyor, rengiyle değil. Onay penceresi zaten var.
 */
export function IconTrash({ size = 15, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
  return svg(
    size,
    <>
      <path d="M4.5 5.5h11M8 5.5V4h4v1.5M6 5.5l.7 10h6.6l.7-10" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Dışa aktar — kutudan yukarı çıkan ok. 20px ızgarada. */
export function IconExport({
  size = 17,
  color = "var(--text-muted)",
  strokeWidth = 1.7,
}: IconProps) {
  return svg(
    size,
    <path d="M10 3.5v9M6.8 6.7 10 3.5l3.2 3.2M4.5 12.5v3a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3" />,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

export function IconClose({ size = 12, color = "var(--text-muted)", strokeWidth = 1.8 }: IconProps) {
  return svg(size, <path d="M6 6l8 8M14 6l-8 8" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
  });
}

/** Kenar çubuğundaki oturum kutucuğu — daire değil köşeli. */
export function IconPrompt({ size = 16, color = "var(--text)", strokeWidth = 1.8 }: IconProps) {
  return svg(
    size,
    <>
      <path d="M4 6l4 4-4 4" />
      <path d="M10.5 14.5h5.5" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

export function IconBot({ size = 18, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="3" y="6" width="14" height="10" rx="3" />
      <path d="M10 3v3" />
      <circle cx="7.5" cy="11" r="1.1" fill={color} stroke="none" />
      <circle cx="12.5" cy="11" r="1.1" fill={color} stroke="none" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Yerleşim seçicisinin dört simgesi — artboard'daki çizimler. */
export function IconLayout({ n, on }: { n: number; on: boolean }) {
  const renk = on ? "var(--text)" : "var(--text-muted)";
  const p = { flexGrow: 1, background: renk, borderRadius: 2 } as const;
  const kap: React.CSSProperties = {
    width: 26,
    height: 22,
    borderRadius: 5,
    display: "flex",
    gap: 2,
    padding: 4,
  };
  if (n === 1) return <span style={kap}><span style={p} /></span>;
  if (n === 2)
    return (
      <span style={kap}>
        <span style={p} />
        <span style={p} />
      </span>
    );
  if (n === 3)
    return (
      <span style={kap}>
        <span style={p} />
        <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={p} />
          <span style={p} />
        </span>
      </span>
    );
  return (
    <span
      style={{
        ...kap,
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(2, minmax(0, 1fr))",
      }}
    >
      <span style={{ background: renk, borderRadius: 2 }} />
      <span style={{ background: renk, borderRadius: 2 }} />
      <span style={{ background: renk, borderRadius: 2 }} />
      <span style={{ background: renk, borderRadius: 2 }} />
    </span>
  );
}

/** Besteci ek düğmesi — ataç. Dosya seçme yerel iletişim kutusundan gelir. */
export function IconAttach({ size = 17, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
  return svg(size, <path d="M14.5 9.5l-4.9 4.9a3 3 0 0 1-4.2-4.2l5.6-5.6a2 2 0 0 1 2.8 2.8l-5.6 5.6a1 1 0 0 1-1.4-1.4l5-5" />, {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  });
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
      <path d={open ? "M7 9V6.5a3 3 0 0 1 5.8-1.1" : "M7 9V6.5a3 3 0 0 1 6 0V9"} />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Ekran görüntüsü. */
export function IconScreen({ size = 16, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="2.5" y="4" width="15" height="10" rx="2" />
      <path d="M7 17h6" />
    </>,
    { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
  );
}

/** Denetim kaydı — üst üste satırlar. */
export function IconList({ size = 16, color = "var(--text-muted)", strokeWidth = 1.7 }: IconProps) {
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
export function IconShield({ size = 14, color = "currentColor", strokeWidth = 1.5 }: IconProps) {
  return svg(size, <path d="M10 2.5 4 5v4.5c0 3.4 2.4 6.5 6 8 3.6-1.5 6-4.6 6-8V5l-6-2.5Z" />, {
    stroke: color,
    strokeWidth,
    strokeLinejoin: "round",
  });
}

/** `serbest` — şimşek: hiç durmadan geçer. */
export function IconBolt({ size = 14, color = "currentColor", strokeWidth = 1.5 }: IconProps) {
  return svg(size, <path d="M11.5 2.5 5.5 11h4l-1 6.5L14.5 9h-4l1-6.5Z" />, {
    stroke: color,
    strokeWidth,
    strokeLinejoin: "round",
    strokeLinecap: "round",
  });
}
