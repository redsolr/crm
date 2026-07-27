"use client";

import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BoardCardSlot } from "./BoardCardSlot";
import type {
  BoardCardBase,
  BoardCardDrag,
  BoardColumnDef,
} from "./board-data-source";

/** Inline "+ Create" composer (placeholder → input → Enter to create). */
function Composer({
  columnId,
  onCreate,
  alwaysVisible,
}: {
  columnId: string;
  onCreate: (columnId: string, title: string) => void;
  alwaysVisible: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const submit = () => {
    const t = title.trim();
    if (t.length === 0) {
      setAdding(false);
      return;
    }
    onCreate(columnId, t);
    setTitle("");
    setAdding(false);
  };

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className={`board-create-trigger flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm text-[var(--theme-text-secondary)] transition-opacity hover:bg-[var(--theme-bg-hover)] hover:text-[var(--theme-text-primary)] focus:opacity-100 group-hover/column:opacity-100 ${
          alwaysVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Create
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--theme-border-hover)] bg-[var(--theme-bg-primary)] p-3 shadow-sm">
      <input
        type="text"
        autoFocus
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setTitle("");
            setAdding(false);
          }
        }}
        onBlur={() => {
          if (title.trim().length === 0) setAdding(false);
        }}
        className="w-full bg-transparent text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none"
      />
    </div>
  );
}

export function BoardColumn<TCard extends BoardCardBase>({
  column,
  cards,
  isDropTarget,
  nestTargetId,
  selectedCardId,
  renderCard,
  renderColumnTop,
  renderColumnFooter,
  onCreate,
  renameColumn,
  showComposer,
  alwaysShowCreateTrigger,
}: {
  column: BoardColumnDef;
  cards: TCard[];
  isDropTarget: boolean;
  nestTargetId: string | null;
  selectedCardId?: string | null;
  renderCard: (card: TCard, drag: BoardCardDrag) => React.ReactNode;
  renameColumn?: (columnId: string, name: string) => Promise<unknown>;
  renderColumnTop?: (column: BoardColumnDef, cards: TCard[]) => React.ReactNode;
  renderColumnFooter?: (column: BoardColumnDef, cards: TCard[]) => React.ReactNode;
  onCreate?: (columnId: string, title: string) => void;
  showComposer: boolean;
  alwaysShowCreateTrigger: boolean;
}) {
  // The droppable fills the column body (`flex-1`) so the whole lane — even
  // when empty — is a drop target.
  const { setNodeRef } = useDroppable({ id: column.id });
  const cardIds = cards.map((c) => c.id);

  // Inline lane rename (double-click the header), when the source supports it.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.title);
  const commitRename = () => {
    setEditing(false);
    const name = draft.trim();
    if (renameColumn && name.length > 0 && name !== column.title) {
      void renameColumn(column.id, name);
    }
  };

  return (
    <div
      className={`project-board-column group/column flex w-[272px] min-w-[272px] flex-shrink-0 flex-col rounded-md bg-[var(--theme-bg-secondary)] transition-shadow ${
        isDropTarget ? "ring-2 ring-inset ring-[var(--theme-accent-blue)]" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="min-w-0 flex-1 rounded border border-[var(--theme-link)] bg-[var(--theme-bg-primary)] px-1 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-primary)] focus:outline-none"
          />
        ) : (
          <span
            role="presentation"
            className={`text-[11px] font-bold uppercase tracking-wider ${
              renameColumn ? "cursor-text" : ""
            }`}
            style={{ color: column.accent ?? "#6b7280" }}
            title={renameColumn ? "Double-click to rename lane" : undefined}
            onDoubleClick={
              renameColumn
                ? () => {
                    setDraft(column.title);
                    setEditing(true);
                  }
                : undefined
            }
          >
            {column.title}
          </span>
        )}
        {column.isDone && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill={column.accent ?? "#22a06b"}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        )}
        <span className="ml-auto text-[11px] text-[var(--theme-text-muted)]">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-1.5 pb-1.5">
        {renderColumnTop?.(column, cards)}
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="min-h-[120px] flex-1 space-y-1.5 rounded-md">
            {cards.map((card) => (
              <BoardCardSlot
                key={card.id}
                card={card}
                isNestTarget={nestTargetId === card.id}
                isSelected={selectedCardId === card.id}
                renderCard={renderCard}
              />
            ))}
            {showComposer && onCreate && (
              <Composer
                columnId={column.id}
                onCreate={onCreate}
                alwaysVisible={alwaysShowCreateTrigger}
              />
            )}
          </div>
        </SortableContext>
        {renderColumnFooter?.(column, cards)}
      </div>
    </div>
  );
}
