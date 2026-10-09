import {
  
  useCallback,
  
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBreakpoints } from "@/lib/hooks";
import { clamp, readToken, storageGet, storageSet } from "@/lib/utils";

/*
 * Estado do layout ADS (navigation system):
 *  - inline:  ≥ 1024px e expandida → coluna redimensionável ao lado do Main
 *  - flyout:  ≥ 1024px e recolhida → abre como overlay ao passar o mouse no toggle
 *  - overlay: < 1024px → sempre recolhida; o toggle abre como overlay
 */

import { LayoutContext, type LayoutState } from "./LayoutContext";

const KEY_EXPANDED = "dash-proto.sidenav.expanded";
const KEY_SIDENAV_WIDTH = "dash-proto.sidenav.width";
const KEY_PANEL_WIDTH = "dash-proto.panel.width";

export function LayoutProvider({ children, immersive = false }: { children: ReactNode; immersive?: boolean }) {
  const { isLarge, isMedium, canHover } = useBreakpoints();

  const [expanded, setExpanded] = useState(() => storageGet(KEY_EXPANDED, true));
  const [sideNavWidth, setSideNavWidthState] = useState(() =>
    storageGet(KEY_SIDENAV_WIDTH, readToken("--dash-sidenav-width")),
  );
  const [panelWidth, setPanelWidthState] = useState(() =>
    storageGet(KEY_PANEL_WIDTH, readToken("--dash-panel-width")),
  );
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const menuOpen = useRef(false);
  const pointerInside = useRef(false);

  const isSideNavInline = isLarge && expanded && !immersive;

  const sideNavBounds = useCallback(
    () => ({
      min: readToken("--dash-sidenav-width-min"),
      max: window.innerWidth * readToken("--dash-sidenav-max-ratio"),
    }),
    [],
  );

  const panelBounds = useCallback(() => {
    const content = window.innerWidth - (isSideNavInline ? sideNavWidth : 0);
    return {
      min: readToken("--dash-panel-width-min"),
      max: Math.max(readToken("--dash-panel-width-min"), content * readToken("--dash-panel-max-ratio")),
    };
  }, [isSideNavInline, sideNavWidth]);

  const setSideNavWidth = useCallback(
    (px: number) => {
      const { min, max } = sideNavBounds();
      const next = Math.round(clamp(px, min, max));
      setSideNavWidthState(next);
      storageSet(KEY_SIDENAV_WIDTH, next);
    },
    [sideNavBounds],
  );

  const setPanelWidth = useCallback(
    (px: number) => {
      const { min, max } = panelBounds();
      const next = Math.round(clamp(px, min, max));
      setPanelWidthState(next);
      storageSet(KEY_PANEL_WIDTH, next);
    },
    [panelBounds],
  );

  const setExpandedPersist = useCallback((next: boolean) => {
    setExpanded(next);
    storageSet(KEY_EXPANDED, next);
  }, []);

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const closeTransientSideNav = useCallback((opts?: { restoreFocus?: boolean }) => {
    clearTimers();
    setFlyoutOpen(false);
    setOverlayOpen(false);
    if (opts?.restoreFocus) toggleButtonRef.current?.focus();
  }, []);

  const toggleSideNav = useCallback(() => {
    clearTimers();
    if (immersive) {
      // No ambiente imersivo o botão só abre e fecha a gaveta; a preferência de "expandida" não muda
      setOverlayOpen((o) => !o);
    } else if (isLarge) {
      if (flyoutOpen) {
        // Clique no toggle com o flyout aberto → fixa a navegação expandida
        setFlyoutOpen(false);
        setExpandedPersist(true);
      } else {
        setExpandedPersist(!expanded);
      }
    } else {
      setOverlayOpen((o) => !o);
    }
  }, [immersive, isLarge, flyoutOpen, expanded, setExpandedPersist]);

  const collapseSideNav = useCallback(() => {
    setExpandedPersist(false);
    setFlyoutOpen(false);
  }, [setExpandedPersist]);

  const openOverlay = useCallback(() => setOverlayOpen(true), []);

  const scheduleFlyoutOpen = useCallback(() => {
    if (isSideNavInline || overlayOpen || !canHover || immersive) return;
    clearTimers();
    openTimer.current = window.setTimeout(
      () => setFlyoutOpen(true),
      readToken("--dash-sidenav-flyout-open-delay"),
    );
  }, [isSideNavInline, overlayOpen, canHover, immersive]);

  const scheduleFlyoutClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    // O flyout continua aberto enquanto um menu dentro dele estiver aberto
    if (menuOpen.current) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(
      () => setFlyoutOpen(false),
      readToken("--dash-sidenav-flyout-close-delay"),
    );
  }, []);

  const cancelFlyoutClose = useCallback(() => window.clearTimeout(closeTimer.current), []);

  const setPointerInsideFlyout = useCallback((inside: boolean) => {
    pointerInside.current = inside;
  }, []);

  const setSideNavMenuOpen = useCallback(
    (open: boolean) => {
      menuOpen.current = open;
      if (open) cancelFlyoutClose();
      else if (!pointerInside.current) scheduleFlyoutClose();
    },
    [cancelFlyoutClose, scheduleFlyoutClose],
  );

  // Troca de breakpoint, ou entrar/sair do ambiente imersivo, descarta estados transitórios
  useEffect(() => {
    clearTimers();
    setFlyoutOpen(false);
    setOverlayOpen(false);
  }, [isLarge, immersive]);

  // Janela menor → re-limita larguras
  useEffect(() => {
    const onResize = () => {
      const s = sideNavBounds();
      setSideNavWidthState((w) => clamp(w, s.min, Math.max(s.min, s.max)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sideNavBounds]);

  // Atalho Ctrl+[ (sem animação: ações de teclado são instantâneas)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        toggleSideNav();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSideNav]);

  useEffect(() => clearTimers, []);

  const value = useMemo<LayoutState>(
    () => ({
      immersive,
      isLarge,
      isMedium,
      canHover,
      isSideNavInline,
      isSideNavExpanded: expanded,
      sideNavWidth,
      setSideNavWidth,
      sideNavBounds,
      toggleSideNav,
      collapseSideNav,
      flyoutOpen: flyoutOpen && !isSideNavInline,
      overlayOpen: overlayOpen && !isSideNavInline,
      closeTransientSideNav,
      openOverlay,
      scheduleFlyoutOpen,
      scheduleFlyoutClose,
      cancelFlyoutClose,
      setPointerInsideFlyout,
      setSideNavMenuOpen,
      toggleButtonRef,
      panelWidth,
      setPanelWidth,
      panelBounds,
    }),
    [
      immersive,
      isLarge,
      isMedium,
      canHover,
      isSideNavInline,
      expanded,
      sideNavWidth,
      setSideNavWidth,
      sideNavBounds,
      toggleSideNav,
      collapseSideNav,
      flyoutOpen,
      overlayOpen,
      closeTransientSideNav,
      openOverlay,
      scheduleFlyoutOpen,
      scheduleFlyoutClose,
      cancelFlyoutClose,
      setPointerInsideFlyout,
      setSideNavMenuOpen,
      panelWidth,
      setPanelWidth,
      panelBounds,
    ],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

/** Mantém o elemento montado durante a animação de saída. */
