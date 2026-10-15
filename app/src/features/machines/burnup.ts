import { DATA_END, dayKey, recordedTargetOn, workingDatesIn, type DateRange, type Machine } from "@/data/machines";

/*
 * "Produção acumulada vs meta": a conta por trás do gráfico, num lugar só.
 *
 * Duas leituras, cada uma comparando a mesma base dos dois lados:
 * - Turnos apontados: a produção dos turnos que CONTAM para a meta contra a meta
 *   desses turnos. É a regra do banco para o atingimento (02-referencia-tecnica:
 *   good_quantity / effective_target, só com counts_toward_target).
 * - Calendário: toda a produção contra a meta vigente em todos os dias úteis do
 *   período. Mostra o quanto do mês já foi feito, apontado ou não.
 *
 * Produção que não conta (hora extra, dia ou turno anulado, parada planejada)
 * entra na produção total, mas não no atingimento: o resumo mostra quanto foi.
 */

export interface BurnupPoint {
  date: Date;
  /** dia já com dados (até o último dia apontado) */
  elapsed: boolean;
  /** acumulados até o dia; nulos nos dias que ainda não chegaram */
  produced: number | null;
  counted: number | null;
  recordedTarget: number | null;
  /** produção do dia que não conta para a meta */
  outsideDay: number | null;
  /** meta do calendário acumulada: existe também nos dias futuros (onde o período precisa chegar) */
  calendarTarget: number;
}

export interface BurnupSummary {
  /** último dia com dados no período (null = nenhum) */
  asOf: Date | null;
  produced: number;
  counted: number;
  recordedTarget: number;
  /** produção ÷ meta dos turnos apontados, em % (null sem meta apontada) */
  attainment: number | null;
  /** produção que não conta para a meta */
  outside: number;
  /** meta do calendário até `asOf` e no período inteiro */
  calendarToDate: number;
  calendarTotal: number;
  /** quanto da meta do calendário até hoje virou turno apontado, em % (null sem meta no calendário) */
  coverage: number | null;
  /** produção total ÷ meta do calendário do período inteiro, em % */
  ofCalendarTotal: number | null;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/** Produção boa de um dia, toda e só a que conta (retrabalho nunca entra, D11) */
function dayProduction(m: Machine, date: Date) {
  const key = dayKey(date);
  let all = 0;
  let counted = 0;
  for (const o of m.orders) {
    if (o.rework || dayKey(o.date) !== key) continue;
    all += o.quantity;
    if (o.counts !== false) counted += o.quantity;
  }
  return { all, counted };
}

export function burnupSeries(machines: Machine[], range: DateRange): BurnupPoint[] {
  // meta do calendário: a meta diária vigente de cada máquina (já no recorte de turno)
  const calendarDaily = machines.reduce((s, m) => s + m.dailyTarget, 0);
  let produced = 0;
  let counted = 0;
  let recorded = 0;
  return workingDatesIn(range).map((date, i) => {
    const elapsed = date <= DATA_END;
    let outsideDay: number | null = null;
    if (elapsed) {
      let dayAll = 0;
      let dayCounted = 0;
      for (const m of machines) {
        const d = dayProduction(m, date);
        dayAll += d.all;
        dayCounted += d.counted;
        recorded += recordedTargetOn(m, date);
      }
      produced += dayAll;
      counted += dayCounted;
      outsideDay = dayAll - dayCounted;
    }
    return {
      date,
      elapsed,
      produced: elapsed ? produced : null,
      counted: elapsed ? counted : null,
      recordedTarget: elapsed ? Math.round(recorded) : null,
      outsideDay,
      calendarTarget: Math.round(calendarDaily * (i + 1)),
    };
  });
}

export function burnupSummary(series: BurnupPoint[]): BurnupSummary {
  const last = [...series].reverse().find((p) => p.elapsed) ?? null;
  const produced = last?.produced ?? 0;
  const counted = last?.counted ?? 0;
  const recordedTarget = last?.recordedTarget ?? 0;
  const calendarToDate = last?.calendarTarget ?? 0;
  const calendarTotal = series.at(-1)?.calendarTarget ?? 0;
  return {
    asOf: last?.date ?? null,
    produced,
    counted,
    recordedTarget,
    attainment: pct(counted, recordedTarget),
    outside: produced - counted,
    calendarToDate,
    calendarTotal,
    coverage: pct(recordedTarget, calendarToDate),
    ofCalendarTotal: pct(produced, calendarTotal),
  };
}
