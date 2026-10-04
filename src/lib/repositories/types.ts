// ─── Contrato da camada de dados ──────────────────────────────
// Uma operação por ação que o Apps Script oferece hoje. Existem duas
// implementações: `gas.ts` (repassa para o api() atual, com o MESMO payload)
// e `supabase/` (fala com o banco novo). A fachada em `index.ts` escolhe
// uma delas pela variável VITE_DATA_SOURCE.
//
// As respostas mantêm o formato das respostas do Apps Script, para que as
// telas não precisem ser reescritas agora.
import type { Session, Machine, Holiday, HolidayScope, ProdRecord, OrdemProducao } from "../api";
import type { BaseDaMeta } from "../metas";

export type DataSourceKind = "gas" | "supabase" | "mock";

export interface MetaInfoRaw {
  updatedBy: string;
  updatedAt: string;
  vigenciaInicio: string;
  /**
   * Como ler o número da meta (D39, D47). Só o modo Supabase informa; vazio se
   * comporta como `per_shift`. As três regras estão em `src/lib/metas.ts`.
   */
  basis?: BaseDaMeta;
}

export interface LoginResponse {
  session: Session;
  onboardingDone: boolean;
}

export interface RegisterInput {
  nome: string;
  senha: string;
  inviteCode?: string;   // GAS
  email?: string;        // Supabase
  badgeNumber?: string;  // Supabase
}

/** Resultado do cadastro: com sessão (GAS entra direto) ou aguardando aprovação (Supabase). */
export type RegisterResponse =
  | { loggedIn: true; session: Session; onboardingDone: boolean }
  | { loggedIn: false; message: string };

/** Linha de apontamento enviada pela tela de Apontamento (formato do legado). */
export interface ProductionEntryPayload {
  date: string;
  turno: string;
  machineId: number;
  machineName: string;
  meta: number;
  producao: number;
  ordensProducao: OrdemProducao[];
  savedBy: string;
  savedAt: string;
  obs: string;
  /** Só modo Supabase: nº de operadores do turno (D12). Vazio = lotação padrão. */
  operatorCount?: number;
}

/**
 * O que corrigir num apontamento (production.updateEntry, D59).
 *
 * Campo AUSENTE = não mexer. Campo VAZIO = apagar:
 *   - `obs: ""` apaga a observação. **É o contrário do `saveEntries`**, em que
 *     observação vazia MANTÉM a que está lá. As duas regras são de propósito:
 *     lá se acrescenta a um apontamento, aqui se corrige. Não "conserte" uma
 *     para ficar igual à outra.
 *   - `operatorCount: 0` apaga o nº de pessoas (D52) — exceto onde a meta é por
 *     pessoa, que o banco recusa (D54).
 *   - `ordensProducao: []` tira todas as OPs: o apontamento continua, sem peça
 *     (máquina parada).
 *
 * Mudar data, turno ou modo para onde já existe apontamento é RECUSADO, com o
 * destino na mensagem ("Já existe apontamento da EMBALADORA HORIZONTAL N°1 em
 * 08/10/2026, Turno 2…"). Juntar os dois esconderia a correção.
 */
export interface UpdateEntryChanges {
  /** SUBSTITUI as OPs do apontamento (não acrescenta). Lista vazia tira todas. */
  ordensProducao?: OrdemProducao[];
  date?: string;
  turno?: string;
  workMode?: "regular" | "overtime";
  obs?: string;
  operatorCount?: number;
}

export interface SaveEntriesOptions {
  /** Só modo Supabase: 'overtime' marca o lote como hora extra (D27). */
  workMode?: "regular" | "overtime";
}

export interface AdminUser {
  nome: string;
  status: string;          // "ativo" | "bloqueado" | "pendente"
  role?: string;           // "admin" | "user"
  // Modo Supabase
  id?: string;
  badgeNumber?: string | null;
  roleName?: string | null;
  accountType?: string;
}

export interface RoleOption {
  id: number;
  code: string;
  name: string;
}

/** Uma permissão do catálogo, com o texto que a tela mostra. */
export interface PermissionOption {
  code: string;
  description: string;
}

