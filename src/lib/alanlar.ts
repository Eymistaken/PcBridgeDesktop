/**
 * Çalışma alanları — terminal kipinin sekmeleri.
 *
 * Kullanıcının isteği (2026-09-08): *"varsayılan olarak dizine göre otomatik
 * ayrılır. ancak ben istersem farklı gruplara ayırabilirim ve o terminal orada
 * kalır. etiket de olmalı. bir çalışma alanında farklı klasörlere giden
 * terminaller olabilir."*
 *
 * ⚠️ **Otomatik olan şey listenin gruplanması, alan üyeliği değil.** Plan
 * "otomatik atama doğuşta" diyordu; bir yeni terminal `~`'da doğuyor, yani
 * dizine göre atama hepsini tek gruba düşürürdü ve `cd`'den sonra yeniden
 * atamak terminalleri alanlar arasında zıplatırdı — kullanıcının şartı
 * *"o terminal orada kalır."* Onun yerine: alan üyeliği **elle**, kenar
 * çubuğundaki "burada değil" listesi **dizine göre** gruplanıyor.
 *
 * **Üyeliğin tek kaynağı alanın ağacı.** Ayrı bir `session → alan` haritası
 * tutulmuyor: bu depoda aynı işi yapan iki denetimden biri bir kez ölü kaldı
 * (`Bot.desktop`) ve kullanıcı ölü anahtarı açıp izin verdiğini sandı.
 *
 * Renk de ayrı bir alan değil — **addan türüyor** (`hueOf`), botlardaki
 * formülün aynısı. Elle hue seçimi eklenmedi: okunmayan bir alan koymak
 * yerine ad değişince renk de değişiyor.
 */

import { oku as okuAgac, oturumaGore, oturumlar, kapat, ekle } from "./agac";
import type { Dugum } from "./agac";

export interface Alan {
  id: string;
  ad: string;
  agac: Dugum | null;
  /**
   * Alanın varsayılan çalışma klasörü — burada doğan terminaller oradan
   * başlıyor. Seçilmemişse alan `~`'da doğuran eski davranışta kalıyor.
   *
   * ⚠️ Yalnızca **doğuşta** okunuyor. tmux `-c`'yi yalnızca `new-session`
   * yolunda görüyor; var olan bir oturuma bağlanmak onu hiç okumuyor
   * (`pty.rs::open`). Yani klasörü sonradan değiştirmek açık bölmeleri
   * taşımıyor — ve taşıyormuş gibi göstermiyoruz.
   */
  dizin?: string;
}

export interface AlanDurum {
  /** Şema sürümü — göç bunun yokluğuna bakıyor. */
  s: 2;
  /**
   * ⚠️ **Boş olabilir.** Kullanıcının isteği (2026-09-09): *"son kalan grup da
   * kapatılabilmeli; terminal görünümü sıfır grupla boş durumda kalabilmeli."*
   * Liste boşken `etkin` boş dizge ve `etkinAlan` `null` döndürüyor; yeni bir
   * terminal açmak alanı **kendiliğinden** kuruyor (`agacYaz`), yani kullanıcı
   * önce grup yaratmak zorunda değil.
   */
  alanlar: Alan[];
  /** Etkin alanın `id`'si. Liste boşken boş dizge. */
  etkin: string;
}

let sayac = 0;
function yeniId(): string {
  sayac += 1;
  return `a${Date.now().toString(36)}-${sayac.toString(36)}`;
}

export function alanYap(ad: string, agac: Dugum | null = null): Alan {
  return { id: yeniId(), ad, agac };
}

/** Liste boşken `etkin` bu: hiçbir alanın kimliği olamayacak bir değer. */
const YOK = "";

