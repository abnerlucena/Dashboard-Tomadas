// ─── Recuperação de senha: a chegada pelo link do e-mail ──────
// Quem esqueceu a senha recebe um e-mail do Supabase. O link do e-mail passa
// pelo servidor do Supabase e volta para este app já com a permissão de trocar
// a senha no endereço — de duas formas possíveis:
//
//   fluxo implícito  .../Dashboard-Tomadas/?recuperar=1#access_token=...&type=recovery
//   fluxo PKCE       .../Dashboard-Tomadas/?recuperar=1&code=...
//
// O `?recuperar=1` é nosso (vem do `redirectTo`, em repositories/supabase/auth.ts);
// o resto é o Supabase que acrescenta.
//
// Por que este arquivo existe, em vez de a tela de login só olhar o endereço:
//
// 1. O app usa HashRouter, ou seja, o hash do endereço É a rota. Um hash como
//    "#access_token=..." não é rota nenhuma, e o roteador abriria a página
//    "não encontrada". O token tem de sair do endereço antes de a tela montar.
// 2. Quem lê o token é o supabase-js (opção `detectSessionInUrl`), e ele só lê
//    no instante em que o cliente é criado. O cliente é criado sob demanda
//    (ver lib/supabase.ts), então é preciso criá-lo de propósito aqui, antes —
//    se a tela limpasse o endereço primeiro, o token se perderia e a
//    recuperação nunca funcionaria.
//
// Por isso `prepararRecuperacaoDeSenha()` roda em main.tsx, antes do render.
import { isMock, isSupabase } from "./repositories";
import { getSupabase } from "./supabase";

const LINK_INVALIDO =
  "O link de recuperação expirou ou já foi usado. Peça um novo e-mail.";

const LINK_DEMOROU =
  "O servidor demorou para responder. Tente de novo ou peça um novo e-mail.";

/**
 * Quanto se espera pelo Supabase antes de desistir e mostrar a tela.
 *
 * Oito segundos é o meio-termo: tempo de sobra para uma conexão lenta de
 * fábrica, e curto o bastante para ninguém achar que o app travou. O risco
 * assumido é um link VÁLIDO numa rede muito ruim cair na tela de "peça outro
 * e-mail" — pedir de novo resolve, e é melhor do que uma tela branca sem saída.
 */
const LIMITE_MS = 8000;

/** Estourou o tempo de espera — separado para a mensagem poder ser outra. */
class DemorouDemais extends Error {}

/** Devolve a promessa, ou estoura `DemorouDemais` se ela passar do tempo. */
function comLimiteDeTempo<T>(promessa: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const alarme = setTimeout(() => reject(new DemorouDemais()), ms);
    promessa.then(
      v => { clearTimeout(alarme); resolve(v); },
      e => { clearTimeout(alarme); reject(e); },
    );
  });
}

/** O que o endereço trazia. */
export type PedidoDeRecuperacao =
  /** Veio token (ou código): dá para trocar a senha. */
  | { tipo: "sessao" }
  /** Veio pelo link, mas sem token válido — o motivo já em português. */
  | { tipo: "erro"; mensagem: string };

/** Em qual tela do cartão de login a visita deve começar. */
export type EstadoRecuperacao =
  | { tela: "novaSenha" }
  | { tela: "recuperar"; erro: string };

/**
 * Lê o endereço e diz o que ele traz. Função pura, sem efeito nenhum —
 * separada do resto justamente para poder ser testada.
 */
