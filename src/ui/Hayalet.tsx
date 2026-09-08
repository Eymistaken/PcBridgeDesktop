/**
 * Sürükleme hayaleti — imleci izleyen küçük etiket.
 *
 * İki çağıran: bölme başlığı ve kenar çubuğu satırı. Ortak, çünkü konum
 * hesabı (imleçten 14px sağa-aşağı) ve sınıf ikisinde de aynı.
 */
export default function Hayalet({
  ad,
  x,
  y,
}: {
  ad: string;
  x: number;
  y: number;
}) {
  return (
    <div className="hayalet mono" style={{ left: x + 14, top: y + 14 }}>
      {ad}
    </div>
  );
}
