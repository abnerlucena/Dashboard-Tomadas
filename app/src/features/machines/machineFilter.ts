/*
 * Filtro de máquinas do Histórico: quais máquinas entram na conta. Dá para tirar
 * algumas ("sem as kits parafusos") ou deixar só algumas. Vive no endereço, para
 * dar para guardar ou mandar o link:
 *   #/historico                 todas
 *   #/historico/<id>            só uma (o "Histórico da máquina" do Dashboard)
 *   #/historico/sem:<ids>       todas, menos as listadas
 *   #/historico/so:<ids>        só as listadas
 * Os ids vão separados por vírgula. Id que não existe é ignorado.
 */

export const EXCLUDE_PREFIX = "sem:";
export const ONLY_PREFIX = "so:";

const idsOf = (list: string, allIds: string[]) => {
  const valid = new Set(allIds);
  return list
    .split(",")
    .map((s) => s.trim())
    .filter((s) => valid.has(s));
};

/** O conjunto de máquinas na conta, a partir do pedaço do endereço depois de "#/historico/" */
export function parseMachineFilter(param: string | undefined, allIds: string[]): Set<string> {
  const all = new Set(allIds);
  if (!param) return all;
  if (param.startsWith(EXCLUDE_PREFIX)) {
    const out = new Set(idsOf(param.slice(EXCLUDE_PREFIX.length), allIds));
    return out.size ? new Set(allIds.filter((id) => !out.has(id))) : all;
  }
  if (param.startsWith(ONLY_PREFIX)) {
    const only = idsOf(param.slice(ONLY_PREFIX.length), allIds);
    return only.length ? new Set(only) : all;
  }
  return all.has(param) ? new Set([param]) : all;
}

/** O pedaço do endereço que guarda o filtro; null quando todas as máquinas estão na conta */
export function filterToken(included: ReadonlySet<string>, allIds: string[]): string | null {
  const inc = allIds.filter((id) => included.has(id));
  const out = allIds.filter((id) => !included.has(id));
  if (!out.length) return null;
  if (inc.length === 1) return inc[0];
  // O lado menor deixa o link curto
  return out.length <= inc.length ? `${EXCLUDE_PREFIX}${out.join(",")}` : `${ONLY_PREFIX}${inc.join(",")}`;
}

/** Texto do botão do filtro */
export function filterLabel(included: ReadonlySet<string>, machines: Array<{ id: string; name: string }>): string {
  const inc = machines.filter((m) => included.has(m.id));
  if (inc.length === machines.length) return "Todas";
  if (!inc.length) return "Nenhuma";
  if (inc.length === 1) return inc[0].name;
  const out = machines.length - inc.length;
  return out <= inc.length ? `Sem ${out} ${out === 1 ? "máquina" : "máquinas"}` : `${inc.length} máquinas`;
}
