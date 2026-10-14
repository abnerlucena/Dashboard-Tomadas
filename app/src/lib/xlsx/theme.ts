import type { Status } from "@/data/machines";

/*
 * Padrão visual das planilhas exportadas pelo Dash (todas as telas).
 * As cores saem dos tokens do tema claro (styles/tokens.css), em hexadecimal,
 * porque o Excel não lê variáveis CSS. A planilha é sempre clara: vai para
 * impressão e para quem abre fora do Dash.
 */

export const XLSX_FONT = "Calibri";

/** ARGB (o Excel quer o alfa na frente) */
const argb = (hex: string) => `FF${hex}`;

export const COLOR = {
  brand: argb("0062B3"), // background.brand.bold
  brandDark: argb("003366"), // background.brand.boldest
  brandSoft: argb("E7F3FE"), // background.information
  text: argb("1F2933"),
  subtle: argb("5B6675"),
  subtlest: argb("8A94A3"),
  white: argb("FFFFFF"),
  zebra: argb("F6F8FA"),
  border: argb("DDE2E8"),
  borderStrong: argb("C4CBD4"),
  totalFill: argb("EEF2F6"),
} as const;

/** Mesmo tom dos lozenges da tela: fundo sutil + texto do papel; "bold" para barras */
export const STATUS_COLOR: Record<Status, { fill: string; text: string; bold: string }> = {
  critical: { fill: argb("FEE9E9"), text: argb("AD1F1F"), bold: argb("C32222") },
  attention: { fill: argb("FFF1D1"), text: argb("914808"), bold: argb("F9AB10") },
  near: { fill: argb("E7F3FE"), text: argb("105893"), bold: argb("1574C1") },
  achieved: { fill: argb("E7F8ED"), text: argb("126836"), bold: argb("1E8549") },
};

/** Faixas de atingimento (STATUS_META), em fração: 0,7 = 70% */
export const STATUS_BREAKS = { attention: 0.7, near: 0.9, achieved: 1 } as const;

/** Cores dos gráficos (paleta categórica validada, tokens chart.categorical) */
export const CHART = {
  brand: "#0076D6",
  target: "#5B6675",
  neutral: "#C4CBD4",
  shifts: ["#1F7AD6", "#0E9C91", "#A32966"],
  status: { critical: "#C32222", attention: "#F9AB10", near: "#1574C1", achieved: "#1E8549" } as Record<Status, string>,
  grid: "#E5E9EE",
  axis: "#5B6675",
};

/** Formatos de número: o Excel troca ponto e vírgula conforme o idioma de quem abre */
export const NUM = {
  int: "#,##0",
  decimal: "#,##0.0",
  percent: "0%",
  percent1: "0.0%",
  date: "dd/mm/yyyy",
  dateTime: "dd/mm/yyyy hh:mm",
  time: "hh:mm",
} as const;
