import {
  clearRecentSearches,
  readRecentSearches,
  recordRecentSearch,
} from "../recent-searches";

describe("recent-searches", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns empty with nothing stored", () => {
    expect(readRecentSearches()).toEqual([]);
  });

  it("records searches MRU-first", () => {
    recordRecentSearch("erawan");
    recordRecentSearch("siam apex");
    expect(readRecentSearches()).toEqual(["siam apex", "erawan"]);
  });

  it("dedupes case-insensitively, keeping the newest spelling first", () => {
    recordRecentSearch("erawan");
    recordRecentSearch("siam apex");
    recordRecentSearch("Erawan");
    expect(readRecentSearches()).toEqual(["Erawan", "siam apex"]);
  });

  it("ignores blank terms", () => {
    recordRecentSearch("   ");
    expect(readRecentSearches()).toEqual([]);
  });

  it("caps at five entries, dropping the oldest", () => {
    for (const term of ["a1", "a2", "a3", "a4", "a5", "a6"]) {
      recordRecentSearch(term);
    }
    expect(readRecentSearches()).toEqual(["a6", "a5", "a4", "a3", "a2"]);
  });

  it("survives corrupted storage", () => {
    window.localStorage.setItem("crm-recent-searches", "{not json");
    expect(readRecentSearches()).toEqual([]);
    window.localStorage.setItem("crm-recent-searches", '{"nope":1}');
    expect(readRecentSearches()).toEqual([]);
    window.localStorage.setItem("crm-recent-searches", '["ok", 42, ""]');
    expect(readRecentSearches()).toEqual(["ok"]);
  });

  it("clears everything", () => {
    recordRecentSearch("erawan");
    clearRecentSearches();
    expect(readRecentSearches()).toEqual([]);
  });
});
