import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface OptionCardsProps<T extends string> {
  label: string;
  value: T | null;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  error?: string | null;
  className?: string;
}

/**
 * Escolha única em cartões com borda visível (rádio): para decisões que
 * precisam ficar à vista, como o turno e o regime do apontamento. O escolhido
 * ganha fundo e borda de seleção e uma marca de confirmação.
 */
export function OptionCards<T extends string>({ label, value, onChange, options, error, className }: OptionCardsProps<T>) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-050", className)}>
      <span id={id} className="font-body-small font-semibold text-subtle">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-invalid={error ? true : undefined}
        className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-100"
      >
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={cn(
                "ds-pressable relative flex min-h-touch-target items-center justify-between gap-100 rounded-large border-thick px-200 py-150 text-left font-medium",
                selected
                  ? "border-selected bg-selected text-selected"
                  : cn("bg-surface text-default hover:bg-neutral-subtle-hovered", error ? "border-danger" : "border-input"),
              )}
            >
              {o.label}
              {selected && <Check aria-hidden className="size-icon-medium shrink-0" />}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="font-body-small text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
