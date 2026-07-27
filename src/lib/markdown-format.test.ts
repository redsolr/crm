import { applyMarkdown, insertText, type Selection } from "./markdown-format";

/** Build a selection from a string with `|` marking start and end carets. */
function sel(spec: string): Selection {
  const start = spec.indexOf("|");
  const end = spec.indexOf("|", start + 1);
  const value = spec.replace(/\|/g, "");
  // With one bar it's a collapsed caret; with two it's a range.
  return end === -1
    ? { value, start, end: start }
    : { value, start, end: end - 1 };
}

describe("applyMarkdown", () => {
  it("wraps a selection in bold markers and keeps it selected", () => {
    const r = applyMarkdown("bold", sel("hi |there| you"));
    expect(r.value).toBe("hi **there** you");
    expect(r.value.slice(r.start, r.end)).toBe("there");
  });

  it("toggles bold off when the selection is already bold", () => {
    const r = applyMarkdown("bold", sel("hi **|there|** you"));
    expect(r.value).toBe("hi there you");
    expect(r.value.slice(r.start, r.end)).toBe("there");
  });

  it("inserts a placeholder and selects it when there is no selection", () => {
    const r = applyMarkdown("italic", sel("hi |"));
    expect(r.value).toBe("hi _italic text_");
    expect(r.value.slice(r.start, r.end)).toBe("italic text");
  });

  it("builds a link and selects the url placeholder", () => {
    const r = applyMarkdown("link", sel("see |Google| now"));
    expect(r.value).toBe("see [Google](url) now");
    expect(r.value.slice(r.start, r.end)).toBe("url");
  });

  it("prefixes each spanned line for a bulleted list", () => {
    const r = applyMarkdown("ul", sel("|one\ntwo\nthree|"));
    expect(r.value).toBe("- one\n- two\n- three");
  });

  it("numbers lines for an ordered list", () => {
    const r = applyMarkdown("ol", sel("|one\ntwo|"));
    expect(r.value).toBe("1. one\n2. two");
  });

  it("prefixes a blockquote", () => {
    const r = applyMarkdown("quote", sel("|hello|"));
    expect(r.value).toBe("> hello");
  });

  it("wraps a code block across the selection", () => {
    const r = applyMarkdown("codeblock", sel("|x = 1|"));
    expect(r.value).toBe("```\nx = 1\n```");
  });
});

describe("insertText", () => {
  it("inserts an emoji at the caret", () => {
    const r = insertText(sel("hi |"), "😀");
    expect(r.value).toBe("hi 😀");
    expect(r.start).toBe(r.end);
    expect(r.start).toBe("hi 😀".length);
  });

  it("replaces the current selection", () => {
    const r = insertText(sel("hi |world|"), "😀");
    expect(r.value).toBe("hi 😀");
  });
});
