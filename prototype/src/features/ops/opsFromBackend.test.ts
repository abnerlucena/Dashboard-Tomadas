import { describe, expect, it } from "vitest";
import type { WorkOrderRecord } from "../../../../src/lib/repositories/types";
import { toMessages, toWorkOrder, unreadIds } from "./opsFromBackend";

const rec = (r: Partial<WorkOrderRecord> = {}): WorkOrderRecord => ({
  id: "uuid-1",
  orderNumber: "4501234",
  machineId: 12,
  materialCode: "12345678",
  materialDescription: "Tomada 10A",
  plannedQuantity: 20000,
  producedQuantity: 8000,
  reworkQuantity: 300,
  stage: "running",
  pauseReason: null,
  releasedAt: "2026-10-01T10:00:00Z",
  closedAt: null,
  source: "app",
  createdAt: "2026-09-30T08:00:00Z",
  lastEntryAt: "2026-10-03T14:00:00Z",
  unread: 2,
  ...r,
});

describe("toWorkOrder", () => {
  it("mantém o id da tela e guarda o uuid", () => {
    const op = toWorkOrder(rec());
    expect(op).toMatchObject({
      id: "OP 4501234",
      dbId: "uuid-1",
      machineId: "12",
      material: "12345678",
      planned: 20000,
      produced: 8000,
      unreadCount: 2,
    });
    expect(op.lastActivityAt?.toISOString()).toBe("2026-10-03T14:00:00.000Z");
  });

  it("OP a conferir, sem material nem quantidade", () => {
    const op = toWorkOrder(
      rec({
        stage: "pending_review",
        materialCode: null,
        materialDescription: null,
        plannedQuantity: null,
        releasedAt: null,
        source: "apontamento",
      }),
    );
    expect(op).toMatchObject({ stage: "pending_review", material: "", product: "", planned: 0 });
    expect(op.releasedAt.toISOString()).toBe("2026-09-30T08:00:00.000Z");
  });
});

describe("conversa", () => {
  const msgs = toMessages(
    [
      {
        id: "m1",
        workOrderId: "uuid-1",
        at: "2026-10-01T10:00:00Z",
        kind: "system",
        author: "",
        text: "OP liberada",
        shiftId: null,
        rework: false,
      },
      {
        id: "m2",
        workOrderId: "uuid-1",
        at: "2026-10-01T15:00:00Z",
        kind: "operator_note",
        author: "Ana",
        text: "Bobina",
        shiftId: 2,
        rework: true,
      },
      {
        id: "m3",
        workOrderId: "uuid-1",
        at: "2026-10-01T16:00:00Z",
        kind: "message",
        author: "Rafael",
        text: "Ciente",
        shiftId: null,
        rework: false,
      },
      {
        id: "m4",
        workOrderId: "uuid-1",
        at: "2026-10-01T17:00:00Z",
        kind: "message",
        author: "Gabriela",
        text: "Ok",
        shiftId: null,
        rework: false,
      },
    ],
    "OP 4501234",
  );

  it("traduz os tipos de mensagem", () => {
    expect(msgs.map((m) => m.role)).toEqual(["system", "operator", "member", "member"]);
    expect(msgs[1]).toMatchObject({ shift: 2, rework: true });
  });

  it("as não lidas são as últimas que não são minhas", () => {
    expect(unreadIds(msgs, 2, "Gabriela")).toEqual(["m2", "m3"]);
    expect(unreadIds(msgs, 0, "Gabriela")).toEqual([]);
  });
});
