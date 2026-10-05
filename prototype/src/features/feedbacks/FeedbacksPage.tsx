import { ArrowLeft, CheckCheck, Info, Lock, MessagesSquare, RefreshCw, Search, SendHorizontal } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SHIFT_META, machineById, type Accent, type OpMessage, type Shift, type WorkOrder } from "@/data/machines";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { cn, formatLongDate, plural, type Notify } from "@/lib/utils";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, ErrorMessage } from "@/components/ui/Feedback";
import { Spinner } from "@/components/ui/Spinner";
import { Lozenge } from "@/components/ui/Lozenge";
import { Avatar } from "@/components/ui/Misc";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { useOpActions } from "@/features/ops/OpActions";
import { OpActionButtons } from "@/features/ops/OpActionButtons";
import { OpProgress } from "@/features/ops/OpsPage";
import { formatWhen, lastActivity, opNumber, stageView, useOps } from "@/features/ops/OpsStore";

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});
const AVATAR_BY_SHIFT: Record<Shift, Accent> = {
  1: "blue",
  2: "teal",
  3: "magenta",
};
/** Respostas rápidas: o gestor responde do celular, no meio da fábrica */
const QUICK_REPLIES = ["Ciente, obrigado.", "Já acionei a manutenção.", "Pode seguir.", "Separa o lote para a qualidade."];

type View = "open" | "unread" | "closed";

const shiftLabel = (m: OpMessage) => (m.shift ? ` · ${SHIFT_META[m.shift].label}` : "");
/** Papel de quem escreveu. Com o banco, quem escreve na conversa vem só com o nome (`member`) */
const roleLabel = (m: OpMessage) =>
  m.role === "manager"
    ? "Gestor"
    : m.role === "leader"
      ? `Líder${shiftLabel(m)}`
      : m.role === "setter"
        ? `Preparador${shiftLabel(m)}`
        : m.role === "operator"
          ? `Operador${shiftLabel(m)} · observação do apontamento`
          : "";

/**
 * Feedbacks = a conversa de cada OP. A observação do operador no apontamento
 * abre ou continua a conversa; líderes e gestor respondem; liberar, pausar e
 * concluir aparecem como mensagens do sistema. Concluída a OP, a conversa
 * se encerra (fica só para leitura).
 */
