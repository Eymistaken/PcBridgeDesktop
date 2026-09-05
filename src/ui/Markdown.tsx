import { Fragment, memo } from "react";

import { markdown, satirIci, type Blok, type Satirici } from "../lib/markdown";

/**
 * Modelin metnini markdown olarak çizer.
 *
 * **HTML dizgesi üretilmiyor:** çözümleyici doğrudan React öğesi veriyor, o
 * yüzden `dangerouslySetInnerHTML` hiç yok ve modelin metni hiçbir koşulda
 * işaretlemeye dönüşemiyor. Her öğe tasarım tokenlarını kullanıyor; markdown
 * kendi rengini getirmiyor.
 */
function MarkdownIc({ text }: { text: string }) {
  return <Bloklar list={markdown(text)} />;
}

/**
 * ⚠️ **`memo` başarım için şart, süs değil.**
 *
 * Akıştaki her parçada `Shell` `turns`'ü yeni bir diziyle değiştiriyor,
 * `Chat` yeniden çiziliyor ve memoize olmayan `Markdown` **bütün** mesajları
 * yeniden ayrıştırıyordu — uzun bir sohbette akış her token'da sohbetin
 * tamamını yeniden çözümlüyor. Tek prop bir dizge, sığ karşılaştırma tam
 * doğru sonucu veriyor.
 */
const Markdown = memo(MarkdownIc);
export default Markdown;

function Bloklar({ list }: { list: Blok[] }) {
  return (
    <>
      {list.map((b, i) => (
        <BlokView key={i} b={b} />
      ))}
    </>
  );
}

function BlokView({ b }: { b: Blok }) {
  switch (b.t) {
    case "p":
      return (
        <p className="md__p">
          <Ic c={b.c} />
        </p>
      );

    case "baslik": {
      // Başlıklar boyutla ayrılıyor, renkle değil — üçüncü bir metin
      // seviyesi yok. `h1` sohbette çok iri durduğu için ölçek sıkı.
      const boy = [16, 15.5, 15, 14.5, 14, 14][b.seviye - 1];
      return (
        <div className="md__baslik" style={{ fontSize: boy }}>
          <Ic c={b.c} />
        </div>
      );
    }

    case "kod":
      return (
        <pre className="md__kod mono">
          {b.dil && <span className="md__dil">{b.dil}</span>}
          <code>{b.v}</code>
        </pre>
      );

    case "alinti":
      return (
        <blockquote className="md__alinti">
          <Bloklar list={b.c} />
        </blockquote>
      );

    case "liste":
      return b.sirali ? (
        <ol className="md__liste" start={b.basla}>
          {b.ogeler.map((o, i) => (
            <li key={i}>
              <Bloklar list={o} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="md__liste">
          {b.ogeler.map((o, i) => (
            <li key={i}>
              <Bloklar list={o} />
            </li>
          ))}
        </ul>
      );

    case "tablo":
      return (
        // Geniş tablo **kendi içinde** kayar; baloncuk asla yatay kaymaz.
        <div className="md__tabloKap">
          <table className="md__tablo">
            <thead>
              <tr>
                {b.basliklar.map((h, i) => (
                  <th key={i} style={{ textAlign: hiza(b.hizalar[i]) }}>
                    <Ic c={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.satirlar.map((r, i) => (
                <tr key={i}>
                  {r.map((h, j) => (
                    <td key={j} style={{ textAlign: hiza(b.hizalar[j]) }}>
                      <Ic c={h} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "cizgi":
      return <div className="md__cizgi" />;
  }
}

function hiza(h: "sol" | "orta" | "sag" | undefined) {
  return h === "orta" ? "center" : h === "sag" ? "right" : "left";
}

function Ic({ c }: { c: Satirici[] }) {
  return (
    <>
      {c.map((p, i) => (
        <Fragment key={i}>
          <Parca p={p} />
        </Fragment>
      ))}
    </>
  );
}

function Parca({ p }: { p: Satirici }) {
  switch (p.t) {
    case "metin":
      return <>{p.v}</>;
    case "kalin":
      return (
        <strong className="md__kalin">
          <Ic c={p.c} />
        </strong>
      );
    case "egik":
      return (
        <em>
          <Ic c={p.c} />
        </em>
      );
    case "cizili":
      return (
        <s>
          <Ic c={p.c} />
        </s>
      );
    case "kod":
      return <code className="md__satirKod mono">{p.v}</code>;
    case "bag":
      // **Gezinme yok.** Uygulamanın dış bağlantı açacak bir eklentisi yok ve
      // webview'ın kendisini başka bir adrese götürmek uygulamayı kaybettirir.
      // Adres ipucunda duruyor; sağ tıkla kopyalanabiliyor.
      return (
        <a
          className="md__bag"
          href={p.url}
          title={p.url}
          onClick={(e) => e.preventDefault()}
        >
          <Ic c={p.c} />
        </a>
      );
  }
}

/** Tek satırlık markdown — başlık, etiket gibi yerler için. */
export function MarkdownSatir({ text }: { text: string }) {
  return <Ic c={satirIci(text)} />;
}
