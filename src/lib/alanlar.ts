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
}

export interface AlanDurum {
  /** Şema sürümü — göç bunun yokluğuna bakıyor. */
  s: 2;
  alanlar: Alan[];
  /** Etkin alanın `id`'si. Listede yoksa ilk alana düşülür. */
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

/**
 * Diskten okur ve **iki eski biçimden göç eder.**
 *
 * `ham` bu anahtarın kendi kaydı; `eskiAgac` ise Aşama 23'ten önceki tek ağaç
 * (`pcbridge.panes`, ki o da kendi içinde düz diziden göç ediyor). Hiçbiri
 * yoksa boş ama **geçerli** bir durum döner: alan listesi hiç boş kalmaz,
 * yoksa arayüzün her yerinde bir "alan var mı" denetimi gerekirdi.
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
    });
  }
  if (alanlar.length === 0) return null;
  const etkin =
    typeof d.etkin === "string" && alanlar.some((a) => a.id === d.etkin)
      ? d.etkin
      : alanlar[0].id;
  return { s: 2, alanlar, etkin };
}

/** Etkin alan — liste hiç boş olmadığı için her zaman bir tane var. */
export function etkinAlan(d: AlanDurum): Alan {
  return d.alanlar.find((a) => a.id === d.etkin) ?? d.alanlar[0];
}

export function etkinAgac(d: AlanDurum): Dugum | null {
  return etkinAlan(d).agac;
}

/** Etkin alanın ağacını değiştirir; ötekiler dokunulmaz. */
export function agacYaz(d: AlanDurum, agac: Dugum | null): AlanDurum {
  const etkin = etkinAlan(d).id;
  return {
    ...d,
    alanlar: d.alanlar.map((a) => (a.id === etkin ? { ...a, agac } : a)),
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
 * Alanı siler. **Son alan silinmez** — liste boşalırsa arayüzün çizecek
 * sekmesi kalmaz. Silinen alandaki oturumlar tmux'ta yaşamaya devam eder;
 * PTY'lerini çağıran kapatıyor (`dusenler`).
 */
export function alanSil(
  d: AlanDurum,
  id: string,
): { durum: AlanDurum; dusenler: string[] } {
  if (d.alanlar.length < 2) return { durum: d, dusenler: [] };
  const kalan = d.alanlar.filter((a) => a.id !== id);
  if (kalan.length === d.alanlar.length) return { durum: d, dusenler: [] };
  const dusenler = oturumlar(d.alanlar.find((a) => a.id === id)?.agac ?? null);
  const etkin = kalan.some((a) => a.id === d.etkin) ? d.etkin : kalan[0].id;
  return { durum: { ...d, alanlar: kalan, etkin }, dusenler };
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
