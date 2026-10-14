import { Check, Minus } from "lucide-react";
import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  isIndeterminate?: boolean;
  label: string;
}

/** Checkbox nativo (acessível por padrão) com visual ADS: radius.xsmall, 14px. */
export function Checkbox({ isIndeterminate, label, className, checked, disabled, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!isIndeterminate;
  }, [isIndeterminate]);

  const filled = checked || isIndeterminate;
  const Icon = isIndeterminate ? Minus : Check;

  return (
    <span className={cn("relative inline-flex size-checkbox shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        className={cn(
          "peer size-checkbox cursor-pointer appearance-none rounded-xsmall border-thick transition-colors duration-hover ease-out",
          "border-input bg-input hover:bg-input-hovered",
          "checked:border-selected checked:bg-selected-bold checked:hover:border-selected checked:hover:bg-selected-bold-hovered",
          "indeterminate:border-selected indeterminate:bg-selected-bold",
          "disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled",
        )}
        {...rest}
      />
      {filled && (
        <Icon
          aria-hidden
          className="pointer-events-none [stroke-width:var(--dash-icon-stroke-bold)] absolute inset-0 m-auto size-checkbox p-025 text-icon-inverse"
        />
      )}
    </span>
  );
}
