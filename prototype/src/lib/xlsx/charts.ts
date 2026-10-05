import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent } from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { CHART } from "./theme";

/*
 * Gráficos das planilhas: o mesmo ECharts das telas, desenhado num canvas fora da
 * tela e entregue como PNG (o Excel não aceita SVG em imagem, e nenhuma biblioteca
 * de navegador cria gráfico nativo do Excel). Sempre no tema claro.
 * Este arquivo só carrega na hora de exportar.
 */
echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

const FONT = "Calibri, Segoe UI, Arial, sans-serif";
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

const axis = {
  axisLine: { lineStyle: { color: CHART.neutral } },
  axisTick: { show: false },
  axisLabel: { color: CHART.axis, fontFamily: FONT, fontSize: 11 },
  splitLine: { lineStyle: { color: CHART.grid } },
};
const legend = {
  top: 0,
  right: 0,
  icon: "roundRect",
  itemWidth: 12,
  itemHeight: 8,
  textStyle: { color: CHART.axis, fontFamily: FONT, fontSize: 11 },
};

/** Imagem pronta para a planilha: o PNG e o tamanho dele (para não esticar) */
export interface ChartImage {
  png: string;
  width: number;
  height: number;
}

/** Desenha e devolve o PNG (data URL), com o dobro de pixels para ficar nítido no Excel */
export function renderPng(option: EChartsCoreOption, width = 1040, height = 600): ChartImage {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px`;
  document.body.appendChild(el);
  const chart = echarts.init(el, undefined, { renderer: "canvas", width, height });
  chart.setOption({ animation: false, textStyle: { fontFamily: FONT }, ...option });
  const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#FFFFFF" });
  chart.dispose();
  el.remove();
  return { png: url, width, height };
}

/** Produção acumulada × meta acumulada, dia a dia */
export function cumulativeChart(days: string[], produced: Array<number | null>, target: number[]) {
  return renderPng(
    {
      legend: { ...legend, data: ["Produção acumulada", "Meta acumulada"] },
      grid: { left: 64, right: 16, top: 36, bottom: 32 },
      xAxis: { type: "category", data: days, ...axis, splitLine: { show: false } },
      yAxis: { type: "value", ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact.format(v) } },
      series: [
        {
          name: "Produção acumulada",
          type: "line",
          data: produced,
          smooth: false,
          symbol: "none",
          lineStyle: { width: 3, color: CHART.brand },
          areaStyle: { color: "rgba(0,118,214,0.10)" },
          itemStyle: { color: CHART.brand },
        },
        {
          name: "Meta acumulada",
          type: "line",
          data: target,
          symbol: "none",
          lineStyle: { width: 2, type: "dashed", color: CHART.target },
          itemStyle: { color: CHART.target },
        },
      ],
    },
    1400,
    440,
  );
}

/** Atingimento por máquina (barras horizontais, cor da situação, linha dos 100%) */
export function attainmentChart(items: Array<{ name: string; percent: number; status: keyof typeof CHART.status }>) {
  const sorted = [...items].sort((a, b) => a.percent - b.percent);
  return renderPng(
    {
      grid: { left: 200, right: 48, top: 16, bottom: 28 },
      xAxis: {
        type: "value",
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: "{value}%" },
        max: (v: { max: number }) => Math.max(110, Math.ceil(v.max / 10) * 10),
      },
      yAxis: {
        type: "category",
        data: sorted.map((i) => i.name),
        ...axis,
        axisLabel: { ...axis.axisLabel, width: 188, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 18,
          data: sorted.map((i) => ({ value: i.percent, itemStyle: { color: CHART.status[i.status], borderRadius: [0, 3, 3, 0] } })),
          label: { show: true, position: "right", color: CHART.axis, fontFamily: FONT, fontSize: 11, formatter: "{c}%" },
          markLine: {
            symbol: "none",
            silent: true,
            label: { formatter: "Meta", color: CHART.axis },
            lineStyle: { color: CHART.target, type: "dashed" },
            data: [{ xAxis: 100 }],
          },
        },
      ],
    },
    720,
    Math.max(420, 40 + sorted.length * 30),
  );
}

/** Produção por turno de cada máquina (barras empilhadas) */
export function shiftsChart(names: string[], byShift: [number[], number[], number[]]) {
  return renderPng(
    {
      legend: { ...legend, data: ["Turno 1", "Turno 2", "Turno 3"] },
      grid: { left: 250, right: 24, top: 36, bottom: 28 },
      xAxis: { type: "value", ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact.format(v) } },
      yAxis: { type: "category", data: names, inverse: true, ...axis, axisLabel: { ...axis.axisLabel, width: 236, overflow: "truncate" } },
      series: byShift.map((data, i) => ({
        name: `Turno ${i + 1}`,
        type: "bar",
        stack: "t",
        barMaxWidth: 18,
        data,
        itemStyle: { color: CHART.shifts[i] },
      })),
    },
    1040,
    Math.max(320, 60 + names.length * 26),
  );
}

/** Produção diária (barras) com a meta do dia (linha) */
export function dailyChart(days: string[], produced: Array<number | null>, target: Array<number | null>) {
  return renderPng(
    {
      legend: { ...legend, data: ["Produção do dia", "Meta do dia"] },
      grid: { left: 64, right: 16, top: 36, bottom: 32 },
      xAxis: { type: "category", data: days, ...axis, splitLine: { show: false } },
      yAxis: { type: "value", ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact.format(v) } },
      series: [
        {
          name: "Produção do dia",
          type: "bar",
          data: produced,
          barMaxWidth: 22,
          itemStyle: { color: CHART.brand, borderRadius: [3, 3, 0, 0] },
        },
        {
          name: "Meta do dia",
          type: "line",
          step: "middle",
          data: target,
          symbol: "none",
          lineStyle: { width: 2, type: "dashed", color: CHART.target },
          itemStyle: { color: CHART.target },
        },
      ],
    },
    1400,
    440,
  );
}

/** Participação (rosca): turnos, linhas */
export function shareChart(items: Array<{ name: string; value: number; color: string }>) {
  return renderPng(
    {
      legend: {
        ...legend,
        top: "middle",
        right: 16,
        orient: "vertical",
        formatter: (n: string) => `${n}  ${int.format(items.find((i) => i.name === n)?.value ?? 0)}`,
      },
      series: [
        {
          type: "pie",
          radius: ["48%", "78%"],
          center: ["32%", "52%"],
          label: {
            formatter: (p: { percent: number }) => `${pct.format(p.percent / 100)}`,
            color: CHART.axis,
            fontFamily: FONT,
            fontSize: 12,
          },
          data: items.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color, borderColor: "#fff", borderWidth: 2 } })),
        },
      ],
    },
    900,
    560,
  );
}
