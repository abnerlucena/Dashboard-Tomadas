import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { mensagemDeErro } from "../../../../src/lib/erros";
import {
  DATA_ORIGIN,
  INITIAL_UNREAD,
  MACHINES,
  MANAGER,
  NOW,
  OP_STAGE_META,
  WORK_ORDERS,
  machineById,
  type OpMessage,
  type WorkOrder,
} from "@/data/machines";
import { useAccess } from "@/features/access/AccessContext";
import { formatNumber } from "@/lib/utils";
import { toMessages, toWorkOrder, unreadIds } from "./opsFromBackend";
import { Ctx, type OpsState } from "./OpsStore";

let seq = 0;
/** Relógio do protótipo: minutos depois de "agora" (28/03, 7h), avançando a cada ação */
const tick = () => new Date(NOW.getTime() + ++seq * 60000);

const system = (opId: string, text: string): OpMessage => ({
  id: `${opId}-s${Date.now()}-${seq}`,
  opId,
  at: tick(),
  author: MANAGER,
  role: "system",
  text,
});

/**
 * Fonte das OPs para as abas OPs e Feedbacks e para o contador do menu.
 * Com o banco (fora do Apps Script), é o contrato `workOrders` (D62); na
 * demonstração, as OPs geradas em machines.ts, em memória.
 */
export function OpsProvider({ children }: { children: ReactNode }) {
  const { client } = useAccess();
  const live = DATA_ORIGIN === "backend" && !!client.reads && client.kind !== "gas";
  return live ? <BackendOps>{children}</BackendOps> : <DemoOps>{children}</DemoOps>;
}

/* ---------- Com o banco ---------- */

