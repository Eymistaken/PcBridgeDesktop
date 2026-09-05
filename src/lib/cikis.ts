import { useEffect, useRef, useState } from "react";

/**
 * Çıkış devinimi için sökülmeyi geciktiren kanca.
 *
 * **Neden gerekiyor:** React `{acik && <X/>}` yazan her yerde öğeyi bir
 * karede söküyor. Uygulamanın devinim katmanı baştan beri yalnızca **giriş**
 * taşıyordu — her şey yumuşak beliriyor, hiçbir şey yumuşak gitmiyordu; kapanan
 * menü, kapanan BotForge, yanıtlanan izin sorusu hepsi bir karede yok oluyordu.
 * "Bitmemiş" hissinin en büyük kaynağı buydu.
 *
 * **Neden kütüphane değil:** `framer-motion` sınıfı bir bağımlılık bu deponun
 * "Markdown kendi kütüphanesini getirmez" çizgisine aykırı. Tek ihtiyaç
 * sökmeyi geciktirmek; onu da bir `setTimeout` yapıyor.
 *
 * Kullanımı — dönen `cikiyor` kök öğeye `data-cikis` olarak konur, CSS çıkış
 * kareleri oradan tetiklenir:
 *
 * ```tsx
 * const { render, cikiyor } = useCikis(acik);
 * return render ? <div className="pop" data-cikis={cikiyor || undefined} /> : null;
 * ```
 *
 * ⚠️ `data-cikis` **`undefined` ile silinmeli**, `false` ile değil: React
 * `data-*` niteliklerine `false` yazınca `data-cikis="false"` çıkıyor ve
 * `[data-cikis]` seçicisi ona da uyuyor — yani öğe açılır açılmaz çıkış
 * devinimini oynatırdı.
 */
export function useCikis(acik: boolean, sure?: number): { render: boolean; cikiyor: boolean } {
  const [render, setRender] = useState(acik);
  const [cikiyor, setCikiyor] = useState(false);

  useEffect(() => {
    if (acik) {
      setRender(true);
      setCikiyor(false);
      return;
    }
    if (!render) return;

    setCikiyor(true);
    const zamanlayici = window.setTimeout(() => {
      setCikiyor(false);
      setRender(false);
    }, sure ?? cikisSuresi());
    return () => window.clearTimeout(zamanlayici);
  }, [acik, render, sure]);

  return { render, cikiyor };
}

/**
 * `useCikis`'in **veri taşıyan** hâli: açıklık bir değerin varlığından geliyorsa.
 *
 * `{silinecek && <Onay bot={silinecek} />}` deseninde değer `undefined`
 * olduğu anda içerik de gidiyor — çıkış devinimi boyunca gösterilecek ad
 * kalmıyordu ("… silinsin mi?" bir karede "undefined silinsin mi?" olurdu).
 * Bu yüzden son dolu değer saklanıyor ve devinim boyunca o çiziliyor.
 */
export function useCikisIcerik<T>(deger: T | undefined | null): {
  icerik: T | undefined;
  render: boolean;
  cikiyor: boolean;
} {
  const son = useRef<T>(undefined);
  if (deger !== undefined && deger !== null) son.current = deger;
  const { render, cikiyor } = useCikis(deger !== undefined && deger !== null);
  return { icerik: render ? son.current : undefined, render, cikiyor };
}

/**
 * Listeden **düşen** öğeyi devinim süresi kadar yerinde tutar.
 *
 * ⚠️ **Filtreye uygulanmaz, yalnızca gerçek listeye.** Kenar çubuğunda arama
 * kutusuna yazarken her tuşta 180 ms takılan bir liste düzeltme değil
 * gerileme olurdu; bu yüzden çağıran, kancayı **süzülmemiş** listeye verip
 * filtreyi sonucun üstüne uygular. Böylece yalnızca gerçekten silinen bot
 * solarak gider.
 *
 * Giden satır **yerini bırakmıyor**: yükseklik çökertmek `height: auto`
 * yüzünden ölçüm ister (bu motorda `interpolate-size` yok, ölçüldü). Onun
 * yerine sıra şu: satır solar (`--dur-base`), söküldükten sonra kalanlar
 * FLIP ile kayar (`useFlip`). İkisi arka arkaya okunaklı bir dizi kuruyor.
 */
