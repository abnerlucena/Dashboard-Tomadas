// ─── Cliente Supabase ─────────────────────────────────────────
// Criado na primeira vez que alguém fala com o banco. Sem as variáveis de
// ambiente, a falha só acontece nessa hora, com a mensagem abaixo.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

let client: TypedSupabaseClient | null = null;

export function getSupabase(): TypedSupabaseClient {
  if (client) return client;
  // Aceita também a URL da API REST (".../rest/v1/"), que às vezes é copiada
  // do painel no lugar da URL do projeto.
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local."
    );
  }
  client = createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
