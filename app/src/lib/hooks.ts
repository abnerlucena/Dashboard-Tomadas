import { useCallback, useEffect, useSyncExternalStore } from "react";

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}

/** Breakpoints ADS: s 768–1023 recolhe a navegação; m ≥ 1024 expande inline. */
export function useBreakpoints() {
  const isLarge = useMediaQuery("(min-width: 1024px)");
  const isMedium = useMediaQuery("(min-width: 768px)");
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  return { isLarge, isMedium, canHover };
}

export type ColorModePreference = "light" | "dark" | "auto";

/**
 * Aplica o tema escolhido. A escolha é pessoal e mora nas preferências da conta
 * (features/preferences); aqui só se resolve "igual ao sistema" e se marca a página.
 */
export function useColorMode(preference: ColorModePreference) {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved = preference === "auto" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-color-mode", resolved);
  }, [resolved]);

  return { preference, resolved };
}
