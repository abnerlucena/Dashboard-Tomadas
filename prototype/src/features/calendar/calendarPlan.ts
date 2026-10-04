import type { Holiday } from "../../../../src/lib/api";
import { parseDay } from "@/data/fromBackend";
import { fromIsoDate, isWeekendDate, toIsoDate } from "@/data/machines";

/*
 * Regras da tela de Calendário que não dependem de React.
 *
 * O contrato cadastra UM dia por chamada (`calendar.addHoliday`): um intervalo
 * (férias coletivas, ponte) vira um cadastro por dia, feito pela tela em laço.
 */

/** Teto de dias por cadastro: evita um laço enorme por engano na data final */
export const MAX_DAYS = 62;

export type HolidayKind = Holiday["type"];

/** Evento como a tela usa: data sempre em ISO, turnos sempre em lista (vazia = dia inteiro) */
export interface CalendarEntry {
  id: string;
  date: string;
  label: string;
  type: HolidayKind;
  /** "special_event" do banco: evento informativo, que a tela não cadastra */
  isEvent: boolean;
  shiftIds: number[];
  createdBy: string;
}

export function toEntry(h: Holiday): CalendarEntry | null {
  const day = parseDay(h.date);
  if (!day) return null;
  return {
    id: String(h.id),
    date: toIsoDate(day),
    label: String(h.label ?? "").trim(),
    type: h.type === "dia_anulado" ? "dia_anulado" : "feriado",
    isEvent: h.eventType === "special_event",
    shiftIds: [...(h.shiftIds ?? [])].sort((a, b) => a - b),
    createdBy: h.createdBy ?? "",
  };
}

export interface PlanInput {
  from: string;
  /** "" = só o dia `from` */
  to: string;
  skipWeekends: boolean;
  type: HolidayKind;
  /** vazio = dia inteiro */
  shiftIds: number[];
  existing: CalendarEntry[];
}

export interface Plan {
  /** dias que vão para o banco, em ordem */
  add: string[];
  weekends: number;
  /** dias que já têm o mesmo cadastro (mesmo tipo, cobrindo os mesmos turnos) */
  duplicates: string[];
  error: string | null;
}

/** Já existe um cadastro do mesmo tipo que cobre estes turnos? (dia inteiro cobre qualquer turno) */
function covered(existing: CalendarEntry[], date: string, type: HolidayKind, shiftIds: number[]) {
  return existing.some(
    (e) =>
      e.date === date &&
      e.type === type &&
      !e.isEvent &&
      (e.shiftIds.length === 0 || (shiftIds.length > 0 && shiftIds.every((s) => e.shiftIds.includes(s)))),
  );
}

export function planDays({ from, to, skipWeekends, type, shiftIds, existing }: PlanInput): Plan {
  const empty: Plan = { add: [], weekends: 0, duplicates: [], error: null };
  if (!from) return { ...empty, error: "Escolha a data" };
  const last = to || from;
  if (last < from) return { ...empty, error: "A data final vem antes da inicial" };
  const days: string[] = [];
  for (let d = fromIsoDate(from); toIsoDate(d) <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(toIsoDate(d));
    if (days.length > MAX_DAYS) return { ...empty, error: `Cadastre no máximo ${MAX_DAYS} dias de cada vez` };
  }
  const plan: Plan = { ...empty };
  for (const iso of days) {
    // Num dia só, o fim de semana vale: é escolha explícita
    if (skipWeekends && days.length > 1 && isWeekendDate(fromIsoDate(iso))) plan.weekends++;
    else if (covered(existing, iso, type, shiftIds)) plan.duplicates.push(iso);
    else plan.add.push(iso);
  }
  if (plan.add.length === 0) plan.error = plan.duplicates.length > 0 ? "Estes dias já estão cadastrados" : "Nenhum dia útil no intervalo";
  return plan;
}

/** "Dia inteiro", "Turno 2", "Turnos 1 e 3" */
export function shiftsLabel(shiftIds: number[]) {
  if (shiftIds.length === 0) return "Dia inteiro";
  if (shiftIds.length === 1) return `Turno ${shiftIds[0]}`;
  return `Turnos ${shiftIds.slice(0, -1).join(", ")} e ${shiftIds[shiftIds.length - 1]}`;
}
