import { TOOL_GROUPS, type McpTool, type ToolGroup } from "./types";

export { TOOL_GROUPS, type ToolGroup };

/**
 * Araçları grup grup ayırır; her grup kendi içinde ada göre sıralı.
 *
 * **Grubu burada hesaplamıyoruz.** Ad listesi Rust'ta (`src-tauri/src/tools.rs`)
 * çünkü izin kipini uygulayan yer orası; ikinci bir liste tutmak "arayüzde
 * masaüstü yazıyordu ama sormadan çalıştı" hatasına açık kapı bırakırdı.
 * Sunucu yeni bir araç eklerse iki yer değil tek yer güncelleniyor.
 */
export function byGroup(tools: McpTool[]): Record<ToolGroup, McpTool[]> {
  const out: Record<ToolGroup, McpTool[]> = { read: [], write: [], desktop: [] };
  for (const tool of tools) out[tool.group].push(tool);
  for (const g of TOOL_GROUPS) out[g].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
