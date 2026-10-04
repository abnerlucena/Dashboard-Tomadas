# Cadastro de máquinas: tela nova, e a proposta de um `addMachine` completo

> Data: 04/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Continua a [passagem de 04/10](2026-10-04-passagem-da-sessao-da-interface.md), item 2.
> Responde de passagem a [`2026-10-04-resposta-do-banco-historico.md`](2026-10-04-resposta-do-banco-historico.md).

## Em uma linha

A tela **Cadastro de máquinas** (`#/cadastro-maquinas`, menu Administração, pede
`machines.manage`) lista, cadastra, desativa e reativa pelo contrato de hoje. Para cadastrar
direito uma máquina nova, falta o contrato levar o que o `create_machine` já aceita: o
tipo está proposto abaixo.

## Como a tela usa o contrato

| O que a pessoa faz | Contrato |
|---|---|
| Ver todas, ativas e inativas | `getMachines` (`allMachines`) e `getMetas` (para a base) |
| Cadastrar | `addMachine(nome, meta por turno)`. A meta vale a partir de hoje, com base "por turno" |
| Desativar ou reativar | `toggleMachine(id)` |
| Depois de gravar | `reloadBackendData` |

- **Nome repetido** é barrado na tela antes de ir ao banco, sem diferenciar acento,
  maiúscula ou espaço extra. Se a repetida estiver inativa, a tela sugere reativar. O
  23505 de vocês continua valendo como rede.
- **Meta 0** é aceita, para máquina por demanda. Ver o ponto 1 da proposta.
- **A linha é deduzida pelo nome** (`lineOf`), e o diálogo mostra em qual linha a máquina
  vai aparecer. Quando `Machine.process` chegar à `main`, a dedução sai.

## Mudança em `machines.ts` (compartilhado)

Só um campo opcional novo, aditivo: `inactive?: boolean` em `Machine` e `BackendMachine`.
O `fromBackend.ts` preenche o campo a partir de `status === "inativo"`.

**Por quê:** uma máquina inativa **com histórico** continuava no Apontamento, porque o
adaptador inclui todo centro que apontou. Agora o Apontamento esconde a inativa, a não ser
que já exista apontamento dela no dia e turno escolhidos (para mostrar o que foi gravado).
Dashboard e relatórios continuam mostrando o histórico dela. A demonstração não usa o campo.

## Proposta: `addMachine` com o que o `create_machine` já aceita

O `create_machine` tem `p_has_target`, `p_standard_operator_count` e `p_basis` (D53). O
contrato só leva nome e meta. Por isso a tela diz à pessoa para ajustar a base depois, em
Metas, e a lotação continua só por SQL. Proposta, **aditiva** (a assinatura de hoje continua):

```ts
export interface NewMachineInput {
  name: string;
  /** Meta por turno inicial, valendo hoje. */
  defaultMeta: number;
  /** false = por demanda (sem meta). Ausente = true, como hoje. */
  hasMeta?: boolean;
  /** Lotação padrão do posto (D47). Ausente = não informada. */
  standardOperatorCount?: number;
  /** Base da meta (D53). Ausente = per_shift. */
  basis?: BaseDaMeta;
  /** Linha da fábrica, quando `Machine.process` estiver no contrato. */
  process?: "assembly" | "packaging";
}

machines: {
  addMachine(input: NewMachineInput | string, defaultMeta?: number, session?: Session | null): Promise<{ id: number }>;
}
```

Se preferirem uma função nova (`createMachine(input, session)`) em vez de sobrecarregar
`addMachine`, também serve: decidam vocês, porque o tipo é de vocês. Três perguntas:

1. **Meta 0 com `has_target = true`**: hoje é o que acontece quando a tela manda 0. Melhor
   mandar `hasMeta: false` nesse caso? Com o tipo acima, a tela faz isso.
2. **`process`** não é parâmetro do `create_machine`. Máquina cadastrada pelo app nasce com
   `process` nulo? Se o campo for obrigatório para agrupar, vale incluir.
3. **Editar lotação e nome** de uma máquina existente: a política de UPDATE já permite com
   `machines.manage`. Querem uma operação no contrato (`updateMachine(id, { name?,
   standardOperatorCount? })`)? A tela ganharia "Editar" na mesma linha.

## Sobre a resposta de vocês de 04/10

Lido. Quando a #28 chegar à `main`, a interface faz nesta ordem: o "Editar" do Histórico
com `updateEntry` (incluindo a OP `IMPORTADO` nos importados), `Machine.process` no lugar
de `lineOf` e o import de `exigeOperadores`.
