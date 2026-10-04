import type { Session } from "../../../../src/lib/api";

/*
 * Catálogo de permissões — é o que chega em `session.permissions` (modo Supabase).
 * Fonte: docs/database/notas/2026-09-27-area-de-acesso-na-ui-nova.md e a tabela
 * `permissions` do banco. Esconder na tela é conveniência: quem impede de verdade
 * é o banco (RLS).
 */
export type Permission =
  | "production.create"
  | "production.edit_own"
  | "production.edit"
  | "production.delete"
  | "production.bulk_edit"
  | "production.bulk_delete"
  | "work_orders.manage"
  | "history.view"
  | "feedbacks.view"
  | "reports.export"
  | "dashboard.view"
  | "targets.view"
  | "tv_mode.view"
  | "machines.manage"
  | "calendar.manage"
  | "alerts.manage"
  | "targets.manage"
  | "users.approve"
  | "import.review"
  | "import.manage"
  | "system.admin";

/**
 * Catálogo com o texto da tabela `permissions` do banco. Com o backend, a tela
 * usa `users.listPermissions()`; esta cópia serve à fonte de demonstração (o
 * mock da sessão do banco não entra em build — ele tem as senhas de mentira).
 */
export const PERMISSION_LABEL: Record<Permission, string> = {
  "production.create": "Apontar produção",
  "production.edit_own": "Corrigir os próprios apontamentos (até 24 h)",
  "production.edit": "Editar qualquer apontamento",
  "production.delete": "Apagar qualquer apontamento",
  "production.bulk_edit": "Editar vários apontamentos de uma vez",
  "production.bulk_delete": "Apagar vários apontamentos de uma vez",
  "work_orders.manage": "Cadastrar OPs e mudar a situação delas",
  "history.view": "Ver histórico de apontamentos",
  "feedbacks.view": "Ver e editar observações (feedbacks)",
  "reports.export": "Exportar relatórios (PDF/CSV)",
  "dashboard.view": "Ver o dashboard",
  "targets.view": "Ver metas",
  "tv_mode.view": "Usar o modo TV",
  "machines.manage": "Cadastrar e alterar máquinas",
  "calendar.manage": "Cadastrar feriados, eventos e dias anulados",
  "alerts.manage": "Configurar alertas",
  "targets.manage": "Alterar metas",
  "users.approve": "Aprovar usuários e ajustar permissões",
  "import.review": "Conferir a área de preparo da importação",
  "import.manage": "Criar, carregar e reverter lotes de importação",
  "system.admin": "Administração do sistema (auditoria, turnos)",
};

/** Grupos da tela de permissões (código fora daqui cai em "Outras") */
export const PERMISSION_GROUPS: Array<{ title: string; codes: Permission[] }> = [
  { title: "Apontamento", codes: ["production.create", "production.edit_own", "production.edit", "production.delete", "production.bulk_edit", "production.bulk_delete", "work_orders.manage"] },
  { title: "Consulta", codes: ["dashboard.view", "history.view", "feedbacks.view", "targets.view", "reports.export", "tv_mode.view"] },
  { title: "Gestão", codes: ["targets.manage", "machines.manage", "calendar.manage", "alerts.manage", "users.approve"] },
  { title: "Importação e sistema", codes: ["import.review", "import.manage", "system.admin"] },
];

/**
 * Permissões fortes: o gestor PODE concedê-las (decisão de 01/10/2026) e elas
 * não são escondidas — a tela só deixa claro que ficam registradas.
 */
export const STRONG_PERMISSIONS = new Set<string>(["system.admin", "users.approve", "targets.manage", "production.delete", "production.bulk_delete", "import.manage"]);

/**
 * Modo Apps Script (legado): a sessão não traz permissões, só `role`.
 * admin = tudo; user = o que o operador fazia no sistema da planilha.
 */
const LEGACY_USER: Permission[] = [
  "production.create",
  "production.edit_own",
  "history.view",
  "feedbacks.view",
  "dashboard.view",
  "targets.view",
  "tv_mode.view",
  "reports.export",
];

export function can(session: Session | null, permission: Permission): boolean {
  if (!session) return false;
  const list = session.permissions;
  if (!list) return session.role === "admin" || LEGACY_USER.includes(permission);
  return list.includes("system.admin") || list.includes(permission);
}

/**
 * Permissão que cada tela exige. Sem entrada = qualquer pessoa logada (Ajuda).
 * OPs: o catálogo não tem código próprio; a conversa das OPs é a mesma dos
 * feedbacks (o operador não a acessa), então usa `feedbacks.view`.
 */
export const ROUTE_PERMISSION: Record<string, Permission> = {
  dashboard: "dashboard.view",
  "linha-montagem": "dashboard.view",
  "linha-embalagem": "dashboard.view",
  "linha-granel": "dashboard.view",
  "turno-1": "dashboard.view",
  "turno-2": "dashboard.view",
  "turno-3": "dashboard.view",
  ranking: "dashboard.view",
  retrabalho: "dashboard.view",
  apontamento: "production.create",
  ops: "feedbacks.view",
  historico: "history.view",
  metas: "targets.view",
  // Ver o calendário é consulta, como o dashboard; cadastrar é calendar.manage
  calendario: "dashboard.view",
  feedbacks: "feedbacks.view",
  relatorios: "reports.export",
  tv: "tv_mode.view",
  usuarios: "users.approve",
  "cadastro-maquinas": "machines.manage",
};

export const canOpen = (session: Session | null, route: string) => {
  const p = ROUTE_PERMISSION[route];
  return p ? can(session, p) : !!session;
};

/** Rótulo do perfil, para o menu do usuário (dedução só para o modo Apps Script) */
export function accessLabel(session: Session): string {
  // O nome do perfil vem do banco (roleName); deduzir pelas permissões deixava
  // duas pessoas de perfis diferentes com o mesmo conjunto iguais
  if (session.roleName) return session.roleName;
  if (session.accountType === "shared") return "Posto compartilhado";
  if (session.accountType === "display") return "Tela de TV";
  if (can(session, "system.admin")) return "Administrador";
  if (can(session, "users.approve")) return "Gestão";
  if (can(session, "targets.manage")) return "Liderança";
  return "Operação";
}
