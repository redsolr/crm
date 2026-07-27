"use client";

import { SelectionButton } from "@/components/ui/SelectionButton";

interface SelectionGroupProps {
  items: { id: string; label: string }[];
  selected: string[];
  onSelect: (id: string) => void;
  label?: string;
  layout?: "list" | "grid";
}

export function SelectionGroup({
  items,
  selected,
  onSelect,
  label,
  layout = "list",
}: SelectionGroupProps) {
  const isGrid = layout === "grid";

  return (
    <div className="onboarding-selection-group">
      {label && <label className="ctx-label mb-2">{label}</label>}
      <div
        className={
          isGrid
            ? "grid grid-cols-1 md:grid-cols-3 gap-2"
            : "flex flex-col gap-2 md:flex-row md:flex-wrap"
        }
      >
        {items.map((item) => (
          <SelectionButton
            key={item.id}
            selected={selected.includes(item.id)}
            onClick={() => onSelect(item.id)}
            className={
              isGrid
                ? "px-3 py-2 rounded-lg text-[13px] capitalize min-h-[44px]"
                : "w-full md:w-auto px-4 py-2.5 rounded-lg text-[14px] min-h-[44px]"
            }
          >
            {item.label}
          </SelectionButton>
        ))}
      </div>
    </div>
  );
}
