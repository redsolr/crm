"use client";

/**
 * Shared modal system — the single source of truth for all dialog UI.
 *
 * Usage:
 *   <Modal onClose={close}>
 *     <Modal.Title>Title</Modal.Title>
 *     <Modal.Description>Subtitle</Modal.Description>
 *     <Modal.Body>...content...</Modal.Body>
 *     <Modal.Actions>
 *       <Modal.Button onClick={fn}>Primary</Modal.Button>
 *       <Modal.ButtonMuted onClick={fn}>Secondary</Modal.ButtonMuted>
 *     </Modal.Actions>
 *   </Modal>
 *
 *   <Modal wide>  — two-column layout (e.g. cancel + feedback)
 *   <Modal.Success icon="check" onClose={fn}>  — success confirmation screen
 */

import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";

// ── Tokens ──────────────────────────────────────────────────────────────────

const BACKDROP = "fixed inset-0 z-50 flex items-center justify-center bg-black/60";

const CARD_BASE =
  "bg-[var(--theme-bg-secondary)] rounded-2xl border border-[var(--theme-border-secondary)] w-full mx-4 p-6 md:p-8 max-h-[calc(100dvh-2rem)] overflow-y-auto";

const SIZE = {
  compact: "max-w-md",
  default: "max-w-xl",
  wide: "max-w-4xl",
};

// rounded-lg, not rounded-full: pills belong to the auth/brand kit —
// inside the app chrome buttons share the inputs' radius (design
// guidelines § radius, 2026-07-19).
const BTN =
  "w-full py-3 rounded-lg text-sm font-medium bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-bg-active)] text-[var(--claude-text)] border border-[var(--theme-border-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

const BTN_CTA =
  "w-full py-3 rounded-lg text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed";

const BTN_MUTED =
  "w-full py-3 rounded-lg text-sm font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)] transition-colors";

// ── Root ────────────────────────────────────────────────────────────────────

function ModalRoot({
  onClose,
  wide,
  size,
  className,
  children,
}: {
  onClose: () => void;
  wide?: boolean;
  /** Card max-width. `wide` is kept for back-compat (≡ size="wide"). */
  size?: "compact" | "default" | "wide";
  /** Extra classes on the card (e.g. a stable hook for tests). */
  className?: string;
  children: React.ReactNode;
}) {
  const sizeClass =
    size === "compact"
      ? SIZE.compact
      : size === "wide" || wide
        ? SIZE.wide
        : SIZE.default;
  return (
    <div
      className={BACKDROP}
      role="button"
      tabIndex={0}
      aria-label="Close dialog"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className={`${CARD_BASE} ${sizeClass} ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Typography ──────────────────────────────────────────────────────────────

function Title({ children, standalone }: { children: React.ReactNode; standalone?: boolean }) {
  return (
    <h2 className={`text-xl font-bold text-[var(--claude-text)] ${standalone ? "mb-8" : "mb-2"}`}>
      {children}
    </h2>
  );
}

function Description({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[var(--theme-text-secondary)] mb-8">
      {children}
    </p>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────

function Body({ children }: { children: React.ReactNode }) {
  return <div className="mb-8">{children}</div>;
}

function Columns({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8">
      {children}
    </div>
  );
}

function Column({ children, divider }: { children: React.ReactNode; divider?: boolean }) {
  return (
    <>
      {divider && <div className="border-l border-[var(--theme-border-secondary)]" />}
      <div className="flex-1 min-w-0">{children}</div>
    </>
  );
}

// ── Order Details Card ──────────────────────────────────────────────────────

function OrderDetails({
  from,
  to,
  summary,
}: {
  from: { label: string; name: string; price: string };
  to: { label: string; name: string; price: string };
  summary?: { label: string; detail?: string; value: string };
}) {
  return (
    <div className="rounded-xl border border-[var(--theme-border-secondary)] p-6 mb-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)] mb-5">
        Order details
      </p>
      <div className="flex items-start gap-6">
        <div className="flex-1 space-y-1.5">
          <p className="text-xs text-[var(--theme-text-muted)]">{from.label}</p>
          <p className="text-base font-semibold text-[var(--claude-text)]">
            {from.name} plan
          </p>
          <p className="text-sm text-[var(--theme-text-secondary)]">
            {from.price}/mo
          </p>
        </div>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-[var(--theme-text-muted)] flex-shrink-0 mt-6"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <div className="flex-1 text-right space-y-1.5">
          <p className="text-xs text-[var(--theme-text-muted)]">{to.label}</p>
          <p className="text-base font-semibold text-[var(--claude-text)]">
            {to.name} plan
          </p>
          <p className="text-sm text-[var(--theme-text-secondary)]">
            {to.price}/mo
          </p>
        </div>
      </div>
      {summary && (
        <div className="flex items-center justify-between mt-5 pt-5 border-t border-[var(--theme-border-secondary)]">
          <div>
            <p className="text-sm text-[var(--theme-text-secondary)]">{summary.label}</p>
            {summary.detail && (
              <p className="text-sm text-[var(--theme-text-muted)] mt-0.5">{summary.detail}</p>
            )}
          </div>
          <span className="text-sm font-semibold text-[var(--claude-text)]">{summary.value}</span>
        </div>
      )}
    </div>
  );
}

// ── Notice ──────────────────────────────────────────────────────────────────

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 mb-8 text-sm text-[var(--theme-text-secondary)]">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="flex-shrink-0 mt-0.5 text-[var(--theme-text-muted)]"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <p>{children}</p>
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

function Actions({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function Button({
  children,
  onClick,
  disabled,
  loading,
  cta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  cta?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cta ? BTN_CTA : BTN} mb-3`}
      style={cta ? { background: "var(--ctx-accent-gradient, linear-gradient(135deg, #FF385C 0%, #E61E4D 50%, #D70466 100%))" } : undefined}
    >
      {loading ? "Processing..." : children}
    </button>
  );
}

