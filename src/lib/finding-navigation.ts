import type { KeyFinding } from "@/queries/chat/use-key-findings-query";

/**
 * Scroll to a finding's source element in the DOM.
 * Tries the highlighted span first, then falls back to element ID or message index.
 */
export function jumpToFindingSource(finding: KeyFinding): void {
  // First, try to find the highlighted span by finding ID
  const highlightedSpan = document.querySelector(
    `[data-finding-id="${finding.id}"]`,
  );
  if (highlightedSpan) {
    highlightedSpan.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightedSpan.classList.add("animate-pulse");
    setTimeout(() => {
      highlightedSpan.classList.remove("animate-pulse");
    }, 1500);
    return;
  }

  // Fallback: find by element ID from the finding source
  const elementId = finding.source.elementId;
  if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } else if (finding.source.messageIndex !== undefined) {
    const element = document.getElementById(
      `chat-message-${finding.source.messageIndex}`,
    );
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}
