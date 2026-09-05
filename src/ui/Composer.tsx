import { useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import { IconAttach, IconClose, IconSend } from "./Icon";
import { useCikisListesi } from "../lib/cikis";
import { yukseklikAyarla } from "../lib/yukseklik";
import { t } from "../lib/i18n";

/**
 * Metin alanının tavanı — **tek yerde.**
 *
 * Eskiden `Chat.tsx`'te `168` ve `app.css`'te `max-height: 168px` diye ikizdi;
 * biri değişince öteki sessizce ayrışırdı. CSS artık bu değeri
 * `--besteci-tavan` değişkeninden okuyor.
 */
export const TAVAN = 168;

/**
 * Kaç piksellik metin yüksekliğinden sonra kutu karta dönüşüyor (Seçenek B).
 *
 * Bir satır 36px (20px satır + 16px dolgu), iki satır 56, üç satır 76.
 * Eşik **60**: iki satır stadyumda kalıyor (orada düğmeler ortalı ve sorun
 * yok), üçüncü satırda karta geçiliyor — şikâyet edilen çirkinlik uzun
 * metinde başlıyordu.
 */
const KART_ESIGI = 60;

export interface ComposerHandle {
  focus: () => void;
}

interface Props {
  /** Yer tutucu ve erişilebilirlik etiketi için bot adı. */
  botName: string;
  /** Ek seçerken açılacak başlangıç dizini. */
  workdir: string;
  busy: boolean;
  onSend: (text: string) => void;
  /** Kip menüsü, bağlam çipi, effort seçici — çağıran koyuyor. */
  foot?: ReactNode;
  /** Sıfırlanınca metin ve ekler temizlenir (bot ya da session değişimi). */
  resetKey: string;
  ref?: React.Ref<ComposerHandle>;
}

/**
 * Mesaj yazma alanı.
 *
 * **Kutu iki hâlli.** Tek satırda stadyum (`9999px`), düğmeler satır içinde.
 * İkinci satıra geçince `--r-lg`'ye (20px) dönüşüyor ve düğmeler kendi
 * sırasına iniyor — kullanıcının 2026-09-05'teki seçimi (Seçenek B). Eskiden
 * kutu her yükseklikte stadyumdu ve `align-items: flex-end` yüzünden düğmeler
 * dibe inip yuvarlak köşenin içine giriyordu.
 *
 * Yükseklik `yukseklikAyarla` ile geçiyor; ölçüm için gereken `height: 0`
 * adımı geçişin dışında tutuluyor, yoksa kutu her tuşta sıfıra inip açılırdı.
 */
export default function Composer({
  botName,
  workdir,
  busy,
  onSend,
  foot,
  resetKey,
  ref,
}: Props) {
  const [text, setText] = useState("");
  const [ekler, setEkler] = useState<string[]>([]);
  const alan = useRef<HTMLTextAreaElement>(null);
  const [cokSatir, setCokSatir] = useState(false);

  useImperativeHandle(ref, () => ({ focus: () => alan.current?.focus() }), []);

  // Bot ya da session değişince yarım kalan metin ve ekler karışmasın.
  useEffect(() => {
    setText("");
    setEkler([]);
  }, [resetKey]);

  // Yazdıkça büyüyen alan. İlk çizimde geçiş kapalı: yeni kurulan bir öğe
  // sıfırdan açılıyormuş gibi görünürdü.
  const ilk = useRef(true);
  useEffect(() => {
    const olculen = yukseklikAyarla(alan.current, TAVAN, !ilk.current);
    ilk.current = false;
    setCokSatir(olculen > KART_ESIGI);
  }, [text]);

  // Kaldırılan ek çipi de solarak gitsin.
  const ekListesi = useCikisListesi(ekler, (yol) => yol);

  /**
   * Ek = **yol**, kopya değil. Ajan aynı makinede çalışıyor; dosyayı bir yere
   * yüklemenin anlamı yok, mutlak yolu vermek yeter — ajan kendi okuma
   * aracıyla açar. Yollar prompt'a görünür biçimde ekleniyor: kullanıcı ne
   * gönderdiğini kendi baloncuğunda okuyabilsin.
   */
  async function dosyaSec() {
    const secilen = await open({
      multiple: true,
      title: t("chat.pickFiles"),
      defaultPath: workdir || undefined,
    }).catch(() => null);
    if (!secilen) return;
    const yollar = Array.isArray(secilen) ? secilen : [secilen];
    setEkler((eski) => [...eski, ...yollar.filter((y) => !eski.includes(y))]);
    alan.current?.focus();
  }

  function gonder() {
    const metin = text.trim();
    if (!metin || busy) return;
    onSend(ekler.length > 0 ? `${metin}\n\n${t("chat.attached")}\n${ekler.join("\n")}` : metin);
    setText("");
    setEkler([]);
  }

  const gonderilemez = busy || !text.trim();
  const gonderDugmesi = (
    <button
      type="button"
      className="ib composer__send"
      title={t("chat.send")}
      aria-label={t("chat.send")}
      disabled={gonderilemez}
      onClick={gonder}
    >
      <IconSend />
    </button>
  );
  const ekDugmesi = (
    <button
      type="button"
      className="ib composer__ek"
      title={t("chat.attach")}
      aria-label={t("chat.attach")}
      onClick={() => void dosyaSec()}
    >
      <IconAttach color="var(--text-muted)" />
    </button>
  );

  return (
    <div className="composer">
      {ekler.length > 0 && (
        <div className="ekler">
          {ekListesi.map(({ oge: yol, cikiyor }) => (
            <span key={yol} className="ek" data-cikis={cikiyor || undefined} title={yol}>
              <IconAttach size={13} color="var(--text-muted)" />
              <span className="mono ek__ad">{dosyaAdi(yol)}</span>
              <button
                type="button"
                className="ek__sil"
                title={t("chat.removeAttachment")}
                aria-label={t("chat.removeNamed", { name: dosyaAdi(yol) })}
                onClick={() => setEkler((e) => e.filter((x) => x !== yol))}
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="composer__box" data-cok={cokSatir || undefined}>
        {!cokSatir && ekDugmesi}
        <textarea
          ref={alan}
          className="composer__text"
          rows={1}
          value={text}
          placeholder={t("chat.write", { name: botName })}
          aria-label={t("chat.write", { name: botName })}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter gönderir; Shift+Enter satır atlar.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              gonder();
            }
          }}
        />
        {!cokSatir && gonderDugmesi}
        {cokSatir && (
          <div className="composer__sira">
            {ekDugmesi}
            <span className="mono muted composer__ipucu">{t("chat.enterHint")}</span>
            <div style={{ flexGrow: 1 }} />
            {gonderDugmesi}
          </div>
        )}
      </div>

      {foot && <div className="composer__foot">{foot}</div>}
    </div>
  );
}

/** `/home/x/rapor.md` → `rapor.md` */
export function dosyaAdi(yol: string): string {
  const i = yol.lastIndexOf("/");
  return i < 0 ? yol : yol.slice(i + 1);
}
