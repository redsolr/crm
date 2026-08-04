"use client";

/**
 * AskMarkdown — renders an assistant chat turn as markdown (GFM).
 * The Ask model replies in markdown (bold, lists, tables); rendering
 * it as real prose instead of raw `**asterisks**` is most of the
 * ChatGPT-class reading experience. User turns stay plain text —
 * users don't author markdown. Element styling lives in globals.css
 * under `.crm-ask-markdown` (theme tokens only).
 *
 * react-markdown never emits raw HTML from the source by default, so
 * model output stays inert.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AskMarkdown({ content }: { content: string }) {
  return (
    <div className="crm-ask-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
