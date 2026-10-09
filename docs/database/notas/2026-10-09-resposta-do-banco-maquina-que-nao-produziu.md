# Máquina que não produziu — resposta do banco

> Data: 09/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a `2026-10-09-maquina-que-nao-produziu.md`. Schema `v0.30.0`, decisão D67.

## Em uma linha

O campo existe, já aplicado no Supabase. O gestor decidiu: **texto livre**, e **só a
parada planejada sai da meta**. Quem diz se é planejada é a tela.

## O que o gestor decidiu

1. **Motivo em texto livre**, como o do retrabalho (D66). Os 6 motivos de vocês viram
   sugestão.
2. **Só a parada planejada sai da meta**, como o dia anulado. Hoje são planejadas:
   **Manutenção** e **Setup / troca**. Sem OP, Sem operador, Falta de material e
   Máquina parada **continuam contando** para a meta.

Com texto livre, o banco não tem como saber pelo texto se a parada é planejada. Por
isso **a tela manda a marcação** junto com o motivo.

## O contrato

```ts
// gravar (saveEntries)
{ ..., ordensProducao: [], motivoParada: "Manutenção", paradaPlanejada: true }

// corrigir (updateEntry)
{ motivoParada: "Falta de material", paradaPlanejada: false, ordensProducao: [] }
{ motivoParada: "" }          // tira a parada
{ paradaPlanejada: false }    // troca só a marcação

// ler (ProdRecord)
rec.motivoParada      // ausente = a máquina não parou
rec.paradaPlanejada   // true = o turno saiu da meta (countsTowardTarget é false e meta vem 0)
```

## Regras do banco

- **Parada só sem peças.** Mandar `motivoParada` junto com OPs com quantidade é
  recusado: *"Máquina que não produziu não tem peças. Tire as OPs ou desmarque 'Não
  produziu'."* No `updateEntry`, mande `ordensProducao: []` junto se o apontamento
  tinha peças.
- **Lançar peças depois tira a parada sozinho.** Vocês **não precisam mais** chamar
  `updateObs(id, "")` para apagar a observação: basta mandar as OPs.
- **Máquina parada não exige o nº de operadores**, nem na A Granél (D54). A parada
  "Sem operador" com 0 pessoas é aceita.
- `motivoParada` ausente mantém o que estava. `""` tira a parada.
- A observação (`obs`) volta a ser só observação, e a parada não aparece mais em
  Feedbacks.

## Dados

Não havia nada a migrar: nenhum apontamento sem peças nem com "Não produziu:" na
observação. Durante a transição, `parseStop` pode continuar lendo a observação como
reserva, mas o banco de produção não tem nenhum caso.

## O que muda nos números

A parada planejada passa a sair da conta do atingimento. Quem soma metas pela leitura
já recebe `meta: 0` e `countsTowardTarget: false` nesses turnos, como no dia anulado.
Não há conta nova a fazer.