/**
 * Uma permissão que ESTE usuário tem, com o rastro de quem a concedeu.
 *
 * O rastro existe por decisão do gestor (01/10/2026): em vez de impedir que
 * um gestor conceda permissões fortes, o sistema registra quem concedeu o quê.
 * Por isso a leitura não devolve só os códigos.
 */
export interface UserPermission {
  code: string;
  /** Nome de quem concedeu. Vazio quando veio da aprovação inicial (D22). */
  grantedBy: string;
  grantedAt: string;
}

export interface TargetHistoryItem {
  machineId: number;
  quantity: number;
  validFrom: string;
  createdBy: string;
  createdAt: string;
}

/** Configuração de alertas no formato do Apps Script (campos podem vir como texto). */
export interface AlertConfigRaw {
  active?: boolean | string;
  recipientEmail?: string;
  thresholdPct?: number | string;
  machines?: Array<number | string>;
  frequency?: string;
}

export interface DataSource {
  kind: DataSourceKind;

  auth: {
    login(identifier: string, password: string, badgeNumber?: string): Promise<LoginResponse>;
    register(input: RegisterInput): Promise<RegisterResponse>;
    logout(session: Session | null): Promise<void>;
    completeOnboarding(session: Session | null): Promise<void>;
    /** Confere se a sessão salva ainda vale (Supabase). No GAS sempre true. */
    isSessionValid(session: Session): Promise<boolean>;
    /**
     * Avisa quando o login do navegador muda por fora desta aba (outra aba entrou
     * com outro usuário, ou saiu). Recebe a sessão nova, ou null se não há login
     * válido. Devolve a função que para de vigiar. No GAS não faz nada.
     */
    watchSession(onChange: (session: Session | null) => void): () => void;
    /**
     * Pede o e-mail de recuperação de senha. Não diz se o e-mail existe ou
     * não: responder "essa conta não existe" contaria a estranhos quem tem
     * conta no sistema. A mensagem é sempre a mesma.
     * No GAS não existe recuperação — avisa para procurar o administrador.
     */
    requestPasswordReset(email: string): Promise<void>;
    /**
     * Define a senha nova. Só funciona logo depois de abrir o link do e-mail,
     * porque é o link que cria a sessão temporária de recuperação.
     */
    setNewPassword(newPassword: string): Promise<void>;
  };

  production: {
    getAll(session: Session | null): Promise<{ data: ProdRecord[] | unknown[] }>;
    saveEntries(entries: ProductionEntryPayload[], options: SaveEntriesOptions, session: Session | null): Promise<void>;
    updateObs(record: ProdRecord, obs: string, session: Session | null): Promise<void>;
    /**
     * Corrige UM apontamento: OPs, quantidade, retrabalho, data, turno, modo,
     * observação, nº de pessoas (D59). É o que a tela de Histórico usa.
     *
     * Diferente de `saveEntries`, que ACRESCENTA OPs a um apontamento (D30),
     * aqui as OPs informadas SUBSTITUEM as que estavam lá.
     *
     * Mudar a data refaz a meta do apontamento com a do dia novo — exceto nos
     * importados, que guardam a meta da planilha. O banco cobra as mesmas
     * regras do apontamento: OP só com números (D57) e, onde a meta é por
     * pessoa, o nº de pessoas (D54).
     *
     * Só Supabase. No Apps Script não existe.
     */
    updateEntry(id: string, changes: UpdateEntryChanges, session: Session | null): Promise<void>;
    bulkDelete(ids: string[], session: Session | null): Promise<void>;
    bulkMove(ids: string[], newDate: string, session: Session | null): Promise<void>;
    bulkEditTurno(ids: string[], newTurno: string, session: Session | null): Promise<void>;
  };

  machines: {
    getMachines(session: Session | null): Promise<{ machines?: Machine[]; allMachines?: Machine[] }>;
    addMachine(name: string, defaultMeta: number, session: Session | null): Promise<void>;
    toggleMachine(machineId: number, session: Session | null): Promise<{ newStatus: string }>;
  };

