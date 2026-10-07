import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/Button";
import { useLayout, usePresence } from "./LayoutContext";
import { Splitter } from "./Splitter";

export const PANEL_ID = "panel";
/** Slot no AppRoot: o Panel é irmão do Main, mesmo sendo declarado dentro da página */
export const PANEL_SLOT_ID = "panel-slot";

interface PanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Painel à direita. ≥ 1024px: inline, redimensionável até 50% da área de
 * conteúdo. < 1024px: sobrepõe o Main. Entrada e saída animadas (250ms).
 */
export function Panel({ open, onClose, title, subtitle, headerExtra, footer, children }: PanelProps) {
  const L = useLayout();
  const presence = usePresence(open);
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => setSlot(document.getElementById(PANEL_SLOT_ID)), []);

  useEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [open, title, slot]);

  if (!presence.mounted || !slot) return null;
  const inline = L.isLarge;

  return createPortal(
    <aside
      ref={ref}
      id={PANEL_ID}
      tabIndex={-1}
      aria-labelledby={`${PANEL_ID}-title`}
      data-state={presence.state}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) onClose();
      }}
      className={cn(
        "flex w-panel max-w-full flex-col bg-surface-overlay shadow-overlay outline-none",
        "data-[state=closed]:pointer-events-none data-[state=closed]:animate-panel-out data-[state=open]:animate-panel-in",
        inline ? "relative shrink-0" : "fixed inset-y-0 right-0 z-panel-overlay",
      )}
    >
      {inline && (
        <Splitter
          edge="start"
          label="Redimensionar painel"
          controls={PANEL_ID}
          value={L.panelWidth}
          bounds={L.panelBounds}
          onResize={L.setPanelWidth}
        />
      )}
      <div
        className={cn(
          "clip-shadow-bottom relative z-sticky flex shrink-0 flex-col gap-150 bg-surface-overlay px-300 pb-200 pt-250 transition-shadow duration-hover ease-out",
          scrolled ? "shadow-overflow" : "shadow-none",
        )}
      >
        <div className="flex items-start gap-100">
          <div className="min-w-0 flex-1">
            <h2 id={`${PANEL_ID}-title`} className="line-clamp-2 font-heading-medium text-default" title={title}>
              {title}
            </h2>
            {subtitle && <div className="mt-050 text-subtle">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Fechar painel" shortcut="Esc" onClick={onClose} className="-mr-100 -mt-050" />
        </div>
        {headerExtra}
      </div>
      {/* Focável: sem nada clicável dentro, é o único jeito de rolar pelo teclado */}
      <div
        tabIndex={0}
        aria-label={`Conteúdo de ${title}`}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-300 pb-300 focus-visible:outline-offset-inset"
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
      >
        {children}
      </div>
      {footer && <div className="flex shrink-0 gap-100 border-t px-300 py-200">{footer}</div>}
    </aside>,
    slot,
  );
}
