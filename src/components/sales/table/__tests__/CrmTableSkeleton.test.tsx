import { render, screen, within } from "@testing-library/react";
import { CrmTableSkeleton } from "../CrmTableSkeleton";

/**
 * The skeleton's contract: real table chrome immediately, shimmer
 * where data will land. With known columns the TRUE header labels
 * render (zero layout shift when rows arrive); without them the
 * header shimmers too. Row/column counts drive the bar grid.
 */
describe("CrmTableSkeleton", () => {
  it("renders real header labels when columns are known", () => {
    render(
      <CrmTableSkeleton
        columns={[
          { id: "name", label: "Name" },
          { id: "stage", label: "Stage" },
          { id: "value", label: "Value", align: "right" },
        ]}
        rowCount={4}
        testIdPrefix="probe"
      />,
    );
    const skeleton = screen.getByTestId("probe-skeleton");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    const headers = within(skeleton).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Name",
      "Stage",
      "Value",
    ]);
    // 4 shimmer rows × 3 columns, every cell carrying a bar.
    const bodyRows = skeleton.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(4);
    for (const row of bodyRows) {
      expect(row.querySelectorAll(".crm-skeleton-bar")).toHaveLength(3);
    }
  });

  it("shimmers the header too when columns are not yet known", () => {
    render(<CrmTableSkeleton columnCount={5} testIdPrefix="probe" />);
    const skeleton = screen.getByTestId("probe-skeleton");
    const headers = within(skeleton).getAllByRole("columnheader");
    expect(headers).toHaveLength(5);
    for (const header of headers) {
      expect(header.querySelector(".crm-skeleton-bar")).not.toBeNull();
    }
  });
});
