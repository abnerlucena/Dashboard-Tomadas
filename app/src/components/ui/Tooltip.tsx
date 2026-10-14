import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { Kbd } from "./Kbd";

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  // Depois do primeiro tooltip, os vizinhos abrem sem atraso (skipDelayDuration)
  <RadixTooltip.Provider delayDuration={400} skipDelayDuration={300}>
    {children}
  </RadixTooltip.Provider>
);

export const TOOLTIP_CONTENT_CLASS =
  "z-tooltip flex max-w-tooltip-max items-center gap-100 rounded-small bg-neutral-bold px-100 py-050 font-body-small text-inverse data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in";

interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
  disabled?: boolean;
  /** Mantém o gatilho montado, mas impede o tooltip de abrir */
  suppressed?: boolean;
}

export function Tooltip({ content, shortcut, side = "bottom", children, disabled, suppressed }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <RadixTooltip.Root open={suppressed ? false : undefined}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={TOOLTIP_CONTENT_CLASS}
        >
          {content}
          {shortcut && <Kbd inverse>{shortcut}</Kbd>}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