export function useCikisListesi<T>(
  liste: T[],
  anahtar: (oge: T) => string,
  sure?: number,
): Array<{ oge: T; cikiyor: boolean }> {
  const [onceki, setOnceki] = useState<T[]>(liste);
  const [gidenler, setGidenler] = useState<Array<{ oge: T; sira: number }>>([]);

  /*
   * ⚠️ **Fark ÇİZİM SIRASINDA alınıyor, etkide değil** — ve bu bir üslup
   * tercihi değil, ölçülmüş bir hatanın düzeltmesi.
   *
   * Önce `useEffect` ile yapılmıştı. Etki boyamadan **sonra** çalıştığı için
   * satır bir kare boyunca listeden düşüyor, altındakiler o karede yukarı
   * atlıyor, sonra etki satırı geri koyunca FLIP onları aşağı kaydırıyordu.
   * WebKitGTK'da ölçüldü: silmeden 30 ms sonra alttaki satır 283 px yerine
   * 233 px'teydi, 150 ms sonra 279'a geri dönüyordu — gözle görülür bir
   * sıçrama. Çizim sırasında kurulan durum React'in kendi "props değişince
   * durumu ayarla" deseni: yeniden çizim boyamadan önce oluyor, ara kare yok.
   */
  if (onceki !== liste) {
    const yeni = new Set(liste.map(anahtar));
    const gidenAnahtarlar = new Set(gidenler.map((g) => anahtar(g.oge)));
    const dusen = onceki
      .map((oge, sira) => ({ oge, sira }))
      .filter(({ oge }) => !yeni.has(anahtar(oge)) && !gidenAnahtarlar.has(anahtar(oge)));
    setOnceki(liste);
    if (dusen.length > 0) setGidenler((g) => [...g, ...dusen]);
  }

  useEffect(() => {
    if (gidenler.length === 0) return;
    const zamanlayici = window.setTimeout(() => setGidenler([]), sure ?? cikisSuresi());
    return () => window.clearTimeout(zamanlayici);
  }, [gidenler, sure]);

  if (gidenler.length === 0) return liste.map((oge) => ({ oge, cikiyor: false }));

  const sonuc = liste.map((oge) => ({ oge, cikiyor: false }));
  // Eski sırasına geri konuyor: sona eklemek satırı ekranın altına atlatırdı.
  for (const { oge, sira } of gidenler) {
    sonuc.splice(Math.min(sira, sonuc.length), 0, { oge, cikiyor: true });
  }
  return sonuc;
}

/** `--dur-base`, ms cinsinden. Bir kez okunur — token koşum sırasında değişmiyor. */
let onbellek: number | null = null;

/**
 * Süre **tokenden** okunuyor, kodda ikinci kez yazılmıyor: `--dur-base`
 * değişince gecikme de değişsin.
 *
 * **Hareket azaltılmışsa sıfır.** Genel `prefers-reduced-motion` bloğu
 * devinimi 0.01 ms'ye indiriyor ama tokene dokunmuyor; o yüzden burada ayrıca
 * bakılmasa öğe görünmez hâlde 180 ms boyunca ekranda durur ve kapanma
 * gecikmeli hissedilirdi. Bu bir erişilebilirlik gereği, tercih değil.
 */
function cikisSuresi(): number {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  if (onbellek !== null) return onbellek;
  const ham = getComputedStyle(document.documentElement).getPropertyValue("--dur-base").trim();
  const sn = ham.endsWith("ms") ? parseFloat(ham) : ham.endsWith("s") ? parseFloat(ham) * 1000 : NaN;
  onbellek = Number.isFinite(sn) && sn > 0 ? sn : 180;
  return onbellek;
}
