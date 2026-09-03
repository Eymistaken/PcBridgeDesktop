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
  | { t: "thinking"; text: string; ms?: number }
  | { t: "tools"; rows: ToolRow[] }
  | { t: "raw"; text: string }
  | { t: "summary"; text: string; dropped: number };

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
        if (b?.t !== "text") {
          out.push({ t: "text", text: e.text });
          break;
        }
        // **Birleştirme kuralını olay söyler.** `delta` bir token akışının
        // parçası: olduğu gibi eklenir, yoksa her kelime alt alta düşer.
        // Aksi hâlde tamamlanmış bir blok ve araya satır atlanır.
        b.text += e.delta ? e.text : (b.text.endsWith("\n") ? "" : "\n") + e.text;
        break;
      }
      case "thinking": {
        // Blok düşünme her zaman yeni baloncuk; token akışı birleştirilir.
        const b = son();
        if (e.delta && b?.t === "thinking") {
          b.text += e.text;
          // Kapanış olayı: metinsiz, yalnızca süreyi taşıyor.
          if (e.ms !== undefined) b.ms = e.ms;
        } else {
          out.push({ t: "thinking", text: e.text, ms: e.ms });
        }
        break;
      }
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
      // Özet birleştirilmez: her biri geçmişte ayrı bir denetim noktası.
      case "summary":
        out.push({ t: "summary", text: e.text, dropped: e.dropped });
        break;
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
