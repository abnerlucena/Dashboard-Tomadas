// ─── Acesso de mentira: login, cadastro, aprovação, recuperação ─
// Serve para construir e testar as telas de acesso sem Supabase, sem SMTP e sem
// ninguém cadastrado. As contas estão em ./contas.ts.
//
// Regra deste arquivo: comportar-se EXATAMENTE como o modo Supabase
// (supabase/auth.ts e supabase/users.ts) — mesmas mensagens, mesmos erros,
// mesma ordem de checagem. Um mock que promete algo que o sistema real não faz
// deixa a tela pronta para um mundo que não existe.
//
// O estado vive no sessionStorage: sobrevive a recarregar a página (o link de
// recuperação recarrega), e some ao fechar a aba — cada teste começa limpo.
import type { Session } from "../../api";
import type { AdminUser, DataSource, LoginResponse, RoleOption } from "../types";
import { BadgeRequiredError } from "../supabase/auth";
import {
  CATALOGO_DE_PERMISSOES, CRACHAS_DA_CONTA_COMPARTILHADA, PERFIS, contasIniciais, type ContaDemo,
} from "./contas";

const CHAVE_CONTAS = "mock.contas";
const CHAVE_SESSAO = "mock.sessao";            // quem está logado (id da conta)
const CHAVE_RECUPERACAO = "mock.recuperacao";  // e-mail com link de recuperação aberto

/** Atraso de rede fingido: sem ele, estados de "carregando" nunca aparecem. */
const ATRASO_MS = import.meta.env.MODE === "test" ? 0 : 350;
const esperar = () => new Promise(r => setTimeout(r, ATRASO_MS));

