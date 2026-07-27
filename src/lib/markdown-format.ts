/**
 * Pure text transforms for a markdown composer toolbar (bold / italic / code /
 * link / lists / quote) plus raw insertion (emoji). DOM-free so it's unit
 * testable: each takes the current `{ value, start, end }` selection and returns
 * the next `{ value, start, end }`. The composer applies the value via its
 * onChange and restores the selection on the textarea.
 *
 * Only actions that actually render with our `MarkdownRenderer` (react-markdown,
 * no remark-gfm) are exposed — so no button is a lie. Strikethrough/tables would
 * need remark-gfm and are intentionally omitted.
 */

export type MarkdownAction =
  | "bold"
  | "italic"
  | "code"
  | "codeblock"
  | "link"
  | "ul"
  | "ol"
  | "quote";

export interface Selection {
  value: string;
  start: number;
  end: number;
}

/** Insert `text` at the caret (replacing any selection); caret lands after it. */
export function insertText(sel: Selection, text: string): Selection {
  const value = sel.value.slice(0, sel.start) + text + sel.value.slice(sel.end);
  const caret = sel.start + text.length;
  return { value, start: caret, end: caret };
}

/**
 * Wrap the selection in `prefix`/`suffix`. With no selection, insert the
 * `placeholder` wrapped and select it so the user can type over it. If the
 * selection is already wrapped, unwrap it (toggle).
 */
function wrap(
  sel: Selection,
  prefix: string,
  suffix: string,
  placeholder: string,
): Selection {
  const selected = sel.value.slice(sel.start, sel.end);

  // Toggle off when the exact markers already hug the selection.
  const before = sel.value.slice(sel.start - prefix.length, sel.start);
  const after = sel.value.slice(sel.end, sel.end + suffix.length);
  if (selected !== "" && before === prefix && after === suffix) {
    const value =
      sel.value.slice(0, sel.start - prefix.length) +
      selected +
      sel.value.slice(sel.end + suffix.length);
    const start = sel.start - prefix.length;
    return { value, start, end: start + selected.length };
  }

  const body = selected === "" ? placeholder : selected;
  const value =
    sel.value.slice(0, sel.start) +
    prefix +
    body +
    suffix +
    sel.value.slice(sel.end);
  const start = sel.start + prefix.length;
  return { value, start, end: start + body.length };
}

/** Prefix each line spanned by the selection (lists, blockquote). */
function prefixLines(
  sel: Selection,
  makePrefix: (lineIndex: number) => string,
): Selection {
  // Expand the range to whole lines.
  const lineStart = sel.value.lastIndexOf("\n", sel.start - 1) + 1;
  let lineEnd = sel.value.indexOf("\n", sel.end);
  if (lineEnd === -1) lineEnd = sel.value.length;

  const block = sel.value.slice(lineStart, lineEnd);
  const prefixed = block
    .split("\n")
    .map((line, i) => `${makePrefix(i)}${line}`)
    .join("\n");

  const value =
    sel.value.slice(0, lineStart) + prefixed + sel.value.slice(lineEnd);
  return { value, start: lineStart, end: lineStart + prefixed.length };
}

/** Apply a markdown action to a selection, returning the next selection. */
export function applyMarkdown(
  action: MarkdownAction,
  sel: Selection,
): Selection {
  switch (action) {
    case "bold":
      return wrap(sel, "**", "**", "bold text");
    case "italic":
      return wrap(sel, "_", "_", "italic text");
    case "code":
      return wrap(sel, "`", "`", "code");
    case "codeblock":
      return wrap(sel, "```\n", "\n```", "code");
    case "link": {
      const selected = sel.value.slice(sel.start, sel.end);
      const text = selected === "" ? "text" : selected;
      const snippet = `[${text}](url)`;
      const value =
        sel.value.slice(0, sel.start) + snippet + sel.value.slice(sel.end);
      // Select the `url` placeholder so the user types the destination next.
      const urlStart = sel.start + text.length + 3; // `[` + text + `](`
      return { value, start: urlStart, end: urlStart + 3 };
    }
    case "ul":
      return prefixLines(sel, () => "- ");
    case "ol":
      return prefixLines(sel, (i) => `${i + 1}. `);
    case "quote":
      return prefixLines(sel, () => "> ");
    default:
      return sel;
  }
}
