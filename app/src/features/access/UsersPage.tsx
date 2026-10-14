import { Ban, Check, KeyRound, RefreshCw, Search, UserCheck, UserRoundCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminUser, RoleOption } from "../../../../src/lib/repositories/types";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { cn, plural, type Notify } from "@/lib/utils";
import { DataTable, type Column, type TableState } from "@/components/data/DataTable";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorMessage, Skeleton } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { useAccess } from "./AccessContext";
import { PermissionsDialog } from "./PermissionsDialog";

/*
 * Usuários (gestão, exige users.approve): aprovar cadastro escolhendo o
 * perfil-modelo, ajustar permissão a permissão (PermissionsDialog), bloquear e
 * desbloquear. O perfil é só o ponto de partida (D22).
 */

const STATUS: Record<string, { label: string; appearance: "success" | "danger" | "warning" }> = {
  ativo: { label: "Ativo", appearance: "success" },
  bloqueado: { label: "Bloqueado", appearance: "danger" },
  pendente: { label: "Aguardando aprovação", appearance: "warning" },
};
const ACCOUNT: Record<string, string> = { personal: "Pessoal", shared: "Compartilhada", display: "Tela de TV" };

type Filter = "all" | "ativo" | "bloqueado";

export function UsersPage({ notify }: { notify: Notify }) {
  const { client, session } = useAccess();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [approving, setApproving] = useState<{ user: AdminUser; roleId: number | null } | null>(null);
  const [blocking, setBlocking] = useState<AdminUser | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [u, r] = await Promise.all([client.users.listUsers(session), client.users.listRoles(session)]);
      setUsers(u.users ?? []);
      setRoles(r);
    } catch (e) {
      setLoadError(mensagemDeErro(e, "Não foi possível carregar os usuários."));
    }
  }, [client, session]);
  useEffect(() => {
    load();
  }, [load]);

  const pending = (users ?? []).filter((u) => u.status === "pendente");
  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (users ?? [])
        .filter((u) => u.status !== "pendente")
        .filter((u) => filter === "all" || u.status === filter)
        .filter((u) => !q || u.nome.toLowerCase().includes(q) || (u.badgeNumber ?? "").includes(q))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [users, filter, q],
  );

  const approve = async () => {
    if (!approving?.user.id || approving.roleId == null) return;
    setBusy(true);
    try {
      await client.users.approveUser(approving.user.id, approving.roleId, session);
      const role = roles.find((r) => r.id === approving.roleId)?.name;
      notify("Cadastro aprovado", `${approving.user.nome} já pode entrar · perfil ${role}`);
      setApproving(null);
      await load();
    } catch (e) {
      notify("Não foi possível aprovar", mensagemDeErro(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u: AdminUser) => {
    setBusy(true);
    try {
      const { newStatus } = await client.users.toggleUser(u, session);
      notify(newStatus === "bloqueado" ? "Usuário bloqueado" : "Usuário desbloqueado", u.nome);
      setBlocking(null);
      await load();
    } catch (e) {
      notify("Não foi possível alterar o usuário", mensagemDeErro(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      id: "name",
      header: "Nome",
      className: "min-w-column-name",
      cell: (u) => (
        <span className="font-medium text-default">
          {u.nome}
          {u.id && u.id === session?.userId && <span className="font-normal text-subtlest"> · você</span>}
        </span>
      ),
    },
    { id: "badge", header: "Crachá", cell: (u) => <span className="font-code text-subtle">{u.badgeNumber ?? "–"}</span> },
    { id: "role", header: "Perfil", cell: (u) => <span className="text-subtle">{u.roleName ?? (u.role === "admin" ? "Administrador" : "–")}</span> },
    { id: "account", header: "Conta", cell: (u) => <span className="text-subtle">{ACCOUNT[u.accountType ?? "personal"] ?? u.accountType}</span> },
    {
      id: "status",
      header: "Situação",
      cell: (u) => <Lozenge appearance={STATUS[u.status]?.appearance ?? "neutral"}>{STATUS[u.status]?.label ?? u.status}</Lozenge>,
    },
    {
      id: "actions",
      header: "",
      srHeader: "Ações",
      align: "end",
      className: "pr-150",
      cell: (u) => (
        <span className="flex justify-end gap-050">
          {u.id && (
            <Button appearance="subtle" spacing="compact" iconBefore={KeyRound} onClick={() => setEditing(u)}>
              Permissões
            </Button>
          )}
          {/* Ninguém se bloqueia sem querer */}
          {u.id === session?.userId ? null : u.status === "bloqueado" ? (
            <Button appearance="subtle" spacing="compact" iconBefore={UserCheck} onClick={() => toggle(u)}>
              Desbloquear
            </Button>
          ) : (
            <Button appearance="subtle" spacing="compact" iconBefore={Ban} onClick={() => setBlocking(u)}>
              Bloquear
            </Button>
          )}
        </span>
      ),
    },
  ];

  const state: TableState = loadError ? "error" : users === null ? "loading" : rows.length ? "ready" : "empty";

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Aprove os cadastros novos, ajuste as permissões de cada pessoa e bloqueie quem não deve mais entrar. O perfil escolhido na aprovação é o ponto de partida."
        actions={
          <Button iconBefore={RefreshCw} onClick={load}>
            Atualizar
          </Button>
        }
      />
      <PageBody>
        {/* ---------- Pendentes: o que o gestor tem para fazer ---------- */}
        <section aria-labelledby="pending-title" className="flex flex-col gap-150">
          <h2 id="pending-title" className="flex items-center gap-100 font-heading-small text-default">
            Aguardando aprovação
            {pending.length > 0 && <Lozenge appearance="warning">{pending.length}</Lozenge>}
          </h2>
          {users === null && !loadError ? (
            <Skeleton className="h-800 w-full rounded-large" />
          ) : pending.length === 0 ? (
            <p className="rounded-large bg-surface-sunken px-200 py-150 text-subtle">Nenhum cadastro aguardando. Os novos pedidos aparecem aqui.</p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-large border">
              {pending.map((u) => (
                <li key={u.id ?? u.nome} className="flex flex-wrap items-center gap-150 border-b bg-surface px-200 py-150 last:border-b-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium text-default">{u.nome}</span>
                    <span className="font-body-small text-subtlest">Crachá {u.badgeNumber ?? "não informado"}</span>
                  </span>
                  <Button appearance="primary" spacing="compact" iconBefore={UserRoundCheck} onClick={() => setApproving({ user: u, roleId: null })}>
                    Aprovar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Todos ---------- */}
        <section aria-labelledby="all-title" className="flex flex-col gap-150">
          <div className="flex flex-wrap items-center justify-between gap-150">
            <h2 id="all-title" className="font-heading-small text-default">
              Usuários com acesso
            </h2>
            <div className="flex flex-wrap items-center gap-100">
              <TextField
                label="Buscar usuário"
                hideLabel
                placeholder="Nome ou crachá"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                elemAfter={<Search aria-hidden className="size-icon-small text-icon-subtle" />}
                className="w-column-name"
              />
              <SegmentedControl
                label="Filtrar por situação"
                iconOnly={false}
                value={filter}
                onChange={(v) => setFilter(v as Filter)}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "ativo", label: "Ativos" },
                  { value: "bloqueado", label: "Bloqueados" },
                ]}
              />
            </div>
          </div>
          <DataTable
            caption="Usuários com acesso"
            columns={columns}
            rows={rows}
            getRowId={(u) => u.id ?? u.nome}
            getRowLabel={(u) => `${u.nome}, ${STATUS[u.status]?.label ?? u.status}`}
            selectable={false}
            state={state}
            footerLead={plural(rows.length, "usuário", "usuários")}
            emptyState={<EmptyState icon={Users} title="Ninguém por aqui" hint="Nenhum usuário com esse filtro ou busca." />}
            errorState={
              <ErrorMessage
                title="Não foi possível carregar os usuários"
                actions={
                  <Button iconBefore={RefreshCw} onClick={load}>
                    Tentar de novo
                  </Button>
                }
              >
                {loadError}
              </ErrorMessage>
            }
          />
        </section>
      </PageBody>

      {/* ---------- Aprovar: escolher o perfil-modelo ---------- */}
      <Modal
        open={!!approving}
        onOpenChange={(o) => !o && setApproving(null)}
        title={approving ? `Aprovar ${approving.user.nome}` : ""}
        primary={{ label: "Aprovar", onClick: approve, isLoading: busy, isDisabled: approving?.roleId == null }}
      >
        {approving && (
          <div className="flex flex-col gap-150">
            <p className="text-subtle">
              Escolha o perfil. As permissões dele são copiadas para a conta e, depois, podem ser ajustadas uma a uma em “Permissões”.
            </p>
            <div role="radiogroup" aria-label="Perfil" className="flex flex-col gap-050">
              {roles.map((r) => {
                const on = approving.roleId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setApproving({ ...approving, roleId: r.id })}
                    className={cn(
                      "ds-pressable flex items-center justify-between gap-100 rounded-medium border px-150 py-100 text-left",
                      on ? "border-selected bg-selected text-selected" : "text-default hover:bg-neutral-subtle-hovered",
                    )}
                  >
                    {r.name}
                    {on && <Check aria-hidden className="size-icon-small" />}
                  </button>
                );
              })}
            </div>
            {approving.roleId == null && <p className="font-body-small text-subtlest">Escolha um perfil para aprovar.</p>}
          </div>
        )}
      </Modal>

      <PermissionsDialog user={editing} onClose={() => setEditing(null)} notify={notify} />

      <Modal
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        title={blocking ? `Bloquear ${blocking.nome}?` : ""}
        primary={{ label: "Bloquear", appearance: "danger", onClick: () => blocking && toggle(blocking), isLoading: busy }}
      >
        A pessoa não consegue mais entrar, e uma sessão aberta deixa de valer. O histórico de apontamentos continua. Dá para desbloquear depois.
      </Modal>
    </>
  );
}
