import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LozengeAppearance = "neutral" | "success" | "danger" | "warning" | "information" | "discovery";

// Subtle: fundo claro + texto do papel. Bold: fundo forte + texto inverso.
const SUBTLE: Record<LozengeAppearance, string> = {
  neutral: "bg-neutral text-subtle",
  success: "bg-success text-success",
  danger: "bg-danger text-danger",
  warning: "bg-warning text-warning",
  information: "bg-information text-information",
  discovery: "bg-discovery text-discovery",
};
const BOLD: Record<LozengeAppearance, string> = {
  neutral: "bg-neutral-bold text-inverse",
  success: "bg-success-bold text-inverse",
  danger: "bg-danger-bold text-inverse",
  warning: "bg-warning-bold text-warning-inverse",
  information: "bg-information-bold text-inverse",
  discovery: "bg-discovery-bold text-inverse",
};
const DOT: Record<LozengeAppearance, string> = {
  neutral: "bg-icon-subtlest",
  success: "bg-icon-success",
  danger: "bg-icon-danger",
  warning: "bg-icon-warning",
  information: "bg-icon-information",
  discovery: "bg-icon-brand",
};

interface LozengeProps {
  appearance?: LozengeAppearance;
  isBold?: boolean;
  withDot?: boolean;
  children: ReactNode;
  className?: string;
}

/** Status sempre com texto — a cor reforça, nunca substitui. */
export function Lozenge({ appearance = "neutral", isBold, withDot, children, className }: LozengeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-lozenge shrink-0 items-center gap-050 whitespace-nowrap rounded-small px-075 font-body-small font-semibold",
        isBold ? BOLD[appearance] : SUBTLE[appearance],
        className,
      )}
    >
      {withDot && <span aria-hidden className={cn("size-status-dot rounded-full", DOT[appearance])} />}
      {children}
    </span>
  );
}
