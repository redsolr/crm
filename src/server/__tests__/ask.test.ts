import { ChatResponseSchema } from "@/lib/chat/schemas";
import { ASK_TOOLS, ASK_TOOLS_BY_NAME } from "@/server/ask-tools";

describe("Ask wire contract", () => {
  it("serves a chat shape the frontend ChatResponseSchema parses", () => {
    // Mirrors serializeChat's output (importing @/server/ask would drag
    // the DB client into jsdom; the shape is the contract under test).
    const wire = {
      id: "chat_4h6TestBase58",
      title: "Which deals need attention?",
      page_id: null,
      findings_count: 0,
      parent_chat_id: null,
      branched_from_message_id: null,
      branch_name: null,
      starred: false,
      ephemeral: false,
      created_at: "2026-07-30T00:00:00.000Z",
      updated_at: "2026-07-30T00:00:00.000Z",
    };
    const parsed = ChatResponseSchema.parse(wire);
    expect(parsed.id).toBe("chat_4h6TestBase58");
    expect(parsed.ephemeral).toBe(false);
  });
});

describe("Ask sales tools", () => {
  it("exposes exactly the 5 platform sales tools by name", () => {
    expect(ASK_TOOLS.map((t) => t.definition.name).sort()).toEqual([
      "create_account",
      "create_opportunity",
      "find_crm_record",
      "log_call_note",
      "update_opportunity",
    ]);
    expect(ASK_TOOLS_BY_NAME.get("find_crm_record")).toBeDefined();
  });

  it("declares Messages-API tool definitions (input_schema with required)", () => {
    for (const tool of ASK_TOOLS) {
      expect(tool.definition.input_schema.type).toBe("object");
      expect(Array.isArray(tool.definition.input_schema.required)).toBe(true);
      expect(tool.definition.description.length).toBeGreaterThan(20);
    }
  });
});
