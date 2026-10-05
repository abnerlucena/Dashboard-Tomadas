// ─── Utilitários do modo Supabase ─────────────────────────────
import type { TypedSupabaseClient } from "../../supabase";

interface PgError { message?: string; code?: string }

/** Converte erros do Supabase em mensagens em português para os toasts. */
export function toError(e: PgError | null | undefined, fallback = "Erro no servidor"): Error {
  let msg = e?.message || fallback;
  if (/JWT expired|invalid JWT|Invalid Refresh Token|refresh_token_not_found/i.test(msg)) {
    // Recarregar basta: o supabase-js descarta sozinho o token que não renova.
    // (Até 05/10/2026 aqui se apagava também a sessão do app antigo, D64.)
    window.location.reload();
    return new Error("Sessão expirada. Reconectando...");
  }
  if (/row-level security|permission denied/i.test(msg)) msg = "Você não tem permissão para esta ação.";
  else if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) msg = "Não foi possível conectar ao servidor. Verifique sua internet.";
  return new Error(msg);
}

/** Tradução das mensagens do Supabase Auth. */
export function toAuthError(e: PgError | null | undefined): Error {
  const msg = e?.message || "";
  if (/Invalid login credentials/i.test(msg)) return new Error("E-mail ou senha incorretos.");
  if (/Email not confirmed/i.test(msg)) return new Error("Confirme seu e-mail antes de entrar (veja a caixa de entrada).");
  if (/already registered|already been registered/i.test(msg)) return new Error("Este e-mail já está cadastrado.");
  if (/Password should be at least/i.test(msg)) return new Error("A senha precisa ter pelo menos 6 caracteres.");
  if (/Database error saving new user/i.test(msg)) {
    return new Error("Não foi possível criar o cadastro. Confira o nº do crachá (obrigatório e não pode estar em uso).");
  }
  if (/email rate limit/i.test(msg)) {
    return new Error("O limite de envio de e-mails de confirmação foi atingido (servidor de e-mail do Supabase). Tente de novo em cerca de 1 hora ou fale com o administrador.");
  }
  if (/rate limit/i.test(msg)) return new Error("Muitas tentativas em pouco tempo. Aguarde alguns minutos.");
  if (/valid email|invalid format/i.test(msg)) return new Error("E-mail inválido.");
  return toError(e, "Erro ao autenticar");
}

/** Lê todas as páginas de uma consulta (o Supabase devolve no máximo 1.000 linhas por vez). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PgError | null }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw toError(error);
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

/** id → nome de todos os usuários (para "quem apontou"). */
export async function loadProfileNames(sb: TypedSupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await sb.rpc("list_profile_names");
  if (error) throw toError(error);
  return new Map((data || []).map(p => [p.id, p.full_name]));
}

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
export function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
