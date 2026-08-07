"use client";

/**
 * Task editor — one modal for everything a task carries: title, stage,
 * project space, priority, due date, assignee, plus delete. All fields
 * are local state committed on Save (one decision point, matching the
 * create-modal idiom), so a half-edited task never hits the wire.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { SelectMenu } from "@/components/ui/select";
import { Field, FORM_INPUT_CLASS as INPUT } from "@/components/sales/form";
import { workItemsApi, type WorkItem } from "@/lib/workItemsApi";
import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";
import {
  useTransitionWorkItem,
  useUpsertAttributeValue,
} from "@/lib/sales/use-sales-mutations";
import { queryKeys } from "@/queries/query-keys";
import {
  labelizeOptionKey,
  TASK_ASSIGNEE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_PROJECT_OPTIONS,
  TASK_STATE_LABELS,
  TASK_STATE_ORDER,
} from "@/lib/work/constants";
import { taskSnapshot } from "@/lib/work/task-snapshot";

// Static pick lists, built once at module scope (same convention as
// sales/select-options.ts — the work domain labels via
// labelizeOptionKey, so it keeps its own copies).
const STAGE_SELECT_OPTIONS = TASK_STATE_ORDER.map((key) => ({
  value: key,
  label: TASK_STATE_LABELS[key] ?? key,
}));
const PROJECT_SELECT_OPTIONS = TASK_PROJECT_OPTIONS.map((o) => ({
  value: o,
  label: labelizeOptionKey(o),
}));
const PRIORITY_SELECT_OPTIONS = TASK_PRIORITY_OPTIONS.map((o) => ({
  value: o,
  label: labelizeOptionKey(o),
}));
const ASSIGNEE_SELECT_OPTIONS = TASK_ASSIGNEE_OPTIONS.map((o) => ({
  value: o,
  label: labelizeOptionKey(o),
}));

interface Props {
  task: WorkItem;
  definitions: AttributeDefinition[];
  values: AttributeValue[];
  onClose: () => void;
}

export function TaskEditModal({ task, definitions, values, onClose }: Props) {
  const snapshot = taskSnapshot(values, definitions);
  const [title, setTitle] = useState(task.title);
  const [stateKey, setStateKey] = useState(task.state.key);
  const [project, setProject] = useState(snapshot.project ?? "");
  const [priority, setPriority] = useState(snapshot.priority ?? "");
  const [dueDate, setDueDate] = useState(snapshot.due_date ?? "");
  const [assignee, setAssignee] = useState(snapshot.assignee ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const transition = useTransitionWorkItem();
  const upsertAttribute = useUpsertAttributeValue();

  const canSubmit = title.trim().length > 0 && !submitting;

  function definitionId(key: string): string | null {
    return definitions.find((d) => d.key === key)?.id ?? null;
  }

  async function handleSave() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let version = task.version;
      if (title.trim() !== task.title) {
        const { workItem } = await workItemsApi.updateWorkItem(
          task.id,
          { title: title.trim() },
          version,
        );
        version = workItem.version;
      }
      if (stateKey !== task.state.key) {
        await transition.mutateAsync({ id: task.id, version, state_key: stateKey });
      }
      const attributeWrites: Array<[string, string, string | null]> = [
        ["project", project, snapshot.project],
        ["priority", priority, snapshot.priority],
        ["due_date", dueDate, snapshot.due_date],
        ["assignee", assignee, snapshot.assignee],
      ];
      for (const [key, next, previous] of attributeWrites) {
        const defId = definitionId(key);
        if (!defId || next === (previous ?? "") || next === "") continue;
        await upsertAttribute.mutateAsync({
          workItemId: task.id,
          definitionId: defId,
          value: next,
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
      onClose();
    } catch (err) {
      console.error("[TaskEditModal] save failed:", err);
      setError("Could not save the task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await workItemsApi.deleteWorkItem(task.id, task.version);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems.all });
      onClose();
    } catch (err) {
      console.error("[TaskEditModal] delete failed:", err);
      setError("Could not delete the task. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>{task.identifier}</Modal.Title>
      <Modal.Body>
        <div className="space-y-4">
          <Field label="Title" required>
            <input
              type="text"
              data-testid="work-task-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Stage">
              <SelectMenu
                testId="work-task-stage-select"
                value={stateKey}
                onChange={setStateKey}
                options={STAGE_SELECT_OPTIONS}
                className={INPUT}
                ariaLabel="Stage"
              />
            </Field>
            <Field label="Project">
              <SelectMenu
                testId="work-task-project-select"
                value={project}
                onChange={setProject}
                options={PROJECT_SELECT_OPTIONS}
                placeholder="Pick a project…"
                className={INPUT}
                ariaLabel="Project"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Priority">
              <SelectMenu
                testId="work-task-priority-select"
                value={priority}
                onChange={setPriority}
                options={PRIORITY_SELECT_OPTIONS}
                placeholder="None"
                emptyOptionLabel="None"
                className={INPUT}
                ariaLabel="Priority"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                data-testid="work-task-due-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Assignee">
            <SelectMenu
              testId="work-task-assignee-select"
              value={assignee}
              onChange={setAssignee}
              options={ASSIGNEE_SELECT_OPTIONS}
              placeholder="Unassigned"
              emptyOptionLabel="Unassigned"
              className={INPUT}
              ariaLabel="Assignee"
            />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button
          cta
          onClick={handleSave}
          disabled={!canSubmit}
          loading={submitting}
        >
          Save
        </Modal.Button>
        <Modal.ButtonMuted onClick={handleDelete}>
          {confirmingDelete ? "Confirm delete" : "Delete task"}
        </Modal.ButtonMuted>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
