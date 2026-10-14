import { lazy, Suspense, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Feedback";

/*
 * Porta de entrada dos gráficos. O ECharts (~180 KB comprimido) fica num
 * pedaço separado do app e só é baixado quando o primeiro gráfico aparece;
 * enquanto isso, um skeleton do mesmo tamanho segura o lugar.
 */
const load = () => import("./Charts");
const LazyBurnup = lazy(() => load().then((m) => ({ default: m.BurnupChart })));
const LazyDaily = lazy(() => load().then((m) => ({ default: m.DailyColumns })));
const LazyAttainment = lazy(() => load().then((m) => ({ default: m.AttainmentBars })));
const LazyCapacity = lazy(() => load().then((m) => ({ default: m.CapacityBars })));
const LazyShiftStack = lazy(() => load().then((m) => ({ default: m.ShiftStackBars })));
const LazyCombo = lazy(() => load().then((m) => ({ default: m.ComboChart })));
const LazyHBars = lazy(() => load().then((m) => ({ default: m.HBars })));

type BurnupProps = ComponentProps<typeof LazyBurnup>;

export function BurnupChart(props: BurnupProps) {
  return (
    <Suspense fallback={<Skeleton className={cn("w-full rounded-medium", props.heightClass ?? "h-chart-large")} />}>
      <LazyBurnup {...props} />
    </Suspense>
  );
}

export function DailyColumns(props: ComponentProps<typeof LazyDaily>) {
  return (
    <Suspense fallback={<Skeleton className="h-chart w-full rounded-medium" />}>
      <LazyDaily {...props} />
    </Suspense>
  );
}

export function AttainmentBars(props: ComponentProps<typeof LazyAttainment>) {
  return (
    <Suspense fallback={<Skeleton className="h-chart w-full rounded-medium" />}>
      <LazyAttainment {...props} />
    </Suspense>
  );
}

export function CapacityBars(props: ComponentProps<typeof LazyCapacity>) {
  return (
    <Suspense fallback={<Skeleton className="h-chart-large w-full rounded-medium" />}>
      <LazyCapacity {...props} />
    </Suspense>
  );
}

export function ShiftStackBars(props: ComponentProps<typeof LazyShiftStack>) {
  return (
    <Suspense fallback={<Skeleton className="size-full rounded-medium" />}>
      <LazyShiftStack {...props} />
    </Suspense>
  );
}

export function ComboChart(props: ComponentProps<typeof LazyCombo>) {
  return (
    <Suspense fallback={<Skeleton className="h-chart w-full rounded-medium" />}>
      <LazyCombo {...props} />
    </Suspense>
  );
}

export function HBars(props: ComponentProps<typeof LazyHBars>) {
  return (
    <Suspense fallback={<Skeleton className="h-chart w-full rounded-medium" />}>
      <LazyHBars {...props} />
    </Suspense>
  );
}

export type { ComboSeries, HBarItem } from "./Charts";
