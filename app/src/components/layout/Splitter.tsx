import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn, readToken } from "@/lib/utils";

interface SplitterProps {
  /** Borda onde o splitter fica: "end" = direita do elemento, "start" = esquerda */
  edge: "start" | "end";
  label: string;
  value: number;
  bounds: () => { min: number; max: number };
  onResize: (px: number) => void;
  onDoubleClick?: () => void;
  controls?: string;
}

/**
 * Divisor de painel (panel splitter). Arrastar redimensiona; setas do
 * teclado ajustam em passos; Home/End vão ao mínimo/máximo; duplo clique
 * executa onDoubleClick (na navegação lateral: recolher).
 */
export function Splitter({ edge, label, value, bounds, onResize, onDoubleClick, controls }: SplitterProps) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const direction = edge === "end" ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width: value };
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    onResize(start.current.width + (e.clientX - start.current.x) * direction);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    start.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = readToken("--dash-splitter-keyboard-step");
    const { min, max } = bounds();
    const grow = edge === "end" ? "ArrowRight" : "ArrowLeft";
    const shrink = edge === "end" ? "ArrowLeft" : "ArrowRight";
    if (e.key === grow) onResize(value + step);
    else if (e.key === shrink) onResize(value - step);
    else if (e.key === "Home") onResize(min);
    else if (e.key === "End") onResize(max);
    else if (e.key === "Enter" && onDoubleClick) onDoubleClick();
    else return;
    e.preventDefault();
  };

  const { min, max } = typeof window === "undefined" ? { min: 0, max: 0 } : bounds();

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "group absolute inset-y-0 z-sticky flex w-splitter cursor-col-resize touch-none justify-center outline-none",
        edge === "end" ? "-right-050" : "-left-050",
      )}
    >
      <span
        aria-hidden
        className="h-full w-splitter-line bg-transparent transition-colors duration-hover ease-out group-hover:bg-border-focused group-focus-visible:bg-border-focused group-data-[dragging]:bg-border-focused"
      />
    </div>
  );
}
