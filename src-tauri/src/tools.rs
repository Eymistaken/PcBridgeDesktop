//! Araç grupları ve izin kipi.
//!
//! **Bu liste burada, arayüzde değil.** Kip Rust'ta uygulanıyor; grubu
//! TypeScript'te ikinci kez tanımlamak iki listenin ayrışmasına ve "arayüzde
//! masaüstü yazıyordu ama sormadan çalıştı" hatasına açık kapı bırakırdı.
//! Ön yüz grubu `mcp_tools` yanıtındaki `group` alanından okur.

use serde::{Deserialize, Serialize};

/// Araç filtresindeki üç grup.
///
/// Ayrım konfor değil **denetim**: bir bota yazma ya da masaüstü aracı vermek
/// ayrı ve bilinçli bir eylem olmalı. Bir bot güvenilmeyen metin okuyorsa
/// (dosya, e-posta, web) ve elinde kabuk varsa, o metindeki "şu komutu
/// çalıştır" satırı ile kullanıcının isteği model için aynı şeydir.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Grup {
    Read,
    Write,
    Desktop,
}

/// Salt-okunur araçlar: makineyi değiştirmezler.
const OKUMA: &[&str] = &[
    "fs_list",
    "fs_read",
    "fs_search",
    "job_list",
    "job_output",
    "job_status",
    "list_agents",
    "screen_info",
    "system_status",
    "tmux_capture",
    "tmux_list",
    "ui_dump",
    "window_list",
];

/// Ekranı, fareyi, klavyeyi süren ve masaüstü kilidini yöneten araçlar.
const MASAUSTU: &[&str] = &[
    "computer_batch",
    "computer_task",
    "desktop_lock",
    "desktop_unlock",
    "keyboard",
    "mouse",
    "screen_capture",
    "ui_click",
    "ui_set_text",
    "window_focus",
];

/// Bir aracın grubu.
///
/// Masaüstü **ada göre** belirlenir ve sunucunun ipucundan önce gelir:
/// `ui_dump` salt-okunur olabilir ama yine de masaüstü izni ister, ve
/// kullanıcı "bu bot ekranımı görsün mü" sorusuna ayrı yanıt vermeli.
///
/// Tanınmayan bir ad `write` sayılır — bilmediğimiz bir aracı zararsız
/// varsaymak yanlış olur. `read_only` ipucu yalnızca listemizde olmayan yeni
/// araçlar için devreye girer.
pub fn grup(name: &str, read_only: Option<bool>) -> Grup {
    if MASAUSTU.contains(&name) {
        return Grup::Desktop;
    }
    if OKUMA.contains(&name) {
        return Grup::Read;
    }
    if read_only == Some(true) {
        return Grup::Read;
    }
    Grup::Write
}

/// Botun izin kipi: hangi grup çalışmadan önce kullanıcıya sorulacak.
///
/// Araç **filtresi** "bu bot neyi görebilir" sorusunun yanıtı; kip ise "gördüğü
/// şeyi sormadan yapabilir mi" sorusunun. İkisi ayrı sorular: bir bota masaüstü
/// aracı verip yine de her seferinde sorulmasını istemek meşru bir kurulum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Izin {
    /// Yazma ve masaüstü araçları her çağrıda onay ister.
    ///
    /// **Varsayılan.** Diskteki mevcut `bots.json` bu alanı taşımıyor; alanı
    /// olmayan bir botun sessizce en serbest kipe düşmesi kabul edilemez.
    #[default]
    Sor,
    /// Yazma serbest, masaüstü sorar.
    YazmaSerbest,
    /// Hiç sorulmaz — filtredeki her araç doğrudan çalışır.
    Serbest,
}

impl Izin {
    /// Bu grup çalışmadan önce kullanıcıya sorulacak mı?
    ///
    /// Okuma **hiçbir kipte** sormaz: onu araç filtresi zaten karara bağladı,
    /// ikinci kez sormak kipi anlamsız bir gürültüye çevirirdi.
    pub fn sorar(self, g: Grup) -> bool {
        match g {
            Grup::Read => false,
            Grup::Write => self == Izin::Sor,
            Grup::Desktop => self != Izin::Serbest,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gruplar_ada_gore_ayrilir() {
        assert_eq!(grup("fs_read", None), Grup::Read);
        assert_eq!(grup("fs_write", None), Grup::Write);
        assert_eq!(grup("shell_run", None), Grup::Write);
        assert_eq!(grup("ui_click", None), Grup::Desktop);
        assert_eq!(grup("desktop_unlock", None), Grup::Desktop);
    }

    #[test]
    fn masaustu_read_only_ipucunu_yener() {
        // `ui_dump` ve `screen_capture` hiçbir şeyi değiştirmez ama ekranı
        // okur; "salt-okunur" olmaları masaüstü iznini gereksiz kılmaz.
        assert_eq!(grup("ui_dump", Some(true)), Grup::Read, "ui_dump okuma listesinde");
        assert_eq!(grup("screen_capture", Some(true)), Grup::Desktop);
    }

    #[test]
    fn taninmayan_arac_yazma_sayilir() {
        assert_eq!(grup("yepyeni_bir_arac", None), Grup::Write);
        assert_eq!(grup("yepyeni_bir_arac", Some(false)), Grup::Write);
        // Sunucu açıkça "hiçbir şeyi değiştirmiyorum" diyorsa ona güveniliyor.
        assert_eq!(grup("yepyeni_bir_arac", Some(true)), Grup::Read);
    }

    #[test]
    fn listeler_ortusmez_ve_pcbridge_araclarini_kapsar() {
        for ad in OKUMA {
            assert!(!MASAUSTU.contains(ad), "{ad} iki listede birden");
        }
        assert_eq!(OKUMA.len(), 13);
        assert_eq!(MASAUSTU.len(), 10);
    }

    /// **Bu matris `src/lib/types.ts`'teki `SORAR` tablosunda ikizlenir.**
    /// Orası kararı vermiyor — kipi burası uyguluyor — yalnızca arayüzün
    /// "bu kip neye uygulanıyor" diye anlatabilmesi için. Burayı
    /// değiştirirsen orayı da değiştir.
    #[test]
    fn kip_gruplara_dogru_karar_verir() {
        // Okuma hiçbir kipte sorulmaz.
        for k in [Izin::Sor, Izin::YazmaSerbest, Izin::Serbest] {
            assert!(!k.sorar(Grup::Read), "{k:?} okumayı sormamalı");
        }

        assert!(Izin::Sor.sorar(Grup::Write));
        assert!(Izin::Sor.sorar(Grup::Desktop));

        assert!(!Izin::YazmaSerbest.sorar(Grup::Write));
        assert!(Izin::YazmaSerbest.sorar(Grup::Desktop), "masaüstü yine sorulmalı");

        assert!(!Izin::Serbest.sorar(Grup::Write));
        assert!(!Izin::Serbest.sorar(Grup::Desktop));
    }

    #[test]
    fn varsayilan_kip_en_kisitlayici_olan() {
        // Alanı olmayan eski bir bot buraya düşer; sessizce serbest kalmamalı.
        assert_eq!(Izin::default(), Izin::Sor);
    }

    #[test]
    fn kip_tel_bicimi_kebab_case() {
        let j = serde_json::to_string(&Izin::YazmaSerbest).unwrap();
        assert_eq!(j, "\"yazma-serbest\"");
        assert_eq!(
            serde_json::from_str::<Izin>("\"serbest\"").unwrap(),
            Izin::Serbest
        );
    }
}
