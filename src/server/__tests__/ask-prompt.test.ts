import {
  ASK_SYSTEM_PROMPT,
  buildAskSystemPrompt,
} from "@/server/ask-prompt";

describe("Ask system prompt memory injection", () => {
  it("returns the base prompt untouched when nothing is saved", () => {
    expect(buildAskSystemPrompt([])).toBe(ASK_SYSTEM_PROMPT);
  });

  it("appends saved memories as a <memory> block, oldest first", () => {
    const prompt = buildAskSystemPrompt([
      "Prefers short, direct follow-up drafts.",
      "The tour targets Thai law firms only.",
    ]);
    expect(prompt.startsWith(ASK_SYSTEM_PROMPT)).toBe(true);
    const memoryBlock = prompt.slice(ASK_SYSTEM_PROMPT.length);
    expect(memoryBlock).toContain("<memory>");
    expect(memoryBlock).toContain("</memory>");
    expect(memoryBlock).toContain("- Prefers short, direct follow-up drafts.");
    expect(memoryBlock.indexOf("Prefers short")).toBeLessThan(
      memoryBlock.indexOf("The tour targets"),
    );
  });

  it("teaches the model the memory tools in the base prompt", () => {
    expect(ASK_SYSTEM_PROMPT).toContain("remember_fact");
    expect(ASK_SYSTEM_PROMPT).toContain("forget_fact");
  });
});
