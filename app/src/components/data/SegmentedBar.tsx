import { STATUS_META, type Status } from "@/data/machines";
import { cn } from "@/lib/utils";

const FILL: Record<Status, string> = {
  critical: "bg-danger-bold",
  attention: "bg-warning-bold",
  near: "bg-information-bold",
  achieved: "bg-success-bold",
};

interface SegmentedBarProps {
  percent: number;
  status: Status;
  segments?: number;
  label: string;
}

/**
 * Medidor em 10 segmentos (cada um = 10% da meta). A cor reforça o status,
 * mas o valor e o status sempre aparecem em texto ao lado.
 */
export function SegmentedBar({ percent, status, segments = 10, label }: SegmentedBarProps) {
  const filled = Math.min(segments, Math.round((percent / 100) * segments));
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percent}% da meta, ${STATUS_META[status].label}`}
      className="flex shrink-0 items-center gap-025"
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-segment-height w-segment-width rounded-xsmall",
            i < filled ? FILL[status] : "bg-neutral-hovered",
          )}
        />
      ))}
    </span>
  );
}
