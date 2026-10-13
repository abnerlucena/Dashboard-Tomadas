import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** nome acessível do botão */
  label: string;
  className?: string;
}

/** Liga e desliga uma opção na hora (sem botão de salvar): role="switch", com foco visível */
export function Switch({ checked, onChange, label, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "ds-pressable relative h-[1.5rem] w-[2.5rem] shrink-0 rounded-full border border-transparent transition-colors duration-hover ease-out",
        checked ? "bg-brand-bold" : "bg-neutral-bold",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-[0.125rem] top-[0.125rem] size-[1.25rem] rounded-full bg-surface-raised shadow-raised transition-transform duration-hover ease-out",
          checked && "translate-x-[1rem]",
        )}
      />
    </button>
  );
}
