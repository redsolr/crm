"use client";

/**
 * A lightweight, dependency-free emoji picker popover for the team-chat
 * composer. A curated set of common emoji grouped into a few sections — enough
 * for everyday chat without pulling in a heavyweight emoji library. Handles
 * click-outside + Escape; the parent owns the open state and anchoring.
 */

import { useCallback, useEffect, useRef } from "react";

const EMOJI_SECTIONS: { label: string; emoji: string[] }[] = [
  {
    label: "Smileys",
    emoji: [
      "😀", "😄", "😁", "😅", "😂", "🙂", "😉", "😊", "😍", "😘",
      "😎", "🤔", "😴", "😇", "🙃", "😬", "😢", "😭", "😮", "😅",
      "😤", "😡", "🥳", "🤝", "😌", "😪", "🤗", "🤒", "🤯", "🥲",
    ],
  },
  {
    label: "Gestures",
    emoji: [
      "👍", "👎", "👌", "🙏", "👏", "🙌", "💪", "🤞", "✌️", "👋",
      "👀", "🫡", "🤙", "☝️", "✋", "🤟", "👉", "👈", "🫶", "🤦",
    ],
  },
  {
    label: "Symbols",
    emoji: [
      "✅", "❌", "⚠️", "❗", "❓", "💯", "🔥", "⭐", "✨", "🎉",
      "❤️", "💙", "💚", "📌", "📎", "🔒", "⏰", "📅", "💡", "⚖️",
    ],
  },
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  const handleOutside = useCallback(
    (e: MouseEvent) => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [handleOutside, handleKey]);

  return (
    <div
      ref={ref}
      className="team-chat-emoji-picker absolute bottom-full left-0 z-50 mb-2 max-h-64 w-64 overflow-y-auto rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] p-2 shadow-2xl [scrollbar-gutter:stable]"
      role="dialog"
      aria-label="Emoji picker"
      data-testid="emoji-picker"
    >
      {EMOJI_SECTIONS.map((section) => (
        <div key={section.label} className="team-chat-emoji-section mb-1.5">
          <div className="team-chat-emoji-section-label px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-text-muted)]">
            {section.label}
          </div>
          <div className="team-chat-emoji-grid grid grid-cols-8 gap-0.5">
            {section.emoji.map((e, i) => (
              <button
                key={`${section.label}-${i}`}
                type="button"
                className="team-chat-emoji-button flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-[var(--theme-bg-hover)]"
                // Keep composer focus — mousedown must not blur the textarea.
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => onPick(e)}
                aria-label={`Emoji ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmojiPicker;
