import { SHIFT_META, STATUS_META, type Machine, type ProductionOrder } from "@/data/machines";

/*
 * Exportar do Dashboard: CSV que o Excel abre direto em pt-BR, com separador ";",
 * vírgula decimal e o BOM do UTF-8 (sem ele, o Excel estraga os acentos).
 * O projeto não tem biblioteca de .xlsx; o CSV basta para conferir e filtrar.
 */

const BOM = "﻿";
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const hour = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Campo com ";", aspas ou quebra de linha vai entre aspas, com as aspas dobradas */
const cell = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (lines: Array<Array<string | number>>) => BOM + lines.map((l) => l.map(cell).join(";")).join("\r\n") + "\r\n";

/** A tabela do Dashboard, como está na tela (filtros e ordem) */
export function machinesCsv(rows: Machine[]): string {
  return toCsv([
    ["Máquina", "Linha", "Dias com apontamento", "Produção", "Meta", "Atingimento (%)", "Situação", "Último apontamento"],
    ...rows.map((m) => [
      m.name,
      m.line,
      m.days,
      m.produced,
      m.hasTarget ? Math.round(m.target) : "",
      m.hasTarget && m.target > 0 ? m.percent : "",
      m.hasTarget ? STATUS_META[m.status].label : "Por demanda",
      m.lastEntry ? `${day.format(m.lastEntry.date)} · ${SHIFT_META[m.lastEntry.shift].label}` : "",
    ]),
  ]);
}

/** Os apontamentos de uma máquina no recorte, do mais antigo ao mais novo */
export function ordersCsv(machine: Machine, orders: ProductionOrder[]): string {
  return toCsv([
    ["Máquina", "Data", "Turno", "OP", "Quantidade", "Retrabalho", "Registrado por", "Registrado às", "Observação"],
    ...[...orders]
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.shift - b.shift)
      .map((o) => [
        machine.name,
        day.format(o.date),
        SHIFT_META[o.shift].label,
        o.opId.replace("OP ", ""),
        o.quantity,
        o.rework ? "Sim" : "Não",
        o.operator,
        hour.format(o.recordedAt),
        o.note?.text ?? "",
      ]),
  ]);
}

/** "dash-maquinas-setembro-de-2026.csv" */
export const csvName = (...parts: string[]) =>
  `${parts
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.csv`;
