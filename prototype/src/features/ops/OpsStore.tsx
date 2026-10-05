import { createContext, useContext } from "react";
import {
  NOW,
  OP_STAGE_META,
  isReadyToClose,
  type OpStage,
  type WorkOrder,
} from "@/data/machines";

/*
 * Estado das OPs compartilhado pelas abas OPs e Feedbacks (e pelo contador
 * do menu). Cada OP tem uma conversa; mudanças de etapa viram mensagens de
 * sistema, e a conversa se encerra quando a OP é concluída.
 */

export interface NewOp {
  number: string;
  machineId: string;
  material: string;
  product: string;
  planned: number;
}

/** Conferir uma OP "a conferir": os dados que faltavam */
export type ReviewOp = Omit<NewOp, "number">;

export interface OpsState {
  /** Com o banco: lê e grava pelo contrato `workOrders` (D62). Sem "Desfazer": o banco só aceita as passagens da tela */
  live: boolean;
  status: "loading" | "ready" | "error";
  error: string | null;
  retry: () => void;
  /** Cadastrar, conferir e mudar a etapa (work_orders.manage, com o banco) */
  canManage: boolean;
  /** Nome de quem está vendo, para "Você" na conversa */
  me: string;
  ops: WorkOrder[];
  opById: (id: string) => WorkOrder | undefined;
  /** ids das mensagens não lidas conhecidas (com o banco, só das conversas abertas) */
  unread: Set<string>;
  totalUnread: number;
  unreadIn: (op: WorkOrder) => number;
  markRead: (opId: string) => void;
  markAllRead: () => void;
  /** null = a fonte não oferece (o banco não tem "marcar como não lida") */
  markUnread: ((opId: string) => void) | null;
  /** Com o banco, a conversa carrega ao abrir a OP */
  loadConversation: (opId: string) => void;
  /** As que gravam devolvem promessa: o erro sobe para quem chamou mostrar */
  send: (opId: string, text: string) => Promise<void>;
  /** muda a etapa; `reason` obrigatório para pausar */
  setStage: (opId: string, stage: Exclude<OpStage, "pending_review">, reason?: string) => Promise<void>;
  create: (op: NewOp) => Promise<string>;
  review: (opId: string, data: ReviewOp) => Promise<void>;
}

// Exportado para o OpsProvider, que vive em OpsProvider.tsx: um arquivo que
// exporta componente E hook perde o recarregamento a quente (react-refresh).
export const Ctx = createContext<OpsState | null>(null);

export function useOps() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOps fora do OpsProvider");
  return ctx;
}

/** Etapa exibida: "Pronta para concluir" é uma OP em produção que já atingiu a quantidade */
export function stageView(op: WorkOrder) {
  if (isReadyToClose(op)) return { label: "Pronta para concluir", appearance: "discovery" as const, key: "ready" as const };
  return { ...OP_STAGE_META[op.stage], key: op.stage };
}

/** Última atividade da conversa (para ordenar a caixa de entrada) */
export function lastActivity(op: WorkOrder) {
  const last = op.messages[op.messages.length - 1]?.at ?? op.releasedAt;
  return op.lastActivityAt && op.lastActivityAt > last ? op.lastActivityAt : last;
}

/** Número sem o prefixo, para URLs e colunas estreitas */
export const opNumber = (id: string) => id.replace("OP ", "");

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "hoje, 14:22" · "ontem, 09:10" · "25 mar, 16:40" (relativo ao "agora" do protótipo) */
export function formatWhen(d: Date) {
  const yesterday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 1);
  const prefix = sameDay(d, NOW) || d > NOW ? "hoje" : sameDay(d, yesterday) ? "ontem" : day.format(d).replace(".", "");
  return `${prefix}, ${time.format(d)}`;
}
