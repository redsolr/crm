import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SlashCommandsMenu,
  useSlashCommands,
  type SlashCommand,
} from "../shared/SlashCommands";

/**
 * Minimal composer harness — the same wiring every real surface uses: the
 * parent owns the draft, the hook owns slash state, the menu renders above
 * the textarea, and the hook's key handler runs before the composer's own
 * (Enter falls through to "send" only when the menu didn't take it).
 */
function Harness({
  commands,
  onSend,
}: {
  commands: SlashCommand[];
  onSend?: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const slash = useSlashCommands({ value, onChange: setValue, commands });
  return (
    <div>
      <SlashCommandsMenu state={slash} ariaLabel="Test commands" />
      <textarea
        data-testid="harness-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (slash.onKeyDown(e)) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend?.(value);
            setValue("");
          }
        }}
      />
    </div>
  );
}

const summarize = jest.fn();
const COMMANDS: SlashCommand[] = [
  {
    name: "summarize",
    description: "Catch me up — AI summary",
    run: summarize,
  },
  { name: "mute", description: "Mute notifications", run: jest.fn() },
  { name: "shrug", description: "Insert a shrug", insert: "¯\\_(ツ)_/¯ " },
];

describe("SlashCommands", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stays closed until the draft starts with /", async () => {
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} />);
    expect(screen.queryByTestId("slash-commands-menu")).not.toBeInTheDocument();

    await user.type(screen.getByTestId("harness-input"), "hello /world");
    expect(screen.queryByTestId("slash-commands-menu")).not.toBeInTheDocument();
  });

  it("opens on a leading / and lists every command", async () => {
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} />);
    await user.type(screen.getByTestId("harness-input"), "/");

    expect(screen.getByTestId("slash-commands-menu")).toBeInTheDocument();
    expect(screen.getByText("/summarize")).toBeInTheDocument();
    expect(screen.getByText("/mute")).toBeInTheDocument();
    expect(screen.getByText("/shrug")).toBeInTheDocument();
  });

  it("filters by name and description as the user types", async () => {
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} />);
    await user.type(screen.getByTestId("harness-input"), "/mu");

    expect(screen.getByText("/mute")).toBeInTheDocument();
    expect(screen.queryByText("/shrug")).not.toBeInTheDocument();

    // Description text matches too ("summary" only appears in /summarize's).
    await user.clear(screen.getByTestId("harness-input"));
    await user.type(screen.getByTestId("harness-input"), "/summary");
    expect(screen.getByText("/summarize")).toBeInTheDocument();
    expect(screen.queryByText("/mute")).not.toBeInTheDocument();
  });

  it("runs an action command on Enter and clears the draft (not sent)", async () => {
    const onSend = jest.fn();
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} onSend={onSend} />);
    const input = screen.getByTestId("harness-input");

    await user.type(input, "/summar{Enter}");
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  it("inserts an insert command's text into the draft without sending", async () => {
    const onSend = jest.fn();
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} onSend={onSend} />);
    const input = screen.getByTestId("harness-input");

    await user.type(input, "/shrug{Enter}");
    expect(input).toHaveValue("¯\\_(ツ)_/¯ ");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("navigates with arrows and selects the highlighted command", async () => {
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} />);
    const input = screen.getByTestId("harness-input");

    await user.type(input, "/");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}"); // → /shrug
    expect(input).toHaveValue("¯\\_(ツ)_/¯ ");
  });

  it("Esc dismisses; leaving slash mode re-arms the menu", async () => {
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} />);
    const input = screen.getByTestId("harness-input");

    await user.type(input, "/mu");
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("slash-commands-menu")).not.toBeInTheDocument();

    // Still dismissed while the same slash draft continues…
    await user.type(input, "t");
    expect(screen.queryByTestId("slash-commands-menu")).not.toBeInTheDocument();

    // …but a fresh `/` after clearing re-opens it.
    await user.clear(input);
    await user.type(input, "/");
    expect(screen.getByTestId("slash-commands-menu")).toBeInTheDocument();
  });

  it("falls through to send when nothing matches", async () => {
    const onSend = jest.fn();
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} onSend={onSend} />);
    const input = screen.getByTestId("harness-input");

    await user.type(input, "/nonsense{Enter}");
    expect(onSend).toHaveBeenCalledWith("/nonsense");
  });

  it("selects a command by mouse click", async () => {
    const user = userEvent.setup();
    render(<Harness commands={COMMANDS} />);
    await user.type(screen.getByTestId("harness-input"), "/");
    await user.click(screen.getByTestId("slash-command-summarize"));
    expect(summarize).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the surface passes no commands", async () => {
    const user = userEvent.setup();
    render(<Harness commands={[]} />);
    await user.type(screen.getByTestId("harness-input"), "/");
    expect(screen.queryByTestId("slash-commands-menu")).not.toBeInTheDocument();
  });
});
