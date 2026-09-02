import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import { ptyOpen, ptyResize, ptyWrite } from "../lib/ipc";
import type { PtyData } from "../lib/types";

interface Props {
  session: string;
  workdir?: string;
  onExit?: () => void;
  /** PTY gerçekten açıldıktan sonra — oturum listesi ancak o zaman günceldir. */
  onOpened?: () => void;
}

/** Tokenlardan okunan renkler — terminal de kabuğun paletini kullanır. */
function palet() {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    background: v("--well"),
    foreground: v("--text"),
    cursor: v("--text"),
    selectionBackground: v("--surface-2"),
    black: v("--well"),
    red: v("--fail"),
    green: v("--ok"),
    yellow: v("--run"),
    blue: v("--blue"),
    magenta: v("--av-mor"),
    cyan: v("--av-cam"),
    white: v("--text"),
    brightBlack: v("--text-muted"),
    brightRed: v("--fail"),
    brightGreen: v("--ok"),
    brightYellow: v("--run"),
    brightBlue: v("--blue"),
    brightMagenta: v("--av-mor"),
    brightCyan: v("--av-cam"),
    brightWhite: v("--text"),
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

    const term = new Terminal({
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--mono").trim(),
      fontSize: 11.5,
      lineHeight: 1.62,
      cursorBlink: true,
      // Kabuk paletiyle aynı; ayrı bir tema uydurmuyoruz.
      theme: palet(),
      allowProposedApi: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);

    let canli = true;
    const cozucu = new TextDecoder();

    const boyutla = () => {
      try {
        fit.fit();
      } catch {
        // Bölme henüz ölçülemiyorsa sonraki turda düzelir.
        return;
      }
      if (canli) void ptyResize(session, term.cols, term.rows).catch(() => {});
    };

    // Açılış: önce ölç, sonra o boyutla tmux'a bağlan.
    try {
      fit.fit();
    } catch {
      /* ölçülemedi, varsayılanla açılır */
    }

    const abone = listen<PtyData>("pty://data", (e) => {
      if (e.payload.session !== session) return;
      const ham = Uint8Array.from(atob(e.payload.b64), (c) => c.charCodeAt(0));
      // stream:true — çok baytlı karakter parça sınırına denk gelirse bozulmasın.
      term.write(cozucu.decode(ham, { stream: true }));
    });
    const aboneCikis = listen<{ session: string }>("pty://exit", (e) => {
      if (e.payload.session === session) cikis.current?.();
    });

    void ptyOpen(session, term.cols, term.rows, workdir)
      .then(() => {
        // `tmux new-session -A` oturumu ancak burada yaratmış olur; liste
        // bundan önce tazelenirse yeni oturumu göremez.
        if (canli) acildi.current?.();

      })
      .catch((err) => {
        term.write(`\r\n\x1b[31m${String((err as { detail?: string })?.detail ?? err)}\x1b[0m\r\n`);
      });

    const veri = term.onData((d) => {
      void ptyWrite(session, d).catch(() => {});
    });

    const gozlemci = new ResizeObserver(boyutla);
    gozlemci.observe(el);

    return () => {
      canli = false;
      gozlemci.disconnect();
      veri.dispose();
      void abone.then((f) => f());
      void aboneCikis.then((f) => f());
      term.dispose();
      // PTY'yi burada kapatmıyoruz: bölme yeniden çizilirse aynı oturuma
      // bağlı kalmalı. Kapatma açık bir eylem (pty_close).
    };
  }, [session, workdir]);

  return <div className="term" ref={kap} />;
}
