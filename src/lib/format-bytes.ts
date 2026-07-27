/** Human-readable byte size (e.g. 248_103 → "242 KB"). Shared by the chat
 *  inline-media cards and the "Shared media & files" panel. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
