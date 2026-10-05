import { DATA_ORIGIN } from "@/data/machines";

/*
 * Telas que ainda não estão ligadas ao banco. Com dados reais, elas mostram
 * este aviso em vez de números inventados misturados aos de verdade. Na
 * demonstração, todas abrem normalmente.
 *
 * OPs e Feedbacks usam o contrato `workOrders` (D62), que só existe no
 * Supabase: no modo Apps Script continuam com o aviso.
 */
export const WAITING: Record<string, string> = {
  ops: "As OPs como cadastro próprio, com a conversa de cada uma, só existem no banco novo (Supabase).",
  feedbacks: "A conversa das OPs só existe no banco novo (Supabase). As observações dos apontamentos aparecem no Histórico.",
};

export const isConnected = (route: string, kind?: string) => DATA_ORIGIN === "demo" || kind !== "gas" || !(route in WAITING);
