/**
 * Terminal bölme ağacı.
 *
 * Eskiden bölmeler düz bir dizideydi (`panes: string[]`) ve yerleşim
 * `panes.length`'ten türüyordu: dört sabit düzen, en fazla dört bölme.
 * Kullanıcının isteği (2026-09-05) gerçek döşeme — istediği kadar bölme,
 * herhangi bir bölmeyi ikiye bölmek, ayraçtan boyutlandırmak ve başlığından
 * tutup başka bir bölmeyle **takas** etmek.
 *
 * ⚠️ **Rust'ta zaten sınır yoktu** (`pty.rs` sınırsız `HashMap`); dörtlü
 * sınır tamamen ön yüz sözleşmesiydi ve beşinci oturumu **sessizce
 * yutuyordu** (`Shell.tsx::setPanes`'teki `slice(0, 4)`).
 */

/** İki yönden biri: `satir` yan yana, `sutun` alt alta. */
export type Yon = "satir" | "sutun";

export type Dugum =
  | { t: "bolme"; id: string; session: string }
  /** `oran` **a**'nın payı (0–1); b kalanı alır. */
  | { t: "bol"; id: string; yon: Yon; oran: number; a: Dugum; b: Dugum };

let sayac = 0;
function yeniId(onek: string): string {
  sayac += 1;
  return `${onek}${Date.now().toString(36)}-${sayac.toString(36)}`;
}

export function bolmeYap(session: string): Dugum {
  return { t: "bolme", id: yeniId("p"), session };
}

/** Ağaçtaki oturum adları, soldan sağa / yukarıdan aşağıya. */
export function oturumlar(d: Dugum | null): string[] {
  if (!d) return [];
  return d.t === "bolme" ? [d.session] : [...oturumlar(d.a), ...oturumlar(d.b)];
}

/** Bölme (yaprak) sayısı. */
export function bolmeSayisi(d: Dugum | null): number {
  if (!d) return 0;
  return d.t === "bolme" ? 1 : bolmeSayisi(d.a) + bolmeSayisi(d.b);
}

/** Bir yaprağı ikiye böler; yenisi verilen yönde **sonra** gelir. */
export function bol(
  kok: Dugum,
  hedefId: string,
  yon: Yon,
  session: string,
): Dugum {
  const yaz = (d: Dugum): Dugum => {
    if (d.t === "bolme") {
      if (d.id !== hedefId) return d;
      return {
        t: "bol",
        id: yeniId("s"),
        yon,
        oran: 0.5,
        a: d,
        b: bolmeYap(session),
      };
    }
    return { ...d, a: yaz(d.a), b: yaz(d.b) };
  };
  return yaz(kok);
}

/**
 * Bölmeyi kaldırır; **kardeş ebeveynin yerine geçer.**
 *
 * Tek bölme kalmışsa `null` döner — ağaç boşalır ve arayüz boş durumu çizer.
 */
export function kapat(kok: Dugum, bolmeId: string): Dugum | null {
  if (kok.t === "bolme") return kok.id === bolmeId ? null : kok;
  const a = kapat(kok.a, bolmeId);
  const b = kapat(kok.b, bolmeId);
  if (a === null) return b;
  if (b === null) return a;
  if (a === kok.a && b === kok.b) return kok;
  return { ...kok, a, b };
}

/**
 * İki bölmenin **oturumunu** takas eder — ağacın şekli değişmez.
 *
 * Kullanıcının istediği bu: "istediğim terminallerin yerlerini
 * değiştirebilmeliyim üstlerindeki gri tutma yerinden tutarak". Düğümleri
 * yer değiştirmek yerine yalnızca yaprakların içeriğini takas etmek düzeni
 * bozulmaz kılıyor.
 */
export function takas(kok: Dugum, aId: string, bId: string): Dugum {
  const a = bul(kok, aId);
  const b = bul(kok, bId);
  if (!a || !b || a.t !== "bolme" || b.t !== "bolme" || aId === bId) return kok;
  const aOturum = a.session;
  const bOturum = b.session;
  const yaz = (d: Dugum): Dugum => {
    if (d.t === "bolme") {
      if (d.id === aId) return { ...d, session: bOturum };
      if (d.id === bId) return { ...d, session: aOturum };
      return d;
    }
    return { ...d, a: yaz(d.a), b: yaz(d.b) };
  };
  return yaz(kok);
}

/** Ayraç sürüklenince oranı yazar. Uçlara yapışmasın diye kırpılıyor. */
export function oranYaz(kok: Dugum, bolId: string, oran: number): Dugum {
  if (kok.t === "bolme") return kok;
  if (kok.id === bolId)
    return { ...kok, oran: Math.min(0.9, Math.max(0.1, oran)) };
  return {
    ...kok,
    a: oranYaz(kok.a, bolId, oran),
    b: oranYaz(kok.b, bolId, oran),
  };
}

export function bul(kok: Dugum | null, id: string): Dugum | null {
  if (!kok) return null;
  if (kok.id === id) return kok;
  if (kok.t === "bolme") return null;
  return bul(kok.a, id) ?? bul(kok.b, id);
}

/** Bir oturumu taşıyan yaprak. */
export function oturumaGore(kok: Dugum | null, session: string): Dugum | null {
  if (!kok) return null;
  if (kok.t === "bolme") return kok.session === session ? kok : null;
  return oturumaGore(kok.a, session) ?? oturumaGore(kok.b, session);
}

