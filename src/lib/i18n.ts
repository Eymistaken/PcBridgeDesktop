/**
 * Dil katmanı — kütüphane yok, sözlük burada.
 *
 * **Neden modül düzeyinde bir `t`, context değil:** çeviri yalnızca
 * bileşenlerden değil, `errorText` ve `sayac` gibi düz yardımcılardan da
 * çağrılıyor. Bunlara `t`'yi parametre olarak taşımak on beş imzayı
 * kirletirdi. Etkin dil modülde duruyor; `App` her render'ın **başında**
 * onu duruma göre yerine koyuyor, yani ağaç çizilmeden önce doğru oluyor.
 * Dil değişince `App` yeniden render ediliyor ve bütün alt ağaç onunla
 * birlikte yeniden çiziliyor — ayrışma olmuyor.
 */

export type Lang = "en" | "tr";

/** Varsayılan İngilizce. Sistem dili **sorulmuyor**: seçim açık olsun. */
export const DEFAULT_LANG: Lang = "en";
export const LANGS: readonly Lang[] = ["en", "tr"];

const KEY = "pcbridge.lang";

export function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return v === "tr" || v === "en" ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function writeLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // Kalıcılık kaybolur; uygulama çalışmaya devam eder.
  }
}

let etkin: Lang = DEFAULT_LANG;

/** `App` render'ın başında çağırır — ağaç çizilmeden dil yerine oturur. */
export function setActiveLang(l: Lang) {
  etkin = l;
}

export function activeLang(): Lang {
  return etkin;
}

/** `toLocale*` çağrıları için BCP-47 etiketi. */
export function locale(): string {
  return etkin === "tr" ? "tr-TR" : "en-US";
}

type Vars = Record<string, string | number>;

/**
 * `t("key")` · `t("key", { n: 3 })`.
 *
 * `n` verilirse ve sözlükte `key_one` / `key_other` varsa çoğul seçilir —
 * İngilizcede "1 run" ama "3 runs"; Türkçede sayıdan sonra çoğul eki
 * gelmediği için iki biçim de aynı yazılır.
 */
export function t(key: string, vars?: Vars): string {
  const sozluk = MESSAGES[etkin];
  let ham: string | undefined;

  if (vars && typeof vars.n === "number") {
    ham = sozluk[`${key}_${vars.n === 1 ? "one" : "other"}`];
  }
  ham ??= sozluk[key];
  // Anahtar yoksa İngilizceye düş; o da yoksa anahtarın kendisi görünsün —
  // sessizce boş bırakmak eksik çeviriyi gizler.
  ham ??= MESSAGES.en[key] ?? key;

  return vars ? ham.replace(/\{(\w+)\}/g, (m, ad) => String(vars[ad] ?? m)) : ham;
}

/** Ajanın kullandığı araç adı → görünen fiil. Bilinmeyen ad olduğu gibi kalır. */
export function toolVerb(tool: string): string {
  return MESSAGES[etkin][`tool.${tool}`] ?? MESSAGES.en[`tool.${tool}`] ?? tool;
}

