import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Misc";
import { useLayout, usePresence } from "./LayoutContext";
import { Splitter } from "./Splitter";

export const SIDE_NAV_ID = "side-nav";

interface SideNavProps {
  /** Cabeçalho: no modo inline ele sobe para o TopNavStart; em flyout/overlay fica no topo do painel */
  header: ReactNode;
  children: ReactNode;
}

export function SideNav({ header, children }: SideNavProps) {
  const L = useLayout();
  const transientOpen = L.flyoutOpen || L.overlayOpen;
  const presence = usePresence(transientOpen);
  const navRef = useRef<HTMLElement>(null);
  // Lembra o modo de abertura para manter o visual certo durante a saída
  const mode = useRef<"flyout" | "overlay">("flyout");
  if (L.overlayOpen) mode.current = "overlay";
  else if (L.flyoutOpen) mode.current = "flyout";

  // Overlay aberto por clique/teclado: foco vai para a navegação
  useEffect(() => {
    if (L.overlayOpen) navRef.current?.focus();
  }, [L.overlayOpen]);

  useEffect(() => {
    if (!transientOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") L.closeTransientSideNav({ restoreFocus: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [transientOpen, L]);

  if (L.isSideNavInline) {
    return (
      <nav
        id={SIDE_NAV_ID}
        aria-label="Navegação principal"
        tabIndex={-1}
        className="relative flex w-sidenav shrink-0 flex-col border-r bg-surface outline-none"
      >
        {children}
        <Splitter
          edge="end"
          label="Redimensionar navegação lateral"
          controls={SIDE_NAV_ID}
          value={L.sideNavWidth}
          bounds={L.sideNavBounds}
          onResize={L.setSideNavWidth}
          onDoubleClick={L.collapseSideNav}
        />
      </nav>
    );
  }

  if (!presence.mounted) return null;

  const isOverlay = mode.current === "overlay";

  return (
    <>
      {isOverlay && (
        <div
          aria-hidden
          data-state={presence.state}
          onClick={() => L.closeTransientSideNav({ restoreFocus: true })}
          className={cn(
            "fixed inset-0 z-sidenav-overlay bg-blanket data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
            // No ambiente imersivo a gaveta também escurece o fundo em telas grandes: clicar fora fecha
            !L.immersive && "m:hidden",
          )}
        />
      )}
      <nav
        ref={navRef}
        id={SIDE_NAV_ID}
        aria-label="Navegação principal"
        tabIndex={-1}
        data-state={presence.state}
        onPointerEnter={() => {
          L.setPointerInsideFlyout(true);
          L.cancelFlyoutClose();
        }}
        onPointerLeave={() => {
          L.setPointerInsideFlyout(false);
          if (L.flyoutOpen) L.scheduleFlyoutClose();
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-sidenav-overlay flex flex-col bg-surface-overlay shadow-overlay outline-none",
          "w-sidenav-overlay s:w-sidenav s:max-w-sidenav-max",
          !L.immersive && "m:absolute",
          "data-[state=closed]:pointer-events-none data-[state=closed]:animate-flyout-out data-[state=open]:animate-flyout-in",
        )}
      >
        <div className="flex h-topnav shrink-0 items-center gap-100 px-150">
          <div className="min-w-0 flex-1">{header}</div>
          {(!L.isLarge || L.immersive) && (
            <IconButton
              icon={X}
              label="Fechar navegação"
              onClick={() => L.closeTransientSideNav({ restoreFocus: true })}
            />
          )}
        </div>
        {children}
      </nav>
    </>
  );
}

/* ---------- Slots ---------- */

export function SideNavBody({ children }: { children: ReactNode }) {
  return <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-150 pb-150 pt-100">{children}</div>;
}

export function SideNavFooter({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-025 border-t px-150 py-150">{children}</div>;
}

export function SideNavSection({ title, children }: { title?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={title ? id : undefined}
      className="flex flex-col gap-025 border-t pt-150 [&:not(:last-child)]:pb-150 first:border-t-0 first:pt-0"
    >
      {title && (
        <h2 id={id} className="px-100 pb-050 font-heading-xxsmall text-subtlest">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

interface SideNavItemProps {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Elemento antes do rótulo quando não há ícone (ex.: ponto decorativo) */
  elemBefore?: ReactNode;
  count?: number;
  isCurrent?: boolean;
}

export function SideNavItem({ href, label, icon: Icon, elemBefore, count, isCurrent }: SideNavItemProps) {
  const L = useLayout();
  return (
    <a
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      onClick={() => L.closeTransientSideNav()}
      className={cn(
        "ds-pressable group flex h-nav-item shrink-0 items-center gap-100 rounded-medium px-100 font-body",
        // Selecionado: tratamento neutro do ADS (não azul), rótulo em negrito
        isCurrent
          ? "bg-neutral font-semibold text-default hover:bg-neutral-hovered active:bg-neutral-pressed"
          : "text-subtle hover:bg-neutral-subtle-hovered hover:text-default active:bg-neutral-subtle-pressed",
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden
          className={cn("size-icon-small shrink-0", isCurrent ? "text-icon" : "text-icon-subtle group-hover:text-icon")}
        />
      ) : (
        <span aria-hidden className="flex size-icon-small shrink-0 items-center justify-center">
          {elemBefore}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && (
        <Badge>
          {count}
          <span className="sr-only"> itens</span>
        </Badge>
      )}
    </a>
  );
}
