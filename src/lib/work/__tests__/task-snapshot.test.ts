import { isOverdue, taskSnapshot } from "../task-snapshot";
import { labelizeOptionKey } from "../constants";
import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";

const DEFS = [
  { id: "ad-project", key: "project" },
  { id: "ad-priority", key: "priority" },
  { id: "ad-due", key: "due_date" },
  { id: "ad-assignee", key: "assignee" },
] as AttributeDefinition[];

function value(definitionId: string, v: unknown): AttributeValue {
  return {
    id: `av-${definitionId}`,
    work_item_id: "wi-1",
    definition_id: definitionId,
    value: v,
    created_at: "2026-08-06T00:00:00.000Z",
    updated_at: "2026-08-06T00:00:00.000Z",
  } as AttributeValue;
}

describe("taskSnapshot", () => {
  it("maps value rows back to attribute keys", () => {
    const snapshot = taskSnapshot(
      [
        value("ad-project", "crm"),
        value("ad-priority", "high"),
        value("ad-due", "2026-08-10"),
        value("ad-assignee", "claude"),
      ],
      DEFS,
    );
    expect(snapshot).toEqual({
      project: "crm",
      priority: "high",
      due_date: "2026-08-10",
      assignee: "claude",
    });
  });

  it("returns nulls for missing, empty, and unknown-definition rows", () => {
    expect(taskSnapshot(undefined, DEFS)).toEqual({
      project: null,
      priority: null,
      due_date: null,
      assignee: null,
    });
    const snapshot = taskSnapshot(
      [value("ad-project", ""), value("ad-unknown", "x"), value("ad-due", 42)],
      DEFS,
    );
    expect(snapshot.project).toBeNull();
    expect(snapshot.due_date).toBeNull();
  });
});

describe("isOverdue", () => {
  const today = "2026-08-06";
  it("is true only strictly before today", () => {
    expect(isOverdue("2026-08-05", today)).toBe(true);
    expect(isOverdue("2026-08-06", today)).toBe(false);
    expect(isOverdue("2026-08-07", today)).toBe(false);
    expect(isOverdue(null, today)).toBe(false);
  });
});

describe("labelizeOptionKey", () => {
  it("title-cases snake_case option keys", () => {
    expect(labelizeOptionKey("class_room")).toBe("Class Room");
    expect(labelizeOptionKey("crm")).toBe("Crm");
    expect(labelizeOptionKey("in_progress")).toBe("In Progress");
  });
});
