import type { Accent } from "@/data/machines";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

// Cores de destaque: decorativas, sem significado de status
const ACCENT: Record<Accent, string> = {
  blue: "bg-accent-blue-subtler text-accent-blue",
  teal: "bg-accent-teal-subtler text-accent-teal",
  green: "bg-accent-green-subtler text-accent-green",
  lime: "bg-accent-lime-subtler text-accent-lime",
  yellow: "bg-accent-yellow-subtler text-accent-yellow",
  orange: "bg-accent-orange-subtler text-accent-orange",
  red: "bg-accent-red-subtler text-accent-red",
  magenta: "bg-accent-magenta-subtler text-accent-magenta",
  purple: "bg-accent-purple-subtler text-accent-purple",
  gray: "bg-accent-gray-subtler text-accent-gray",
};

export function Tag({ accent = "gray", children }: { accent?: Accent; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-lozenge shrink-0 items-center whitespace-nowrap rounded-small px-075 font-body-small font-medium",
        ACCENT[accent],
      )}
    >
      {children}
    </span>
  );
}

interface TagGroupProps {
  items: string[];
  accentFor: (label: string) => Accent;
  max?: number;
}

/** Mostra até `max` tags e resume o resto em "+N" (lista completa no tooltip). */
export function TagGroup({ items, accentFor, max = 2 }: TagGroupProps) {
  const visible = items.slice(0, max);
  const hidden = items.slice(max);
  return (
    <span className="flex items-center gap-050">
      {visible.map((label) => (
        <Tag key={label} accent={accentFor(label)}>
          {label}
        </Tag>
      ))}
      {hidden.length > 0 && (
        <Tooltip content={hidden.join(", ")}>
          <span
            tabIndex={0}
            aria-label={`Mais ${hidden.length}: ${hidden.join(", ")}`}
            className="inline-flex h-lozenge items-center rounded-small bg-neutral px-075 font-body-small font-medium text-subtle"
          >
            +{hidden.length}
          </span>
        </Tooltip>
      )}
    </span>
  );
}
