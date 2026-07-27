/**
 * Org-level module gating — tests the CLAIM: a view whose module the
 * org doesn't carry does not exist for that org, core views always do,
 * and a workspace list from an older backend (no `module_keys`) never
 * throws.
 */

import {
  enabledModulesFromWorkspaces,
  isViewEnabled,
  VIEW_MODULE_REQUIREMENTS,
} from "../enabled-modules";

describe("enabledModulesFromWorkspaces", () => {
  it("unions module keys across workspaces", () => {
    const modules = enabledModulesFromWorkspaces([
      { module_keys: ["legal"] },
      { module_keys: ["sales"] },
      { module_keys: [] },
    ]);
    expect([...modules].sort()).toEqual(["legal", "sales"]);
  });

  it("tolerates workspaces without the field (older backend payloads)", () => {
    expect(enabledModulesFromWorkspaces([{}, { module_keys: undefined }]).size).toBe(
      0,
    );
  });
});

describe("isViewEnabled", () => {
  const legalOnly = new Set(["legal"]);
  const salesOnly = new Set(["sales"]);
  const none = new Set<string>();

  it("core views are enabled for every org, even with no modules", () => {
    for (const coreView of [
      "research",
      "team-chat",
      "summary",
      "team",
      "personal",
      "knowledge-graph",
      "context-builder",
    ]) {
      expect(isViewEnabled(coreView, none)).toBe(true);
    }
  });

  it("an EMPTY module set is ungated — every view shows (bare dev orgs, pre-backfill rows)", () => {
    for (const viewId of ["sales", "brief", "explorer", "legal-library"]) {
      expect(isViewEnabled(viewId, none)).toBe(true);
    }
  });

  it("a law-firm org (legal only) never sees the sales surfaces", () => {
    expect(isViewEnabled("sales", legalOnly)).toBe(false);
    expect(isViewEnabled("brief", legalOnly)).toBe(false);
    expect(isViewEnabled("explorer", legalOnly)).toBe(true);
    expect(isViewEnabled("communications", legalOnly)).toBe(true);
    expect(isViewEnabled("legal-library", legalOnly)).toBe(true);
  });

  it("a sales org never sees the legal surfaces", () => {
    expect(isViewEnabled("sales", salesOnly)).toBe(true);
    expect(isViewEnabled("brief", salesOnly)).toBe(true);
    for (const legalView of [
      "explorer",
      "communications",
      "matter-templates",
      "legal-library",
      "firm-standards",
      "legal-workflows",
    ]) {
      expect(isViewEnabled(legalView, salesOnly)).toBe(false);
    }
  });

  it("every gated view maps to a known module", () => {
    for (const moduleKey of Object.values(VIEW_MODULE_REQUIREMENTS)) {
      expect(["sales", "legal"]).toContain(moduleKey);
    }
  });
});
