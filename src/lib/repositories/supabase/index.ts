// ─── Implementação Supabase ───────────────────────────────────
import type { DataSource } from "../types";
import { supabaseAuth } from "./auth";
import { supabaseProduction } from "./production";
import { supabaseCalendar, supabaseMachines, supabaseTargets } from "./catalog";
import { supabaseUsers } from "./users";
import { supabaseWorkOrders } from "./workOrders";
import { supabaseOccurrences } from "./occurrences";

export const supabaseDataSource: DataSource = {
  kind: "supabase",
  auth: supabaseAuth,
  production: supabaseProduction,
  machines: supabaseMachines,
  targets: supabaseTargets,
  calendar: supabaseCalendar,
  users: supabaseUsers,
  workOrders: supabaseWorkOrders,
  occurrences: supabaseOccurrences,
};

export { BadgeRequiredError } from "./auth";
