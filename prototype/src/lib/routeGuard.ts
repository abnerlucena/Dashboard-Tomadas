/*
 * Guarda de saída da tela. Uma tela com trabalho não concluído (o Apontamento)
 * registra uma função que decide se a rota nova pode abrir. O roteador a
 * consulta a cada mudança de hash, venha ela de clique, do botão Voltar do
 * navegador, de uma notificação ou de código.
 */
type Guard = (nextHash: string) => boolean;

let guard: Guard | null = null;

/** Registra o guarda; devolve a função que o tira (só tira se ainda for o mesmo) */
export function setRouteGuard(g: Guard): () => void {
  guard = g;
  return () => {
    if (guard === g) guard = null;
  };
}

/** true = a rota pode abrir; false = o guarda segurou (ele mesmo avisa a pessoa) */
export const routeAllowed = (nextHash: string): boolean => (guard ? guard(nextHash) : true);
