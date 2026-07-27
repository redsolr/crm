"use client";

/**
 * Shared message composer — the ONE input surface for team chat, the lawyer
 * Communications window, and the public client chat (Slack anatomy: an
 * optional formatting bar, a full-width textarea, and a bottom action rail
 * with the send button at the far right).
 *
 * The component owns LOOK + INTERACTIONS (icons, layout, focus ring,
 * markdown shortcuts, emoji, paste/drag-to-attach, chips, Enter-to-send);
 * the PARENT owns the data flow (upload pipeline, send mutation, slash /
 * mention menus via `aboveInput` + `onInputKeyDown`). That split exists
 * because the three surfaces upload through different endpoints and attach
 * on different lifecycles — the seam keeps them honest without three
 * divergent composers.
 *
 * Class names are caller-supplied per slot (`classNames`) — they are the
 * semantic hooks the e2e suites select on (`team-chat-composer-input`,
 * `communications-chat-send`, …), so the rebuild changes pixels, never
 * selectors.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AtSign,
  Bold,
  Braces,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Plus,
  SendHorizontal,
  Smile,
  TextQuote,
  X,
} from "lucide-react";
import { EmojiPicker } from "@/components/shared/EmojiPicker";
import {
  applyMarkdown,
  insertText,
  type MarkdownAction,
} from "@/lib/markdown-format";

/** One pending attachment chip (parent owns the upload lifecycle). */
export interface ComposerAttachment {
  id: string;
  fileName: string;
  contentType: string;
  status: "uploading" | "ready" | "error";
  /** Object URL for an image thumbnail; the parent revokes it. */
  previewUrl?: string;
}

/** Per-slot class hooks — the e2e selector contract each surface preserves. */
export interface ComposerClassNames {
  /** Outer wrapper (e.g. `team-chat-composer`). */
  root: string;
  /** The textarea (e.g. `communications-chat-composer-input`). */
  input: string;
  /** Send button (e.g. `team-chat-composer-send` / `communications-chat-send`). */
  send: string;
  /** Emoji toggle (e.g. `team-chat-composer-emoji`). */
  emoji: string;
  /** Attach button (e.g. `communications-chat-attach` / `public-chat-attach-button`). */
  attach: string;
  /** Hidden file input (e.g. `communications-chat-attach-input`). */
  attachInput?: string;
  /** Attachment chip (e.g. `team-chat-composer-attachment-chip`). */
  chip?: string;
  /** Relative wrapper around the textarea (slash/mention menu anchor). */
  field?: string;
}

export interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Fire the send. The parent guards with `canSend` itself too. */
  onSend: () => void;
  placeholder: string;
  /** Whether send is currently allowed (content present, nothing uploading…). */
  canSend: boolean;
  /** Tooltip on the send button while disabled (e.g. "Uploading…"). */
  sendTitle?: string;
  /** Markdown toolbar + Ctrl/Cmd shortcuts (team chat; OFF for plain-text channels). */
  formatting?: boolean;
  /** Show the @ rail button (inserts `@` — the parent's typeahead reacts). */
  mentionButton?: boolean;
  /** Pending attachment chips (parent-owned). Omit for chip-less surfaces. */
  attachments?: ComposerAttachment[];
  /** Files picked / pasted / dropped — parent runs its upload pipeline. */
  onPickFiles?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  attachAccept?: string;
  attachDisabled?: boolean;
  /** `data-testid` stamped on each chip (comms e2e contract). */
  chipTestId?: string;
  /**
   * Parent key handler running BEFORE the composer's own (slash/mention
   * menus own arrows/enter while open). Return `true` when handled.
   */
  onInputKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Extra aria props for the textarea (combobox wiring for menus). */
  inputAriaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  /** Rendered inside the field anchor, above the textarea (slash/mention menu). */
  aboveInput?: React.ReactNode;
  /** External ref to the textarea (parents restore carets / focus). */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  classNames: ComposerClassNames;
}

