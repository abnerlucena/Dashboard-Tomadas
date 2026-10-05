// ─── Autenticação via Supabase Auth (D19–D23) ─────────────────
import { getSupabase } from "../../supabase";
import type { Session } from "../../api";
import type { DataSource, LoginResponse } from "../types";
import { toAuthError, toError } from "./helpers";

/** Erro com código, para a tela de login pedir o crachá da conta compartilhada. */
export class BadgeRequiredError extends Error {
  code = "BADGE_REQUIRED" as const;
  constructor() {
    super("Conta compartilhada: informe o nº do seu crachá para continuar.");
  }
}

async function buildSession(): Promise<LoginResponse> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getSession();
  const authSession = auth.session;
  if (!authSession) throw new Error("Sessão não encontrada. Faça login novamente.");

  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, full_name, status, account_type, roles(name)")
    .eq("id", authSession.user.id)
    .single();
  if (error || !profile) throw toError(error, "Perfil não encontrado.");

  const { data: permissions, error: permError } = await sb.rpc("my_permissions");
  if (permError) throw toError(permError);
  const perms = permissions || [];

  const session: Session = {
    token: "supabase",              // o token real fica guardado pelo supabase-js
    nome: profile.full_name,
    role: perms.includes("system.admin") ? "admin" : "user",
    expiresAt: authSession.expires_at ? new Date(authSession.expires_at * 1000).toISOString() : undefined,
    source: "supabase",
    userId: profile.id,
    permissions: perms,
    accountType: profile.account_type as Session["accountType"],
    // O nome do perfil vem junto para a tela não ter de deduzi-lo das
    // permissões: deduzir faz duas pessoas de perfis diferentes com o mesmo
    // conjunto aparecerem iguais.
    roleName: (profile.roles as { name: string } | null)?.name ?? undefined,
  };
  return { session };
}

export const supabaseAuth: DataSource["auth"] = {
  async login(email, password, badgeNumber) {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toAuthError(error);

    const { data: auth } = await sb.auth.getUser();
    const { data: profile, error: profError } = await sb
      .from("profiles")
      .select("status, account_type, full_name")
      .eq("id", auth.user?.id ?? "")
      .single();
    if (profError || !profile) {
      await sb.auth.signOut();
      throw toError(profError, "Perfil não encontrado.");
    }
    if (profile.status === "pending") {
      await sb.auth.signOut();
      throw new Error("Seu cadastro está aguardando aprovação do gestor.");
    }
    if (profile.status === "blocked") {
      await sb.auth.signOut();
      throw new Error("Usuário bloqueado. Fale com o gestor.");
    }

    // D23: conta compartilhada só ganha permissões depois da identificação por crachá.
    let identifiedName: string | null = null;
    if (profile.account_type === "shared") {
      if (!badgeNumber?.trim()) {
        await sb.auth.signOut();
        throw new BadgeRequiredError();
      }
      const { data, error: idError } = await sb.rpc("identify_shared_session", { p_badge_number: badgeNumber.trim() });
      if (idError) {
        await sb.auth.signOut();
        throw toError(idError);
      }
      identifiedName = data;
    }

    const result = await buildSession();
    if (identifiedName) result.session.nome = `${identifiedName} (${profile.full_name})`;
    return result;
  },

  async register({ nome, senha, email, badgeNumber }) {
    const sb = getSupabase();
    if (!email?.trim()) throw new Error("Informe o e-mail.");
    if (!badgeNumber?.trim()) throw new Error("Informe o nº do crachá.");
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { full_name: nome.trim(), badge_number: badgeNumber.trim() } },
    });
    if (error) throw toAuthError(error);
    // O cadastro nasce "pendente" (D20): mesmo que o Supabase já devolva uma
    // sessão, a pessoa só entra depois da aprovação do gestor.
    if (data.session) await sb.auth.signOut();
    return {
      loggedIn: false,
      message: data.session
        ? "Cadastro enviado! Aguarde a aprovação do gestor para entrar."
        : "Cadastro enviado! Confirme o e-mail (veja a caixa de entrada) e aguarde a aprovação do gestor.",
    };
  },

  async logout() {
    try { await getSupabase().auth.signOut(); } catch { /* sem conexão: a sessão local é limpa mesmo assim */ }
  },

  // O Supabase guarda UMA sessão por navegador, compartilhada entre as abas.
  // Se outra aba entrar com outro usuário, esta aba precisa acompanhar — senão
  // mostraria um nome e falaria com o banco como outra pessoa.
  watchSession(onChange) {
    const sb = getSupabase();
    let lastUserId: string | null | undefined;
    let running = false, again = false;
    const check = async () => {
      if (running) { again = true; return; }   // chegou outra troca no meio: confere de novo ao terminar
      running = true;
      try {
        const { data } = await sb.auth.getSession();
        const uid = data.session?.user.id ?? null;
        if (uid === lastUserId) return;
        lastUserId = uid;
        if (!uid) { onChange(null); return; }
        const { session } = await buildSession();
        // Cadastro pendente ou bloqueado não tem permissão nenhuma: trata como sem login.
        const semAcesso = (session.permissions?.length ?? 0) === 0 && session.accountType !== "shared";
        onChange(semAcesso ? null : session);
      } catch {
        /* sem rede: tenta de novo no próximo evento */
        lastUserId = undefined;
      } finally {
        running = false;
        if (again) { again = false; void check(); }
      }
    };
    const { data: sub } = sb.auth.onAuthStateChange(() => { void check(); });
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith("sb-")) void check(); };
    window.addEventListener("focus", onVisible);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  },

  async isSessionValid(session) {
    if (session.source !== "supabase") return false;
    const { data } = await getSupabase().auth.getSession();
    return !!data.session && data.session.user.id === session.userId;
  },

  async requestPasswordReset(email) {
    const limpo = email.trim().toLowerCase();
    if (!limpo) throw new Error("Informe o e-mail da sua conta.");

    // Para onde o link do e-mail leva. Usa a URL do próprio app, para
    // funcionar igual em localhost e no site publicado. Este endereço precisa
    // estar liberado em Authentication → URL Configuration no painel do
    // Supabase, senão o link volta para a página inicial sem o token.
    const destino = `${window.location.origin}${import.meta.env.BASE_URL}?recuperar=1`;

    const { error } = await getSupabase().auth.resetPasswordForEmail(limpo, {
      redirectTo: destino,
    });

    // Um erro de "e-mail não encontrado" não é devolvido de propósito pelo
    // Supabase, e a tela também não deve inventar um: dizer "essa conta não
    // existe" contaria a qualquer estranho quem tem conta no sistema.
    if (error) throw toAuthError(error);
  },

  async setNewPassword(newPassword) {
    if (newPassword.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");

    // O link do e-mail cria uma sessão temporária de recuperação. Sem ela, não
    // há a quem trocar a senha — é o que acontece quando alguém abre a tela
    // direto, ou quando o link já expirou.
    const { data } = await getSupabase().auth.getSession();
    if (!data.session) {
      throw new Error("O link de recuperação expirou ou já foi usado. Peça um novo e-mail.");
    }

    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) throw toAuthError(error);

    // Sai da sessão de recuperação: quem trocou a senha entra de novo com ela.
    // Assim a senha nova é testada na hora, em vez de só na próxima visita.
    await getSupabase().auth.signOut();
  },
};