const en: Record<string, string> = {
  // ── açılış ──
  "boot.keyring": "Reading the keyring…",

  // ── karşılama ──
  "welcome.blurb":
    "Paste the server's static token. Once it checks out it is kept only in the system keyring — never written to a file, never printed.",
  "welcome.token": "Static token",
  "welcome.connect": "Connect",
  "welcome.connecting": "Connecting…",
  "welcome.trySaved": "Try the saved token",
  "welcome.deleteSaved": "Delete the saved one",

  // ── kip anahtarı ──
  "mode.label": "Mode",
  "mode.bots": "Bots",
  "mode.terminals": "Terminal",
  "mode.botsTitle": "Bots (Ctrl+1)",
  "mode.terminalsTitle": "Terminal (Ctrl+2)",

  // ── bot kenar çubuğu ──
  "side.newBot": "New bot",
  "side.newBotTitle": "New bot (Ctrl+N)",
  "side.search": "Search bots",
  "side.noBots": "No bots yet",
  "side.noBotsHint": "Press the plus at the top right. A bot is an agent, a model, an effort and a directory.",
  "side.noMatch": "No bot matches “{q}”.",
  "side.edit": "Edit",
  "side.delete": "Delete",
  "side.editBot": "Edit bot {name}",
  "side.deleteBot": "Delete bot {name}",
  "side.refreshing": "refreshing…",
  // İki sayı tek dizgede olsaydı biri hep yanlış çekimlenirdi ("1 agents");
  // parçalar ayrı ve her biri kendi çoğulunu seçiyor.
  "side.toolCount_one": "{n} tool",
  "side.toolCount_other": "{n} tools",
  "side.agentCount_one": "{n} agent",
  "side.agentCount_other": "{n} agents",
  "side.running": "run in progress…",
  "side.noRuns": "no runs yet",
  "side.runs_one": "{n} run",
  "side.runs_other": "{n} runs",
  "side.yesterday": "yesterday",

  // ── şerit ──
  "strip.locked": "Desktop control locked",
  "strip.unlocked": "Desktop control on",
  "strip.minutes": "{n} min",

  // ── terminal kenar çubuğu ──
  "term.newSession": "New session",
  "term.newSessionTitle": "New session (Ctrl+N)",
  "term.sessionName": "session-name",
  "term.newSessionLabel": "New session name",
  "term.noSessions": "No open sessions",
  "term.noSessionsHint": "Press the plus. The session lives in tmux, so it survives closing the app.",
  "term.elsewhere": "Open on the PC, not here",
  "term.alsoOnPc": "also open on the PC",
  "term.kill": "Kill session",
  "term.killNamed": "Kill session {name}",
  "term.sessionCount_one": "{n} session",
  "term.sessionCount_other": "{n} sessions",
  "term.openHere": "{n} open here",

  // ── bölmeler ──
  "panes.0": "No panes",
  "panes.1": "One pane",
  "panes.2": "Two panes",
  "panes.3": "Three panes",
  "panes.4": "Four panes",
  "panes.layout": "Layout",
  "panes.nPanes_one": "{n} pane",
  "panes.nPanes_other": "{n} panes",
  "panes.empty": "No open panes",
  "panes.emptyHint":
    "Click a session in the list on the left, or press the plus to open a new one. Every pane is a real tmux session.",
  "panes.close": "Close pane (the session keeps running)",
  "panes.closeNamed": "Close pane {name}",

  // ── sohbet ──
  "chat.empty": "No conversation yet",
  "chat.emptyHint":
    "Type below. Every message starts a run through agent_run, and the output streams live from out.log.",
  "chat.pickFiles": "Files to hand the agent",
  "chat.attached": "Attached files:",
  "chat.attach": "Attach a file",
  "chat.removeAttachment": "Remove attachment",
  "chat.removeNamed": "Remove attachment {name}",
  "chat.write": "Message {name}",
  "chat.send": "Send",
  "chat.stop": "Stop",
  "chat.stopped": "stopped",
  "chat.failed": "The run failed.",
  "chat.runningVerb": "Running",

  // ── araç fiilleri ──
  "tool.Read": "Read",
  "tool.NotebookRead": "Read",
  "tool.Grep": "Searched",
  "tool.Glob": "Searched",
  "tool.Write": "Wrote",
  "tool.Edit": "Edited",
  "tool.MultiEdit": "Edited",
  "tool.NotebookEdit": "Edited",
  "tool.Bash": "Ran",
  "tool.BashOutput": "Ran",
  "tool.WebFetch": "Fetched",
  "tool.WebSearch": "Web search",
  "tool.Task": "Agent",
  "tool.Agent": "Agent",
  "tool.TodoWrite": "List",
  "tool.Artifact": "Published",

  // ── bot formu ──
  "forge.new": "New bot",
  "forge.edit": "Edit bot",
  "forge.livesHere": "Lives in this app · config.toml is left alone",
  "forge.name": "Name",
  "forge.namePlaceholder": "Bridge Maintenance",
  "forge.mark": "Mark",
  "forge.markHint": "same L and C for all six · only the hue changes",
  "forge.agent": "Agent",
  "forge.notOnPath": "not found on PATH",
  "forge.model": "Model",
  "forge.effort": "Effort",
  "forge.readFrom": "read from list_agents",
  "forge.disabledSuffix": "disabled",
  "forge.workdir": "Working directory",
  "forge.choose": "Choose…",
  "forge.chooseTitle": "Working directory",
  "forge.preamble": "Standing instruction · prepended to every prompt",
  "forge.preamblePlaceholder": "Answer in English. Never call something “working” unless you measured it.",
  "forge.desktop": "Desktop permission",
  "forge.desktopHint":
    "When on, every run asks for desktop_unlock — virtual keyboard and mouse. It closes itself when the time runs out.",
  "forge.cancel": "Cancel",
  "forge.save": "Save",
  "forge.saving": "Saving…",

  // ── sistem paneli ──
  "sys.title": "System",
  "sys.refresh": "Refresh",
  "sys.refreshConn": "Refresh the connection",
  "sys.server": "Server",
  "sys.endpoint": "Endpoint",
  "sys.tools": "Tools",
  "sys.defaultAgent": "Default agent",
  "sys.defaultWorkdir": "Default directory",
  "sys.agents": "Agents — {n}",
  "sys.agentsUnparsed": "The server returned an agent list but it could not be parsed.",
  "sys.disabled": "Disabled: {list}",
  "sys.optIn": "Only on explicit request: {list}",
  "sys.note": "Note: {note}",
  "sys.shortcuts": "Shortcuts",
  "sys.scNewBot": "New bot · new session",
  "sys.scPanel": "This panel",
  "sys.scSend": "Send",
  "sys.scNewline": "New line",
  "sys.scClose": "Close the dialog",
  "sys.scHint":
    "Ctrl N does nothing in a text field or a terminal pane — every key goes where you are typing.",
  "sys.appearance": "Appearance",
  "sys.theme": "Theme",
  "sys.themeSystem": "System",
  "sys.themeDark": "Dark",
  "sys.themeLight": "Light",
  "sys.language": "Language",
  "sys.langEn": "English",
  "sys.langTr": "Türkçe",

  // ── masaüstü izni ──
  "desk.title": "Desktop permission",
  "desk.control": "Desktop control",
  "desk.on": "Desktop control is on",
  "desk.off": "Desktop control is locked",
  "desk.blurb":
    "While it is on, agents can use a virtual keyboard and mouse. It closes itself when the time runs out, and everything is refused while the screen is locked.",
  "desk.leaseLeft": "Time left on the sliding lease",
  "desk.leaseNote": "The sliding lease decays after the last action · hard ceiling {hard}",
  "desk.reason": "Reason: {reason}",
  "desk.duration": "Duration",
  "desk.durationLabel": "Permission duration",
  "desk.minutes": "{n} min",
  "desk.reasonLabel": "Reason · written to the audit log",
  "desk.reasonPlaceholder": "what it is being opened for",
  "desk.reasonAria": "Permission reason",
  "desk.openedFrom": "Opened from Pcbridge Desktop",
  "desk.expired":
    "{hard} was still left on the hard ceiling, but the sliding lease ran out — pcbridge does not revive a dead permission, so you have to open it again.",
  "desk.unknown": "The state file could not be read — treating it as locked.",
  "desk.screen": "Screen",
  "desk.capture": "Capture",
  "desk.capturing": "capturing…",
  "desk.captureGated":
    "Screen capture is gated by the permission too — it is the most privacy-sensitive output there is, and cannot be taken without opening the permission.",
  "desk.screenN": "Screen {n}",
  "desk.computer": "Computer",
  "desk.reading": "reading…",
  "desk.audit": "Audit log — pcbridge",
  "desk.auditEmpty": "No entries found. pcbridge may be writing audit.log somewhere else.",

  // ── silme onayı ──
  "del.title": "Delete bot",
  "del.ask": "Delete “{name}”?",
  "del.blurb":
    "The bot profile goes away. Run records stay on disk — only the definition inside this app is deleted.",
  "del.cancel": "Cancel",
  "del.confirm": "Delete",

  // ── hatalar ──
  "err.noToken": "No token found.",
  "err.unauthorized": "The server rejected the token (401). Paste the correct static token.",
  "err.unreachable": "Cannot reach the server. Is pcbridge running? — {detail}",
  "err.protocol": "Unexpected response: {detail}",
  "err.refused": "connection refused — pcbridge may not be running",
  "err.timeout": "no response",
  "err.emptyMessage": "An empty message is not sent.",
  "err.jobIdUnreadable": "Could not read the job id: {detail}",
  "err.botsIo": "bots.json could not be read or written: {detail}",
  "err.botsCorrupt": "bots.json is corrupt: {detail}",
  "err.botNotFound": "Bot not found: {detail}",
  "err.nameRequired": "Give the bot a name.",
  "err.agentRequired": "No agent selected.",
  "err.workdirRequired": "The working directory cannot be empty.",
  "err.workdirMissing": "The working directory does not exist: {detail}",
  "err.ptySpawn": "The terminal could not be opened: {detail}",
  "err.ptyNoPane": "That pane is not open: {detail}",
  "err.ptyIo": "Terminal write error: {detail}",
  "err.keyringNoStore": "No keyring is available on this system.",
  "err.keyringLocked": "The keyring could not be reached: {detail}",
  "err.keyringOther": "Keyring error: {detail}",
};