/**
 * Diskten okur ve **iki eski biçimden göç eder.**
 *
 * `ham` bu anahtarın kendi kaydı; `eskiAgac` ise Aşama 23'ten önceki tek ağaç
 * (`pcbridge.panes`, ki o da kendi içinde düz diziden göç ediyor).
 *
 * **Hiç kayıt yoksa tek bir alanla başlar.** Sıfır alan geçerli bir durum ama
 * ilk açılışın hâli değil: oraya kullanıcı hepsini kapatarak varıyor, ve o
 * kayıt `coz` tarafından olduğu gibi korunuyor.
 */
export function oku(
  ham: string | null,
  eskiAgac: string | null,
  varsayilanAd: string,
): AlanDurum {
  const v = coz(ham);
  if (v) return v;
  return tek(alanYap(varsayilanAd, okuAgac(eskiAgac)));
}

function tek(a: Alan): AlanDurum {
  return { s: 2, alanlar: [a], etkin: a.id };
}

function coz(ham: string | null): AlanDurum | null {
  if (!ham) return null;
  let v: unknown;
  try {
    v = JSON.parse(ham);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const d = v as Record<string, unknown>;
  if (d.s !== 2 || !Array.isArray(d.alanlar)) return null;

  // Bozuk bir kayıt arayüzü çökertmesin: ağaç `agac.oku`'nun kendi
  // doğrulayıcısından geçiyor, adı olmayan alan atılıyor.
  const alanlar: Alan[] = [];
  for (const x of d.alanlar) {
    if (!x || typeof x !== "object") continue;
    const a = x as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.ad !== "string") continue;
    alanlar.push({
      id: a.id,
      ad: a.ad,
      agac: a.agac ? okuAgac(JSON.stringify(a.agac)) : null,
      ...(typeof a.dizin === "string" && a.dizin ? { dizin: a.dizin } : {}),
    });
  }
  // ⚠️ **Boş liste geçerli**, ama "hepsi bozuktu" değil: kayıtta alan varken
  // hiçbiri doğrulamadan geçmediyse elimizde bir şey yok demektir ve göç
  // yoluna düşmek doğru olanı. Kayıtta hiç alan yoksa kullanıcı hepsini
  // kapatmıştır ve o durum korunmalı.
  if (alanlar.length === 0 && d.alanlar.length > 0) return null;
  const etkin =
    typeof d.etkin === "string" && alanlar.some((a) => a.id === d.etkin)
      ? d.etkin
      : (alanlar[0]?.id ?? YOK);
  return { s: 2, alanlar, etkin };
}

/** Etkin alan — hiç alan yoksa `null`. */
export function etkinAlan(d: AlanDurum): Alan | null {
  return d.alanlar.find((a) => a.id === d.etkin) ?? d.alanlar[0] ?? null;
}

export function etkinAgac(d: AlanDurum): Dugum | null {
  return etkinAlan(d)?.agac ?? null;
}

/** Etkin alanın varsayılan klasörü — yeni terminal oradan doğuyor. */
export function etkinDizin(d: AlanDurum): string | undefined {
  return etkinAlan(d)?.dizin;
}

/**
 * Etkin alanın ağacını değiştirir; ötekiler dokunulmaz.
 *
 * **Hiç alan yokken ağaç yazmak alanı kurar.** Kullanıcının şartı: *"yeni bir
 * terminal açmak için önceden grup oluşturmak zorunlu olmamalı."* Boş bir ağaç
 * için kurmuyor — son bölmeyi kapatmak boş bir grup doğurmamalı.
 */
export function agacYaz(
  d: AlanDurum,
  agac: Dugum | null,
  varsayilanAd: string,
): AlanDurum {
  const etkin = etkinAlan(d);
  if (!etkin) {
    if (!agac) return d;
    const a = alanYap(varsayilanAd, agac);
    return { ...d, alanlar: [a], etkin: a.id };
  }
  return {
    ...d,
    alanlar: d.alanlar.map((a) => (a.id === etkin.id ? { ...a, agac } : a)),
  };
}