export function lerRecuperacaoDoEndereco(
  search: string,
  hash: string,
): PedidoDeRecuperacao | null {
  const busca = new URLSearchParams(search);
  // O hash pode ser a rota ("#/"), a rota com parâmetros ("#/?x=1") ou o token
  // solto do Supabase ("#access_token=..."). Tirar o "#" e a "/" da frente
  // deixa os três casos no mesmo formato de leitura.
  const doHash = new URLSearchParams(hash.replace(/^#/, "").replace(/^\/+/, "").replace(/^\?/, ""));

  const marcado = busca.has("recuperar");
  const ehRecuperacao = doHash.get("type") === "recovery";
  // Visita comum (abriu o app, entrou pelo dashboard): nada a fazer.
  if (!marcado && !ehRecuperacao) return null;

  // O Supabase avisa por aqui quando o próprio link já não vale — link velho,
  // link já usado, ou pedido feito duas vezes.
  const erro =
    doHash.get("error_description") ?? busca.get("error_description") ??
    doHash.get("error") ?? busca.get("error");
  if (erro) return { tipo: "erro", mensagem: mensagemDoErro(erro) };

  const temPermissao = doHash.has("access_token") || busca.has("code");
  return temPermissao ? { tipo: "sessao" } : { tipo: "erro", mensagem: LINK_INVALIDO };
}

function mensagemDoErro(erro: string): string {
  // Só o "expirou" ganha texto próprio: é o caso que acontece de verdade, e
  // saber que basta pedir outro e-mail resolve a dúvida de quem está na tela.
  if (/expired|otp_expired/i.test(erro)) {
    return "O link de recuperação expirou. Peça um novo e-mail.";
  }
  return LINK_INVALIDO;
}

let estado: EstadoRecuperacao | null = null;

/**
 * Se esta visita veio do link do e-mail, diz em que tela ela começa. Devolve
 * `null` numa visita comum. A tela de login chama isto ao montar.
 */
export function recuperacaoEmAndamento(): EstadoRecuperacao | null {
  return estado;
}

/**
 * Trata a chegada pelo link do e-mail: transforma o token do endereço na sessão
 * temporária de recuperação, apaga o token do endereço e do histórico do
 * navegador, e guarda em que tela o login deve abrir.
 *
 * Roda uma vez, em main.tsx, antes de a tela montar. Nunca falha para fora:
 * qualquer problema vira a tela de "pedir outro e-mail", com o motivo escrito.
 */
export async function prepararRecuperacaoDeSenha(): Promise<void> {
  // Só há recuperação por e-mail com o Supabase (e na demonstração).
  if (!isSupabase && !isMock) return;

  let pedido: PedidoDeRecuperacao | null = null;
  try {
    pedido = lerRecuperacaoDoEndereco(window.location.search, window.location.hash);
  } catch {
    return; // endereço estranho: segue como visita comum
  }
  if (!pedido) return;

  // Quem chega pelo link tem de cair na tela de senha nova, mesmo que este
  // navegador tenha um login guardado. É a interface quem decide isso, lendo
  // `recuperacaoEmAndamento()`. (Até 05/10/2026 aqui se apagava também a
  // sessão do app antigo, D64.)

  if (pedido.tipo === "erro") {
    estado = { tela: "recuperar", erro: pedido.mensagem };
    normalizarEndereco();
    return;
  }

  // Modo de demonstração: não há token de verdade. O link que o mock escreve no
  // console (`?recuperar=1&code=mock`) vale como link válido; a senha nova só é
  // aceita se um pedido de recuperação foi feito antes (ver mock/acesso.ts).
  if (isMock) {
    estado = { tela: "novaSenha" };
    normalizarEndereco();
    return;
  }

  // A sessão Supabase que este navegador já tinha também sai, ANTES de o cliente
  // nascer. Sem isso, um link inválido deixava a sessão antiga no lugar,
  // `getSession()` a devolvia, e a tela de senha nova abria — trocando a senha
  // de quem estava logado antes, não de quem pediu o e-mail.
  apagarSessaoSupabaseGuardada(window.localStorage);

  try {
    // Criar o cliente é o que faz o supabase-js ler o token do endereço;
    // `getSession()` espera essa leitura terminar. Como a sessão antiga já foi
    // apagada, sessão em mãos só pode ter vindo do link.
    //
    // O limite de tempo existe porque esta chamada acontece ANTES de a tela
    // montar (ver main.tsx): sem ele, rede ruim ou Supabase fora do ar deixam
    // a pessoa olhando uma tela branca, sem mensagem nem botão.
    const sessao = await comLimiteDeTempo(
      getSupabase().auth.getSession().then(r => r.data.session),
      LIMITE_MS,
    );
    estado = sessao
      ? { tela: "novaSenha" }
      : { tela: "recuperar", erro: LINK_INVALIDO };
  } catch (e) {
    // Sem rede, sem configuração, ou demorou demais: a tela pede outro e-mail.
    // Preferir uma tela com instrução a uma tela branca.
    estado = {
      tela: "recuperar",
      erro: e instanceof DemorouDemais ? LINK_DEMOROU : LINK_INVALIDO,
    };
  }
  normalizarEndereco();
}

/**
 * Apaga a sessão que o supabase-js guardou (`sb-<projeto>-auth-token`). Mantém
 * o `...-auth-token-code-verifier`: no fluxo PKCE é ele que troca o `code` do
 * link pela sessão nova, e apagá-lo quebraria a recuperação. Exportada para teste.
 */
export function apagarSessaoSupabaseGuardada(storage: Storage | undefined): void {
  try {
    if (!storage) return;
    const chaves: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const chave = storage.key(i);
      if (chave && /^sb-.+-auth-token$/.test(chave)) chaves.push(chave);
    }
    chaves.forEach(chave => storage.removeItem(chave));
  } catch { /* sem localStorage: não há sessão guardada para vazar */ }
}

/**
 * Devolve ao endereço o formato que o HashRouter espera ("#/" = tela de login)
 * e tira dele o token — que não deve ficar visível na barra nem no histórico.
 */
function normalizarEndereco(): void {
  try {
    window.history.replaceState(null, "", `${window.location.pathname}#/`);
  } catch { /* navegador sem history: o endereço fica como está */ }
}
