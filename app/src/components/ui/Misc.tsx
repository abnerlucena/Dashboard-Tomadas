import type { ReactNode } from "react";
import type { Accent } from "@/data/machines";
import { cn } from "@/lib/utils";

/* ---------- Badge de contagem (neutro, radius.xsmall) ---------- */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-badge min-w-badge shrink-0 items-center justify-center rounded-xsmall bg-neutral px-050 font-body-small font-medium tabular-nums text-subtle",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Avatar (radius.full) ---------- */
const AVATAR_ACCENT: Record<Accent, string> = {
  blue: "bg-accent-blue-subtle text-accent-blue-bolder",
  teal: "bg-accent-teal-subtle text-accent-teal-bolder",
  green: "bg-accent-green-subtle text-accent-green-bolder",
  lime: "bg-accent-lime-subtle text-accent-lime-bolder",
  yellow: "bg-accent-yellow-subtle text-accent-yellow-bolder",
  orange: "bg-accent-orange-subtle text-accent-orange-bolder",
  red: "bg-accent-red-subtle text-accent-red-bolder",
  magenta: "bg-accent-magenta-subtle text-accent-magenta-bolder",
  purple: "bg-accent-purple-subtle text-accent-purple-bolder",
  gray: "bg-accent-gray-subtle text-accent-gray-bolder",
};

export function Avatar({
  name,
  size = "small",
  accent = "teal",
}: {
  name: string;
  size?: "small" | "medium";
  accent?: Accent;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-heading-xxsmall",
        size === "small" ? "size-avatar-small" : "size-avatar-medium",
        AVATAR_ACCENT[accent],
      )}
    >
      {initials}
    </span>
  );
}

/* ---------- Logo WEG (vetor oficial do repositório, em currentColor) ---------- */
export function WegMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 5991 4192" aria-hidden className={cn("fill-current", className)}>
      <polygon points="461,466 461,2795 922,2795 922,932 1383,932 1383,2795 1844,2795 1844,932 2304,932 2304,3261 0,3261 0,0 5991,0 5991,466" />
      <path d="M4148 2329l0 -1397 -1383 0 0 2329 1383 0 0 -466 -922 0 0 -466 922 0zm-461 -466l-461 0 0 -466 461 0 0 466z" />
      <path d="M5991 932l-1382 0 0 2329 922 0 0 466 -5531 0 0 465 5991 0 0 -3260zm-461 1863l-461 0 0 -1398 461 0 0 1398z" />
    </svg>
  );
}

export function WegTile({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex size-tile shrink-0 items-center justify-center rounded-medium bg-brand-bold text-inverse", className)}
    >
      <WegMark className="w-250" />
    </span>
  );
}
