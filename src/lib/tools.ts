import type { McpTool } from "./types";

/**
 * Araç filtresindeki üç grup.
 *
 * Ayrım konfor değil **denetim**: bir bota yazma ya da masaüstü aracı vermek
 * ayrı ve bilinçli bir eylem olmalı. Bir bot güvenilmeyen metin okuyorsa
 * (dosya, e-posta, web) ve elinde kabuk varsa, o metindeki "şu komutu
 * çalıştır" satırı ile kullanıcının isteği model için aynı şeydir.
 */
export type ToolGroup = "read" | "write" | "desktop";

export const TOOL_GROUPS: ToolGroup[] = ["read", "write", "desktop"];

/**
 * pcbridge'in araçlarının ada göre gruplanması.
 *
 * Bu liste **yedek**: sunucu `annotations.readOnlyHint` veriyorsa okuma
 * grubu ondan çıkar. pcbridge bugün veriyor mu ölçülmedi, o yüzden ikisi de
 * duruyor ve tanınmayan bir ad sessizce en kısıtlı olmayan gruba düşmüyor —
 * `write` sayılıyor, çünkü bilmediğimiz bir aracı zararsız varsaymak yanlış.
 */
const OKUMA = new Set([
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
]);

const MASAUSTU = new Set([
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
]);

/**
 * Bir aracın grubu. Masaüstü grubu **ada göre** belirlenir ve sunucunun
 * ipucundan önce gelir: `ui_dump` salt-okunur olabilir ama yine de masaüstü
 * izni istiyor, ve kullanıcı "bu bot ekranımı görsün mü" sorusuna ayrı yanıt
 * vermeli.
 */
export function groupOf(tool: McpTool): ToolGroup {
  if (MASAUSTU.has(tool.name)) return "desktop";
  if (OKUMA.has(tool.name)) return "read";
  // Sunucu "hiçbir şeyi değiştirmiyor" diyorsa ona güveniyoruz; listemizde
  // olmayan yeni bir araç böyle doğru gruba düşebilir.
  if (tool.readOnly === true) return "read";
  return "write";
}

/** Araçları grup grup ayırır; her grup kendi içinde ada göre sıralı. */
export function byGroup(tools: McpTool[]): Record<ToolGroup, McpTool[]> {
  const out: Record<ToolGroup, McpTool[]> = { read: [], write: [], desktop: [] };
  for (const tool of tools) out[groupOf(tool)].push(tool);
  for (const g of TOOL_GROUPS) out[g].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
