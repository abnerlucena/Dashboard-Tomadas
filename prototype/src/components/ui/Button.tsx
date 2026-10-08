import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

export type ButtonAppearance = "primary" | "default" | "subtle" | "danger";

const APPEARANCE: Record<ButtonAppearance, string> = {
  // Único botão "bold" da página: color.background.brand.bold
  primary: "bg-brand-bold text-inverse hover:bg-brand-bold-hovered active:bg-brand-bold-pressed",
  default: "bg-neutral text-subtle hover:bg-neutral-hovered active:bg-neutral-pressed",
  subtle: "bg-neutral-subtle text-subtle hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed",
  // Ações destrutivas (excluir): só em confirmações
  danger: "bg-danger-bold text-inverse hover:bg-danger-bold-hovered active:bg-danger-bold-pressed",
};

const SELECTED = "bg-selected text-selected hover:bg-selected-hovered active:bg-selected-pressed";
const DISABLED = "bg-disabled text-disabled cursor-not-allowed";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  appearance?: ButtonAppearance;
  spacing?: "default" | "compact";
  iconBefore?: LucideIcon;
  iconAfter?: LucideIcon;
  isSelected?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    appearance = "default",
    spacing = "default",
    iconBefore: IconBefore,
    iconAfter: IconAfter,
    isSelected,
    isDisabled,
    isLoading,
    className,
    children,
    type = "button",
    onClick,
    ...rest
  },
  ref,
) {
  const blocked = isDisabled || isLoading;
  return (
    <button
      ref={ref}
      type={type}
      aria-disabled={isDisabled || undefined}
      aria-busy={isLoading || undefined}
      aria-pressed={isSelected}
      onClick={blocked ? (e) => e.preventDefault() : onClick}
      className={cn(
        "ds-pressable ds-hit-y relative inline-flex shrink-0 select-none items-center justify-center gap-075 whitespace-nowrap rounded-medium font-body font-medium",
        spacing === "compact" ? "h-control-compact px-100" : "h-control px-150",
        isDisabled ? DISABLED : isSelected ? SELECTED : APPEARANCE[appearance],
        isLoading && "cursor-progress",
        className,
      )}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-075", isLoading && "opacity-0")}>
        {IconBefore && <IconBefore aria-hidden className="size-icon-small shrink-0" />}
        {children}
        {IconAfter && <IconAfter aria-hidden className="size-icon-small shrink-0" />}
      </span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  );
});

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "children"> {
  icon: LucideIcon;
  /** Rótulo acessível — também vira tooltip */
  label: string;
  shortcut?: string;
  appearance?: Exclude<ButtonAppearance, "primary" | "danger">;
  spacing?: "default" | "compact";
  isSelected?: boolean;
  isDisabled?: boolean;
  showTooltip?: boolean;
  tooltipSuppressed?: boolean;
  children?: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon: Icon,
    label,
    shortcut,
    appearance = "subtle",
    spacing = "default",
    isSelected,
    isDisabled,
    showTooltip = true,
    tooltipSuppressed,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-disabled={isDisabled || undefined}
      className={cn(
        "ds-pressable ds-hit relative inline-flex shrink-0 items-center justify-center rounded-medium",
        spacing === "compact" ? "size-control-compact" : "size-control",
        isDisabled
          ? "cursor-not-allowed text-icon-disabled"
          : isSelected
            ? cn(SELECTED, "text-icon-selected")
            : appearance === "default"
              ? "bg-neutral text-icon-subtle hover:bg-neutral-hovered active:bg-neutral-pressed"
              : "bg-neutral-subtle text-icon-subtle hover:bg-neutral-subtle-hovered hover:text-icon active:bg-neutral-subtle-pressed",
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-icon-small" />
      {children}
    </button>
  );
  if (!showTooltip) return button;
  return (
    <Tooltip content={label} shortcut={shortcut} suppressed={tooltipSuppressed}>
      {button}
    </Tooltip>
  );
});
