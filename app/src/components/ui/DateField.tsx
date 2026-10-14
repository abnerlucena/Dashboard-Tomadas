import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";
import { FieldShell, inputBase, type FieldProps } from "./TextField";

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const longDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** "2026-03-27" ↔ Date local (sem fuso: meia-noite do próprio dia) */
const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toBr = (iso: string) => iso.split("-").reverse().join("/");
const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};
const addMonths = (iso: string, n: number) => {
  const d = parse(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toIso(d);
};
const clamp = (iso: string, min?: string, max?: string) =>
  min && iso < min ? min : max && iso > max ? max : iso;

type DateFieldProps = FieldProps & {
  /** Data em ISO (aaaa-mm-dd) ou "" */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  /** Dia destacado como "hoje" */
  today?: string;
  id?: string;
};

/**
 * Campo de data com calendário próprio (segue o tema, ao contrário do seletor
 * nativo do sistema). Gatilho com aparência de input; o calendário abre num
 * popover. Teclado: setas movem o dia (±1, ±7), PageUp/PageDown trocam o mês,
 * Home/End vão ao início/fim da semana, Enter escolhe, Esc fecha.
 */
export function DateField({
  label,
  hideLabel,
  helper,
  error,
  warning,
  isRequired,
  className,
  value,
  onChange,
  min,
  max,
  today,
  id: idProp,
}: DateFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [open, setOpen] = useState(false);
  const start = clamp(value || today || min || toIso(new Date()), min, max);
  const [focused, setFocused] = useState(start);
  const grid = useRef<HTMLDivElement>(null);
  const hasMsg = !!(error || warning || helper);

  // Ao abrir, o calendário começa no dia escolhido (ou no mais próximo permitido)
  const onOpenChange = (next: boolean) => {
    if (next) setFocused(start);
    setOpen(next);
  };
  const focusDay = () => grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();

  // Setas e troca de mês levam o foco junto
  useEffect(() => {
    if (open) focusDay();
  }, [focused, open]);

  const view = parse(focused);
  const year = view.getFullYear();
  const month = view.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // segunda = 0
  const cells: Array<string | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => toIso(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const firstOfMonth = toIso(new Date(year, month, 1));
  const lastOfMonth = toIso(new Date(year, month, days));
  const canPrev = !min || firstOfMonth > min;
  const canNext = !max || lastOfMonth < max;
  const outOfRange = (iso: string) => (!!min && iso < min) || (!!max && iso > max);

  const choose = (iso: string) => {
    if (outOfRange(iso)) return;
    onChange(iso);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const weekday = (parse(focused).getDay() + 6) % 7;
    const map: Record<string, () => string> = {
      ArrowRight: () => addDays(focused, 1),
      ArrowLeft: () => addDays(focused, -1),
      ArrowDown: () => addDays(focused, 7),
      ArrowUp: () => addDays(focused, -7),
      Home: () => addDays(focused, -weekday),
      End: () => addDays(focused, 6 - weekday),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    setFocused(clamp(map[e.key](), min, max));
  };

  return (
    <FieldShell {...{ id, label, hideLabel, helper, error, warning, isRequired, className }}>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            aria-haspopup="dialog"
            aria-invalid={error ? true : undefined}
            aria-describedby={hasMsg ? `${id}-msg` : undefined}
            aria-required={isRequired || undefined}
            aria-label={`${label}: ${value ? longDay.format(parse(value)) : "nenhuma data"}`}
            className={cn(
              inputBase,
              "flex h-control items-center justify-between gap-100 px-100 text-left tabular-nums data-[state=open]:border-focused",
              error ? "border-danger" : warning ? "border-warning" : "border-input",
              !value && "text-subtlest",
            )}
          >
            {value ? toBr(value) : "dd/mm/aaaa"}
            <CalendarDays aria-hidden className="size-icon-small shrink-0 text-icon-subtle" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={8}
            aria-label={`Escolher ${label.toLowerCase()}`}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              focusDay();
            }}
            className="z-menu origin-popover rounded-large bg-surface-overlay p-150 text-default shadow-overlay data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in"
          >
            <div className="mb-100 flex items-center justify-between gap-100">
              <IconButton
                icon={ChevronLeft}
                label="Mês anterior"
                showTooltip={false}
                isDisabled={!canPrev}
                onClick={() => canPrev && setFocused(clamp(addMonths(focused, -1), min, max))}
              />
              <span aria-live="polite" className="font-heading-xsmall first-letter:uppercase">
                {monthName.format(view)}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Próximo mês"
                showTooltip={false}
                isDisabled={!canNext}
                onClick={() => canNext && setFocused(clamp(addMonths(focused, 1), min, max))}
              />
            </div>
            <div ref={grid} role="grid" aria-label={monthName.format(view)} onKeyDown={onKeyDown} className="flex flex-col gap-025">
              <div role="row" className="grid grid-cols-7 gap-025">
                {WEEKDAYS.map((w) => (
                  <span key={w} role="columnheader" className="pb-050 text-center font-body-small text-subtlest">
                    {w}
                  </span>
                ))}
              </div>
              {weeks.map((week, w) => (
                <div key={w} role="row" className="grid grid-cols-7 gap-025">
                  {week.map((iso, i) => {
                    if (!iso) return <span key={`pad-${i}`} role="gridcell" aria-hidden />;
                    const isSelected = iso === value;
                    const disabled = outOfRange(iso);
                    return (
                      <span key={iso} role="gridcell" aria-selected={isSelected}>
                        <button
                          type="button"
                          data-iso={iso}
                          tabIndex={iso === focused ? 0 : -1}
                          aria-label={longDay.format(parse(iso))}
                          aria-disabled={disabled || undefined}
                          aria-current={iso === today ? "date" : undefined}
                          onClick={() => choose(iso)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              choose(iso);
                            }
                          }}
                          className={cn(
                            "ds-pressable flex size-control items-center justify-center rounded-medium font-body-small tabular-nums",
                            disabled
                              ? "cursor-not-allowed text-disabled"
                              : isSelected
                                ? "bg-brand-bold font-semibold text-inverse hover:bg-brand-bold-hovered"
                                : cn("text-default hover:bg-neutral-subtle-hovered", iso === today && "font-semibold text-brand"),
                          )}
                        >
                          {parse(iso).getDate()}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FieldShell>
  );
}
