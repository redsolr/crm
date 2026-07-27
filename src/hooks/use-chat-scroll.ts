"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Chat scroll orchestration — the ChatGPT/Claude interaction model, built
 * from first principles instead of "always scroll to bottom":
 *
 * 1. SEND → ANCHOR TO TOP. When the user sends a message, the viewport
 *    scrolls once so that message sits at the top of the chat area, and a
 *    trailing spacer reserves enough scroll room below it for the answer
 *    to stream into. The reader's eye stays fixed at the top of the
 *    response instead of chasing text toward the bottom.
 * 2. STREAM → NO AUTO-SCROLL. As chunks arrive, the spacer shrinks by
 *    exactly the height the content grows, keeping the total scroll
 *    height — and therefore the scroll position — stable. Once the answer
 *    outgrows the reserved space it flows below the fold and the user
 *    reads at their own pace. This deletes the entire "cancel auto-follow
 *    when the user scrolls up" heuristic class: there is nothing to
 *    cancel because nothing follows.
 * 3. OPEN CHAT → JUMP TO LATEST. Loading an existing conversation lands
 *    on the newest turn instantly (no animation), like opening a thread
 *    in ChatGPT/Claude.
 * 4. JUMP-TO-LATEST PILL. `showJumpToLatest` is true whenever the
 *    viewport isn't near the bottom — consumers render a pill wired to
 *    `scrollToBottom`.
 *
 * Native browser scroll anchoring is disabled on the container: the
 * spacer arithmetic IS the anchoring, and the two fight otherwise.
 *
 * The container and content column attach via callback refs so consumers
 * that mount the scroller conditionally (mobile hides it on empty chats)
 * still get listeners/observers wired the moment the element appears.
 */

interface ChatScrollMessage {
  role: string;
  content: string;
}

interface UseChatScrollProps {
  messages: ChatScrollMessage[];
  /** Assigned by MessagesList to the wrapper of the newest user message. */
  lastMsgRef: React.RefObject<HTMLDivElement | null>;
}

