import {
  createContext,
  
  useContext,
  useEffect,
  
  
  useState,
  
} from "react";
import { readToken } from "@/lib/utils";

/*
 * Estado do layout ADS (navigation system):
 *  - inline:  ≥ 1024px e expandida → coluna redimensionável ao lado do Main
 *  - flyout:  ≥ 1024px e recolhida → abre como overlay ao passar o mouse no toggle
 *  - overlay: < 1024px → sempre recolhida; o toggle abre como overlay
 */


export interface LayoutState {
  /**
   * Tela de ambiente imersivo (Apontamento): a navegação lateral fica recolhida
   * (sem mexer na preferência salva) e abre como gaveta pelo botão do topo.
   */
  immersive: boolean;
  isLarge: boolean;
  isMedium: boolean;
  canHover: boolean;

  isSideNavInline: boolean;
  isSideNavExpanded: boolean;
  sideNavWidth: number;
  setSideNavWidth: (px: number) => void;
  sideNavBounds: () => { min: number; max: number };
  toggleSideNav: () => void;
  collapseSideNav: () => void;

  flyoutOpen: boolean;
  overlayOpen: boolean;
  closeTransientSideNav: (opts?: { restoreFocus?: boolean }) => void;
  openOverlay: () => void;
  scheduleFlyoutOpen: () => void;
  scheduleFlyoutClose: () => void;
  cancelFlyoutClose: () => void;
  setPointerInsideFlyout: (inside: boolean) => void;
  setSideNavMenuOpen: (open: boolean) => void;
  toggleButtonRef: React.RefObject<HTMLButtonElement>;

  panelWidth: number;
  setPanelWidth: (px: number) => void;
  panelBounds: () => { min: number; max: number };
}

// Exportado para o LayoutProvider, que vive em LayoutProvider.tsx: um arquivo
// que exporta componente E hook perde o recarregamento a quente (react-refresh).
export const LayoutContext = createContext<LayoutState | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout precisa estar dentro de <LayoutProvider>");
  return ctx;
}

export function usePresence(open: boolean, durationToken = "--ds-motion-duration-panel") {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setState("open");
      return;
    }
    setState("closed");
    const t = window.setTimeout(() => setMounted(false), readToken(durationToken));
    return () => window.clearTimeout(t);
  }, [open, durationToken]);

  return { mounted, state };
}
