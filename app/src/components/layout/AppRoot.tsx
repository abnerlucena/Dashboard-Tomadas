import { Info, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useLayout } from "./LayoutContext";
import { LayoutProvider } from "./LayoutProvider";
import { PANEL_SLOT_ID } from "./Panel";
import { SIDE_NAV_ID } from "./SideNav";

export const MAIN_ID = "main-content";

/*
 * AppRoot envolve toda a tela. Áreas (filhas diretas, na ordem ADS):
 * Banner (opcional) · TopNav · SideNav · Main · Panel.
 *
 * ≥ 1024px: altura da viewport; Main e Panel rolam por conta própria.
 * < 1024px: a página rola no body; a TopNav fica grudada no topo.
 */
interface AppRootProps {
  /** Ambiente imersivo (Apontamento): navegação lateral recolhida, aberta só sob demanda */
  immersive?: boolean;
  banner?: ReactNode;
  topNav: ReactNode;
  sideNav: ReactNode;
  children: ReactNode;
}

export function AppRoot(props: AppRootProps) {
  return (
    <LayoutProvider immersive={props.immersive}>
      <AppRootInner {...props} />
    </LayoutProvider>
  );
}

function AppRootInner({ banner, topNav, sideNav, children }: AppRootProps) {
  const L = useLayout();
  const style = {
    "--dash-sidenav-width": `${L.sideNavWidth}px`,
    "--dash-panel-width": `${L.panelWidth}px`,
  } as CSSProperties;

  return (
    <div style={style} className="flex min-h-dvh flex-col bg-surface text-default m:h-dvh m:overflow-hidden">
      <SkipLinks />
      {banner}
      {topNav}
      <div className="relative flex flex-1 m:min-h-0">
        {sideNav}
        {children}
        {/* O <Panel> é declarado pela página e renderizado aqui via portal */}
        <div id={PANEL_SLOT_ID} className="contents" />
      </div>
    </div>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return (
    <main id={MAIN_ID} tabIndex={-1} className="scrollbar-thin min-w-0 flex-1 pb-800 outline-none s:pb-0 m:overflow-y-auto">
      {children}
    </main>
  );
}

function SkipLinks() {
  const L = useLayout();
  const linkClass =
    "sr-only focus:not-sr-only focus:fixed focus:left-100 focus:top-100 focus:z-skip-link focus:rounded-medium focus:bg-surface-overlay focus:px-150 focus:py-100 focus:font-medium focus:text-link focus:shadow-overlay";

  const goTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (id === SIDE_NAV_ID && !L.isSideNavInline) {
      L.openOverlay(); // a própria navegação recebe o foco ao abrir
      return;
    }
    document.getElementById(id)?.focus();
  };

  return (
    <div>
      <a href={`#${MAIN_ID}`} onClick={goTo(MAIN_ID)} className={linkClass}>
        Pular para o conteúdo principal
      </a>
      <a href={`#${SIDE_NAV_ID}`} onClick={goTo(SIDE_NAV_ID)} className={linkClass}>
        Pular para a navegação lateral
      </a>
    </div>
  );
}

export function Banner({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <div
      role="region"
      aria-label="Aviso"
      className="z-banner flex min-h-banner shrink-0 items-center gap-100 bg-neutral-bold px-200 py-050 text-inverse"
    >
      <Info aria-hidden className="size-icon-small shrink-0" />
      <p className="min-w-0 flex-1 font-medium">{children}</p>
      <button
        type="button"
        aria-label="Dispensar aviso"
        onClick={onDismiss}
        className="ds-pressable flex size-control-compact shrink-0 items-center justify-center rounded-medium hover:bg-inverse-subtle-hovered active:bg-inverse-subtle-pressed"
      >
        <X aria-hidden className="size-icon-small" />
      </button>
    </div>
  );
}
