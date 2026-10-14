import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "./Menu";

export interface FilterOption {
  value: string;
  label: string;
  /** Texto curto exibido no gatilho (padrão: label) */
  short?: string;
  hint?: string;
}

interface FilterPillProps {
  label: string;
  value: string;
  defaultValue: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  isDisabled?: boolean;
}

/**
 * Filtro em "pílula": rótulo discreto + valor. Quando o valor difere do
 * padrão, o filtro fica no estado selecionado (background.selected).
 */
export function FilterPill({ label, value, defaultValue, options, onChange, isDisabled }: FilterPillProps) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const isActive = value !== defaultValue;

  return (
    <Menu>
      <MenuTrigger asChild disabled={isDisabled}>
        <button
          type="button"
          aria-label={`${label}: ${current.label}`}
          className={cn(
            "ds-pressable group inline-flex h-control shrink-0 items-center rounded-medium border font-body",
            "disabled:cursor-not-allowed disabled:border-disabled disabled:text-disabled",
            isActive
              ? "border-selected bg-selected text-selected hover:bg-selected-hovered active:bg-selected-pressed"
              : "bg-surface text-default hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed data-[state=open]:bg-neutral-subtle-pressed",
          )}
        >
          <span className={cn("pl-150 pr-100", isActive ? "text-selected" : "text-subtlest")}>{label}</span>
          <span aria-hidden className={cn("h-200 border-l", isActive && "border-selected")} />
          <span className="flex items-center gap-050 pl-100 pr-100 font-medium">
            {current.short ?? current.label}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-icon-small transition-transform duration-menu ease-out group-data-[state=open]:rotate-180",
                isActive ? "text-icon-selected" : "text-icon-subtle",
              )}
            />
          </span>
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{label}</MenuLabel>
        <MenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <MenuRadioItem key={o.value} value={o.value}>
              <span className="flex-1 truncate">{o.label}</span>
              {o.hint && <span className="font-body-small text-subtlest">{o.hint}</span>}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