/** `session` → alan adı. Kenar çubuğu satırı hangi alanda olduğunu yazıyor. */
export function alanHaritasi(d: AlanDurum): Record<string, string> {
  const h: Record<string, string> = {};
  for (const a of d.alanlar) for (const s of oturumlar(a.agac)) h[s] = a.ad;
  return h;
}

export function alanEkle(d: AlanDurum, ad: string): AlanDurum {
  const a = alanYap(ad);
  return { ...d, alanlar: [...d.alanlar, a], etkin: a.id };
}

/**
 * Alanı siler — **sonuncusu dahil.**
 *
 * ⚠️ Eskiden `alanlar.length < 2` iken hiçbir şey yapmıyordu; gerekçe
 * "sekmesiz bir terminal kipi çizilemez" idi. Kullanıcı 2026-09-09'da tersini
 * istedi ve gerekçe zaten yanlıştı: sıfır sekme çizilebilir bir durum, yeni
 * terminal de alanı kendiliğinden kuruyor (`agacYaz`).
 *
 * Silinen alandaki oturumlar tmux'ta yaşamaya devam eder; PTY'lerini çağıran
 * kapatıyor (`dusenler`).
 */
export function alanSil(
  d: AlanDurum,
  id: string,
): { durum: AlanDurum; dusenler: string[] } {
  const kalan = d.alanlar.filter((a) => a.id !== id);
  if (kalan.length === d.alanlar.length) return { durum: d, dusenler: [] };
  const dusenler = oturumlar(d.alanlar.find((a) => a.id === id)?.agac ?? null);
  const etkin = kalan.some((a) => a.id === d.etkin)
    ? d.etkin
    : (kalan[0]?.id ?? YOK);
  return { durum: { ...d, alanlar: kalan, etkin }, dusenler };
}

/**
 * Alanın varsayılan klasörünü yazar; boş dizge onu **siler** ve alan yeniden
 * `~`'da doğuran davranışa döner. Bölme başlığındaki klasör düğmesinin
 * alan karşılığı.
 */
export function alanKlasor(
  d: AlanDurum,
  id: string,
  dizin: string,
): AlanDurum {
  const kirpik = dizin.trim();
  return {
    ...d,
    alanlar: d.alanlar.map((a) => {
      if (a.id !== id) return a;
      if (!kirpik) {
        const { dizin: _dusen, ...kalan } = a;
        return kalan;
      }
      return { ...a, dizin: kirpik };
    }),
  };
}

export function alanAdlandir(d: AlanDurum, id: string, ad: string): AlanDurum {
  const kirpik = ad.trim();
  if (!kirpik) return d;
  return {
    ...d,
    alanlar: d.alanlar.map((a) => (a.id === id ? { ...a, ad: kirpik } : a)),
  };
}

export function etkinYap(d: AlanDurum, id: string): AlanDurum {
  return d.alanlar.some((a) => a.id === id) ? { ...d, etkin: id } : d;
}

/** Oturumu **bütün** alanların ağacından düşürür. */
export function oturumDus(d: AlanDurum, session: string): AlanDurum {
  return {
    ...d,
    alanlar: d.alanlar.map((a) => {
      const yaprak = oturumaGore(a.agac, session);
      if (!yaprak || !a.agac) return a;
      return { ...a, agac: kapat(a.agac, yaprak.id) };
    }),
  };
}

/**
 * Oturumu başka bir alana taşır ve **orayı etkin yapar.**
 *
 * Etkin yapmak kasıtlı: taşıdığı terminalin nereye gittiğini görmeyen
 * kullanıcı için "kayboldu" gibi görünürdü.
 */
export function oturumTasi(
  d: AlanDurum,
  session: string,
  hedefId: string,
): AlanDurum {
  if (!d.alanlar.some((a) => a.id === hedefId)) return d;
  const bos = oturumDus(d, session);
  return {
    ...bos,
    alanlar: bos.alanlar.map((a) =>
      a.id === hedefId ? { ...a, agac: ekle(a.agac, session) } : a,
    ),
    etkin: hedefId,
  };
}
