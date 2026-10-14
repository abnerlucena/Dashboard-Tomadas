import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { STATUS_META, type Status } from "@/data/machines";
import { cn } from "@/lib/utils";
import { Lozenge } from "@/components/ui/Lozenge";

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

// Mesmo tom dos lozenges/células de status: fundo sutil + texto do papel
const TONE: Record<Status, string> = {
  critical: "bg-danger text-danger hover:bg-danger-hovered",
  attention: "bg-warning text-warning hover:bg-warning-hovered",
  near: "bg-information text-information hover:bg-information-hovered",
  achieved: "bg-success text-success hover:bg-success-hovered",
};

// Barra de % da meta dentro do dia: cor forte do status
const BAR: Record<Status, string> = {
  critical: "bg-danger-bold",
  attention: "bg-warning-bold",
  near: "bg-information-bold",
  achieved: "bg-success-bold",
};

export interface CalendarDay {
  /** texto curto sob o número (ex.: "81 mil") */
  caption?: string;
  /** % da meta do dia (barra e número no canto) */
  percent?: number;
  status?: Status | null;
  /** dia sem ação possível (fim de semana, futuro) */
  muted?: boolean;
  /** descrição completa para leitores de tela */
  label: string;
}

interface MonthCalendarProps {
  year: number;
  month: number; // 0-based
  selected: number;
  today?: number;
  onSelect: (day: number) => void;
  getDay: (day: number) => CalendarDay;
  /** título e navegação; a legenda fica ao lado */
  header?: ReactNode;
}

/**
 * Calendário do mês em grade (seg → dom). Setas movem a seleção (±1 dia,
 * ±1 semana); Home/End vão ao início/fim da semana. Um só dia fica no
 * tab order (roving tabindex).
 */
export function MonthCalendar({ year, month, selected, today, onSelect, getDay, header }: MonthCalendarProps) {
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // segunda = 0
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (day: number) => {
    const next = Math.min(days, Math.max(1, day));
    onSelect(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, day: number) => {
    const weekday = (offset + day - 1) % 7;
    const map: Record<string, number> = {
      ArrowRight: day + 1,
      ArrowLeft: day - 1,
      ArrowDown: day + 7,
      ArrowUp: day - 7,
      Home: day - weekday,
      End: day + (6 - weekday),
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    move(map[e.key]);
  };

  return (
    <div className="flex flex-col gap-200">
      <div className="flex flex-wrap items-center justify-between gap-150">
        {header}
        <ul className="flex flex-wrap gap-050" aria-label="Legenda: cor do dia em relação à meta diária">
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <li key={s}>
              <Lozenge appearance={STATUS_META[s].appearance}>{STATUS_META[s].label}</Lozenge>
            </li>
          ))}
        </ul>
      </div>
      <div role="grid" aria-label="Calendário do mês" className="grid grid-cols-7 gap-050">
        <div role="row" className="contents">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="pb-050 text-center font-body-small text-subtlest">
              {w}
            </span>
          ))}
        </div>
        <div role="row" className="contents">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`pad-${i}`} role="gridcell" aria-hidden />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const info = getDay(day);
            const isSelected = day === selected;
            return (
              <span key={day} role="gridcell" aria-selected={isSelected}>
                <button
                  ref={(el) => (refs.current[day] = el)}
                  type="button"
                  tabIndex={isSelected ? 0 : -1}
                  aria-label={info.label}
                  aria-current={day === today ? "date" : undefined}
                  onClick={() => onSelect(day)}
                  onKeyDown={(e) => onKeyDown(e, day)}
                  className={cn(
                    "ds-pressable flex min-h-600 w-full flex-col items-stretch justify-between gap-050 rounded-medium border-thick p-075 text-left s:min-h-800 s:p-100",
                    isSelected ? "border-selected" : "border-transparent",
                    info.status
                      ? TONE[info.status]
                      : info.muted
                        ? // fim de semana e dia futuro: discreto, mas legível (contraste AA)
                          "text-subtlest hover:bg-neutral-subtle-hovered"
                        : "bg-neutral text-subtle hover:bg-neutral-hovered",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-050">
                    <span className={cn("font-body-small font-semibold tabular-nums", day === today && "text-brand")}>{day}</span>
                    {info.percent != null && <span className="hidden font-body-small tabular-nums s:inline">{info.percent}%</span>}
                  </span>
                  {/* No celular a célula é estreita: só a cor; o valor fica no rótulo acessível e no resumo do dia */}
                  {info.caption && <span className="hidden truncate font-body font-semibold tabular-nums s:block">{info.caption}</span>}
                  {info.percent != null && info.status && (
                    <span aria-hidden className="hidden h-050 w-full overflow-hidden rounded-full bg-neutral s:block">
                      <span className={cn("block h-full rounded-full", BAR[info.status])} style={{ width: `${Math.min(info.percent, 100)}%` }} />
                    </span>
                  )}
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
