import { listen } from "@tauri-apps/api/event";

import type { PtyData } from "./types";

/**
 * PTY olaylarının **tek** dinleyicisi.
 *
 * ⚠️ Rust `pty://data`'yı **yayın** olarak gönderiyor (adresli değil) ve her
 * `Term` kendi `listen`'ını kurup kendi olmayanı atıyordu. Dört bölmede
 * sorun değil; bölme sayısı serbestleşince her bayt her bölmede bir kez
 * çözülüyor ve O(n²) oluyor.
 *
 * Burada tek abonelik var, dağıtım oturum adına göre bir haritadan.
 * Dinleyicisi olmayan olay sessizce düşüyor — bölme kapanırken gelen son
 * baytlar için doğru davranış.
 */
type Veri = (b64: string) => void;
type Cikis = () => void;

const veriler = new Map<string, Set<Veri>>();
const cikislar = new Map<string, Set<Cikis>>();

let kuruldu = false;

function kur() {
  if (kuruldu) return;
  kuruldu = true;
  void listen<PtyData>("pty://data", (e) => {
    const dinleyenler = veriler.get(e.payload.session);
    if (dinleyenler) for (const f of dinleyenler) f(e.payload.b64);
  });
  void listen<{ session: string }>("pty://exit", (e) => {
    const dinleyenler = cikislar.get(e.payload.session);
    if (dinleyenler) for (const f of dinleyenler) f();
  });
}

function abone<T>(
  harita: Map<string, Set<T>>,
  session: string,
  f: T,
): () => void {
  kur();
  let kume = harita.get(session);
  if (!kume) {
    kume = new Set();
    harita.set(session, kume);
  }
  kume.add(f);
  return () => {
    const k = harita.get(session);
    if (!k) return;
    k.delete(f);
    if (k.size === 0) harita.delete(session);
  };
}

export const veriDinle = (session: string, f: Veri) =>
  abone(veriler, session, f);
export const cikisDinle = (session: string, f: Cikis) =>
  abone(cikislar, session, f);
