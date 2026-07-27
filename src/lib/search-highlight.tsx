import React from "react";

/**
 * Render a PostgreSQL `ts_headline` snippet (`…<mark>match</mark>…`) as React
 * nodes. NEVER `dangerouslySetInnerHTML` — snippet content is user/client-
 * authored text, so raw HTML would be an XSS vector. Splitting on the mark
 * tags and rendering React elements lets React escape everything else while
 * still highlighting the matched terms.
 */
export function renderSnippet(snippet: string): React.ReactNode {
  const parts = snippet.split(/(<mark>|<\/mark>)/);
  const nodes: React.ReactNode[] = [];
  let marking = false;
  parts.forEach((part, i) => {
    if (part === "<mark>") {
      marking = true;
      return;
    }
    if (part === "</mark>") {
      marking = false;
      return;
    }
    if (part === "") return;
    nodes.push(
      marking ? (
        <mark
          key={i}
          className="search-highlight-mark rounded-[2px] bg-[var(--theme-accent)]/25 text-inherit"
        >
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  });
  return nodes;
}
