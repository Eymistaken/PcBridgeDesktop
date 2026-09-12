/**
 * Bestecinin session açılışından sohbete **inişi.**
 *
 * Kullanıcının isteği (2026-09-12): *"mesaj gönderme kutusu tam ortada
 * dursun… ilk mesajı gönderince mesaj kutusu aşağıya insin animasyonla."*
 *
 * **Neden ayrı bir modül.** İki besteci aynı besteci değil: session
 * açılışındaki `SessionHome`'un içinde, sohbetteki `Chat`'in yüzen
 * altlığında. İlk mesaj gönderilince biri sökülüp öteki kuruluyor, yani
 * ortada geçirilecek bir öğe yok — yeni kurulan bir öğe geçiş oynatmaz
 * (Aşama 12'de ölçülmüştü). Bu yüzden **konum el değiştiriyor**: söküm
 * anındaki üst kenar kaydediliyor, yeni besteci kurulunca aradaki fark
 * bir kez `transform` olarak konup sıfıra geçiriliyor. `flip.ts`'in
 * yaptığının aynısı, ama iki ayrı bileşen arasında.
 *
 * ⚠️ **Prop olarak geçirilmedi.** `Shell → Chat → Composer` zinciri boyunca
 * bir ref taşımak aynı şeyi daha çok yerde yazmak olurdu; burada tek bir
 * değer var ve ömrü tek bir kare.
 */
let ustKenar: number | null = null;

/**
 * Söküm öncesi ölçüm. `Shell` ilk mesajı gönderirken çağırıyor — o an
 * `SessionHome` hâlâ ekranda.
 */
export function inisiKaydet(): void {
  const el = document.querySelector<HTMLElement>(".home .composer");
  ustKenar = el ? el.getBoundingClientRect().top : null;
}

/**
 * Yeni besteci kurulunca farkı oynatır. Ölçüm **bir kez** tüketiliyor:
 * sonraki mount'ta (session değişimi, kip anahtarı) besteci yerinden
 * zıplamasın.
 */
export function inisiOynat(el: HTMLElement | null): void {
  const bas = ustKenar;
  ustKenar = null;
  if (!el || bas === null) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const dy = bas - el.getBoundingClientRect().top;
  // 2px'in altı zaten yerinde; boşuna bir kare devinim koymayalım.
  if (Math.abs(dy) < 2) return;

  el.style.transition = "none";
  el.style.transform = `translateY(${dy}px)`;
  // ⚠️ Ters konum bir kare **görünmeli**; aynı karede sıfırlamak geçişi
  // yutuyor (`flip.ts` aynı tuzağa düşmüştü).
  requestAnimationFrame(() => {
    el.style.transition = "transform var(--dur-slow) var(--ease-inout)";
    el.style.transform = "";
  });
}
