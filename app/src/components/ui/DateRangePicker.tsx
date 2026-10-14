import * as Popover from "@radix-ui/react-popover";
import { CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn, plural } from "@/lib/utils";
import { Button, IconButton } from "./Button";
import {
  WEEKDAYS, addDays, clamp, isWeekday, longDay, monthName, presetsFor, rangeLabel,
  same, startOf, workingDaysBetween, type Range,
} from "./dateRange";

// O tipo continua acessível por aqui (reexportar tipo não afeta o react-refresh).
export type { Range };

interface DateRangePickerProps {
  label: string;
  value: Range;
  onChange: (r: Range) => void;
  /** limites do calendário */
  min: Date;
  max: Date;
  /** último dia com dados (dias depois dele contam só na meta) */
  dataEnd: Date;
  /** valor padrão: diferente dele, o gatilho fica "selecionado" (como os filtros) */
  defaultValue?: Range;
  /** "pill" = filtro da barra; "field" = campo de formulário com rótulo acima */
  variant?: "pill" | "field";
}

/**
 * Seletor de período: atalhos à esquerda, calendário de intervalo à direita.
 * Clique no primeiro e no último dia (o intervalo aparece ao passar o mouse);
 * setas navegam pelos dias, Enter marca. Nada muda até "Aplicar".
 */
