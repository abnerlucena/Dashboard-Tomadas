import { PanelLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/Button";
import { useLayout } from "./LayoutContext";
import { SIDE_NAV_ID } from "./SideNav";

/*
 * TopNav: altura fixa (56px), três slots. Com a navegação lateral expandida,
 * o TopNavStart assume a largura e o fundo dela e perde a borda inferior,
 * formando uma barra lateral de altura total.
 */
export function TopNav({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-topnav flex h-topnav shrink-0 bg-surface m:relative m:top-auto">{children}</header>
  );
}

export function TopNavStart({ children }: { children: ReactNode }) {
  const { isSideNavInline } = useLayout();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-100 px-150",
        isSideNavInline ? "w-sidenav border-r" : "border-b",
      )}
    >
      {children}
    </div>
  );
}

/** Container de Middle + End (carrega a borda inferior da top nav). */
export function TopNavContent({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 items-center gap-200 border-b pl-100 pr-150 s:pl-200">{children}</div>;
}

export function TopNavMiddle({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 items-center justify-center">{children}</div>;
}

export function TopNavEnd({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-050">{children}</div>;
}

export function SideNavToggleButton() {
  const L = useLayout();
  const isOpen = L.isSideNavInline || L.overlayOpen;
  return (
    <IconButton
      ref={L.toggleButtonRef}
      icon={PanelLeft}
      label={isOpen ? "Recolher navegação lateral" : "Expandir navegação lateral"}
      shortcut="Ctrl ["
      aria-expanded={isOpen || L.flyoutOpen}
      aria-controls={SIDE_NAV_ID}
      tooltipSuppressed={L.flyoutOpen}
      onClick={L.toggleSideNav}
      onPointerEnter={L.scheduleFlyoutOpen}
      onPointerLeave={L.scheduleFlyoutClose}
    />
  );
}
