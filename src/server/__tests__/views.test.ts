import {
  createViewSchema,
  serializeSavedView,
  updateViewSchema,
  type SavedViewRow,
} from "@/server/views";

describe("saved-view wire serialization", () => {
  it("maps the row to the snake_case SavedView shape", () => {
    const row: SavedViewRow = {
      id: "view_abc",
      name: "Hot pipeline",
      kind: "work_items",
      visibility: "private",
      workspaceId: "ws_crm",
      ownerAccountId: "usr_local",
      ownerName: null,
      query: { filters: { stage: ["qualified"] }, groupBy: "stage" },
      createdAt: new Date("2026-07-31T10:00:00Z"),
      updatedAt: new Date("2026-07-31T11:00:00Z"),
    };
    expect(serializeSavedView(row)).toEqual({
      id: "view_abc",
      name: "Hot pipeline",
      kind: "work_items",
      visibility: "private",
      workspace_id: "ws_crm",
      owner_account_id: "usr_local",
      owner_name: null,
      query: { filters: { stage: ["qualified"] }, groupBy: "stage" },
      created_at: "2026-07-31T10:00:00.000Z",
      updated_at: "2026-07-31T11:00:00.000Z",
    });
  });

  it("serializes a null query blob as an empty object", () => {
    const row = {
      id: "view_x",
      name: "n",
      kind: "work_items",
      visibility: "shared",
      workspaceId: "ws_crm",
      ownerAccountId: "usr_local",
      ownerName: "Founder",
      query: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as unknown as SavedViewRow;
    expect(serializeSavedView(row).query).toEqual({});
  });
});

describe("saved-view request validation", () => {
  it("accepts a minimal create and rejects a nameless one", () => {
    expect(
      createViewSchema.safeParse({ name: "My view", kind: "work_items" })
        .success,
    ).toBe(true);
    expect(createViewSchema.safeParse({ kind: "work_items" }).success).toBe(
      false,
    );
  });

  it("rejects unknown visibility values", () => {
    expect(
      createViewSchema.safeParse({
        name: "v",
        kind: "work_items",
        visibility: "public",
      }).success,
    ).toBe(false);
  });

  it("requires at least one field on update", () => {
    expect(updateViewSchema.safeParse({}).success).toBe(false);
    expect(updateViewSchema.safeParse({ name: "renamed" }).success).toBe(true);
  });
});
