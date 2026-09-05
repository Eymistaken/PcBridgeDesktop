import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";

import { cikisDinle, veriDinle } from "../lib/ptybus";
import { ptyOpen, ptyResize, ptyWrite } from "../lib/ipc";

interface Props {
  session: string;
  workdir?: string;
  onExit?: () => void;
  /** PTY gerçekten açıldıktan sonra — oturum listesi ancak o zaman günceldir. */
  onOpened?: () => void;
}

/**
 * Hücre yüksekliği. **1.0'a yakın olmak zorunda:** TUI'ler (Claude Code,
 * Antigravity) çerçevelerini `─ │ ╭ ╯` ve blok karakterleriyle çiziyor.
 * Yüksek satır aralığında bu karakterler hücreyi doldurmaz ve dikey çizgiler
 * kopuk kopuk görünür — "terminal garip duruyor"un sebebi buydu.
 */
const SATIR = 1.15;

/** Tam sayı: kesirli boyut hücre genişliğini kesirli yapar ve ızgara kayar. */
const PUNTO = 13;

/** Tokenlardan okunan renkler — terminal de kabuğun paletini kullanır. */
function palet() {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    background: v("--well"),
    // Kuyu iki temada da koyu; metni `--text`'ten almak aydınlıkta 1.09:1
    // veriyordu — terminal okunmuyordu. `--well-text` tema değişse de sabit.
    foreground: v("--well-text"),
    cursor: v("--well-text"),
    selectionBackground: v("--surface-2"),
    black: v("--well"),
    red: v("--fail"),
    green: v("--ok"),
    yellow: v("--run"),
    blue: v("--blue"),
    magenta: v("--magenta"),
    cyan: v("--cyan"),
    white: v("--well-text"),
    brightBlack: v("--well-muted"),
    brightRed: v("--fail"),
    brightGreen: v("--ok"),
    brightYellow: v("--run"),
    brightBlue: v("--blue"),
    brightMagenta: v("--magenta"),
    brightCyan: v("--cyan"),
    brightWhite: v("--well-text"),
  };
}

