import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// Só os módulos usados entram no pacote (tree-shaking). SVG: texto nítido em qualquer zoom.
echarts.use([LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);

interface EChartProps {
  /** Opção do ECharts; como função, recebe a largura atual (layout responsivo) */
  option: EChartsCoreOption | ((width: number) => EChartsCoreOption);
  /** Resumo em texto do gráfico (nome acessível) */
  label: string;
  className?: string;
  /** altura calculada (ex.: proporcional ao número de linhas) */
  style?: CSSProperties;
  /**
   * Navegação por teclado: setas percorrem os itens (mostram o tooltip e
   * anunciam o valor), Enter ativa, Esc fecha. Sem isto o gráfico não recebe foco.
   */
  keyboard?: {
    count: number;
    /** item inicial ao começar a navegar (ex.: último dia apontado) */
    start?: number;
    /** direção das setas: horizontal (dias) ou vertical (lista de barras) */
    axis: "x" | "y";
    describe: (index: number) => string;
    onActivate?: (index: number) => void;
  };
  onClick?: (params: { dataIndex: number; componentType: string; value?: unknown }) => void;
  /** Sem tooltip nem interação (Modo TV) */
  isStatic?: boolean;
}

/** Monta o ECharts num div, acompanha o tamanho do container e libera ao desmontar. */
export function EChart({ option, label, className, style, keyboard, onClick, isStatic }: EChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: "svg" });
    chart.current = c;
    c.on("click", (p) => clickRef.current?.(p as { dataIndex: number; componentType: string; value?: unknown }));
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
      c.resize();
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  const resolved = useMemo(
    () => (typeof option === "function" ? (width > 0 ? option(width) : null) : option),
    [option, width],
  );
  useEffect(() => {
    // Mescla com o estado anterior: trocar filtro/tema anima a mudança em vez de redesenhar do zero
    if (resolved) chart.current?.setOption(resolved, { lazyUpdate: true });
  }, [resolved]);

  const show = (i: number | null) => {
    const c = chart.current;
    if (!c) return;
    c.dispatchAction({ type: "downplay", seriesIndex: 0 });
    if (i == null) {
      c.dispatchAction({ type: "hideTip" });
    } else {
      c.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: i });
      c.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: i });
    }
    setIndex(i);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!keyboard) return;
    const next = keyboard.axis === "x" ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 };
    const dir = next[e.key as keyof typeof next];
    if (dir) {
      e.preventDefault();
      // Primeira seta: começa no item inicial; depois, anda um item
      const target = index == null ? (keyboard.start ?? (dir > 0 ? 0 : keyboard.count - 1)) : index + dir;
      show(Math.min(keyboard.count - 1, Math.max(0, target)));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      show(e.key === "Home" ? 0 : keyboard.count - 1);
    } else if ((e.key === "Enter" || e.key === " ") && index != null && keyboard.onActivate) {
      e.preventDefault();
      keyboard.onActivate(index);
    } else if (e.key === "Escape") {
      show(null);
    }
  };

  const hint = keyboard ? ` Use as setas para percorrer ${keyboard.axis === "x" ? "os dias" : "os itens"}${keyboard.onActivate ? " e Enter para abrir" : ""}.` : "";

  return (
    <div
      role="group"
      aria-label={label + hint}
      tabIndex={keyboard && !isStatic ? 0 : undefined}
      onKeyDown={onKeyDown}
      onBlur={() => index != null && show(null)}
      className={cn("relative w-full rounded-medium focus-visible:outline-offset-inset", className)}
      style={style}
    >
      <div ref={el} aria-hidden className={cn("size-full", isStatic && "pointer-events-none")} />
      <span className="sr-only" aria-live="polite">
        {keyboard && index != null ? keyboard.describe(index) : ""}
      </span>
    </div>
  );
}
