import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ children, inverse }: { children: ReactNode; inverse?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-kbd min-w-kbd items-center justify-center rounded-xsmall px-050 font-body-small font-medium",
        inverse ? "bg-inverse-subtle text-inverse" : "border bg-surface text-subtlest",
      )}
    >
      {children}
    </kbd>
  );
}
