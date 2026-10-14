import { Button } from "@/components/ui/Button";
import type { OpAction } from "./OpActions";

export function OpActionButtons({ actions, compact }: { actions: OpAction[]; compact?: boolean }) {
  return (
    <>
      {actions.map((a) => (
        <Button
          key={a.id}
          appearance={a.isPrimary ? "primary" : "default"}
          spacing={compact ? "compact" : "default"}
          iconBefore={a.icon}
          onClick={a.run}
        >
          {a.label}
        </Button>
      ))}
    </>
  );
}