export default function Term({ session, workdir, onExit, onOpened }: Props) {
  const kap = useRef<HTMLDivElement>(null);
  const cikis = useRef(onExit);
  cikis.current = onExit;
  const acildi = useRef(onOpened);
  acildi.current = onOpened;

  useEffect(() => {
    const el = kap.current;
    if (!el) return;

    let canli = true;
    const sokulecek: Array<() => void> = [];

    /**
     * **Yazı tipi ÖNCE yüklenir, terminal sonra kurulur.** xterm hücre
     * genişliğini `open()` anında bir kez ölçüyor; Geist Mono o an hazır
     * değilse ölçü yedek yazı tipinden çıkıyor, sütun sayısı yanlış
     * hesaplanıyor ve tmux'a yanlış genişlik gidiyor — CLI kendini görünen
     * alandan başka bir ene çiziyor. `fonts.ready` tek başına yetmez:
     * `@fontsource` yüz tanımları tembel, istenmeyen bir yazı tipi için
     * "bekleyen yükleme" yoktur ve `ready` hemen çözülür. `load()` isteği
     * açıkça başlatır.
     */
    const yaziHazir = document.fonts
      ? document.fonts
          .load(`${PUNTO}px "Geist Mono"`)
          .then(() => document.fonts.ready)
      : Promise.resolve();

    void yaziHazir.then(() => {
      if (canli) kur(el);
    });

    function kur(kap: HTMLDivElement) {
      const term = new Terminal({
        fontFamily: getComputedStyle(document.documentElement)
          .getPropertyValue("--mono")
          .trim(),
        fontSize: PUNTO,
        lineHeight: SATIR,
        cursorBlink: true,
        // Kutu-çizim ve blok karakterlerini xterm kendi çiziyor, yazı tipinin
        // glif metriğine bırakmıyor: TUI çerçeveleri hücreye tam oturuyor.
        customGlyphs: true,
        // Kabuk paletiyle aynı; ayrı bir tema uydurmuyoruz.
        theme: palet(),
        allowProposedApi: true,
        scrollback: 10000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);

      // Unicode 11: emoji ve CJK'nın hücre genişliği doğru hesaplansın. Yanlış
      // genişlik satırın kalanını kaydırır ve TUI çerçevesini bozar.
      const uni = new Unicode11Addon();
      term.loadAddon(uni);
      term.unicode.activeVersion = "11";

      term.open(kap);

      /*
       * **WebGL çizici YOK — WebKitGTK'da hiç çizmiyor.**
       *
       * Ölçüldü (2026-09-03): aynı sayfa, aynı 1,5 saniye, hiçbir girdi olayı
       * olmadan alınan gerçek widget görüntüsü — WebGL açıkken tuval **bomboş**,
       * kapalıyken yazı yerinde. Belirti kullanıcının tarif ettiğinin aynısı:
       * bir harf, bir sonraki tuşa basılana kadar hiç belirmiyor. Girdi olayı
       * tam yeniden çizim tetikliyor ve o zaman görünüyor.
       *
       * Hız gerekçesi de düştü: 2000 satırlık yazma DOM çizicide 46 ms, WebGL'de
       * 43 ms — ölçülebilir bir fark yok. `customGlyphs` artık `Terminal`
       * seçeneği; kutu-çizim ve blok karakterleri DOM çizicide de hücreye tam
       * oturuyor (çerçeve görüntüsüyle doğrulandı).
       */

      const cozucu = new TextDecoder();
      let sonCols = 0;
      let sonRows = 0;
      let zaman: ReturnType<typeof setTimeout> | undefined;

      /** Ölçüp yalnızca boyut GERÇEKTEN değiştiyse tmux'a haber verir. */
      const boyutla = () => {
        if (!canli) return;
        try {
          fit.fit();
        } catch {
          // Bölme henüz ölçülemiyorsa sonraki turda düzelir.
          return;
        }
        if (term.cols === sonCols && term.rows === sonRows) return;
        sonCols = term.cols;
        sonRows = term.rows;
        void ptyResize(session, term.cols, term.rows).catch(() => {});
      };

      // Pencere sürüklenirken ResizeObserver onlarca kez ateşler; her biri
      // tmux'a tam yeniden çizim yaptırır. Son ölçüyü bekle.
      const gecikmeliBoyutla = () => {
        clearTimeout(zaman);
        zaman = setTimeout(boyutla, 90);
      };

      // Abonelik **ortak veri yolundan** (`lib/ptybus.ts`): Rust yayın
      // gönderiyor ve her bölme kendi `listen`'ını kursaydı her bayt her
      // bölmede bir kez çözülürdü — bölme sayısı serbestleşince O(n²).
      sokulecek.push(
        veriDinle(session, (b64) => {
          const ham = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          // stream:true — çok baytlı karakter parça sınırına denk gelirse bozulmasın.
          term.write(cozucu.decode(ham, { stream: true }));
        }),
      );
      sokulecek.push(cikisDinle(session, () => cikis.current?.()));

      // Önce ölç, sonra o boyutla tmux'a bağlan.
      try {
        fit.fit();
      } catch {
        /* ölçülemedi, varsayılanla açılır */
      }
      sonCols = term.cols;
      sonRows = term.rows;
      void ptyOpen(session, term.cols, term.rows, workdir)
        .then(() => {
          // Oturum ancak burada var olmuş olur; liste bundan önce tazelenirse
          // yeni oturumu göremez.
          if (canli) acildi.current?.();
        })
        .catch((err) => {
          term.write(
            `\r\n\x1b[31m${String((err as { detail?: string })?.detail ?? err)}\x1b[0m\r\n`,
          );
        });

      const veri = term.onData((d) => {
        void ptyWrite(session, d).catch(() => {});
      });
      sokulecek.push(() => veri.dispose());

      const gozlemci = new ResizeObserver(gecikmeliBoyutla);
      gozlemci.observe(kap);
      sokulecek.push(() => gozlemci.disconnect());

      // Tema değişince terminal eski paletinde kalmasın. Bileşen yeniden
      // kurulmuyor (bölme açık kalıyor), o yüzden dışarıdan izlemek gerek.
      const temayiTazele = () => {
        if (canli) term.options.theme = palet();
      };
      const nitelik = new MutationObserver(temayiTazele);
      nitelik.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      sokulecek.push(() => nitelik.disconnect());

      const sistem = window.matchMedia("(prefers-color-scheme: light)");
      sistem.addEventListener("change", temayiTazele);
      sokulecek.push(() => sistem.removeEventListener("change", temayiTazele));

      sokulecek.push(() => {
        clearTimeout(zaman);
        term.dispose();
      });
    }

    return () => {
      canli = false;
      sokulecek.forEach((f) => f());
      // PTY'yi burada kapatmıyoruz: bölme yeniden çizilirse aynı oturuma
      // bağlı kalmalı. Kapatma açık bir eylem (pty_close).
    };
  }, [session, workdir]);

  return <div className="term" ref={kap} />;
}
