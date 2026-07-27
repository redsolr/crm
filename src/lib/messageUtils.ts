/**
 * Filters messages for display, removing system messages and tool-only messages.
 * This is the same logic used by MessagesList to determine which messages are visible.
 */
export function filterDisplayMessages<
  T extends { role: string; content?: string | null },
>(messages: T[]): T[] {
  return messages.filter((m) => {
    if (m.role === "system") return false;
    const content = m.content?.trim() || "";
    if (content.startsWith("[") && content.endsWith("]")) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          if (parsed.every((b: { type: string }) => b.type === "tool_result"))
            return false;
          const hasToolUse = parsed.some(
            (b: { type: string }) => b.type === "tool_use",
          );
          const hasText = parsed.some(
            (b: { type: string; text?: string }) =>
              b.type === "text" && b.text?.trim(),
          );
          if (hasToolUse && !hasText) return false;
        }
      } catch {
        // Not valid JSON, keep it
      }
    }
    return true;
  });
}
