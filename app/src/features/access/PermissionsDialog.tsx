import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminUser, PermissionOption, UserPermission } from "../../../../src/lib/repositories/types";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { cn, plural, type Notify } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorMessage, Skeleton } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { useAccess } from "./AccessContext";
import { PERMISSION_GROUPS, STRONG_PERMISSIONS } from "./permissions";

/*
 * Permissão a permissão de uma conta (D22). O perfil escolhido na aprovação é
 * só o ponto de partida; daqui o gestor marca e desmarca.
 *
 * Decisão do gestor (01/10/2026): nenhuma permissão é proibida de conceder —
 * inclusive as fortes —, e em troca o sistema guarda quem concedeu o quê. Por
 * isso a tela mostra o rastro de cada uma e não esconde as fortes.
 *
 * `setPermissions` recebe a lista COMPLETA; o adaptador grava só o que mudou,
 * para não carimbar o rastro das que ficaram com a data de hoje.
 */

const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const when = (iso: string) => (iso ? date.format(new Date(iso)) : "");

export function PermissionsDialog({ user, onClose, notify }: { user: AdminUser | null; onClose: () => void; notify: Notify }) {
  const { client, session } = useAccess();
  const [catalog, setCatalog] = useState<PermissionOption[] | null>(null);
  const [grants, setGrants] = useState<UserPermission[] | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    setGrants(null);
    try {
      const [c, g] = await Promise.all([client.users.listPermissions(session), client.users.getPermissions(user.id, session)]);
      setCatalog(c);
      setGrants(g);
      setDraft(new Set(g.map((x) => x.code)));
    } catch (e) {
      setError(mensagemDeErro(e, "Não foi possível carregar as permissões."));
    }
  }, [client, session, user?.id]);
  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => new Set((grants ?? []).map((g) => g.code)), [grants]);
  const added = [...draft].filter((c) => !current.has(c));
  const removed = [...current].filter((c) => !draft.has(c));
  const changes = added.length + removed.length;
  const isSelf = !!user?.id && user.id === session?.userId;
  // Tirar de si mesmo o que dá acesso a esta tela tranca a porta por dentro
  const locksSelfOut = isSelf && !draft.has("users.approve") && !draft.has("system.admin");

  // Grupos da tela; o que o catálogo trouxer e não estiver neles cai em "Outras"
  const groups = useMemo(() => {
    if (!catalog) return [];
    const byCode = new Map(catalog.map((p) => [p.code, p]));
    const known = new Set(PERMISSION_GROUPS.flatMap((g) => g.codes as string[]));
    return [
      ...PERMISSION_GROUPS.map((g) => ({ title: g.title, items: g.codes.map((c) => byCode.get(c)).filter((p): p is PermissionOption => !!p) })),
      { title: "Outras", items: catalog.filter((p) => !known.has(p.code)) },
    ].filter((g) => g.items.length > 0);
  }, [catalog]);

  const toggle = (code: string) =>
    setDraft((d) => {
      const next = new Set(d);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const save = async () => {
    if (!user?.id || !changes) return;
    setSaving(true);
    try {
      await client.users.setPermissions(user.id, [...draft].sort(), session);
      notify(
        `Permissões de ${user.nome} salvas`,
        [added.length && plural(added.length, "concedida", "concedidas"), removed.length && plural(removed.length, "retirada", "retiradas")]
          .filter(Boolean)
          .join(" · ") + ". Valem a partir da próxima entrada da pessoa.",
      );
      onClose();
    } catch (e) {
      notify("Não foi possível salvar as permissões", mensagemDeErro(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const trail = (code: string) => {
    if (added.includes(code)) return { text: "Nova: fica registrada em seu nome", tone: "text-discovery" };
    if (removed.includes(code)) return { text: "Será retirada", tone: "text-danger" };
    const g = grants?.find((x) => x.code === code);
    if (!g) return null;
    return {
      text: g.grantedBy ? `Concedida por ${g.grantedBy}${g.grantedAt ? ` em ${when(g.grantedAt)}` : ""}` : "Sem autor registrado (veio do cadastro inicial)",
      tone: "text-subtlest",
    };
  };

  return (
    <Modal
      open={!!user}
      onOpenChange={(o) => !o && onClose()}
      title={user ? `Permissões de ${user.nome}` : ""}
      primary={{
        label: changes ? `Salvar ${plural(changes, "alteração", "alterações")}` : "Salvar",
        onClick: save,
        isLoading: saving,
        isDisabled: !changes || !grants,
      }}
    >
      <div className="flex flex-col gap-200">
        <p className="text-subtle">
          {user?.roleName ? (
            <>
              Perfil <strong className="font-semibold text-default">{user.roleName}</strong>: é o ponto de partida.{" "}
            </>
          ) : null}
          Marque e desmarque permissão a permissão. Cada concessão fica registrada com quem concedeu e quando, e a pessoa passa a ver as mudanças na
          próxima vez que entrar.
        </p>

        {error ? (
          <ErrorMessage
            title="Não foi possível carregar as permissões"
            actions={
              <Button iconBefore={RefreshCw} onClick={load}>
                Tentar de novo
              </Button>
            }
          >
            {error}
          </ErrorMessage>
        ) : !grants || !catalog ? (
          <div className="flex flex-col gap-100">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-500 w-full rounded-medium" />
            ))}
          </div>
        ) : (
          groups.map((g) => (
            <fieldset key={g.title} className="flex flex-col gap-025">
              <legend className="pb-050 font-heading-xsmall text-default">{g.title}</legend>
              {g.items.map((p) => {
                const t = trail(p.code);
                const strong = STRONG_PERMISSIONS.has(p.code);
                return (
                  <label
                    key={p.code}
                    className={cn(
                      "flex cursor-pointer items-start gap-100 rounded-medium px-100 py-075 hover:bg-neutral-subtle-hovered",
                      draft.has(p.code) && "bg-neutral",
                    )}
                  >
                    <span className="pt-025">
                      <Checkbox label={p.description} checked={draft.has(p.code)} onChange={() => toggle(p.code)} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span aria-hidden className="flex flex-wrap items-center gap-075 text-default">
                        {p.description}
                        {strong && (
                          <span title="Pode ser concedida; fica registrado quem concedeu.">
                            <Lozenge appearance="warning">forte</Lozenge>
                          </span>
                        )}
                      </span>
                      <span className="font-code font-body-small text-subtlest">{p.code}</span>
                      {t && <span className={cn("font-body-small", t.tone)}>{t.text}</span>}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))
        )}

        {locksSelfOut && (
          <ErrorMessage title="Você vai perder o acesso a esta tela">
            Sem “Aprovar usuários e ajustar permissões”, você não consegue mais ver nem desfazer isto. Só outro gestor poderá devolver.
          </ErrorMessage>
        )}
      </div>
    </Modal>
  );
}