  targets: {
    getMetas(session: Session | null): Promise<{ metas?: Record<number, number>; metasInfo?: Record<number, MetaInfoRaw> }>;
    /**
     * Grava as metas e, opcionalmente, a BASE de cada uma (D47, D53).
     *
     * Máquina que não aparecer em `bases` mantém a base que já tinha — mudar
     * o número não muda como o número é lido. Só o que mudou vira degrau novo
     * na linha do tempo; o passado nunca é reescrito.
     *
     * No modo Apps Script a base não existe e o parâmetro é ignorado.
     */
    saveMetas(metas: Record<string, number>, vigenciaInicio: string, session: Session | null, bases?: Record<string, BaseDaMeta>): Promise<void>;
    /** Só Supabase: histórico de metas (D13). No GAS devolve lista vazia. */
    getHistory(session: Session | null): Promise<TargetHistoryItem[]>;
    /**
     * A meta e a base que valiam NUMA DATA, não hoje.
     *
     * O apontamento guarda uma foto da meta do seu dia (D08). Quem lança um
     * turno atrasado precisa da meta daquele dia, senão a foto sai errada e
     * fica errada para sempre — a meta antiga nunca é reescrita.
     *
     * No GAS não existe histórico de metas: devolve as de hoje.
     */
    getMetasEm(date: string, session: Session | null): Promise<{ metas: Record<number, number>; metasInfo: Record<number, MetaInfoRaw> }>;
  };

  calendar: {
    getHolidays(session: Session | null): Promise<{ holidays?: Holiday[] | unknown[] }>;
    addHoliday(date: string, label: string, type: Holiday["type"], session: Session | null, shiftIds?: number[]): Promise<void>;
    removeHoliday(id: string, session: Session | null): Promise<void>;
    /**
     * Cadastra o mesmo evento em VÁRIOS dias, tudo ou nada (D61): férias
     * coletivas, ponte. Se um dia falhar, nenhum entra. Dia repetido na lista
     * conta uma vez. Até 366 dias por chamada.
     *
     * `scope` padrão: "company". `shiftIds` vazio = o dia inteiro.
     * Devolve quantos dias entraram. Só modo Supabase.
     */
    addHolidays(
      dates: string[], label: string, type: Holiday["type"], session: Session | null,
      options?: { shiftIds?: number[]; scope?: HolidayScope },
    ): Promise<number>;
  };

  users: {
    listUsers(session: Session | null): Promise<{ users?: AdminUser[] }>;
    toggleUser(target: AdminUser, session: Session | null): Promise<{ newStatus: string }>;
    adminCreateUser(nome: string, senha: string, session: Session | null): Promise<void>;
    resetPassword(targetNome: string, novaSenha: string, session: Session | null): Promise<void>;
    generateInviteCode(session: Session | null): Promise<{ code: string }>;
    /** Só Supabase (D20/D22). */
    approveUser(userId: string, roleId: number, session: Session | null): Promise<void>;
    listRoles(session: Session | null): Promise<RoleOption[]>;
    /** O catálogo inteiro de permissões, para a tela montar a lista. */
    listPermissions(session: Session | null): Promise<PermissionOption[]>;
    /**
     * As permissões de um usuário, com quem concedeu cada uma.
     *
     * Quem aprova vê as de qualquer um; os demais só as próprias — é a RLS
     * que decide, não a tela.
     */
    getPermissions(userId: string, session: Session | null): Promise<UserPermission[]>;
    /**
     * Grava a lista COMPLETA de permissões do usuário: o que não estiver nela
     * é retirado.
     *
     * Só mexe no que mudou. Reescrever tudo a cada salvar apagaria o rastro de
     * quem concedeu o quê, que é justamente o que o gestor pediu para manter.
     */
    setPermissions(userId: string, permissions: string[], session: Session | null): Promise<void>;
  };

  alerts: {
    getAlertConfig(session: Session | null): Promise<{ config?: AlertConfigRaw }>;
    saveAlertConfig(config: AlertConfigRaw, session: Session | null): Promise<void>;
    testAlertEmail(session: Session | null): Promise<void>;
  };
}
