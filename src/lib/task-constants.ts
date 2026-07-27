import type { WorkItemPriority } from "./workItemsApi";

export const PRIORITY_COLORS: Record<WorkItemPriority, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  none: "#6b7280",
};

export const STATUS_OPTIONS: {
  key: string;
  label: string;
  color: string;
}[] = [
  { key: "backlog", label: "Backlog", color: "#6b7280" },
  { key: "todo", label: "TO DO", color: "#388bff" },
  { key: "in_progress", label: "IN PROGRESS", color: "#1d7afc" },
  { key: "in_review", label: "IN REVIEW", color: "#9f8fef" },
  { key: "done", label: "DONE", color: "#22a06b" },
  { key: "cancelled", label: "CANCELLED", color: "#6E6E73" },
];

export const PRIORITY_OPTIONS: {
  key: WorkItemPriority;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: "none", label: "None", icon: "—", color: "#6b7280" },
  { key: "low", label: "Low", icon: "↓", color: "#22c55e" },
  { key: "medium", label: "Medium", icon: "=", color: "#f97316" },
  { key: "high", label: "High", icon: "↑", color: "#ef4444" },
  { key: "urgent", label: "Urgent", icon: "⬆", color: "#ef4444" },
];

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  backlog: { bg: "#3a3f47", text: "#9fadbc" },
  todo: { bg: "#1c3d5e", text: "#579dff" },
  in_progress: { bg: "#1c3d5e", text: "#579dff" },
  in_review: { bg: "#352c63", text: "#9f8fef" },
  done: { bg: "#1c3d2e", text: "#4bce97" },
  cancelled: { bg: "#3a3f47", text: "#9fadbc" },
};

// Jira-style resolution values
export const RESOLUTION_OPTIONS = [
  { key: "unresolved", label: "Unresolved" },
  { key: "done", label: "Done" },
  { key: "wont_do", label: "Won't Do" },
  { key: "duplicate", label: "Duplicate" },
] as const;

// WorkItem type icons (Jira-style colored shapes)
export const TASK_TYPE_STYLES: Record<
  string,
  { className: string; label: string }
> = {
  task: {
    className:
      "w-4 h-4 rounded-sm bg-[#388bff] flex items-center justify-center",
    label: "WorkItem",
  },
  story: {
    className:
      "w-4 h-4 rounded-sm bg-[#22a06b] flex items-center justify-center",
    label: "Story",
  },
  bug: {
    className:
      "w-4 h-4 rounded-full bg-[#ef4444] flex items-center justify-center",
    label: "Bug",
  },
  subtask: {
    className:
      "w-4 h-4 rounded-sm bg-[#579dff] flex items-center justify-center",
    label: "Sub-task",
  },
  epic: {
    className:
      "w-4 h-4 rounded-sm bg-[#9f8fef] flex items-center justify-center",
    label: "Epic",
  },
};

// ============================================================================
// Default Workflow Statuses (matches Flutter kDefaultStatuses)
// ============================================================================

export type StatusCategory = "backlog" | "active" | "done" | "cancelled";

export interface WorkflowStatus {
  key: string;
  name: string;
  category: StatusCategory;
  position: number;
}

export const DEFAULT_WORKFLOW_STATUSES: WorkflowStatus[] = [
  { key: "backlog", name: "Backlog", category: "backlog", position: 0 },
  { key: "todo", name: "Todo", category: "active", position: 1 },
  { key: "in_progress", name: "In Progress", category: "active", position: 2 },
  { key: "in_review", name: "In Review", category: "active", position: 3 },
  { key: "done", name: "Done", category: "done", position: 4 },
  { key: "cancelled", name: "Cancelled", category: "cancelled", position: 5 },
];

// Per-status color for known built-in keys (matches Flutter statusColorForKey)
export const STATUS_DOT_COLORS: Record<string, string> = {
  backlog: "#B0B0B4",
  todo: "#8DC4F0",
  in_progress: "#FF9F0A",
  in_review: "#BF5AF2",
  done: "#34C759",
  cancelled: "#6E6E73",
};

// ============================================================================
// Default Tags (matches Flutter _defaultTags)
// ============================================================================

export interface DefaultTag {
  name: string;
  color: string;
  description: string;
}

export const DEFAULT_TAGS: DefaultTag[] = [
  {
    name: "Urgent",
    color: "#FF453A",
    description: "Needs immediate attention",
  },
  {
    name: "In Review",
    color: "#F59E0B",
    description: "Awaiting review or approval",
  },
  {
    name: "Blocked",
    color: "#EF4444",
    description: "Cannot proceed until resolved",
  },
  {
    name: "Research",
    color: "#0A84FF",
    description: "Requires investigation or analysis",
  },
  {
    name: "Quick Win",
    color: "#30D158",
    description: "Small effort, high impact",
  },
  {
    name: "Idea",
    color: "#8B5CF6",
    description: "Potential future initiative",
  },
  {
    name: "Meeting",
    color: "#06B6D4",
    description: "Related to a meeting or discussion",
  },
  {
    name: "Unknown",
    color: "#6B7280",
    description: "Uncategorized or needs triage",
  },
];
