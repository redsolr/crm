import { buildRecordTimeline } from "../use-record-timeline";
import type { Activity } from "@/lib/activitiesApi";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import type { WorkItem } from "@/lib/workItemsApi";
import { makeWorkItem } from "./fixtures";

function makeItem(
  id: string,
  typeKey: "call_note" | "commitment",
  overrides: Partial<WorkItem> = {},
): WorkItem {
  return makeWorkItem(id, {
    title: `${typeKey} ${id}`,
    state: {
      id: "st-1",
      key: typeKey === "commitment" ? "open" : "active",
      name: "Open",
      category: "active",
    },
    type: { id: `wit-${typeKey}`, key: typeKey, name: typeKey },
    parent_id: "opp-1",
    created_at: "2026-07-10T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
    ...overrides,
  });
}

function def(id: string, key: string): AttributeDefinition {
  return { id, key } as AttributeDefinition;
}

const DEFS = [
  def("ad-call-date", "call_date"),
  def("ad-outcome", "outcome"),
  def("ad-call-type", "call_type"),
  def("ad-summary", "summary"),
  def("ad-due-date", "due_date"),
  def("ad-promised-to", "promised_to"),
];

function activity(id: string, at: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    type: "work_item_created",
    entity_type: "work_item",
    entity_id: "opp-1",
    entity_identifier: "SAL-1",
    project_id: "ws-1",
    actor_id: "u-1",
    changes: null,
    created_at: at,
    ...overrides,
  } as Activity;
}

describe("buildRecordTimeline", () => {
  it("merges all three streams sorted newest-first", () => {
    const note = makeItem("n1", "call_note");
    const commitment = makeItem("c1", "commitment", {
      created_at: "2026-07-15T00:00:00Z",
    });
    const entries = buildRecordTimeline(
      [activity("a1", "2026-07-01T00:00:00Z")],
      [note],
      [commitment],
      DEFS,
      {
        // call_date positions the note between the two others
        n1: [{ definition_id: "ad-call-date", value: "2026-07-12" }],
      },
    );
    expect(entries.map((e) => e.kind)).toEqual([
      "commitment",
      "call_note",
      "activity",
    ]);
  });

  it("projects call-note attributes (outcome / type / summary) and falls back to created_at without call_date", () => {
    const note = makeItem("n1", "call_note");
    const entries = buildRecordTimeline(
      [],
      [note],
      [],
      DEFS,
      {
        n1: [
          { definition_id: "ad-outcome", value: "positive" },
          { definition_id: "ad-call-type", value: "in_person_demo" },
          { definition_id: "ad-summary", value: "Great demo." },
        ],
      },
    );
    const entry = entries[0]!;
    expect(entry.kind).toBe("call_note");
    if (entry.kind !== "call_note") throw new Error("unreachable");
    expect(entry.at).toBe(note.created_at);
    expect(entry.outcome).toBe("positive");
    expect(entry.callType).toBe("in_person_demo");
    expect(entry.summary).toBe("Great demo.");
  });

  it("marks a done commitment and carries due date + promisee", () => {
    const commitment = makeItem("c1", "commitment", {
      state: { id: "st-d", key: "done", name: "Done", category: "done" },
    });
    const entries = buildRecordTimeline(
      [],
      [],
      [commitment],
      DEFS,
      {
        c1: [
          { definition_id: "ad-due-date", value: "2026-07-20" },
          { definition_id: "ad-promised-to", value: "Khun Somchai" },
        ],
      },
    );
    const entry = entries[0]!;
    if (entry.kind !== "commitment") throw new Error("unreachable");
    expect(entry.done).toBe(true);
    expect(entry.dueDate).toBe("2026-07-20");
    expect(entry.promisedTo).toBe("Khun Somchai");
  });

  it("renders a stage-change activity with a from → to detail", () => {
    const entries = buildRecordTimeline(
      [
        activity("a1", "2026-07-16T00:00:00Z", {
          type: "work_item_status_changed",
          changes: { state_key: { from: "contacted", to: "call_booked" } },
        }),
      ],
      [],
      [],
      DEFS,
      {},
    );
    const entry = entries[0]!;
    if (entry.kind !== "activity") throw new Error("unreachable");
    expect(entry.label).toBe("moved stage");
    expect(entry.detail).toBe("contacted → call booked");
  });

  it("ignores attribute rows whose definition is unknown or value non-string", () => {
    const note = makeItem("n1", "call_note");
    const entries = buildRecordTimeline(
      [],
      [note],
      [],
      DEFS,
      {
        n1: [
          { definition_id: "ad-unknown", value: "x" },
          { definition_id: "ad-outcome", value: 42 },
        ],
      },
    );
    const entry = entries[0]!;
    if (entry.kind !== "call_note") throw new Error("unreachable");
    expect(entry.outcome).toBeNull();
  });
});
