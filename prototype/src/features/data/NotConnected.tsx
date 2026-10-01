import { Cable, LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui/Feedback";
import { WAITING } from "./connection";

export function NotConnected({ title, route }: { title: string; route: string }) {
  return (
    <div className="px-200 pt-300 m:px-400">
      <h1 className="font-heading-large text-default">{title}</h1>
      <EmptyState
        icon={Cable}
        title="Esta tela ainda não está ligada ao banco"
        hint={WAITING[route]}
        action={{ label: "Ir para o Dashboard", icon: LayoutDashboard, onClick: () => (window.location.hash = "/dashboard") }}
      />
    </div>
  );
}
