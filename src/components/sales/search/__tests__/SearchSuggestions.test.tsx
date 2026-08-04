import { render, screen, within, fireEvent } from "@testing-library/react";
import {
  SearchSuggestions,
  SUGGESTED_NAV,
} from "../SearchSuggestions";

/**
 * The empty-query dropdown's contract (Slack shape, 2026-08-04):
 * recents are actionable rows, the Suggested nav rows route, and the
 * keycap footer teaches the keyboard. Selection highlighting follows
 * the parent's flat index (recents first, then nav).
 */
describe("SearchSuggestions", () => {
  const noop = () => undefined;

  function renderPanel(overrides?: {
    recents?: string[];
    activeIndex?: number;
    onApply?: (term: string) => void;
    onOpenNav?: (item: { id: string; href: string }) => void;
  }) {
    return render(
      <SearchSuggestions
        recents={overrides?.recents ?? []}
        activeIndex={overrides?.activeIndex ?? 0}
        onHover={noop}
        onApply={overrides?.onApply ?? noop}
        onOpenNav={overrides?.onOpenNav ?? noop}
        onClearRecents={noop}
      />,
    );
  }

  it("renders every Suggested nav destination and the keycap footer", () => {
    renderPanel();
    const nav = screen.getByTestId("crm-search-nav");
    for (const item of SUGGESTED_NAV) {
      expect(
        within(nav).getByTestId(`crm-search-nav-${item.id}`),
      ).toHaveTextContent(item.label);
    }
    expect(screen.getByTestId("crm-search-suggest-footer")).toHaveTextContent(
      "Select",
    );
  });

  it("hides the recents section when there are none", () => {
    renderPanel();
    expect(screen.queryByTestId("crm-search-recent")).toBeNull();
  });

  it("clicking a recent re-applies the term; clicking a nav row opens it", () => {
    const onApply = jest.fn();
    const onOpenNav = jest.fn();
    renderPanel({ recents: ["nimman"], onApply, onOpenNav });

    fireEvent.click(screen.getByTestId("crm-search-recent-item"));
    expect(onApply).toHaveBeenCalledWith("nimman");

    fireEvent.click(screen.getByTestId("crm-search-nav-companies"));
    expect(onOpenNav).toHaveBeenCalledWith(
      expect.objectContaining({ id: "companies", href: "/sales/companies" }),
    );
  });

  it("selection highlight follows the FLAT index — recents first, then nav", () => {
    renderPanel({ recents: ["nimman"], activeIndex: 1 });
    // Index 1 with one recent = the FIRST nav row.
    const first = screen.getByTestId(`crm-search-nav-${SUGGESTED_NAV[0]!.id}`);
    expect(first.className).toContain("bg-[var(--theme-bg-active)]");
    const recent = screen.getByTestId("crm-search-recent-item");
    expect(recent.className).not.toContain("bg-[var(--theme-bg-active)]");
  });
});
