import { useEffect, useRef, useState } from "react";

import { IconBolt, IconCheck, IconShield } from "./Icon";
import { mcpTools } from "../lib/ipc";
import { t } from "../lib/i18n";
import { PERMISSIONS, TOOL_GROUPS, type Permission, type ToolGroup } from "../lib/types";

interface Props {
  value: Permission;
  botName: string;
  /** Botun araç filtresi — kipin neye uygulandığını göstermek için. */
  tools: string[];
  disabled?: boolean;
  onChange: (p: Permission) => void;
  /** Araçları düzenlemek için bot ayarlarını açar. */
  onEditTools: () => void;
}

/**
 * Her kipin kendi ikonu — kip **renkle değil biçimle** anlatılıyor.
 *
 * Kalkan durur ve sorar · tik geçirir · şimşek hiç durmaz. Üçü de
 * `currentColor` kullanıyor: renk yalnızca kimlikten ve durumdan gelir, bir
 * kip ikisi de değildir.
 */
function KipIkonu({ kip }: { kip: Permission }) {
  if (kip === "sor") return <IconShield size={14} />;
  if (kip === "yazma-serbest") return <IconCheck size={14} color="currentColor" strokeWidth={1.8} />;
  return <IconBolt size={14} />;
}

/**
 * Bestecinin altındaki izin kipi menüsü.
 *
 * **Botun kendi alanını yazar**, ayrı bir "oturum kipi" tutmaz. Aynı işi yapan
 * iki denetimden biri er geç ölü kalıyor — bu uygulamada bir kez oldu
 * (`Bot.desktop` bayrağı kaydediliyor ama hiç okunmuyordu) ve kullanıcı ölü
 * anahtarı açıp masaüstü izni verdiğini sandı.
 *
 * **Sayaç satırı da o yüzden var.** Kip "sorulacak mı" der, filtre "görebilecek
 * mi". "Hiç sorma" seçip masaüstü aracı olmayan bir bottan masaüstü işi
 * beklemek doğal bir yanlış anlama — ölçüldü, iki kez oldu. Menü artık kipin
 * **neye** uygulandığını aynı yerde söylüyor.
 *
 * Renk yok: seçim yükselen yüzeyle anlatılıyor. Menü `--field` üstünde duruyor,
 * hover `--surface`'a, seçili satır `--surface-2`'ye çıkıyor. Seçili satırda
 * ipucu metni `--text`'e yükseliyor — `--text-muted` `--surface-2` üstünde
 * 4.07:1 ile AA'nın altında kalıyor ve orada kullanılmıyor.
 */
export default function PermMenu({
  value,
  botName,
  tools,
  disabled,
  onChange,
  onEditTools,
}: Props) {
  const [acik, setAcik] = useState(false);
  const [sayilar, setSayilar] = useState<Record<ToolGroup, number>>();
  const kok = useRef<HTMLDivElement>(null);

  // Dışarı tıklama ve Esc kapatır.
  useEffect(() => {
    if (!acik) return;
    function tikla(e: MouseEvent) {
      if (!kok.current?.contains(e.target as Node)) setAcik(false);
    }
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") setAcik(false);
    }
    document.addEventListener("mousedown", tikla);
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("mousedown", tikla);
      document.removeEventListener("keydown", tus);
    };
  }, [acik]);

  // Grup **Rust'tan** geliyor; burada ikinci bir ad listesi tutulmuyor.
  // Menü açılınca isteniyor: bağlantı yoksa sayaç görünmez, menü çalışır.
  useEffect(() => {
    if (!acik) return;
    let iptal = false;
    void (async () => {
      try {
        const hepsi = await mcpTools();
        if (iptal) return;
        const n: Record<ToolGroup, number> = { read: 0, write: 0, desktop: 0 };
        for (const x of hepsi) if (tools.includes(x.name)) n[x.group] += 1;
        setSayilar(n);
      } catch {
        // pcbridge bağlı değilse sayaç yok. Kip seçimi buna bağlı değil.
      }
    })();
    return () => {
      iptal = true;
    };
  }, [acik, tools]);

  return (
    <div className="permmenu" ref={kok}>
      {acik && (
        <div className="permmenu__pop" role="menu" aria-label={t("perm.menu", { name: botName })}>
          {PERMISSIONS.map((k) => (
            <button
              key={k}
              type="button"
              role="menuitemradio"
              aria-checked={value === k}
              className="permmenu__sec"
              onClick={() => {
                onChange(k);
                setAcik(false);
              }}
            >
              <span className="permmenu__ikon">
                <KipIkonu kip={k} />
              </span>
              <span className="permmenu__metin">
                <span className="permmenu__ad">{t(`perm.${k}`)}</span>
                <span className="permmenu__ipucu">{t(`perm.${k}.hint`)}</span>
              </span>
            </button>
          ))}

          <button
            type="button"
            className="permmenu__filtre"
            onClick={() => {
              setAcik(false);
              onEditTools();
            }}
          >
            <span className="permmenu__sayac">
              {sayilar
                ? TOOL_GROUPS.map((g) => (
                    <span
                      key={g}
                      // Sıfır araçlı grup **soluk değil vurgulu**: kipin o
                      // grupta hiçbir şeye uygulanmadığı görülmesi gereken şey.
                      className={sayilar[g] === 0 ? "permmenu__bos" : undefined}
                    >
                      {t(`forge.toolGroup.${g}`)} {sayilar[g]}
                    </span>
                  ))
                : t("perm.toolsUnknown", { n: tools.length })}
            </span>
            <span className="permmenu__duzenle">{t("perm.editTools")}</span>
          </button>
        </div>
      )}
      <button
        type="button"
        className="permmenu__dugme"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={acik}
        aria-label={t("perm.menu", { name: botName })}
        onClick={() => setAcik((a) => !a)}
      >
        <KipIkonu kip={value} />
        <span>{t(`perm.${value}`)}</span>
        <IconChevron acik={acik} />
      </button>
    </div>
  );
}

/** Menü açılım oku — alana özgü bir ikon değil, `Icon.tsx`'e girmiyor. */
function IconChevron({ acik }: { acik: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ transform: acik ? "rotate(180deg)" : undefined }}
    >
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
