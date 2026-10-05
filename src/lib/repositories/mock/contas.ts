// ─── Contas de demonstração (modo mock) ───────────────────────
// Dados FICTÍCIOS, feitos para exercitar todos os estados da área de acesso.
// O repositório é público: nada aqui é pessoa, e-mail ou senha de verdade.
//
// Senha de todas as contas: 123456
//
//   e-mail                 situação                      para testar
//   operador@demo.local    ativo, perfil Operador        menu mínimo
//   tecnico@demo.local     ativo, perfil Técnico         dashboard, máquinas, calendário
//   gestor@demo.local      ativo, perfil Gestor          aprovar cadastros, alterar metas
//   pendente@demo.local    aguardando aprovação          mensagem de pendente
//   bloqueado@demo.local   bloqueado                     mensagem de bloqueado
//   admin@demo.local       conta compartilhada (crachá)  pedido de crachá: use 1001 ou 1002
//   tv@demo.local          conta de exibição             só o Modo TV
//
// As permissões de cada perfil seguem o catálogo de
// docs/database/02-referencia-tecnica.md, seção 8.

export const SENHA_DEMO = "123456";

export type StatusConta = "active" | "pending" | "blocked";
export type TipoConta = "personal" | "shared" | "display";

export interface Perfil {
  id: number;
  code: string;
  name: string;
  permissoes: string[];
}

const P = {
  apontar:   ["production.create", "production.edit_own"],
  corrigir:  ["production.edit", "production.delete"],
  lote:      ["production.bulk_edit", "production.bulk_delete"],
  // D62: cadastrar OP e mudar a situação. No banco vai para os mesmos quatro
  // perfis que têm edição em lote: distribuidor, técnico, gestor e admin.
  ops:       ["work_orders.manage"],
  analise:   ["history.view", "feedbacks.view"],
  exportar:  ["reports.export"],
  painel:    ["dashboard.view", "targets.view", "tv_mode.view"],
  cadastros: ["machines.manage", "calendar.manage", "alerts.manage"],
  gestao:    ["targets.manage", "users.approve", "system.admin"],
};

export const PERFIS: Perfil[] = [
  { id: 1, code: "operator",    name: "Operador",     permissoes: [...P.apontar] },
  { id: 2, code: "preparer",    name: "Preparador",   permissoes: [...P.apontar, ...P.corrigir, ...P.analise] },
  { id: 3, code: "distributor", name: "Distribuidor", permissoes: [...P.apontar, ...P.corrigir, ...P.lote, ...P.ops, ...P.analise, ...P.exportar] },
  { id: 4, code: "technician",  name: "Técnico",      permissoes: [...P.apontar, ...P.corrigir, ...P.lote, ...P.ops, ...P.analise, ...P.exportar, ...P.painel, ...P.cadastros] },
  { id: 5, code: "manager",     name: "Gestor",       permissoes: [...P.apontar, ...P.corrigir, ...P.lote, ...P.ops, ...P.analise, ...P.exportar, ...P.painel, ...P.cadastros, ...P.gestao] },
  { id: 6, code: "admin",       name: "Admin",        permissoes: [...P.apontar, ...P.corrigir, ...P.lote, ...P.ops, ...P.analise, ...P.exportar, ...P.painel, ...P.cadastros, ...P.gestao] },
  { id: 7, code: "tv_display",  name: "TV",           permissoes: ["tv_mode.view"] },
];

export interface ContaDemo {
  id: string;
  email: string;
  nome: string;
  cracha: string | null;
  status: StatusConta;
  tipo: TipoConta;
  perfilId: number | null;
  senha: string;
  /**
   * Permissões DESTA conta. O perfil é só o modelo de onde elas saem na
   * aprovação (D22); depois disso cada uma anda por conta própria, e é esta
   * lista que vale. Ausente = ainda não aprovada, ou nunca ajustada.
   */
  permissoes?: string[];
}

/** O catálogo, com o texto que a tela mostra. Espelha a tabela permissions. */
export const CATALOGO_DE_PERMISSOES: Array<{ code: string; description: string }> = [
  { code: "alerts.manage", description: "Configurar alertas" },
  { code: "calendar.manage", description: "Cadastrar feriados, eventos e dias anulados" },
  { code: "dashboard.view", description: "Ver o dashboard" },
  { code: "feedbacks.view", description: "Ver e editar observações (feedbacks)" },
  { code: "history.view", description: "Ver histórico de apontamentos" },
  { code: "import.manage", description: "Criar, carregar e reverter lotes de importação" },
  { code: "import.review", description: "Conferir a área de preparo da importação" },
  { code: "machines.manage", description: "Cadastrar e alterar máquinas" },
  { code: "production.bulk_delete", description: "Apagar vários apontamentos de uma vez" },
  { code: "production.bulk_edit", description: "Editar vários apontamentos de uma vez" },
  { code: "production.create", description: "Apontar produção" },
  { code: "production.delete", description: "Apagar qualquer apontamento" },
  { code: "production.edit", description: "Editar qualquer apontamento" },
  { code: "production.edit_own", description: "Corrigir os próprios apontamentos (até 24 h)" },
  { code: "reports.export", description: "Exportar relatórios (PDF/CSV)" },
  { code: "system.admin", description: "Administração do sistema (auditoria, turnos)" },
  { code: "targets.manage", description: "Alterar metas" },
  { code: "targets.view", description: "Ver metas" },
  { code: "tv_mode.view", description: "Usar o modo TV" },
  { code: "users.approve", description: "Aprovar usuários e ajustar permissões" },
  { code: "work_orders.manage", description: "Cadastrar OPs e mudar a situação delas" },
];

/** Crachás aceitos na conta compartilhada (D23): quem se identifica nela. */
export const CRACHAS_DA_CONTA_COMPARTILHADA: Record<string, string> = {
  "1001": "Carla Demonstração",
  "1002": "Diego Demonstração",
};

export function contasIniciais(): ContaDemo[] {
  return [
    { id: "u-operador",  email: "operador@demo.local",  nome: "Ana Operadora",       cracha: "2001", status: "active",  tipo: "personal", perfilId: 1, senha: SENHA_DEMO },
    { id: "u-tecnico",   email: "tecnico@demo.local",   nome: "Bruno Técnico",       cracha: "2002", status: "active",  tipo: "personal", perfilId: 4, senha: SENHA_DEMO },
    { id: "u-gestor",    email: "gestor@demo.local",    nome: "Gabriela Gestora",    cracha: "2003", status: "active",  tipo: "personal", perfilId: 5, senha: SENHA_DEMO },
    { id: "u-pendente",  email: "pendente@demo.local",  nome: "Paulo Pendente",      cracha: "2004", status: "pending", tipo: "personal", perfilId: null, senha: SENHA_DEMO },
    { id: "u-bloqueado", email: "bloqueado@demo.local", nome: "Beatriz Bloqueada",   cracha: "2005", status: "blocked", tipo: "personal", perfilId: 1, senha: SENHA_DEMO },
    { id: "u-admin",     email: "admin@demo.local",     nome: "Administração",       cracha: null,   status: "active",  tipo: "shared",   perfilId: 6, senha: SENHA_DEMO },
    { id: "u-tv",        email: "tv@demo.local",        nome: "TV da Fábrica",       cracha: null,   status: "active",  tipo: "display",  perfilId: 7, senha: SENHA_DEMO },
  ];
}