function ButtonMuted({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={BTN_MUTED}>
      {children}
    </button>
  );
}

// ── Agreement Checkbox ──────────────────────────────────────────────────────

function Agreement({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 mb-8 cursor-pointer select-none">
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5 w-[18px] h-[18px] flex-shrink-0 rounded border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] data-[state=checked]:bg-[var(--ctx-accent-primary,#FF385C)] data-[state=checked]:border-[var(--ctx-accent-primary,#FF385C)] flex items-center justify-center transition-colors"
      >
        <Checkbox.Indicator>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6l2.5 2.5 4.5-5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span className="text-sm text-[var(--theme-text-secondary)] leading-relaxed">
        {children}
      </span>
    </label>
  );
}

// ── Radio Group ─────────────────────────────────────────────────────────────

function RadioSelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      className="space-y-0.5 mb-6"
    >
      {options.map((option) => (
        <label
          key={option}
          className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer select-none"
        >
          <RadioGroup.Item
            value={option}
            className="w-[18px] h-[18px] rounded-full border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] data-[state=checked]:bg-[var(--ctx-accent-primary,#FF385C)] data-[state=checked]:border-[var(--ctx-accent-primary,#FF385C)] flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <RadioGroup.Indicator className="flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </RadioGroup.Indicator>
          </RadioGroup.Item>
          <span className="text-sm text-[var(--theme-text-secondary)]">
            {option}
          </span>
        </label>
      ))}
    </RadioGroup.Root>
  );
}

// ── Success Screen ──────────────────────────────────────────────────────────

function Success({
  title,
  description,
  detail,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  detail?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <ModalRoot onClose={onClose}>
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-8 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-green-400"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[var(--claude-text)] mb-5">
          {title}
        </h2>
        <p className="text-sm text-[var(--theme-text-secondary)] mb-5">
          {description}
        </p>
        {detail && (
          <p className="text-sm text-[var(--theme-text-muted)] mb-10">
            {detail}
          </p>
        )}
        <button onClick={onClose} className={BTN}>
          Close
        </button>
      </div>
    </ModalRoot>
  );
}

// ── Textarea ────────────────────────────────────────────────────────────────

function Textarea({
  value,
  onChange,
  placeholder,
  maxLength = 500,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] text-sm text-[var(--claude-text)] placeholder:text-[var(--theme-text-muted)] resize-none focus:outline-none focus:border-[var(--theme-text-muted)]"
      />
      <span className="absolute bottom-3 right-3 text-xs text-[var(--theme-text-muted)]">
        {value.length}/{maxLength}
      </span>
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export const Modal = Object.assign(ModalRoot, {
  Title,
  Description,
  Body,
  Columns,
  Column,
  OrderDetails,
  Notice,
  Actions,
  Button,
  ButtonMuted,
  Agreement,
  RadioSelect,
  Success,
  Textarea,
});