function BackendOps({ children }: { children: ReactNode }) {
  const { client, session, can } = useAccess();
  const reads = client.reads!;
  const me = session?.nome ?? "";
  const [ops, setOps] = useState<WorkOrder[]>([]);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<OpsState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  /** Lista nova do banco, mantendo as conversas já abertas */
  const reloadList = useCallback(async () => {
    const list = await reads.workOrders.list(session);
    // A tela precisa da máquina; centro fora da janela de dados (inativo, sem apontamento) não entra
    const known = new Set(MACHINES.map((m) => m.id));
    setOps((prev) =>
      list
        .map(toWorkOrder)
        .filter((op) => known.has(op.machineId))
        .map((op) => {
          const old = prev.find((p) => p.dbId === op.dbId);
          return old?.conversationLoaded ? { ...op, messages: old.messages, conversationLoaded: true } : op;
        }),
    );
    // A sessão muda de objeto a cada renovação de token; a leitura é a mesma
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reads]);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    reloadList()
      .then(() => alive && setStatus("ready"))
      .catch((e) => {
        if (!alive) return;
        setError(mensagemDeErro(e, "Não foi possível carregar as OPs."));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [reloadList, attempt]);

  const fetchConversation = useCallback(
    async (op: WorkOrder) => {
      const messages = toMessages(await reads.workOrders.conversation(op.dbId!, session), op.id);
      const fresh = unreadIds(messages, op.unreadCount ?? 0, me);
      if (fresh.length) setUnread((prev) => new Set([...prev, ...fresh]));
      setOps((list) => list.map((o) => (o.id === op.id ? { ...o, messages, conversationLoaded: true } : o)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reads, me],
  );

  const value = useMemo<OpsState>(() => {
    const opById = (id: string) => ops.find((op) => op.id === id);
    const need = (id: string) => {
      const op = opById(id);
      if (!op?.dbId) throw new Error("OP não encontrada.");
      return op;
    };
    /** Depois de gravar: a lista e, se aberta, a conversa */
    const after = async (op: WorkOrder) => {
      await reloadList();
      if (op.conversationLoaded) await fetchConversation(op);
    };
    const markRead = (opId: string) => {
      const op = opById(opId);
      if (!op?.dbId || !op.unreadCount) return;
      setOps((list) => list.map((o) => (o.id === opId ? { ...o, unreadCount: 0 } : o)));
      // Falhar ao marcar como lida não atrapalha ninguém: na próxima leitura volta a contagem
      reads.workOrders.markRead(op.dbId, session).catch(() => undefined);
    };
    return {
      live: true,
      status,
      error,
      retry: () => setAttempt((n) => n + 1),
      canManage: can("work_orders.manage"),
      me,
      ops,
      opById,
      unread,
      totalUnread: ops.reduce((n, op) => n + (op.unreadCount ?? 0), 0),
      unreadIn: (op) => op.unreadCount ?? 0,
      markRead,
      markAllRead: () => ops.filter((op) => op.unreadCount).forEach((op) => markRead(op.id)),
      markUnread: null,
      loadConversation: (opId) => {
        const op = opById(opId);
        if (op?.dbId && !op.conversationLoaded) fetchConversation(op).catch(() => undefined);
      },
      send: async (opId, text) => {
        const op = need(opId);
        await reads.workOrders.postMessage(op.dbId!, text, session);
        await after({ ...op, conversationLoaded: true });
      },
      setStage: async (opId, stage, reason) => {
        const op = need(opId);
        await reads.workOrders.setStage(op.dbId!, stage, reason, session);
        await after(op);
      },
      create: async ({ number, machineId, material, product, planned }) => {
        await reads.workOrders.create(
          {
            orderNumber: number,
            machineId: Number(machineId),
            ...(material ? { materialCode: material } : {}),
            ...(product ? { materialDescription: product } : {}),
            ...(planned ? { plannedQuantity: planned } : {}),
          },
          session,
        );
        await reloadList();
        return `OP ${number}`;
      },
      review: async (opId, { machineId, material, product, planned }) => {
        const op = need(opId);
        await reads.workOrders.update(
          op.dbId!,
          { machineId: Number(machineId), materialCode: material, materialDescription: product, plannedQuantity: planned },
          session,
        );
        await after(op);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops, unread, status, error, me, reloadList, fetchConversation, can]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------- Demonstração ---------- */

function DemoOps({ children }: { children: ReactNode }) {
  const [ops, setOps] = useState<WorkOrder[]>(WORK_ORDERS);
  const [unread, setUnread] = useState<Set<string>>(() => new Set(INITIAL_UNREAD));

  const update = useCallback((opId: string, fn: (op: WorkOrder) => WorkOrder) => {
    setOps((list) => list.map((op) => (op.id === opId ? fn(op) : op)));
  }, []);

  const value = useMemo<OpsState>(() => {
    const opById = (id: string) => ops.find((op) => op.id === id);
    return {
      live: false,
      status: "ready",
      error: null,
      retry: () => undefined,
      canManage: true,
      me: MANAGER,
      ops,
      opById,
      unread,
      totalUnread: unread.size,
      unreadIn: (op) => op.messages.reduce((n, m) => n + (unread.has(m.id) ? 1 : 0), 0),
      markRead: (opId) => {
        const op = opById(opId);
        if (!op || !op.messages.some((m) => unread.has(m.id))) return;
        setUnread((prev) => {
          const next = new Set(prev);
          op.messages.forEach((m) => next.delete(m.id));
          return next;
        });
      },
      markAllRead: () => setUnread(new Set()),
      markUnread: (opId) => {
        const op = opById(opId);
        const last = op && [...op.messages].reverse().find((m) => m.role !== "system" && m.author !== MANAGER);
        if (last) setUnread((prev) => new Set(prev).add(last.id));
      },
      loadConversation: () => undefined,
      send: async (opId, text) =>
        update(opId, (op) => ({
          ...op,
          messages: [...op.messages, { id: `${opId}-u${++seq}`, opId, at: tick(), author: MANAGER, role: "manager", text }],
        })),
      setStage: async (opId, stage, reason) =>
        update(opId, (op) => {
          const text =
            stage === "running"
              ? op.stage === "waiting"
                ? `OP liberada para produção por ${MANAGER}.`
                : `Produção retomada por ${MANAGER}.`
              : stage === "paused"
                ? `Pausada por ${MANAGER}: ${reason}.`
                : stage === "done"
                  ? `OP concluída por ${MANAGER} · ${formatNumber(op.produced)} de ${formatNumber(op.planned)} peças.`
                  : `OP voltou para ${OP_STAGE_META[stage].label.toLowerCase()}.`;
          const at = tick();
          return {
            ...op,
            stage,
            pauseReason: stage === "paused" ? (reason ?? null) : null,
            closedAt: stage === "done" ? at : null,
            messages: [...op.messages, { ...system(opId, text), at }],
          };
        }),
      create: async ({ number, machineId, material, product, planned }) => {
        const id = `OP ${number}`;
        const at = tick();
        setOps((list) => [
          {
            id,
            machineId,
            material,
            product,
            planned,
            produced: 0,
            stage: "waiting",
            releasedAt: at,
            closedAt: null,
            pauseReason: null,
            entryIds: [],
            messages: [
              {
                ...system(id, `OP cadastrada no sistema para ${machineById(machineId).name}. Aguardando liberação para a produção.`),
                at,
              },
            ],
          },
          ...list,
        ]);
        return id;
      },
      review: async (opId, { machineId, material, product, planned }) =>
        update(opId, (op) => ({
          ...op,
          machineId,
          material,
          product,
          planned,
          stage: "waiting",
          messages: [...op.messages, system(opId, `OP conferida por ${MANAGER}. Aguardando liberação para a produção.`)],
        })),
    };
  }, [ops, unread, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