export function DateRangePicker({ label, value, onChange, min, max, dataEnd, defaultValue, variant = "pill" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: Date; to: Date | null }>(value);
  const [hover, setHover] = useState<Date | null>(null);
  const [focused, setFocused] = useState<Date>(value.to);
  const grid = useRef<HTMLDivElement>(null);
  const presets = presetsFor(dataEnd, min, max);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value);
      setFocused(value.to);
      setHover(null);
    }
    setOpen(next);
  };

  const view = focused;
  const year = view.getFullYear();
  const month = view.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: Array<Date | null> = [...Array.from({ length: offset }, () => null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const focusDay = () => grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  useEffect(() => {
    if (open) focusDay();
  }, [focused, open]);

  const pick = (d: Date) => {
    if (d < min || d > max) return;
    setDraft((cur) => (cur.to === null && d >= cur.from ? { from: cur.from, to: d } : { from: d, to: null }));
  };

  // intervalo exibido: o rascunho, estendido até o dia sob o mouse enquanto escolhe o fim
  const end = draft.to ?? (hover && hover >= draft.from ? hover : draft.from);
  const shown: Range = { from: draft.from, to: end };
  const complete = draft.to !== null;

  const onKeyDown = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (e.key in step) {
      e.preventDefault();
      setFocused((f) => clamp(addDays(f, step[e.key]), min, max));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focused);
    }
  };

  const apply = () => {
    if (!complete) return;
    onChange({ from: draft.from, to: draft.to! });
    setOpen(false);
  };

  const isActive = defaultValue ? !(same(value.from, defaultValue.from) && same(value.to, defaultValue.to)) : false;
  const futureDays = complete && draft.to! > dataEnd;
  const canPrev = new Date(year, month, 1) > startOf(min);
  const canNext = new Date(year, month + 1, 1) <= max;

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {variant === "field" ? (
        <div className="flex flex-col gap-050">
          <span className="font-body-small font-semibold text-subtle">{label}</span>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={`${label}: ${rangeLabel(value)}`}
              className="flex h-control w-full min-w-column-name items-center justify-between gap-100 rounded-medium border border-input bg-input px-100 text-left text-default hover:bg-input-hovered data-[state=open]:border-focused"
            >
              <span className="truncate">{rangeLabel(value)}</span>
              <CalendarRange aria-hidden className="size-icon-small shrink-0 text-icon-subtle" />
            </button>
          </Popover.Trigger>
        </div>
      ) : (
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${rangeLabel(value)}`}
            className={cn(
              "ds-pressable group inline-flex h-control shrink-0 items-center rounded-medium border font-body",
              isActive
                ? "border-selected bg-selected text-selected hover:bg-selected-hovered active:bg-selected-pressed"
                : "bg-surface text-default hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed data-[state=open]:bg-neutral-subtle-pressed",
            )}
          >
            <span className={cn("pl-150 pr-100", isActive ? "text-selected" : "text-subtlest")}>{label}</span>
            <span aria-hidden className={cn("h-200 border-l", isActive && "border-selected")} />
            <span className="flex items-center gap-050 pl-100 pr-100 font-medium">
              {rangeLabel(value)}
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-icon-small transition-transform duration-menu ease-out group-data-[state=open]:rotate-180",
                  isActive ? "text-icon-selected" : "text-icon-subtle",
                )}
              />
            </span>
          </button>
        </Popover.Trigger>
      )}
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
          className="z-menu flex max-w-full origin-popover flex-col rounded-large bg-surface-overlay text-default shadow-overlay data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in"
        >
          <div className="flex flex-col s:flex-row">
            {/* Atalhos */}
            <ul aria-label="Atalhos de período" className="flex flex-wrap gap-050 border-b p-150 s:w-range-presets s:flex-col s:flex-nowrap s:border-b-0 s:border-r">
              {presets.map((p) => {
                const current = complete && same(p.range.from, draft.from) && same(p.range.to, draft.to!);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(p.range);
                        setFocused(p.range.to);
                      }}
                      className={cn(
                        "ds-pressable flex w-full items-center justify-between gap-100 rounded-medium px-100 py-075 text-left font-body-small",
                        current ? "bg-selected font-semibold text-selected" : "text-default hover:bg-neutral-subtle-hovered",
                      )}
                    >
                      {p.label}
                      {current && <Check aria-hidden className="hidden size-icon-small s:block" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Calendário de intervalo */}
            <div className="p-150">
              <div className="mb-100 flex items-center justify-between gap-100">
                <IconButton icon={ChevronLeft} label="Mês anterior" showTooltip={false} isDisabled={!canPrev} onClick={() => canPrev && setFocused(new Date(year, month - 1, 1))} />
                <span aria-live="polite" className="font-heading-xsmall first-letter:uppercase">
                  {monthName.format(view)}
                </span>
                <IconButton icon={ChevronRight} label="Próximo mês" showTooltip={false} isDisabled={!canNext} onClick={() => canNext && setFocused(new Date(year, month + 1, 1))} />
              </div>
              <div ref={grid} role="grid" aria-label={monthName.format(view)} onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)} className="flex flex-col gap-025">
                <div role="row" className="grid grid-cols-7">
                  {WEEKDAYS.map((w) => (
                    <span key={w} role="columnheader" className="pb-050 text-center font-body-small text-subtlest">
                      {w}
                    </span>
                  ))}
                </div>
                {weeks.map((week, w) => (
                  <div key={w} role="row" className="grid grid-cols-7">
                    {week.map((d, i) => {
                      if (!d) return <span key={`p${i}`} role="gridcell" aria-hidden />;
                      const disabled = d < min || d > max;
                      const isStart = same(d, shown.from);
                      const isEnd = same(d, shown.to);
                      const inside = d > shown.from && d < shown.to;
                      const noData = d > dataEnd && !disabled;
                      return (
                        <span
                          key={d.getDate()}
                          role="gridcell"
                          aria-selected={isStart || isEnd || inside}
                          // faixa contínua do intervalo por trás dos dias
                          className={cn(
                            "flex justify-center",
                            (inside || (isStart && !same(shown.from, shown.to)) || (isEnd && !same(shown.from, shown.to))) && "bg-selected",
                            isStart && !same(shown.from, shown.to) && "rounded-l-full",
                            isEnd && !same(shown.from, shown.to) && "rounded-r-full",
                          )}
                        >
                          <button
                            type="button"
                            tabIndex={same(d, focused) ? 0 : -1}
                            aria-label={`${longDay.format(d)}${noData ? ", sem dados ainda" : ""}`}
                            aria-disabled={disabled || undefined}
                            onClick={() => {
                              setFocused(d);
                              pick(d);
                            }}
                            onMouseEnter={() => setHover(d)}
                            className={cn(
                              "ds-pressable flex size-control items-center justify-center rounded-full font-body-small tabular-nums",
                              disabled
                                ? "cursor-not-allowed text-disabled"
                                : isStart || isEnd
                                  ? "bg-brand-bold font-semibold text-inverse"
                                  : cn(
                                      "hover:bg-neutral-subtle-hovered",
                                      inside ? "text-selected" : isWeekday(d) ? "text-default" : "text-subtlest",
                                      noData && "text-subtlest underline decoration-dotted",
                                    ),
                            )}
                          >
                            {d.getDate()}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-150 border-t px-150 py-100">
            <p aria-live="polite" className="min-w-0 flex-1 font-body-small text-subtle">
              {complete ? (
                <>
                  <span className="font-semibold text-default">{rangeLabel({ from: draft.from, to: draft.to! })}</span> ·{" "}
                  {plural(workingDaysBetween({ from: draft.from, to: draft.to! }), "dia útil", "dias úteis")}
                  {futureDays && " · dias futuros contam só na meta"}
                </>
              ) : (
                "Agora escolha o último dia"
              )}
            </p>
            <Button appearance="subtle" spacing="compact" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button appearance="primary" spacing="compact" isDisabled={!complete} onClick={apply}>
              Aplicar
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
