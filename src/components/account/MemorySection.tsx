"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memoriesApi } from "@/lib/memoriesApi";
import { queryKeys } from "@/queries/query-keys";

/**
 * Account → Assistant memory: the founder's window into what the
 * assistant remembers (ChatGPT-memory shape). The agent saves facts
 * from conversation via remember_fact; here they can be reviewed,
 * added by hand (standing rules), and deleted.
 */
export function MemorySection() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const memories = useQuery({
    queryKey: queryKeys.memories.all,
    queryFn: () => memoriesApi.listMemories(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.memories.all });

  const create = useMutation({
    mutationFn: (value: string) => memoriesApi.createMemory(value),
    onSuccess: () => {
      setContent("");
      setFormError(null);
      void invalidate();
    },
    onError: (err) => {
      console.error("[memories] create failed:", err);
      setFormError(
        err instanceof Error ? err.message : "Could not save the memory.",
      );
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => memoriesApi.deleteMemory(id),
    onSuccess: () => void invalidate(),
    onError: (err) => console.error("[memories] delete failed:", err),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = content.trim();
    if (value === "") {
      setFormError("Write the fact to remember first.");
      return;
    }
    create.mutate(value);
  }

  const rows = memories.data ?? [];

  return (
    <section className="crm-panel space-y-3" data-testid="account-memory">
      <h2 className="crm-panel-title">Assistant memory</h2>
      <p className="text-[13px] text-[var(--theme-text-muted)]">
        Standing facts the assistant applies in every Ask conversation —
        it saves them itself when you share something durable ("remember
        that…"), or add one here. Delete anything it shouldn't keep.
      </p>

      <form
        onSubmit={handleSubmit}
        className="memory-create flex gap-2"
        data-testid="memory-create-form"
      >
        <input
          type="text"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setFormError(null);
          }}
          maxLength={500}
          placeholder="e.g. Keep follow-up drafts short and direct"
          className="min-w-0 flex-1 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] px-3 py-2 text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-text-muted)]"
          data-testid="memory-content-input"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="crm-btn-ghost shrink-0 disabled:opacity-50"
          data-testid="memory-create-button"
        >
          {create.isPending ? "Saving…" : "Remember"}
        </button>
      </form>
      {formError !== null && (
        <p
          className="text-[12.5px] text-[var(--crm-red)]"
          data-testid="memory-error"
        >
          {formError}
        </p>
      )}

      {memories.isLoading ? (
        <p className="text-[13px] text-[var(--theme-text-muted)]">
          Loading memories…
        </p>
      ) : memories.isError ? (
        <p
          className="text-[12.5px] text-[var(--crm-red)]"
          data-testid="memory-load-error"
        >
          Could not load memories — reload to retry.
        </p>
      ) : rows.length === 0 ? (
        <p
          className="text-[13px] text-[var(--theme-text-muted)]"
          data-testid="memory-empty"
        >
          Nothing saved yet.
        </p>
      ) : (
        <div className="space-y-2" data-testid="memory-list">
          {rows.map((memory) => (
            <div
              key={memory.id}
              className="crm-row-card crm-row-card-inset"
              data-testid="memory-row"
            >
              <span className="min-w-0 flex-1 text-[13px] text-[var(--theme-text-primary)]">
                {memory.content}
              </span>
              {memory.created_by_name !== null && (
                <span className="shrink-0 text-[11px] text-[var(--theme-text-muted)]">
                  {memory.created_by_name}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove.mutate(memory.id)}
                disabled={remove.isPending}
                className="crm-btn-ghost crm-btn-xs text-[var(--crm-red)] disabled:opacity-50"
                data-testid="memory-row-delete"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