const tr: Record<string, string> = {
  "boot.keyring": "Anahtarlık okunuyor…",

  "welcome.blurb":
    "Sunucunun statik token'ını yapıştır. Doğrulandıktan sonra yalnızca sistem anahtarlığında saklanır — dosyaya yazılmaz, ekrana basılmaz.",
  "welcome.token": "Statik token",
  "welcome.connect": "Bağlan",
  "welcome.connecting": "Bağlanıyor…",
  "welcome.trySaved": "Kayıtlı token'la dene",
  "welcome.deleteSaved": "Kayıtlıyı sil",

  "mode.label": "Kip",
  "mode.bots": "Botlar",
  "mode.terminals": "Terminal",
  "mode.botsTitle": "Botlar (Ctrl+1)",
  "mode.terminalsTitle": "Terminal (Ctrl+2)",

  "side.newBot": "Yeni bot",
  "side.newBotTitle": "Yeni bot (Ctrl+N)",
  "side.search": "Bot ara",
  "side.noBots": "Henüz bot yok",
  "side.noBotsHint": "Sağ üstteki artıya bas. Bot bir ajan, model, effort ve dizin demek.",
  "side.noMatch": "“{q}” ile eşleşen bot yok.",
  "side.edit": "Düzenle",
  "side.delete": "Sil",
  "side.editBot": "{name} botunu düzenle",
  "side.deleteBot": "{name} botunu sil",
  "side.refreshing": "tazeleniyor…",
  "side.toolCount_one": "{n} araç",
  "side.toolCount_other": "{n} araç",
  "side.agentCount_one": "{n} ajan",
  "side.agentCount_other": "{n} ajan",
  "side.running": "koşum sürüyor…",
  "side.noRuns": "henüz koşum yok",
  "side.runs_one": "{n} koşum",
  "side.runs_other": "{n} koşum",
  "side.yesterday": "dün",

  "strip.locked": "Masaüstü kontrolü kilitli",
  "strip.unlocked": "Masaüstü kontrolü açık",
  "strip.minutes": "{n} dk",

  "term.newSession": "Yeni oturum",
  "term.newSessionTitle": "Yeni oturum (Ctrl+N)",
  "term.sessionName": "oturum-adi",
  "term.newSessionLabel": "Yeni oturum adı",
  "term.noSessions": "Açık oturum yok",
  "term.noSessionsHint": "Artıya bas. Oturum tmux'ta yaşar; uygulamayı kapatsan da durur.",
  "term.elsewhere": "PC'de açık, burada değil",
  "term.alsoOnPc": "PC'de de açık",
  "term.kill": "Oturumu sonlandır",
  "term.killNamed": "{name} oturumunu sonlandır",
  "term.sessionCount_one": "{n} oturum",
  "term.sessionCount_other": "{n} oturum",
  "term.openHere": "{n}'i burada açık",

  "panes.0": "Bölme yok",
  "panes.1": "Tek bölme",
  "panes.2": "İki bölme",
  "panes.3": "Üç bölme",
  "panes.4": "Dört bölme",
  "panes.layout": "Yerleşim",
  "panes.nPanes_one": "{n} bölme",
  "panes.nPanes_other": "{n} bölme",
  "panes.empty": "Açık bölme yok",
  "panes.emptyHint":
    "Soldaki listeden bir oturuma tıkla ya da artıya basıp yeni bir tane aç. Her bölme gerçek bir tmux oturumudur.",
  "panes.close": "Bölmeyi kapat (oturum yaşamaya devam eder)",
  "panes.closeNamed": "{name} bölmesini kapat",

  "chat.empty": "Henüz konuşma yok",
  "chat.emptyHint":
    "Aşağıya yaz. Her mesaj agent_run ile bir koşum başlatır ve çıktı out.log'dan canlı akar.",
  "chat.pickFiles": "Ajana verilecek dosyalar",
  "chat.attached": "Ekli dosyalar:",
  "chat.attach": "Dosya ekle",
  "chat.removeAttachment": "Eki çıkar",
  "chat.removeNamed": "{name} ekini çıkar",
  "chat.write": "{name}'a yaz",
  "chat.send": "Gönder",
  "chat.stop": "Durdur",
  "chat.stopped": "durduruldu",
  "chat.failed": "Koşum başarısız bitti.",
  "chat.runningVerb": "Sürüyor",

  "tool.Read": "Okundu",
  "tool.NotebookRead": "Okundu",
  "tool.Grep": "Arandı",
  "tool.Glob": "Arandı",
  "tool.Write": "Yazıldı",
  "tool.Edit": "Düzenlendi",
  "tool.MultiEdit": "Düzenlendi",
  "tool.NotebookEdit": "Düzenlendi",
  "tool.Bash": "Çalıştırıldı",
  "tool.BashOutput": "Çalıştırıldı",
  "tool.WebFetch": "Getirildi",
  "tool.WebSearch": "Web'de arandı",
  "tool.Task": "Ajan",
  "tool.Agent": "Ajan",
  "tool.TodoWrite": "Liste",
  "tool.Artifact": "Yayımlandı",

  "forge.new": "Yeni bot",
  "forge.edit": "Botu düzenle",
  "forge.livesHere": "Bu uygulamada yaşar · config.toml'a dokunulmaz",
  "forge.name": "Ad",
  "forge.namePlaceholder": "Köprü Bakımı",
  "forge.mark": "İşaret",
  "forge.markHint": "altısı da aynı L ve C · yalnızca hue değişir",
  "forge.agent": "Ajan",
  "forge.notOnPath": "PATH'te bulunamadı",
  "forge.model": "Model",
  "forge.effort": "Effort",
  "forge.readFrom": "list_agents'tan okundu",
  "forge.disabledSuffix": "kapalı",
  "forge.workdir": "Çalışma dizini",
  "forge.choose": "Seç…",
  "forge.chooseTitle": "Çalışma dizini",
  "forge.preamble": "Kalıcı yönerge · her prompt'un başına eklenir",
  "forge.preamblePlaceholder": "Türkçe cevap ver. Ölçmediğin şeyi “çalışıyor” diye yazma.",
  "forge.desktop": "Masaüstü izni",
  "forge.desktopHint":
    "Açılırsa her koşumda desktop_unlock istenir — sanal klavye ve fare. Süre dolunca kendiliğinden kapanır.",
  "forge.cancel": "Vazgeç",
  "forge.save": "Kaydet",
  "forge.saving": "Kaydediliyor…",

  "sys.title": "Sistem",
  "sys.refresh": "Tazele",
  "sys.refreshConn": "Bağlantıyı tazele",
  "sys.server": "Sunucu",
  "sys.endpoint": "Uç nokta",
  "sys.tools": "Araç",
  "sys.defaultAgent": "Varsayılan ajan",
  "sys.defaultWorkdir": "Varsayılan dizin",
  "sys.agents": "Ajanlar — {n}",
  "sys.agentsUnparsed": "Sunucu ajan listesi döndürdü ama ayrıştırılamadı.",
  "sys.disabled": "Engelli: {list}",
  "sys.optIn": "Yalnızca açıkça istenirse: {list}",
  "sys.note": "Not: {note}",
  "sys.shortcuts": "Kısayollar",
  "sys.scNewBot": "Yeni bot · yeni oturum",
  "sys.scPanel": "Bu panel",
  "sys.scSend": "Gönder",
  "sys.scNewline": "Satır atla",
  "sys.scClose": "Pencereyi kapat",
  "sys.scHint":
    "Metin alanında ve terminal bölmesinde Ctrl N çalışmaz — her tuş yazdığın yere gider.",
  "sys.appearance": "Görünüm",
  "sys.theme": "Tema",
  "sys.themeSystem": "Sistem",
  "sys.themeDark": "Koyu",
  "sys.themeLight": "Aydınlık",
  "sys.language": "Dil",
  "sys.langEn": "English",
  "sys.langTr": "Türkçe",

  "desk.title": "Masaüstü izni",
  "desk.control": "Masaüstü kontrolü",
  "desk.on": "Masaüstü kontrolü açık",
  "desk.off": "Masaüstü kontrolü kilitli",
  "desk.blurb":
    "Açıkken ajanlar sanal klavye ve fare kullanabilir. Süre dolunca kendiliğinden kapanır; ekran kilitliyken her şey reddedilir.",
  "desk.leaseLeft": "Kayan kiranın kalanı",
  "desk.leaseNote": "Kayan kira son eylemden sonra düşüyor · sert tavan {hard}",
  "desk.reason": "Gerekçe: {reason}",
  "desk.duration": "Süre",
  "desk.durationLabel": "İzin süresi",
  "desk.minutes": "{n} dk",
  "desk.reasonLabel": "Gerekçe · denetim kaydına yazılır",
  "desk.reasonPlaceholder": "ne için açılıyor",
  "desk.reasonAria": "İzin gerekçesi",
  "desk.openedFrom": "Pcbridge Desktop'tan açıldı",
  "desk.expired":
    "Sert tavanda {hard} kalmıştı ama kayan kira düştü — pcbridge ölmüş bir izni diriltmiyor, yeniden açman gerekiyor.",
  "desk.unknown": "Durum dosyası okunamadı — kilitli sayılıyor.",
  "desk.screen": "Ekran",
  "desk.capture": "Görüntü al",
  "desk.capturing": "alınıyor…",
  "desk.captureGated":
    "Ekran görüntüsü de izne bağlı — en gizlilik-hassas çıktı bu. İzni açmadan alınamaz.",
  "desk.screenN": "Ekran {n}",
  "desk.computer": "Bilgisayar",
  "desk.reading": "okunuyor…",
  "desk.audit": "Denetim kaydı — pcbridge",
  "desk.auditEmpty": "Kayıt bulunamadı. pcbridge audit.log'u başka bir yere yazıyor olabilir.",

  "del.title": "Botu sil",
  "del.ask": "“{name}” silinsin mi?",
  "del.blurb":
    "Bot profili gider. Koşum kayıtları diskte kalır — silinen yalnızca bu uygulamadaki tanım.",
  "del.cancel": "Vazgeç",
  "del.confirm": "Sil",

  "err.noToken": "Token bulunamadı.",
  "err.unauthorized": "Sunucu token'ı kabul etmedi (401). Doğru statik token'ı yapıştır.",
  "err.unreachable": "Sunucuya ulaşılamıyor. pcbridge çalışıyor mu? — {detail}",
  "err.protocol": "Beklenmeyen yanıt: {detail}",
  "err.refused": "bağlantı reddedildi — pcbridge çalışmıyor olabilir",
  "err.timeout": "yanıt vermedi",
  "err.emptyMessage": "Boş mesaj gönderilmez.",
  "err.jobIdUnreadable": "İş kimliği okunamadı: {detail}",
  "err.botsIo": "bots.json yazılamadı/okunamadı: {detail}",
  "err.botsCorrupt": "bots.json bozuk: {detail}",
  "err.botNotFound": "Bot bulunamadı: {detail}",
  "err.nameRequired": "Bota bir ad ver.",
  "err.agentRequired": "Ajan seçilmedi.",
  "err.workdirRequired": "Çalışma dizini boş olamaz.",
  "err.workdirMissing": "Çalışma dizini yok: {detail}",
  "err.ptySpawn": "Terminal açılamadı: {detail}",
  "err.ptyNoPane": "Bölme açık değil: {detail}",
  "err.ptyIo": "Terminal yazma hatası: {detail}",
  "err.keyringNoStore": "Bu sistemde kullanılabilir bir anahtarlık yok.",
  "err.keyringLocked": "Anahtarlığa erişilemedi: {detail}",
  "err.keyringOther": "Anahtarlık hatası: {detail}",
};

const MESSAGES: Record<Lang, Record<string, string>> = { en, tr };

/** Sözlükler aynı anahtar kümesini taşımalı — test bunu doğruluyor. */
export const __sozlukler = MESSAGES;
