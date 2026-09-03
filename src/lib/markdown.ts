/**
 * Modelin yazdığı markdown'ı çözümler.
 *
 * **Neden kütüphane değil:** bu depo kendi açılır listesini, kendi menüsünü
 * yazdı; bir markdown kütüphanesi otuz küsur geçişli bağımlılık getiriyor ve
 * çıktısının her öğesini tasarım tokenlarına oturtmak yine elle iş. Buradaki
 * çözümleyici **React öğesi** üretiyor, HTML dizgesi değil — yani
 * `dangerouslySetInnerHTML` hiç kullanılmıyor ve modelin metni hiçbir koşulda
 * işaretlemeye dönüşemiyor.
 *
 * Kapsam modelin fiilen yazdıkları: başlık · kod bloğu · alıntı · liste ·
 * **GFM tablosu** · yatay çizgi · paragraf; satır içinde kalın, eğik, kod,
 * üstü çizili ve bağlantı.
 */

export type Satirici =
  | { t: "metin"; v: string }
  | { t: "kalin"; c: Satirici[] }
  | { t: "egik"; c: Satirici[] }
  | { t: "kod"; v: string }
  | { t: "cizili"; c: Satirici[] }
  | { t: "bag"; c: Satirici[]; url: string };

export type Blok =
  | { t: "p"; c: Satirici[] }
  | { t: "baslik"; seviye: number; c: Satirici[] }
  | { t: "kod"; dil: string | null; v: string }
  | { t: "alinti"; c: Blok[] }
  | { t: "liste"; sirali: boolean; basla: number; ogeler: Blok[][] }
  | { t: "tablo"; basliklar: Satirici[][]; hizalar: Hiza[]; satirlar: Satirici[][][] }
  | { t: "cizgi" };

export type Hiza = "sol" | "orta" | "sag";

// ────────────────────────────── satır içi ──────────────────────────────

