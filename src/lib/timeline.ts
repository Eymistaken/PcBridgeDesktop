import type { JobEvent } from "./types";

/** Döküm baloncuğundaki tek satır. */
export interface ToolRow {
  id: string;
  /** Ham araç adı; görünen fiile `i18n::toolVerb` çeviriyor. */
  tool: string;
  detail: string;
  state: "run" | "ok" | "fail";
}

/** Sohbette çizilecek parça. */
export type Block =
  | { t: "text"; text: string }
  | { t: "thinking"; text: string }
  | { t: "tools"; rows: ToolRow[] }
  | { t: "raw"; text: string };

/**
 * Olay akışını baloncuklara böler. Ardışık araç çağrıları **tek** döküm
 * baloncuğunda toplanır — `Main.dc.html`'deki imza hamlesi bu.
 */
export function toBlocks(events: JobEvent[]): Block[] {
  const out: Block[] = [];
  const son = () => out[out.length - 1];

  for (const e of events) {
    switch (e.kind) {
      case "text": {
        const b = son();
        // Ajan metni parça parça gelebilir; ardışık olanları birleştir.
        if (b?.t === "text") b.text += (b.text.endsWith("\n") ? "" : "\n") + e.text;
        else out.push({ t: "text", text: e.text });
        break;
      }
      case "thinking":
        out.push({ t: "thinking", text: e.text });
        break;
      case "toolStart": {
        const b = son();
        const row: ToolRow = { id: e.id, tool: e.tool, detail: e.detail, state: "run" };
        if (b?.t === "tools") b.rows.push(row);
        else out.push({ t: "tools", rows: [row] });
        break;
      }
      case "toolEnd": {
        // Sonuç, ilgili satıra geriye doğru işlenir.
        for (let i = out.length - 1; i >= 0; i--) {
          const b = out[i];
          if (b.t !== "tools") continue;
          const row = b.rows.find((r) => r.id === e.id);
          if (row) {
            row.state = e.ok ? "ok" : "fail";
            break;
          }
        }
        break;
      }
      case "raw": {
        const b = son();
        if (b?.t === "raw") b.text += "\n" + e.text;
        else out.push({ t: "raw", text: e.text });
        break;
      }
      // session ve finished baloncuk üretmez: durum şeridine gider.
      default:
        break;
    }
  }
  return out;
}

/** Akıştaki son `finished` olayı — tur durumu buradan okunur. */
export function finishedOf(events: JobEvent[]) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "finished") return e;
  }
  return undefined;
}
