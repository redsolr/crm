/**
 * SelectMenu / TypeaheadCombobox — the app-wide searchable dropdown.
 *
 * Tests the CLAIMS the app relies on, not the DOM internals:
 *  - picking an option commits the VALUE (ids stay ids, labels are
 *    display-only) and closes the menu;
 *  - the search box appears for long lists and filters them;
 *  - keyboard-only selection works (open → arrows → Enter);
 *  - dismissal without a pick reports `onOpenChange(false)` AFTER any
 *    commit (the cell-editor cancel contract);
 *  - the typeahead keeps free text valid (unknown company stays
 *    typed), fills the input on pick, and falls through Enter to the
 *    host when nothing is highlighted.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SelectMenu, TypeaheadCombobox, keyOptions } from "../select";

const FRUIT = [
  { value: "apple", label: "apple" },
  { value: "banana", label: "banana" },
  { value: "cherry", label: "cherry" },
];

const COMPANIES = [
  "Titan Law",
  "Lanna Law Office",
  "Siam Apex Law",
  "Thonglor Legal Group",
  "Erawan Corporate Legal",
  "Krung Thep Family Law",
  "Ratchada Litigation Chambers",
].map((name, i) => ({ value: `acc_${i}`, label: name }));

describe("keyOptions", () => {
  it("labels snake_case keys with spaces, keeps values raw", () => {
    expect(keyOptions(["matter_chaos", "other"])).toEqual([
      { value: "matter_chaos", label: "matter chaos" },
      { value: "other", label: "other" },
    ]);
  });
});

describe("SelectMenu", () => {
  it("shows the selected label, exposes the value on data-value", () => {
    render(
      <SelectMenu
        value="banana"
        onChange={jest.fn()}
        options={FRUIT}
        testId="fruit"
      />,
    );
    const trigger = screen.getByTestId("fruit");
    expect(trigger).toHaveTextContent("banana");
    expect(trigger).toHaveAttribute("data-value", "banana");
  });

  it("shows the placeholder while empty", () => {
    render(
      <SelectMenu
        value=""
        onChange={jest.fn()}
        options={FRUIT}
        placeholder="Pick a fruit…"
        testId="fruit"
      />,
    );
    expect(screen.getByTestId("fruit")).toHaveTextContent("Pick a fruit…");
  });

  it("opens on click and commits the picked VALUE, then closes", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SelectMenu
        value=""
        onChange={onChange}
        options={COMPANIES}
        testId="company"
      />,
    );
    await user.click(screen.getByTestId("company"));
    await user.click(screen.getByRole("option", { name: "Siam Apex Law" }));
    expect(onChange).toHaveBeenCalledWith("acc_2");
    await waitFor(() =>
      expect(screen.queryByTestId("crm-select-menu")).not.toBeInTheDocument(),
    );
  });

  it("filters through the search box on long lists", async () => {
    const user = userEvent.setup();
    render(
      <SelectMenu
        value=""
        onChange={jest.fn()}
        options={COMPANIES}
        testId="company"
      />,
    );
    await user.click(screen.getByTestId("company"));
    const search = screen.getByTestId("crm-select-search-input");
    expect(search).toHaveFocus();
    await user.keyboard("law o");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.getByRole("option", { name: "Lanna Law Office" }),
    ).toBeInTheDocument();
    await user.keyboard("zzz");
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("hides the search box on short lists", async () => {
    const user = userEvent.setup();
    render(
      <SelectMenu value="" onChange={jest.fn()} options={FRUIT} testId="fruit" />,
    );
    await user.click(screen.getByTestId("fruit"));
    expect(
      screen.queryByTestId("crm-select-search-input"),
    ).not.toBeInTheDocument();
  });

  it("supports keyboard-only selection (arrows + Enter)", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SelectMenu
        value="apple"
        onChange={onChange}
        options={FRUIT}
        testId="fruit"
      />,
    );
    await user.click(screen.getByTestId("fruit"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("renders a clearable empty option when emptyOptionLabel is set", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SelectMenu
        value="apple"
        onChange={onChange}
        options={FRUIT}
        emptyOptionLabel="Any"
        testId="fruit"
      />,
    );
    await user.click(screen.getByTestId("fruit"));
    await user.click(screen.getByRole("option", { name: "Any" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("cell-editor contract: commit lands BEFORE the close signal; a dismissal without a pick only signals close", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const { unmount } = render(
      <SelectMenu
        value=""
        onChange={(v) => calls.push(`commit:${v}`)}
        onOpenChange={(open) => calls.push(open ? "open" : "close")}
        options={FRUIT}
        defaultOpen
        testId="cell"
      />,
    );
    // Menu is already open (defaultOpen) — pick.
    await user.click(screen.getByRole("option", { name: "cherry" }));
    expect(calls).toEqual(["commit:cherry", "close"]);
    unmount();

    calls.length = 0;
    render(
      <SelectMenu
        value=""
        onChange={(v) => calls.push(`commit:${v}`)}
        onOpenChange={(open) => calls.push(open ? "open" : "close")}
        options={FRUIT}
        defaultOpen
        testId="cell2"
      />,
    );
    await user.keyboard("{Escape}");
    expect(calls).toEqual(["close"]);
  });

  it("reports engagement while the menu is open (field-claim signal)", async () => {
    const user = userEvent.setup();
    const onEngagedChange = jest.fn();
    render(
      <div>
        <SelectMenu
          value=""
          onChange={jest.fn()}
          options={FRUIT}
          onEngagedChange={onEngagedChange}
          testId="fruit"
        />
        <button data-testid="elsewhere">elsewhere</button>
      </div>,
    );
    await user.click(screen.getByTestId("fruit"));
    expect(onEngagedChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByTestId("elsewhere"));
    await waitFor(() =>
      expect(onEngagedChange).toHaveBeenLastCalledWith(false),
    );
  });
});

describe("TypeaheadCombobox", () => {
  function Host({
    onPick,
    onEnter,
  }: {
    onPick?: (o: { value: string; label: string }) => void;
    onEnter?: () => void;
  }) {
    const [text, setText] = useState("");
    return (
      <TypeaheadCombobox
        value={text}
        onValueChange={setText}
        options={COMPANIES}
        onPick={onPick}
        onEnter={onEnter}
        testId="company-input"
      />
    );
  }

  it("filters suggestions while typing and fills the input on pick", async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    render(<Host onPick={onPick} />);
    const input = screen.getByTestId("company-input");
    await user.type(input, "tita");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.click(screen.getByRole("option", { name: "Titan Law" }));
    expect(input).toHaveValue("Titan Law");
    expect(onPick).toHaveBeenCalledWith({ value: "acc_0", label: "Titan Law" });
  });

  it("keeps unknown text valid and closes the menu on exact match", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByTestId("company-input");
    await user.type(input, "Brand New Firm");
    expect(input).toHaveValue("Brand New Firm");
    // "Titan Law" typed exactly → suggestions collapse (nothing to pick).
    await user.clear(input);
    await user.type(input, "Titan Law");
    expect(screen.queryByTestId("crm-select-menu")).not.toBeInTheDocument();
  });

  it("Enter falls through to the host when nothing is highlighted, picks when navigated", async () => {
    const user = userEvent.setup();
    const onEnter = jest.fn();
    render(<Host onEnter={onEnter} />);
    const input = screen.getByTestId("company-input");
    await user.type(input, "law");
    await user.keyboard("{Enter}");
    expect(onEnter).toHaveBeenCalledTimes(1);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(input).not.toHaveValue("law");
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