/** Yeni bir bölmeyi ağacın **en geniş** yaprağını bölerek ekler. */
export function ekle(kok: Dugum | null, session: string): Dugum {
  if (!kok) return bolmeYap(session);
  if (oturumlar(kok).includes(session)) return kok;
  // Yaprağın ölçüsü ağaçta bilinmiyor; derinliği en az olanı bölmek pratikte
  // en büyüğüne denk geliyor ve düzeni dengeli tutuyor.
  const hedef = enSigYaprak(kok);
  // Yön dönüşümlü: hep aynı yönde bölmek uzun ince şeritler üretiyordu.
  const yon: Yon = derinlik(kok, hedef.id) % 2 === 0 ? "satir" : "sutun";
  return bol(kok, hedef.id, yon, session);
}

function enSigYaprak(kok: Dugum): Dugum {
  let en: { d: Dugum; k: number } | null = null;
  const gez = (d: Dugum, k: number) => {
    if (d.t === "bolme") {
      if (!en || k < en.k) en = { d, k };
      return;
    }
    gez(d.a, k + 1);
    gez(d.b, k + 1);
  };
  gez(kok, 0);
  return en ? (en as { d: Dugum; k: number }).d : kok;
}

function derinlik(kok: Dugum, id: string, k = 0): number {
  if (kok.id === id) return k;
  if (kok.t === "bolme") return -1;
  const a = derinlik(kok.a, id, k + 1);
  return a >= 0 ? a : derinlik(kok.b, id, k + 1);
}

// ─────────────────────────── hazır düzenler ───────────────────────────

export type Duzen = "izgara" | "sutunlar" | "satirlar" | "ana";

/**
 * Verilen oturumlardan bir düzen üretir.
 *
 * Hazır düzenler **ağaç üreticisi**: seçildikten sonra kullanıcı yine
 * herhangi bir ayracı sürükleyebiliyor, bölebiliyor, takas edebiliyor.
 */
export function duzenKur(sessions: string[], duzen: Duzen): Dugum | null {
  const s = sessions.filter(Boolean);
  if (s.length === 0) return null;
  if (s.length === 1) return bolmeYap(s[0]);

  switch (duzen) {
    case "sutunlar":
      return seritKur(s, "satir");
    case "satirlar":
      return seritKur(s, "sutun");
    case "ana": {
      // Solda tam boy ana bölme, sağda kalanlar üst üste.
      const [ilk, ...kalan] = s;
      return {
        t: "bol",
        id: yeniId("s"),
        yon: "satir",
        oran: 0.58,
        a: bolmeYap(ilk),
        b: seritKur(kalan, "sutun"),
      };
    }
    default: {
      // Izgara: kareye en yakın sütun sayısı, satırlar eşit bölünüyor.
      const sutun = Math.ceil(Math.sqrt(s.length));
      const satirlar: string[][] = [];
      for (let i = 0; i < s.length; i += sutun)
        satirlar.push(s.slice(i, i + sutun));
      return dengeli(
        satirlar.map((r) => seritKur(r, "satir")),
        "sutun",
      );
    }
  }
}

/** Düz bir şerit: hepsi aynı yönde, eşit paylı. */
function seritKur(s: string[], yon: Yon): Dugum {
  return dengeli(s.map(bolmeYap), yon);
}

/**
 * Düğümleri eşit paylı bir ağaca dizer.
 *
 * ⚠️ Oran **kalan öğe sayısına** göre: sağa doğru zincirlenen bir ağaçta hep
 * `0.5` yazmak ilk bölmeyi ötekilerin toplamı kadar büyütürdü.
 */
function dengeli(dugumler: Dugum[], yon: Yon): Dugum {
  if (dugumler.length === 1) return dugumler[0];
  const [ilk, ...kalan] = dugumler;
  return {
    t: "bol",
    id: yeniId("s"),
    yon,
    oran: 1 / dugumler.length,
    a: ilk,
    b: dengeli(kalan, yon),
  };
}

// ─────────────────────────── kalıcılık ───────────────────────────

/**
 * localStorage'dan okur.
 *
 * **Eski biçim göçü:** düz bir dizi (`["claude", "agy"]`) bulunursa eşit
 * paylı bir ızgaraya çevriliyor — kullanıcı bölmelerini kaybetmiyor.
 */
export function oku(ham: string | null): Dugum | null {
  if (!ham) return null;
  let v: unknown;
  try {
    v = JSON.parse(ham);
  } catch {
    return null;
  }
  if (Array.isArray(v)) {
    return duzenKur(
      v.filter((x): x is string => typeof x === "string"),
      "izgara",
    );
  }
  return gecerli(v) ? (v as Dugum) : null;
}

/** Diskten gelen ağacı doğrular: bozuk bir kayıt arayüzü çökertmesin. */
function gecerli(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  if (d.t === "bolme")
    return typeof d.id === "string" && typeof d.session === "string";
  if (d.t === "bol") {
    return (
      typeof d.id === "string" &&
      (d.yon === "satir" || d.yon === "sutun") &&
      typeof d.oran === "number" &&
      gecerli(d.a) &&
      gecerli(d.b)
    );
  }
  return false;
}
