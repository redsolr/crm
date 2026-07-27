import { domainFromUrl, faviconUrl } from "../company-domain";

describe("domainFromUrl", () => {
  it("extracts the hostname from a full URL", () => {
    expect(domainFromUrl("https://acme.co.th/about")).toBe("acme.co.th");
  });

  it("accepts scheme-less values", () => {
    expect(domainFromUrl("acme.com")).toBe("acme.com");
  });

  it("strips www. and lowercases", () => {
    expect(domainFromUrl("https://WWW.Acme.COM")).toBe("acme.com");
  });

  it("returns null for empty / non-string / free text", () => {
    expect(domainFromUrl(null)).toBeNull();
    expect(domainFromUrl(undefined)).toBeNull();
    expect(domainFromUrl("")).toBeNull();
    expect(domainFromUrl("   ")).toBeNull();
    // No dot — not a usable public host, initials fallback instead.
    expect(domainFromUrl("localhost")).toBeNull();
    expect(domainFromUrl("just some notes")).toBeNull();
  });
});

describe("faviconUrl", () => {
  it("builds the s2 favicon URL with the domain encoded", () => {
    expect(faviconUrl("acme.co.th", 64)).toBe(
      "https://www.google.com/s2/favicons?domain=acme.co.th&sz=64",
    );
  });
});
