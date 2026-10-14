import type { LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

interface Option {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  /** Só ícones (rótulo vira tooltip e nome acessível) */
  iconOnly?: boolean;
  /** "control": mesma altura dos campos (32px), para ficar alinhado em formulários */
  size?: "compact" | "control";
}

/**
 * Controle segmentado: grupo de opções exclusivas (radiogroup).
 * Setas movem a seleção; o item selecionado usa o tratamento "selected".
 */
export function SegmentedControl({ label, value, options, onChange, iconOnly = true, size = "compact" }: SegmentedControlProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex w-fit shrink-0 gap-025 rounded-medium bg-neutral", size === "control" ? "p-050" : "p-025")}>
      {options.map((o, i) => {
        const selected = o.value === value;
        const Icon = o.icon;
        const button = (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? o.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "ds-pressable inline-flex h-control-compact items-center justify-center gap-050 rounded-small font-body-small font-medium",
              iconOnly ? "w-control-compact" : "px-100",
              selected
                ? // tratamento "selecionado" do sistema: legível no claro e no escuro
                  "bg-selected text-selected hover:bg-selected-hovered"
                : "text-subtle hover:bg-neutral-subtle-hovered hover:text-default",
            )}
          >
            {Icon && <Icon aria-hidden className="size-icon-small" />}
            {!iconOnly && o.label}
          </button>
        );
        return iconOnly ? (
          <Tooltip key={o.value} content={o.label}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </div>
  );
}