/** Gap kept above the anchored user message so it doesn't touch the container edge. */
const TOP_GUTTER_PX = 16;
/** How close to the bottom (px) still counts as "at bottom" for the pill. */
const AT_BOTTOM_EPSILON_PX = 80;

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export function useChatScroll({ messages, lastMsgRef }: UseChatScrollProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);

  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  /**
   * Total scroll height (anchor scrollTop + clientHeight) the current turn
   * reserves; null when no reservation is active (idle / history view).
   * The reservation is deliberately kept after the turn completes — same
   * as ChatGPT — so the view never yanks back down when streaming ends.
   */
  const reservedHeightRef = useRef<number | null>(null);
  /** True while the programmatic anchor scroll animates — suppresses the pill. */
  const anchoringRef = useRef(false);
  const anchorTargetRef = useRef(0);
  const prevSnapshotRef = useRef({ count: 0, userCount: 0 });

  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (
      anchoringRef.current &&
      Math.abs(container.scrollTop - anchorTargetRef.current) < 2
    ) {
      anchoringRef.current = false;
    }
    const atBottom =
      container.scrollTop + container.clientHeight >=
      container.scrollHeight - AT_BOTTOM_EPSILON_PX;
    setShowJumpToLatest(!atBottom && !anchoringRef.current);
  }, []);

  /**
   * Keep the spacer honoring the active reservation: shrink it 1:1 as the
   * streamed answer grows (scroll height stays constant → no movement),
   * grow it back if layout reflows shorter. Runs from the content
   * ResizeObserver; converges because the observer re-fires after each
   * adjustment until the delta is zero or the spacer is exhausted.
   */
  const maintainReservation = useCallback(() => {
    const reserved = reservedHeightRef.current;
    const container = containerRef.current;
    const spacer = spacerRef.current;
    if (reserved === null || !container || !spacer) return;
    const current = spacer.offsetHeight;
    const delta = reserved - container.scrollHeight;
    const next = Math.max(0, current + delta);
    if (next !== current) {
      spacer.style.height = `${next}px`;
    }
  }, []);

  const collapseReservation = useCallback(() => {
    reservedHeightRef.current = null;
    const spacer = spacerRef.current;
    if (spacer) spacer.style.height = "0px";
  }, []);

  const scrollToBottom = useCallback((behavior?: ScrollBehavior) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight - container.clientHeight,
      behavior: behavior ?? preferredScrollBehavior(),
    });
  }, []);

  /**
   * The send-time anchor: reserve scroll room below the new user message,
   * then scroll it to the top of the viewport. The spacer is sized
   * iteratively because a flex-stretched content column can absorb spacer
   * height into its slack before it starts extending the scroll height.
   */
  const anchorToLastUserMessage = useCallback(() => {
    const container = containerRef.current;
    const spacer = spacerRef.current;
    const anchorEl = lastMsgRef.current;
    if (!container || !spacer || !anchorEl) return;

    const anchorTop =
      anchorEl.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    const targetTop = Math.max(0, anchorTop - TOP_GUTTER_PX);
    const reserved = targetTop + container.clientHeight;
    reservedHeightRef.current = reserved;

    spacer.style.height = "0px";
    let spacerHeight = 0;
    for (let i = 0; i < 4; i++) {
      const missing = reserved - container.scrollHeight;
      if (missing <= 0) break;
      spacerHeight += missing;
      spacer.style.height = `${spacerHeight}px`;
    }

    anchoringRef.current = true;
    anchorTargetRef.current = targetTop;
    container.scrollTo({ top: targetTop, behavior: preferredScrollBehavior() });
  }, [lastMsgRef]);

  /** Attach to the scrollable container (overflow-y-auto element). */
  const containerCleanupRef = useRef<(() => void) | null>(null);
  const attachContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerCleanupRef.current?.();
      containerCleanupRef.current = null;
      containerRef.current = el;
      if (!el) return;

      // We do our own anchoring via the spacer; the browser's heuristic
      // scroll anchoring fights it during streaming reflows.
      el.style.overflowAnchor = "none";

      const onScroll = () => updateScrollState();
      const onUserTakeover = () => {
        anchoringRef.current = false;
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      el.addEventListener("wheel", onUserTakeover, { passive: true });
      el.addEventListener("touchstart", onUserTakeover, { passive: true });
      containerCleanupRef.current = () => {
        el.removeEventListener("scroll", onScroll);
        el.removeEventListener("wheel", onUserTakeover);
        el.removeEventListener("touchstart", onUserTakeover);
      };
    },
    [updateScrollState],
  );

  /** Attach to the inner messages column (the element that grows while streaming). */
  const contentCleanupRef = useRef<(() => void) | null>(null);
  const attachContent = useCallback(
    (el: HTMLDivElement | null) => {
      contentCleanupRef.current?.();
      contentCleanupRef.current = null;
      if (!el) return;
      const observer = new ResizeObserver(() => {
        maintainReservation();
        updateScrollState();
      });
      observer.observe(el);
      contentCleanupRef.current = () => observer.disconnect();
    },
    [maintainReservation, updateScrollState],
  );

  useLayoutEffect(() => {
    const visible = messages.filter((m) => m.role !== "system");
    const userCount = visible.filter((m) => m.role === "user").length;
    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = { count: visible.length, userCount };

    if (visible.length === 0) {
      // Chat cleared / switched away — drop any leftover reservation so the
      // next conversation starts from clean geometry.
      collapseReservation();
      return;
    }

    if (userCount > prev.userCount) {
      const last = visible[visible.length - 1];
      // A live send ends with the user message itself or the empty
      // assistant placeholder the send pipeline appends alongside it.
      // A history load ends with a completed assistant message.
      const isActiveSend =
        last.role === "user" ||
        (last.role === "assistant" && last.content === "");
      if (isActiveSend) {
        anchorToLastUserMessage();
        return;
      }
    }

    if (prev.count === 0) {
      // Opening an existing conversation: land on the latest turn instantly.
      collapseReservation();
      scrollToBottom("auto");
    }
  }, [messages, anchorToLastUserMessage, collapseReservation, scrollToBottom]);

  return {
    attachContainer,
    attachContent,
    spacerRef,
    showJumpToLatest,
    scrollToBottom,
  };
}
