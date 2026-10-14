import { CircleCheck, ClipboardCheck, Pause, Play, Send } from "lucide-react";
import { useState, type ReactNode } from "react";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { isReadyToClose, type OpStage, type WorkOrder } from "@/data/machines";
import { formatNumber, type Notify } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextField";
import { OpFields } from "./OpForm";
import { emptyDraft, opErrors, type OpDraft } from "./opDraft";
import { useOps } from "./OpsStore";

const PAUSE_OPTIONS = ["Falta de material", "Máquina em manutenção", "Aguardando liberação da qualidade", "Outro motivo"];

export interface OpAction {
  id: "review" | "release" | "pause" | "resume" | "close";
  label: string;
  icon: typeof Play;
  /** a ação que o sistema sugere agora (vira o botão principal) */
  isPrimary: boolean;
  run: () => void;
}

/**
 * Ações de etapa de uma OP, usadas na tabela de OPs e no cabeçalho da conversa.
 * Pausar pede o motivo (vira mensagem na conversa); concluir abaixo da
 * quantidade pede confirmação; conferir (OP "a conferir") pede material e
 * quantidade. Na demonstração há "Desfazer"; com o banco, não: ele só aceita as
 * passagens da tela (D62), e o erro dele aparece.
 */
export function useOpActions(notify: Notify) {
  const { setStage, review, live, canManage, ops } = useOps();
  const [pausing, setPausing] = useState<WorkOrder | null>(null);
  const [reason, setReason] = useState(PAUSE_OPTIONS[0]);
  const [other, setOther] = useState("");
  const [closing, setClosing] = useState<WorkOrder | null>(null);
  const [reviewing, setReviewing] = useState<{ op: WorkOrder; draft: OpDraft; tried: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Grava a etapa; avisa o resultado. Devolve se deu certo */
  const go = async (op: WorkOrder, stage: Exclude<OpStage, "pending_review">, title: string, description?: string, why?: string) => {
    setBusy(true);
    try {
      await setStage(op.id, stage, why);
    } catch (e) {
      setBusy(false);
      notify(`Não foi possível mudar a ${op.id}`, mensagemDeErro(e), "error");
      return false;
    }
    setBusy(false);
    const undo =
      live || op.stage === "pending_review"
        ? undefined
        : {
            label: "Desfazer",
            onClick: () => void setStage(op.id, op.stage as Exclude<OpStage, "pending_review">, op.pauseReason ?? undefined),
          };
    notify(title, description, "success", undo);
    return true;
  };

  const close = (op: WorkOrder) => go(op, "done", `${op.id} concluída`, "A conversa da OP foi encerrada.");

  const actionsFor = (op: WorkOrder): OpAction[] => {
    if (!canManage) return [];
    switch (op.stage) {
      case "pending_review":
        return [
          {
            id: "review",
            label: "Conferir",
            icon: ClipboardCheck,
            isPrimary: true,
            run: () => setReviewing({ op, draft: emptyDraft(op), tried: false }),
          },
        ];
      case "waiting":
        return [
          {
            id: "release",
            label: "Liberar para produção",
            icon: Send,
            isPrimary: true,
            run: () => void go(op, "running", `${op.id} liberada`, "A OP já aparece para apontamento na máquina."),
          },
        ];
      case "running":
        return [
          {
            id: "close",
            label: "Concluir OP",
            icon: CircleCheck,
            isPrimary: isReadyToClose(op),
            run: () => (isReadyToClose(op) ? void close(op) : setClosing(op)),
          },
          {
            id: "pause",
            label: "Pausar",
            icon: Pause,
            isPrimary: false,
            run: () => {
              setReason(PAUSE_OPTIONS[0]);
              setOther("");
              setPausing(op);
            },
          },
        ];
      case "paused":
        return [
          { id: "resume", label: "Retomar produção", icon: Play, isPrimary: true, run: () => void go(op, "running", `${op.id} retomada`) },
          { id: "close", label: "Concluir OP", icon: CircleCheck, isPrimary: false, run: () => setClosing(op) },
        ];
      case "done":
        return [];
    }
  };

  const finalReason = reason === "Outro motivo" ? other.trim() : reason;
  const reviewErrors = reviewing ? opErrors(reviewing.draft, ops, false) : null;

  const dialogs: ReactNode = (
    <>
      <Modal
        open={!!pausing}
        onOpenChange={(o) => !o && !busy && setPausing(null)}
        title={pausing ? `Pausar ${pausing.id}?` : ""}
        primary={{
          label: "Pausar OP",
          isLoading: busy,
          onClick: async () => {
            if (!pausing || !finalReason) return;
            if (await go(pausing, "paused", `${pausing.id} pausada`, finalReason, finalReason)) setPausing(null);
          },
        }}
      >
        <fieldset className="flex flex-col gap-100">
          <legend className="pb-100 text-subtle">O motivo vai para a conversa da OP, para todos os turnos verem.</legend>
          {PAUSE_OPTIONS.map((o) => (
            <label key={o} className="flex min-h-control items-center gap-100 text-default">
              <input
                type="radio"
                name="pause-reason"
                value={o}
                checked={reason === o}
                onChange={() => setReason(o)}
                className="size-checkbox [accent-color:var(--ds-background-brand-bold)]"
              />
              {o}
            </label>
          ))}
        </fieldset>
        {reason === "Outro motivo" && (
          <TextArea
            label="Motivo"
            className="mt-150"
            autoFocus
            maxLength={200}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            error={other.trim() ? null : "Descreva o motivo da pausa"}
          />
        )}
      </Modal>

      <Modal
        open={!!closing}
        onOpenChange={(o) => !o && !busy && setClosing(null)}
        title={closing ? `Concluir ${closing.id}?` : ""}
        primary={{
          label: "Concluir mesmo assim",
          isLoading: busy,
          onClick: async () => {
            if (closing && (await close(closing))) setClosing(null);
          },
        }}
      >
        {closing && (
          <p className="text-default">
            {closing.planned > 0 ? (
              <>
                A OP tem <strong className="tabular-nums">{formatNumber(closing.produced)}</strong> de{" "}
                <strong className="tabular-nums">{formatNumber(closing.planned)}</strong> peças apontadas (
                {Math.round((closing.produced / closing.planned) * 100)}%).
              </>
            ) : (
              <>
                A OP tem <strong className="tabular-nums">{formatNumber(closing.produced)}</strong> peças apontadas.
              </>
            )}{" "}
            Ao concluir, a conversa é encerrada e a OP sai da lista de apontamento.
          </p>
        )}
      </Modal>

      <Modal
        open={!!reviewing}
        onOpenChange={(o) => !o && !busy && setReviewing(null)}
        title={reviewing ? `Conferir ${reviewing.op.id}` : ""}
        primary={{
          label: "Conferir",
          isLoading: busy,
          isDisabled: !!reviewing?.tried && !!reviewErrors?.any,
          onClick: async () => {
            if (!reviewing) return;
            setReviewing({ ...reviewing, tried: true });
            if (reviewErrors?.any) return;
            const { op, draft } = reviewing;
            setBusy(true);
            try {
              await review(op.id, {
                machineId: draft.machineId,
                material: draft.material,
                product: draft.product.trim(),
                planned: Number(draft.planned),
              });
            } catch (e) {
              setBusy(false);
              notify(`Não foi possível conferir a ${op.id}`, mensagemDeErro(e), "error");
              return;
            }
            setBusy(false);
            setReviewing(null);
            notify(`${op.id} conferida`, "Ela aguarda liberação para a produção.");
          },
        }}
      >
        {reviewing && (
          <div className="flex flex-col gap-200">
            <p className="text-subtle">
              Esta OP nasceu de um apontamento com um número que ainda não estava cadastrado. Confira a máquina, o material e a quantidade
              pedida: ela passa a aguardar liberação.
            </p>
            <OpFields
              draft={reviewing.draft}
              onChange={(draft) => setReviewing({ ...reviewing, draft })}
              errors={reviewing.tried ? reviewErrors : null}
              withNumber={false}
            />
          </div>
        )}
      </Modal>
    </>
  );

  return { actionsFor, dialogs };
}