export function FeedbacksPage({ opParam, notify }: { opParam?: string; notify: Notify }) {
  const { ops, totalUnread, unreadIn, markRead, markAllRead, markUnread, status, error, retry } = useOps();
  const [view, setView] = useState<View>("open");
  const [query, setQuery] = useState("");
  const selectedId = opParam ? `OP ${opParam}` : null;
  const selected = selectedId ? ops.find((op) => op.id === selectedId) : undefined;

  const threads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ops
      .filter((op) => {
        const byView = view === "open" ? op.stage !== "done" : view === "closed" ? op.stage === "done" : unreadIn(op) > 0;
        const m = machineById(op.machineId);
        return (
          byView &&
          (!q ||
            op.id.toLowerCase().includes(q) ||
            op.material.includes(q) ||
            op.product.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => lastActivity(b).getTime() - lastActivity(a).getTime());
  }, [ops, view, query, unreadIn]);

  const open = (op: WorkOrder) => (window.location.hash = `/feedbacks/${opNumber(op.id)}`);

  return (
    <>
      <PageHeader
        title="Feedbacks"
        lozenge={
          totalUnread > 0 ? (
            <Lozenge appearance="discovery">{plural(totalUnread, "não lida", "não lidas")}</Lozenge>
          ) : (
            <Lozenge>Tudo lido</Lozenge>
          )
        }
        description="Conversas das OPs: observações que os operadores deixam no apontamento, respostas de preparadores, líderes e gestores, e cada mudança de etapa. A conversa se encerra quando a OP é concluída."
      />
      {/* Acesso: preparadores para cima. O operador participa pela observação do apontamento. */}
      <p className="flex items-center gap-075 px-200 pt-150 font-body-small text-subtle m:px-400">
        <Lock aria-hidden className="size-icon-small shrink-0" />
        Visível para preparadores, líderes e gestores.
      </p>
      <PageBody>
        {status === "error" && (
          <ErrorMessage
            title="Não foi possível carregar as conversas"
            actions={
              <Button iconBefore={RefreshCw} onClick={retry}>
                Tentar de novo
              </Button>
            }
          >
            {error}
          </ErrorMessage>
        )}
        <div className="flex h-chat overflow-hidden rounded-xlarge border bg-surface">
          {/* ---------- Caixa de entrada ---------- */}
          <aside
            aria-label="Conversas"
            className={cn("w-full shrink-0 flex-col border-r m:flex m:w-inbox", selected ? "hidden" : "flex")}
          >
            <div className="flex flex-col gap-100 border-b p-150">
              <div className="flex items-center justify-between gap-100">
                <SegmentedControl
                  label="Mostrar conversas"
                  iconOnly={false}
                  value={view}
                  onChange={(v) => setView(v as View)}
                  options={[
                    { value: "open", label: "Abertas" },
                    {
                      value: "unread",
                      label: `Não lidas${totalUnread ? ` (${totalUnread})` : ""}`,
                    },
                    { value: "closed", label: "Encerradas" },
                  ]}
                />
                {/* fica na lista (e não no rodapé fixo do mobile, que cobriria a resposta) */}
                <IconButton
                  icon={CheckCheck}
                  label="Marcar tudo como lido"
                  isDisabled={totalUnread === 0}
                  onClick={markAllRead}
                />
              </div>
              <TextField
                label="Buscar conversa"
                hideLabel
                placeholder="OP, material ou máquina"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                elemAfter={<Search aria-hidden className="size-icon-small" />}
              />
            </div>
            {status === "loading" ? (
              <div className="m-auto py-400">
                <Spinner label="Carregando as conversas" />
              </div>
            ) : threads.length === 0 ? (
              <EmptyState
                icon={view === "unread" ? CheckCheck : Search}
                title={view === "unread" ? "Nenhuma mensagem nova" : "Nenhuma conversa aqui"}
                hint={view === "unread" ? "Você está em dia com as OPs." : "Troque o filtro ou limpe a busca."}
                headingLevel={3}
              />
            ) : (
              <ul className="scrollbar-thin flex-1 overflow-y-auto">
                {threads.map((op) => (
                  <ThreadItem
                    key={op.id}
                    op={op}
                    unreadCount={unreadIn(op)}
                    isCurrent={op.id === selectedId}
                    onOpen={() => open(op)}
                  />
                ))}
              </ul>
            )}
          </aside>

          {/* ---------- Conversa ---------- */}
          <section aria-label="Conversa da OP" className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden m:flex")}>
            {selected ? (
              <Conversation
                key={selected.id}
                op={selected}
                notify={notify}
                onRead={() => markRead(selected.id)}
                onMarkUnread={
                  markUnread &&
                  (() => {
                    markUnread(selected.id);
                    window.location.hash = "/feedbacks";
                  })
                }
              />
            ) : status === "loading" ? (
              <div className="m-auto">
                <Spinner label="Carregando as conversas" />
              </div>
            ) : (
              <EmptyState
                icon={MessagesSquare}
                title={selectedId ? `${selectedId} não encontrada` : "Escolha uma conversa"}
                hint="Cada OP tem a sua conversa: o que aconteceu na máquina, quem respondeu e em que etapa ela está."
                headingLevel={2}
                className="m-auto"
              />
            )}
          </section>
        </div>
      </PageBody>
    </>
  );
}

function ThreadItem({
  op,
  unreadCount,
  isCurrent,
  onOpen,
}: {
  op: WorkOrder;
  unreadCount: number;
  isCurrent: boolean;
  onOpen: () => void;
}) {
  const { me } = useOps();
  const m = machineById(op.machineId);
  // Com o banco, a última mensagem só é conhecida depois de abrir a conversa
  const last = op.messages[op.messages.length - 1] as OpMessage | undefined;
  const stage = stageView(op);
  const who = !last || last.role === "system" ? "" : `${last.author === me ? "Você" : last.author.split(" ")[0]}: `;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={isCurrent || undefined}
        aria-label={`${op.id}, ${op.product}, ${stage.label}${unreadCount ? `, ${plural(unreadCount, "mensagem não lida", "mensagens não lidas")}` : ""}`}
        className={cn(
          "flex w-full flex-col gap-025 border-b px-200 py-150 text-left transition-colors duration-hover ease-out",
          isCurrent ? "bg-selected" : "hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed",
        )}
      >
        <span className="flex items-center gap-100">
          {unreadCount > 0 && <span aria-hidden className="size-dot shrink-0 rounded-full bg-icon-brand" />}
          <span className={cn("font-code text-default", unreadCount > 0 && "font-semibold")}>{opNumber(op.id)}</span>
          <Lozenge appearance={stage.appearance}>{stage.label}</Lozenge>
          <span className="ml-auto shrink-0 font-body-small text-subtlest">{formatWhen(lastActivity(op))}</span>
        </span>
        <span className="truncate font-body-small text-subtle">
          <span className="font-code">{op.material}</span> {op.product} · {m.name}
        </span>
        <span className={cn("flex items-center gap-100", unreadCount > 0 ? "font-semibold text-default" : "text-subtle")}>
          <span className="min-w-0 flex-1 truncate">
            {last ? (
              <>
                {who}
                {last.text}
              </>
            ) : unreadCount > 0 ? (
              "Mensagens novas"
            ) : (
              "Abra para ver a conversa"
            )}
          </span>
          {unreadCount > 0 && (
            <span className="flex h-250 min-w-250 shrink-0 items-center justify-center rounded-full bg-brand-bold px-075 font-body-small font-semibold text-inverse">
              {unreadCount}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Conversation({
  op,
  notify,
  onRead,
  onMarkUnread,
}: {
  op: WorkOrder;
  notify: Notify;
  onRead: () => void;
  /** null = a fonte não oferece */
  onMarkUnread: (() => void) | null;
}) {
  const { unread, send, me, loadConversation } = useOps();
  const { actionsFor, dialogs } = useOpActions(notify);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const m = machineById(op.machineId);
  const stage = stageView(op);
  const isClosed = op.stage === "done";

  const loaded = op.conversationLoaded !== false;
  const [sending, setSending] = useState(false);
  // Com o banco, a conversa carrega ao abrir
  useEffect(() => {
    loadConversation(op.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Linha "Novas mensagens" antes da primeira não lida, fixada quando a conversa chega; depois marca como lida
  const [firstUnread, setFirstUnread] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!loaded || firstUnread !== undefined) return;
    setFirstUnread(op.messages.find((msg) => unread.has(msg.id))?.id ?? null);
    onRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  // Rola até o fim ao abrir e a cada mensagem nova
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [op.messages.length]);

  const submit = async (text = draft) => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await send(op.id, t);
      setDraft("");
    } catch (e) {
      notify("Não foi possível enviar", mensagemDeErro(e), "error");
    }
    setSending(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  let lastDay = "";
  return (
    <>
      <header className="flex flex-col gap-150 border-b px-200 py-150">
        <div className="flex items-start gap-100">
          <IconButton
            icon={ArrowLeft}
            label="Voltar para as conversas"
            className="-ml-050 m:hidden"
            onClick={() => (window.location.hash = "/feedbacks")}
          />
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-100 font-heading-small text-default">
              <span className="font-code">{op.id}</span>
              <Lozenge appearance={stage.appearance}>{stage.label}</Lozenge>
            </h2>
            <p className="truncate text-subtle">
              {op.material ? (
                <>
                  Material <span className="font-code">{op.material}</span> · {op.product} · {m.name}
                </>
              ) : (
                <>Material a conferir · {m.name}</>
              )}
            </p>
          </div>
          {onMarkUnread && (
            <Button appearance="subtle" spacing="compact" onClick={onMarkUnread} className="hidden s:inline-flex">
              Marcar como não lida
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-150">
          <OpProgress op={op} className="w-column-name grow s:grow-0" />
          {op.stage === "paused" && op.pauseReason && (
            <span className="font-body-small text-warning">Motivo: {op.pauseReason}</span>
          )}
          <span className="flex flex-wrap gap-100 s:ml-auto">
            <OpActionButtons actions={actionsFor(op)} compact />
          </span>
        </div>
      </header>

      <div
        ref={scroller}
        role="log"
        aria-label={`Mensagens da ${op.id}`}
        className="scrollbar-thin flex flex-1 flex-col gap-150 overflow-y-auto px-200 py-200"
      >
        {!loaded && (
          <div className="m-auto">
            <Spinner label="Carregando a conversa" />
          </div>
        )}
        {op.messages.map((msg) => {
          const dayLabel = formatLongDate(msg.at);
          const showDay = dayLabel !== lastDay;
          lastDay = dayLabel;
          return (
            <Fragment key={msg.id}>
              {showDay && (
                <p className="flex items-center gap-150 font-body-small text-subtlest first-letter:uppercase before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                  {dayLabel}
                </p>
              )}
              {msg.id === firstUnread && (
                <p className="flex items-center gap-150 font-body-small font-semibold text-brand before:h-px before:flex-1 before:bg-brand-bold after:h-px after:flex-1 after:bg-brand-bold">
                  Novas mensagens
                </p>
              )}
              <Message msg={msg} me={me} />
            </Fragment>
          );
        })}
      </div>

      {isClosed ? (
        <p className="flex items-center gap-100 border-t bg-surface-sunken px-200 py-150 text-subtle">
          <Lock aria-hidden className="size-icon-small shrink-0" />
          Conversa encerrada {op.closedAt ? `em ${formatWhen(op.closedAt)}` : ""} com a conclusão da OP. Fica guardada para
          consulta.
        </p>
      ) : (
        <form
          className="flex flex-col gap-100 border-t px-200 py-150"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="scrollbar-thin -mx-200 flex gap-075 overflow-x-auto px-200" role="group" aria-label="Respostas rápidas">
            {QUICK_REPLIES.map((r) => (
              <Button key={r} appearance="default" spacing="compact" onClick={() => void submit(r)} className="shrink-0" isDisabled={sending}>
                {r}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-100">
            <label htmlFor="chat-draft" className="sr-only">
              Mensagem para a {op.id}
            </label>
            <textarea
              id="chat-draft"
              rows={2}
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Responder na ${op.id}…`}
              className="min-h-600 w-full min-w-0 flex-1 resize-none rounded-medium border border-input bg-input px-100 py-075 text-default placeholder:text-subtlest hover:bg-input-hovered focus:border-focused"
            />
            <Button appearance="primary" iconBefore={SendHorizontal} type="submit" isDisabled={!draft.trim()} isLoading={sending}>
              Enviar
            </Button>
          </div>
          <p className="hidden font-body-small text-subtlest s:block">Enter envia · Shift + Enter quebra a linha</p>
        </form>
      )}
      {dialogs}
    </>
  );
}

function Message({ msg, me }: { msg: OpMessage; me: string }) {
  if (msg.role === "system")
    return (
      <p className="mx-auto flex max-w-bubble items-center gap-075 rounded-full bg-neutral px-150 py-050 text-center font-body-small text-subtle">
        <Info aria-hidden className="size-icon-small shrink-0" />
        <span>
          {msg.text} <span className="text-subtlest">· {time.format(msg.at)}</span>
        </span>
      </p>
    );

  const mine = msg.author === me;
  const accent: Accent = msg.role === "manager" ? "purple" : AVATAR_BY_SHIFT[msg.shift ?? 1];
  return (
    <article
      aria-label={`${mine ? "Você" : msg.author}, ${time.format(msg.at)}`}
      className={cn("flex max-w-bubble gap-100", mine && "ml-auto flex-row-reverse")}
    >
      {!mine && <Avatar name={msg.author} size="medium" accent={accent} />}
      <div className={cn("flex min-w-0 flex-col gap-025", mine && "items-end")}>
        <p className="flex flex-wrap items-center gap-x-100 font-body-small">
          <span className="font-semibold text-default">{mine ? "Você" : msg.author}</span>
          {!mine && roleLabel(msg) && <span className="text-subtle">{roleLabel(msg)}</span>}
          <span className="text-subtlest">{time.format(msg.at)}</span>
          {msg.rework && <Lozenge appearance="warning">Retrabalho</Lozenge>}
        </p>
        <p
          className={cn(
            "rounded-large px-150 py-100 text-default",
            mine ? "rounded-tr-small bg-brand-subtlest" : "rounded-tl-small bg-neutral",
          )}
        >
          {msg.text}
        </p>
      </div>
    </article>
  );
}