/** One monochrome rail/toolbar icon button. */
function RailButton({
  label,
  onClick,
  disabled = false,
  className = "",
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  expanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`composer-rail-button flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--theme-text-muted)] transition-colors hover:bg-[var(--theme-bg-hover)] hover:text-[var(--theme-text-primary)] disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const FORMAT_ACTIONS: {
  action: MarkdownAction;
  label: string;
  Icon: typeof Bold;
}[] = [
  { action: "bold", label: "Bold (Ctrl/Cmd+B)", Icon: Bold },
  { action: "italic", label: "Italic (Ctrl/Cmd+I)", Icon: Italic },
  { action: "code", label: "Code", Icon: Code },
  { action: "codeblock", label: "Code block", Icon: Braces },
  { action: "link", label: "Link (Ctrl/Cmd+K)", Icon: Link2 },
  { action: "ul", label: "Bulleted list", Icon: List },
  { action: "ol", label: "Numbered list", Icon: ListOrdered },
  { action: "quote", label: "Quote", Icon: TextQuote },
];

export function MessageComposer({
  value,
  onChange,
  onSend,
  placeholder,
  canSend,
  sendTitle,
  formatting = false,
  mentionButton = false,
  attachments,
  onPickFiles,
  onRemoveAttachment,
  attachAccept,
  attachDisabled = false,
  chipTestId,
  onInputKeyDown,
  inputAriaProps,
  aboveInput,
  textareaRef,
  classNames,
}: MessageComposerProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const taRef = textareaRef ?? internalRef;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fmtOpen, setFmtOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  // Caret to restore AFTER the controlled value re-renders (markdown/emoji
  // insertions land the caret where the user expects).
  const pendingSel = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (pendingSel.current !== null && ta !== null) {
      ta.focus();
      ta.setSelectionRange(pendingSel.current.start, pendingSel.current.end);
      pendingSel.current = null;
    }
  }, [value, taRef]);

  // Auto-grow the textarea with content (capped by max-h + scroll).
  useEffect(() => {
    const ta = taRef.current;
    if (ta === null) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value, taRef]);

  const runAction = (action: MarkdownAction): void => {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const next = applyMarkdown(action, { value, start, end });
    pendingSel.current = { start: next.start, end: next.end };
    onChange(next.value);
  };

  const insertAtCaret = (text: string): void => {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const next = insertText({ value, start, end }, text);
    pendingSel.current = { start: next.start, end: next.end };
    onChange(next.value);
  };

  const pickFiles = (list: FileList | File[] | null): void => {
    if (onPickFiles === undefined || list === null) return;
    const files = Array.from(list);
    if (files.length > 0) onPickFiles(files);
  };

  const attachable = onPickFiles !== undefined;

  return (
    <div className={`${classNames.root} px-3 pb-3 pt-1`}>
      <div
        role="presentation"
        className={`composer-box flex flex-col gap-1 rounded-xl border bg-[var(--theme-bg-secondary)] px-2.5 pb-1.5 pt-2 transition-colors focus-within:border-[var(--theme-accent-border)] focus-within:ring-1 focus-within:ring-[var(--theme-accent-border)] ${
          dragOver
            ? "composer-box-dragover border-[var(--theme-accent-border)] ring-1 ring-[var(--theme-accent-border)]"
            : "border-[var(--theme-border-secondary)]"
        }`}
        onDragOver={(e) => {
          if (!attachable) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!attachable) return;
          e.preventDefault();
          setDragOver(false);
          pickFiles(e.dataTransfer.files);
        }}
      >
        {/* Formatting toolbar — Aa-toggleable, only on markdown surfaces. */}
        {formatting && fmtOpen && (
          <div className="composer-formatting-toolbar flex items-center gap-0.5 border-b border-[var(--theme-border-primary)] pb-1">
            {FORMAT_ACTIONS.map(({ action, label, Icon }) => (
              <RailButton
                key={action}
                label={label}
                className="composer-fmt-button"
                onClick={() => runAction(action)}
              >
                <Icon size={15} strokeWidth={2} />
              </RailButton>
            ))}
          </div>
        )}

        {/* Pending attachment chips (parent-owned lifecycle). */}
        {attachments !== undefined && attachments.length > 0 && (
          <div className="composer-attachments flex flex-wrap items-center gap-1.5 pt-0.5">
            {attachments.map((a) => (
              <span
                key={a.id}
                className={`${classNames.chip ?? "composer-attachment-chip"} flex max-w-[15rem] items-center gap-1.5 rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] py-1 pl-1.5 pr-2 text-xs text-[var(--theme-text-secondary)]`}
                {...(chipTestId !== undefined && { "data-testid": chipTestId })}
              >
                {a.previewUrl !== undefined ? (
                  // Object URLs are local blobs — the Next optimizer can't
                  // (and shouldn't) proxy them, hence unoptimized.
                  <Image
                    src={a.previewUrl}
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                    className="composer-attachment-thumb h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <Paperclip size={13} aria-hidden="true" />
                )}
                <span className="composer-attachment-name truncate">
                  {a.fileName}
                </span>
                {a.status === "uploading" && (
                  <Loader2
                    size={13}
                    className="composer-attachment-uploading animate-spin text-[var(--theme-text-muted)]"
                    aria-label="Uploading"
                  />
                )}
                {a.status === "error" && (
                  <span className="composer-attachment-error text-[var(--theme-accent-red)]">
                    failed
                  </span>
                )}
                {onRemoveAttachment !== undefined && (
                  <button
                    type="button"
                    className="composer-attachment-remove text-[var(--theme-text-muted)] transition-colors hover:text-[var(--theme-text-primary)]"
                    aria-label={`Remove ${a.fileName}`}
                    onClick={() => onRemoveAttachment(a.id)}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Full-width input. The relative wrapper anchors slash/mention menus. */}
        <div className={`${classNames.field ?? "composer-field"} relative`}>
          {aboveInput}
          <textarea
            ref={taRef}
            className={`${classNames.input} max-h-40 min-h-[1.75rem] w-full resize-none bg-transparent px-0.5 py-1 text-sm leading-relaxed text-[var(--theme-text-primary)] outline-none placeholder:text-[var(--theme-text-muted)]`}
            rows={1}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
              if (!attachable) return;
              const files = e.clipboardData?.files;
              if (files !== undefined && files.length > 0) {
                e.preventDefault();
                pickFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (onInputKeyDown?.(e) === true) return;
              if (formatting && (e.ctrlKey || e.metaKey)) {
                const key = e.key.toLowerCase();
                if (key === "b" || key === "i" || key === "k") {
                  e.preventDefault();
                  runAction(
                    key === "b" ? "bold" : key === "i" ? "italic" : "link",
                  );
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            {...inputAriaProps}
          />
        </div>

        {/* Bottom action rail — attach / Aa / emoji / @ … spacer … send. */}
        <div className="composer-rail flex items-center gap-0.5">
          {attachable && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                {...(attachAccept !== undefined && { accept: attachAccept })}
                className={`${classNames.attachInput ?? "composer-attach-input"} hidden`}
                onChange={(e) => {
                  pickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <RailButton
                label="Attach file"
                className={classNames.attach}
                disabled={attachDisabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={16} strokeWidth={2.25} />
              </RailButton>
            </>
          )}
          {formatting && (
            <RailButton
              label={fmtOpen ? "Hide formatting" : "Show formatting"}
              expanded={fmtOpen}
              onClick={() => setFmtOpen((o) => !o)}
            >
              <span
                className={`composer-fmt-toggle text-[12px] font-semibold ${fmtOpen ? "text-[var(--theme-text-primary)]" : ""}`}
              >
                Aa
              </span>
            </RailButton>
          )}
          <div className="composer-emoji-anchor relative shrink-0">
            <RailButton
              label="Emoji"
              className={classNames.emoji}
              expanded={emojiOpen}
              onClick={() => setEmojiOpen((o) => !o)}
            >
              <Smile size={16} />
            </RailButton>
            {emojiOpen && (
              <EmojiPicker
                onPick={(emoji) => {
                  insertAtCaret(emoji);
                  setEmojiOpen(false);
                }}
                onClose={() => setEmojiOpen(false)}
              />
            )}
          </div>
          {mentionButton && (
            <RailButton
              label="Mention someone"
              onClick={() => insertAtCaret("@")}
            >
              <AtSign size={15} />
            </RailButton>
          )}

          <span className="composer-hint ml-auto mr-2 hidden select-none text-[11px] text-[var(--theme-text-muted)] sm:inline">
            <kbd className="font-sans">Shift</kbd>+<kbd className="font-sans">Enter</kbd> for a new line
          </span>
          <button
            type="button"
            className={`${classNames.send} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              canSend
                ? "bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent-hover)]"
                : "bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-muted)]"
            }`}
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send"
            title={sendTitle ?? "Send"}
          >
            <SendHorizontal size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
