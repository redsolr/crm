"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardCardBase, BoardCardDrag } from "./board-data-source";

/**
 * One sortable card slot. Wires `@dnd-kit/sortable` and hands the drag props to
 * the consumer's `renderCard`. While dragging, the slot stays mounted as a
 * faded, dashed skeleton (the opaque clone follows the cursor via the board's
 * DragOverlay) so the drop position is obvious and the layout doesn't jump.
 */
export function BoardCardSlot<TCard extends BoardCardBase>({
  card,
  isNestTarget,
  isSelected,
  renderCard,
}: {
  card: TCard;
  isNestTarget: boolean;
  isSelected: boolean;
  renderCard: (card: TCard, drag: BoardCardDrag) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    // Always animate layout changes so siblings ease into place one-at-a-time
    // (the dnd-kit multi-container recommendation) instead of snapping.
    animateLayoutChanges: () => true,
  });

  // The dragged card stays mounted as a faded, dashed **preview placeholder**
  // that glides to its drop slot (the sortable strategy transforms it there),
  // while the opaque clone follows the cursor via the board's DragOverlay. The
  // earlier "jiggle" was the collision flip-flopping the drop target every
  // frame — fixed in <Board> — so this preview now moves smoothly instead of
  // jittering, and the drop position stays visible (which a 0-opacity gap lost).
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
    opacity: isDragging ? 0.4 : 1,
    ...(isDragging
      ? {
          outline: "2px dashed var(--theme-accent-blue)",
          outlineOffset: "-2px",
          borderRadius: 8,
        }
      : {}),
  };

  return (
    <>
      {renderCard(card, {
        setNodeRef,
        style,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as unknown as Record<string, unknown> | undefined,
        isDragging,
        isNestTarget,
        isSelected,
      })}
    </>
  );
}