// ── estado ────────────────────────────────────────────────────
function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = sessionStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch { return padrao; }
}
function gravar(chave: string, valor: unknown) {
  try {
    if (valor === null) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch { /* sem sessionStorage: o mock vale só até recarregar */ }
}

let contasEmMemoria: ContaDemo[] | null = null;
function contas(): ContaDemo[] {
  if (!contasEmMemoria) contasEmMemoria = ler<ContaDemo[]>(CHAVE_CONTAS, contasIniciais());
  return contasEmMemoria;
}
function salvarContas() { gravar(CHAVE_CONTAS, contas()); }

/** Volta tudo ao estado inicial. Para testes e para o botão "recomeçar" da demonstração. */
export function resetarMock() {
  contasEmMemoria = null;
  gravar(CHAVE_CONTAS, null);
  gravar(CHAVE_SESSAO, null);
  gravar(CHAVE_RECUPERACAO, null);
}

const porEmail = (email: string) =>
  contas().find(c => c.email.toLowerCase() === email.trim().toLowerCase());
const perfil = (id: number | null) => PERFIS.find(p => p.id === id) ?? null;

// D22: o perfil é o MODELO de onde as permissões saem na aprovação. Depois
// disso vale a lista da conta, que o gestor pode ajustar uma a uma. Conta sem
// lista ainda não foi aprovada nem ajustada: cai no modelo.
const permissoesDe = (conta: ContaDemo) =>
  conta.permissoes ?? perfil(conta.perfilId)?.permissoes ?? [];

function montarSessao(conta: ContaDemo, identificado?: string): LoginResponse {
  const perms = permissoesDe(conta);
  const session: Session = {
    token: "mock",
    nome: identificado ? `${identificado} (${conta.nome})` : conta.nome,
    role: perms.includes("system.admin") ? "admin" : "user",
    expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
    source: "mock",
    userId: conta.id,
    permissions: perms,
    accountType: conta.tipo,
    roleName: perfil(conta.perfilId)?.name ?? undefined,
  };
  return { session };
}

// ── observadores de sessão (o equivalente ao onAuthStateChange) ─
const observadores = new Set<(s: Session | null) => void>();
function avisar() {
  const id = ler<string | null>(CHAVE_SESSAO, null);
  const conta = id ? contas().find(c => c.id === id) : undefined;
  const s = conta && conta.status === "active" ? montarSessao(conta).session : null;
  observadores.forEach(cb => cb(s));
}

const podeAprovar = (s: Session | null) => !!s?.permissions?.includes("users.approve");

// ═══ auth ═══════════════════════════════════════════════════════
export const mockAuth: DataSource["auth"] = {
  async login(email, senha, cracha) {
    await esperar();
    const conta = porEmail(email);
    // Mesma mensagem para e-mail inexistente e senha errada, como no Supabase:
    // dizer qual dos dois errou contaria a estranhos quem tem conta.
    if (!conta || conta.senha !== senha) throw new Error("E-mail ou senha incorretos.");
    if (conta.status === "pending") throw new Error("Seu cadastro está aguardando aprovação do gestor.");
    if (conta.status === "blocked") throw new Error("Usuário bloqueado. Fale com o gestor.");

    let identificado: string | undefined;
    if (conta.tipo === "shared") {
      if (!cracha?.trim()) throw new BadgeRequiredError();
      identificado = CRACHAS_DA_CONTA_COMPARTILHADA[cracha.trim()];
      if (!identificado) throw new Error("Crachá não encontrado entre os usuários ativos.");
    }

    gravar(CHAVE_SESSAO, conta.id);
    return montarSessao(conta, identificado);
  },

  async register({ nome, senha, email, badgeNumber }) {
    await esperar();
    if (!email?.trim()) throw new Error("Informe o e-mail.");
    if (!badgeNumber?.trim()) throw new Error("Informe o nº do crachá.");
    if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    if (porEmail(email)) throw new Error("Este e-mail já está cadastrado.");
    // O crachá é único no banco; o Supabase devolve um erro genérico que a
    // camada traduz nesta mensagem (ver toAuthError).
    if (contas().some(c => c.cracha === badgeNumber.trim())) {
      throw new Error("Não foi possível criar o cadastro. Confira o nº do crachá (obrigatório e não pode estar em uso).");
    }

    contas().push({
      id: `u-${Date.now()}`,
      email: email.trim().toLowerCase(),
      nome: nome.trim(),
      cracha: badgeNumber.trim(),
      status: "pending",       // D20: todo cadastro nasce pendente
      tipo: "personal",
      perfilId: null,
      senha,
    });
    salvarContas();
    return { loggedIn: false, message: "Cadastro enviado! Aguarde a aprovação do gestor para entrar." };
  },

  async logout() {
    gravar(CHAVE_SESSAO, null);
    avisar();
  },

  async isSessionValid(session) {
    if (session.source !== "mock") return false;
    const id = ler<string | null>(CHAVE_SESSAO, null);
    const conta = contas().find(c => c.id === id);
    return !!conta && conta.status === "active" && conta.id === session.userId;
  },

  watchSession(onChange) {
    observadores.add(onChange);
    // Outra aba do mesmo navegador não compartilha sessionStorage, então aqui
    // só há mudança feita nesta aba — o que já cobre bloqueio pelo gestor.
    return () => { observadores.delete(onChange); };
  },

  async requestPasswordReset(email) {
    await esperar();
    const limpo = email.trim().toLowerCase();
    if (!limpo) throw new Error("Informe o e-mail da sua conta.");
    // Resposta idêntica exista a conta ou não (ver supabase/auth.ts).
    if (porEmail(limpo)) {
      gravar(CHAVE_RECUPERACAO, limpo);
      // Não há e-mail de verdade: o "link" vai para o console.
      const base = `${window.location.origin}${window.location.pathname}`;
      console.info(`[mock] Link de recuperação para ${limpo}: ${base}?recuperar=1&code=mock`);
    }
  },

  async setNewPassword(novaSenha) {
    await esperar();
    if (novaSenha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    const email = ler<string | null>(CHAVE_RECUPERACAO, null);
    const conta = email ? porEmail(email) : undefined;
    if (!conta) throw new Error("O link de recuperação expirou ou já foi usado. Peça um novo e-mail.");
    conta.senha = novaSenha;
    salvarContas();
    gravar(CHAVE_RECUPERACAO, null);   // o link vale uma vez
  },
};

// ═══ users ══════════════════════════════════════════════════════
// Espelha supabase/users.ts e as regras de RLS de `profiles`:
//   • ler: a própria linha, ou todas para quem tem users.approve;
//   • alterar: só quem tem users.approve (sem permissão, o banco não dá erro —
//     simplesmente não altera nada, e a camada traduz isso em mensagem).
const STATUS_LEGADO: Record<ContaDemo["status"], string> = {
  active: "ativo", blocked: "bloqueado", pending: "pendente",
};

export const mockUsers: DataSource["users"] = {
  async listUsers(session) {
    await esperar();
    const visiveis = podeAprovar(session) ? contas() : contas().filter(c => c.id === session?.userId);
    const ordem = { pending: 0, blocked: 1, active: 2 } as const;   // pendentes primeiro, como no banco
    const users: AdminUser[] = [...visiveis]
      .sort((a, b) => ordem[a.status] - ordem[b.status] || a.nome.localeCompare(b.nome))
      .map(c => {
        const p = perfil(c.perfilId);
        return {
          id: c.id,
          nome: c.nome,
          status: STATUS_LEGADO[c.status],
          role: p && ["manager", "admin"].includes(p.code) ? "admin" : "user",
          roleName: p?.name ?? null,
          badgeNumber: c.cracha,
          accountType: c.tipo,
        };
      });
    return { users };
  },

  async toggleUser(alvo, session) {
    await esperar();
    if (!alvo.id) throw new Error("Usuário sem identificador.");
    if (alvo.status === "pendente") throw new Error('Cadastro pendente: use "Aprovar".');
    if (!podeAprovar(session)) throw new Error("Você não tem permissão para alterar usuários.");
    const conta = contas().find(c => c.id === alvo.id);
    if (!conta) throw new Error("Você não tem permissão para alterar usuários.");
    conta.status = alvo.status === "ativo" ? "blocked" : "active";
    salvarContas();
    avisar();
    return { newStatus: STATUS_LEGADO[conta.status] };
  },

  async approveUser(userId, roleId, session) {
    await esperar();
    if (!podeAprovar(session)) throw new Error("Você não tem permissão para aprovar usuários.");
    const conta = contas().find(c => c.id === userId);
    if (!conta) throw new Error("Usuário não encontrado.");
    if (!perfil(roleId)) throw new Error("Perfil inválido.");
    conta.status = "active";
    conta.perfilId = roleId;
    // Copia o modelo do perfil, como a approve_user do banco (D22). A partir
    // daqui a lista é da conta e pode ser ajustada permissão a permissão.
    conta.permissoes = [...(perfil(roleId)?.permissoes ?? [])];
    salvarContas();
  },

  async listRoles(): Promise<RoleOption[]> {
    await esperar();
    return PERFIS.map(({ id, code, name }) => ({ id, code, name }));
  },

  async listPermissions() {
    await esperar();
    return CATALOGO_DE_PERMISSOES.map(p => ({ ...p }));
  },

  async getPermissions(userId, session) {
    await esperar();
    const conta = contas().find(c => c.id === userId);
    if (!conta) throw new Error("Usuário não encontrado.");
    // A RLS do banco deixa ver as próprias ou, com users.approve, as de
    // qualquer um. Aqui a mesma regra, para a tela se comportar igual.
    if (conta.id !== session?.userId && !podeAprovar(session)) {
      throw new Error("Você não tem permissão para ver as permissões de outro usuário.");
    }
    return [...permissoesDe(conta)].sort().map(code => ({
      code,
      grantedBy: conta.permissoes ? "Gabriela Gestora" : "",
      grantedAt: new Date().toISOString(),
    }));
  },

  async setPermissions(userId, permissions, session) {
    await esperar();
    if (!podeAprovar(session)) throw new Error("Você não tem permissão para alterar permissões de usuários.");
    const conta = contas().find(c => c.id === userId);
    if (!conta) throw new Error("Usuário não encontrado.");
    const conhecidas = new Set(CATALOGO_DE_PERMISSOES.map(p => p.code));
    const invalida = permissions.find(c => !conhecidas.has(c));
    // O banco recusa pela chave estrangeira; aqui a recusa é explícita, para
    // o erro ser o mesmo nos dois modos.
    if (invalida) throw new Error(`Permissão desconhecida: "${invalida}".`);
    conta.permissoes = [...new Set(permissions)].sort();
    salvarContas();
    avisar();
  },

};