/** `**` `*` `_` `` ` `` `~~` `[..](..)` — iç içe geçebilirler. */
export function satirIci(s: string): Satirici[] {
  const out: Satirici[] = [];
  let düz = "";

  const bosalt = () => {
    if (düz) {
      out.push({ t: "metin", v: düz });
      düz = "";
    }
  };

  let i = 0;
  while (i < s.length) {
    const c = s[i];

    // Ters bölü bir sonraki işareti kaçırır.
    if (c === "\\" && i + 1 < s.length && "\\`*_~[]".includes(s[i + 1])) {
      düz += s[i + 1];
      i += 2;
      continue;
    }

    // Satır içi kod: içindeki hiçbir işaret yorumlanmaz.
    if (c === "`") {
      const kapanis = s.indexOf("`", i + 1);
      if (kapanis > i) {
        bosalt();
        out.push({ t: "kod", v: s.slice(i + 1, kapanis) });
        i = kapanis + 1;
        continue;
      }
    }

    // İki karakterli işaretler. **`for` içinden `continue` dış döngüyü
    // sürdürmez** — eşleşme bir bayrakla dışarı taşınıyor.
    let eslesti = false;
    for (const [isaret, tip] of [
      ["**", "kalin"],
      ["__", "kalin"],
      ["~~", "cizili"],
    ] as const) {
      if (!s.startsWith(isaret, i)) continue;
      const kapanis = s.indexOf(isaret, i + isaret.length);
      if (kapanis <= i) continue;
      bosalt();
      out.push({ t: tip, c: satirIci(s.slice(i + isaret.length, kapanis)) });
      i = kapanis + isaret.length;
      eslesti = true;
      break;
    }
    if (eslesti) continue;

    // Kapanışı olmayan çift işaret düz metindir; tek karakterli eğik
    // kuralına düşüp `*` yiyip bitirmesin diye burada tüketiliyor.
    if (s.startsWith("**", i) || s.startsWith("__", i) || s.startsWith("~~", i)) {
      düz += s.slice(i, i + 2);
      i += 2;
      continue;
    }

    // Eğik: tek `*` ya da `_`. `_` sözcük ortasında yorumlanmaz
    // (`fs_read_file` kalın olmamalı).
    if (c === "*" || (c === "_" && (i === 0 || /[\s([{]/.test(s[i - 1])))) {
      const kapanis = s.indexOf(c, i + 1);
      if (kapanis > i + 1) {
        bosalt();
        out.push({ t: "egik", c: satirIci(s.slice(i + 1, kapanis)) });
        i = kapanis + 1;
        continue;
      }
    }

    // Bağlantı: [metin](url)
    if (c === "[") {
      const kapali = s.indexOf("]", i);
      if (kapali > i && s[kapali + 1] === "(") {
        const urlSon = s.indexOf(")", kapali + 2);
        if (urlSon > kapali) {
          bosalt();
          out.push({
            t: "bag",
            c: satirIci(s.slice(i + 1, kapali)),
            url: s.slice(kapali + 2, urlSon).trim(),
          });
          i = urlSon + 1;
          continue;
        }
      }
    }

    düz += c;
    i++;
  }
  bosalt();
  return out;
}

// ─────────────────────────────── bloklar ───────────────────────────────

const TABLO_AYIRICI = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** GFM tablo satırını hücrelere böler; kenar `|`'ları düşer. */
function hucreler(satir: string): string[] {
  let s = satir.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  // Kaçırılmış `\|` hücre sınırı değil.
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += s[i];
    }
  }
  out.push(cur.trim());
  return out;
}

function hizalar(ayirici: string): Hiza[] {
  return hucreler(ayirici).map((h) => {
    const bas = h.startsWith(":");
    const son = h.endsWith(":");
    return bas && son ? "orta" : son ? "sag" : "sol";
  });
}

export function markdown(kaynak: string): Blok[] {
  const satirlar = kaynak.replace(/\r\n?/g, "\n").split("\n");
  const out: Blok[] = [];
  let i = 0;

  while (i < satirlar.length) {
    const satir = satirlar[i];

    // Boş satır blokları ayırır.
    if (!satir.trim()) {
      i++;
      continue;
    }

    // Kod bloğu — içindeki hiçbir şey yorumlanmaz.
    const cit = satir.match(/^\s*```+\s*([\w+#-]*)\s*$/);
    if (cit) {
      const dil = cit[1] || null;
      const govde: string[] = [];
      i++;
      while (i < satirlar.length && !/^\s*```+\s*$/.test(satirlar[i])) {
        govde.push(satirlar[i]);
        i++;
      }
      i++; // kapanış çiti
      out.push({ t: "kod", dil, v: govde.join("\n") });
      continue;
    }

    // Başlık
    const bas = satir.match(/^(#{1,6})\s+(.*)$/);
    if (bas) {
      out.push({ t: "baslik", seviye: bas[1].length, c: satirIci(bas[2].trim()) });
      i++;
      continue;
    }

    // Yatay çizgi
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(satir)) {
      out.push({ t: "cizgi" });
      i++;
      continue;
    }

    // Tablo: başlık satırı + ayırıcı
    if (satir.includes("|") && i + 1 < satirlar.length && TABLO_AYIRICI.test(satirlar[i + 1])) {
      const basliklar = hucreler(satir).map(satirIci);
      const hiz = hizalar(satirlar[i + 1]);
      i += 2;
      const govde: Satirici[][][] = [];
      while (i < satirlar.length && satirlar[i].includes("|") && satirlar[i].trim()) {
        govde.push(hucreler(satirlar[i]).map(satirIci));
        i++;
      }
      out.push({ t: "tablo", basliklar, hizalar: hiz, satirlar: govde });
      continue;
    }

    // Alıntı
    if (/^\s*>/.test(satir)) {
      const govde: string[] = [];
      while (i < satirlar.length && /^\s*>/.test(satirlar[i])) {
        govde.push(satirlar[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push({ t: "alinti", c: markdown(govde.join("\n")) });
      continue;
    }

    // Liste
    const oge = satir.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (oge) {
      const sirali = /\d/.test(oge[2]);
      const girinti = oge[1].length;
      // Sıralı liste 1'den başlamayabilir; `<ol start>` onu koruyor.
      const basla = sirali ? parseInt(oge[2], 10) : 1;
      const ogeler: Blok[][] = [];
      while (i < satirlar.length) {
        const m = satirlar[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        // Aynı kademede ve aynı türde olmayan satır listeyi bitirir.
        if (!m || m[1].length !== girinti || /\d/.test(m[2]) !== sirali) break;
        const govde = [m[3]];
        i++;
        // **Daha derin girintili her satır bu öğeye ait** — iç içe liste
        // dahil. Eskiden liste işareti taşıyan girintili satır dışarıda
        // kalıyor, sıralı liste ikiye bölünüyor ve numaralar 1'den yeniden
        // başlıyordu (ölçüldü).
        const ic: string[] = [];
        while (
          i < satirlar.length &&
          satirlar[i].trim() &&
          (satirlar[i].match(/^\s*/)?.[0].length ?? 0) > girinti
        ) {
          ic.push(satirlar[i]);
          i++;
        }
        if (ic.length) {
          // Bir kademe sola çek: iç blok kendi başına çözümlenecek.
          const enAz = Math.min(...ic.map((l) => l.match(/^\s*/)?.[0].length ?? 0));
          govde.push(...ic.map((l) => l.slice(enAz)));
        }
        ogeler.push(markdown(govde.join("\n")));
      }
      out.push({ t: "liste", sirali, basla, ogeler });
      continue;
    }

    // Paragraf — sonraki boş satıra ya da yeni bir blok başlangıcına kadar.
    const govde: string[] = [];
    while (i < satirlar.length && satirlar[i].trim()) {
      const s = satirlar[i];
      if (
        /^\s*```/.test(s) ||
        /^#{1,6}\s/.test(s) ||
        /^\s*>/.test(s) ||
        /^(\s*)([-*+]|\d+[.)])\s/.test(s) ||
        (govde.length > 0 && s.includes("|") && TABLO_AYIRICI.test(satirlar[i + 1] ?? ""))
      ) {
        break;
      }
      govde.push(s);
      i++;
    }
    if (govde.length) out.push({ t: "p", c: satirIci(govde.join("\n")) });
  }

  return out;
}
