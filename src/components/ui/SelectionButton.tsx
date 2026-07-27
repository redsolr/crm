"use client";

interface SelectionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: "accent" | "light";
  showCheck?: boolean;
}

const VARIANTS = {
  accent: {
    selected: "bg-white border-[#FF385C] border-[1.5px] text-[#FF385C]",
    unselected:
      "bg-ctx-soft border-[1.5px] border-ctx-line text-ctx-primary hover:border-ctx-muted",
  },
  light: {
    selected: "bg-white/10 border-white/20 text-white",
    unselected:
      "bg-transparent border-ctx-line text-ctx-muted hover:text-ctx-primary hover:border-white/20",
  },
};

function SelectionCircle({
  selected,
  variant,
}: {
  selected: boolean;
  variant: "accent" | "light";
}) {
  if (selected) {
    return (
      <span className="selection-circle is-selected flex-none w-5 h-5 rounded-full bg-[#FF385C] flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke={variant === "light" ? "#000" : "#fff"}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="selection-circle flex-none w-5 h-5 rounded-full border-[1.5px] border-ctx-line" />
  );
}

export function SelectionButton({
  selected,
  onClick,
  children,
  className = "",
  variant = "accent",
  showCheck = true,
}: SelectionButtonProps) {
  const styles = VARIANTS[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`selection-btn font-medium transition-all cursor-pointer flex items-center gap-3 ${
        selected ? styles.selected : styles.unselected
      } ${className}`}
    >
      <span className="selection-btn-label flex-1 text-left">{children}</span>
      {showCheck && <SelectionCircle selected={selected} variant={variant} />}
    </button>
  );
}
