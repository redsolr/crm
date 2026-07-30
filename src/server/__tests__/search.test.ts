import { buildTsquery } from "@/server/search";

describe("buildTsquery", () => {
  it("prefix-matches the last token for search-as-you-type", () => {
    expect(buildTsquery("acme")).toBe("acme:*");
    expect(buildTsquery("acme pil")).toBe("acme & pil:*");
  });

  it("reduces tokens to letters/digits so tsquery syntax cannot leak in", () => {
    expect(buildTsquery("acme & co! (pilot)")).toBe("acme & co & pilot:*");
    expect(buildTsquery("a:*|b'c")).toBe("a & b & c:*");
    expect(buildTsquery("CRM-12")).toBe("crm & 12:*");
  });

  it("returns null when nothing searchable remains", () => {
    expect(buildTsquery("")).toBeNull();
    expect(buildTsquery("  !&|  ")).toBeNull();
  });

  it("caps token count on pathological input", () => {
    const query = Array.from({ length: 20 }, (_, i) => `t${i}`).join(" ");
    const built = buildTsquery(query);
    expect(built).not.toBeNull();
    expect((built as string).split(" & ")).toHaveLength(8);
  });
});
