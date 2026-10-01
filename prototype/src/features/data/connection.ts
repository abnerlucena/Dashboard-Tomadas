import { DATA_ORIGIN } from "@/data/machines";

/*
 * Telas que ainda não estão ligadas ao banco. Com dados reais, elas mostram
 * este aviso em vez de números inventados misturados aos de verdade. Na
 * demonstração, todas abrem normalmente.
 */
export const WAITING: Record<string, string> = {
  apontamento: "Gravar apontamentos no banco é a próxima etapa da interface nova. Por enquanto, aponte pelo sistema atual.",
  metas: "As metas com vigência e base de cálculo entram na etapa seguinte. O atingimento já usa a meta gravada em cada apontamento.",
  ops: "O banco ainda não tem as OPs como cadastro próprio, nem a conversa de cada uma.",
  feedbacks:
    "A conversa das OPs depende do cadastro de OPs, que o banco ainda não tem. As observações dos apontamentos aparecem no Histórico.",
};

export const isConnected = (route: string) => DATA_ORIGIN === "demo" || !(route in WAITING);
