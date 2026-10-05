# Resposta do banco — cadastro de máquinas

> Data: 05/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a [`2026-10-04-cadastro-de-maquinas.md`](2026-10-04-cadastro-de-maquinas.md)
> e à [`2026-10-04-historico-corrige-apontamento.md`](2026-10-04-historico-corrige-apontamento.md).

## O Histórico: conferido e mesclado

A #29 foi mesclada junto com a #30. Antes de mesclar, montei as duas juntas num branch
de ensaio e rodei tipos, testes e lint. O uso do `updateEntry` bate com o contrato, e
a mudança em `machines.ts` (`orders` e `inactive`) só acrescenta campos opcionais.

## As três perguntas: o gestor respondeu (D63, schema 0.27.0)

| Pergunta | Resposta |
|---|---|
| 1. Meta 0 com `has_target = true` | **Meta 0 é "por demanda".** Sem `hasMeta`, o banco deduz da meta. As combinações contraditórias são **recusadas** ("com meta" e 0; "por demanda" e meta > 0) |
| 2. `process` no cadastro | **Obrigatório.** Máquina sem linha some dos agrupamentos |
| 3. Editar nome e lotação | **Sim.** E a linha também |

## O contrato

Optei por **funções novas** em vez de sobrecarregar `addMachine`, como vocês sugeriram
que também servia:

```ts
machines.createMachine(input: NewMachineInput, session): Promise<number>   // devolve o id
machines.updateMachine(id: number, changes: MachineChanges, session): Promise<void>

interface NewMachineInput {
  name: string;
  process: "assembly" | "packaging";     // obrigatória
  defaultMeta: number;                   // 0 = por demanda
  hasMeta?: boolean;                     // ausente = deduzido da meta
  standardOperatorCount?: number;        // obrigatória se basis = "per_shift_prorated"
  basis?: BaseDaMeta;                    // ausente = per_shift
}
interface MachineChanges { name?: string; process?: MachineProcess; standardOperatorCount?: number }
```

## O que muda para a tela

**Por favor, troquem `addMachine` por `createMachine`.** A linha obrigatória está
em dois passos para não quebrar a tela de vocês:

1. **Agora:** `createMachine` exige a linha no tipo. O `addMachine` continua funcionando,
   marcado como `@deprecated`, e meta 0 por ele já vira por demanda.
2. **Quando a tela trocar:** me avisem, e o banco passa a exigir a linha (`not null` na
   coluna). O `addMachine` sai do contrato.

Mensagens que a tela deve mostrar como vieram:
- "Máquina com meta precisa de meta maior que zero. Para máquina por demanda, cadastre sem meta."
- "Máquina por demanda não tem meta. …"
- "Para a meta conforme a lotação, informe a lotação padrão."
- "Já existe uma máquina com o nome "…"." (no editar)

Na edição: **meta e base não mudam por aqui**, porque têm vigência e mudam pela tela de
Metas. **A lotação não se apaga**, só se troca por outro número maior que zero, porque é
o divisor da meta rateada.
