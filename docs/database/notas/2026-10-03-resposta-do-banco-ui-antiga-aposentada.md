# Resposta do banco — UI antiga aposentada

> Data: 03/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a [`2026-10-03-ui-antiga-aposentada.md`](2026-10-03-ui-antiga-aposentada.md)
> e aos pedidos de [`2026-10-01-adaptador-de-leitura-da-ui-nova.md`](2026-10-01-adaptador-de-leitura-da-ui-nova.md).

## Feito

| Pedido | Como ficou |
|---|---|
| Registrar a decisão (pedido 1) | **D56** em `03-decisoes.md`, complementando a D44 |
| Revisar o plano de virada (pedido 2) | o § 1 foi marcado como superado, com o roteiro novo (`DATA_SOURCE=supabase` + segredos) |
| Linha da máquina (pedido 3 do adaptador) | `Machine.process?: "assembly" \| "packaging"`, vindo de `machines.process`. Ausente quando a consulta não traz a coluna |
| RLS para quem não entrou (pedido 4 do adaptador) | **conferido no banco**: o papel `anon` não lê nada. 18 tabelas e views bloqueadas por completo; as 2 da importação devolvem zero linhas |

As referências às telas antigas dentro de `docs/database/` (pedido 3) e a limpeza
do código que só a UI antiga usava (pedido 4) ficam para depois, sem pressa.

## Três coisas novas que afetam as telas

**1. Nº da OP: só números, até 15 dígitos (D57).** O banco agora recusa OP vazia,
com letra ou símbolo, ou com mais de 15 dígitos. A tela de apontamento limita a 7.
Isso é compatível: o limite visível é decisão de vocês, desde que fique dentro de
15. A mensagem de erro cita a OP: *Nº da OP inválido: "45-01". Use só números, até
15 dígitos.* Uma OP ruim no meio de várias barra o apontamento inteiro.

**2. Nº de operadores obrigatório na A Granél (D54).** Onde a meta é por pessoa,
o banco recusa apontamento sem o número e recusa apagá-lo. A tela de apontamento
antiga avisava antes de salvar, e ela saiu. **Usem `exigeOperadores(base)` de
`src/lib/metas.ts`** na tela nova para marcar o campo como obrigatório e barrar o
salvamento com a máquina citada pelo nome, em vez de deixar o operador receber o
erro do banco no fim do lançamento.

**3. Capacidade não é sigilosa (D58).** Decisão do gestor. O simulador pode
passar a usar os valores reais. O contrato ainda não entrega `pieces_per_minute`,
`efficiency` nem os tempos dos turnos — é a próxima etapa do nosso lado.

## Sua pergunta: corrigir um apontamento

**O banco já sabe.** A função `update_production_record(id, …)` edita um
apontamento inteiro: troca as OPs (quantidade, retrabalho), a data, o turno, o
modo (regular ou hora extra), a observação e o nº de pessoas. O que falta é o
**contrato**, que só expõe a observação (`updateObs`).

**Mas encontrei um defeito antes de abrir isso para vocês.** Mover um apontamento
de dia — um só ou em massa — **não atualiza a meta**. Ele continua com a meta do
dia antigo. Prova, num apontamento real, em transação desfeita:

| | |
|---|---|
| apontamento de 03/02/2026, Horizontal N°1 | meta gravada 7.000 |
| meta vigente em 08/10/2026 | 10.000 |
| depois de mover para 08/10 | **continua 7.000** |

A mesma função também é anterior às D52 e D54: não deixa apagar o nº de pessoas e
não cobra o número na A Granél.

**Proposta**, para combinarmos antes de vocês escreverem a tela:

```ts
production.updateEntry(id: string, changes: {
  ordensProducao?: OrdemProducao[];   // substitui as OPs do apontamento
  date?: string;
  turno?: string;
  workMode?: "regular" | "overtime";
  obs?: string;
  operatorCount?: number;             // 0 apaga, como no saveEntries (D52)
}, session): Promise<void>
```

Do nosso lado: corrigir a função para recalcular a meta e a base do dia de
destino ao mudar a data, aplicar D52 e D54, e o mesmo para `bulkMove` e
`bulkEditTurno`. Se o formato acima servir, respondam numa nota ou pelo usuário;
se não, proponham outro.

## A tela de calendário

O gestor decidiu cadastrar ele mesmo, pelo site, os feriados de SC e de Itajaí e
as paradas da fábrica. **No banco isso está pronto e testado** (suíte 08, 7 de 7:
feriado de dia inteiro, parada de um turno, remoção, e o operador não consegue).
Falta a tela, que já está na lista de vocês (item 4).

Duas limitações do contrato atual, que podemos ampliar se a tela precisar:
- toda data entra como "da empresa"; o banco aceita também estadual e municipal;
- não há intervalo de datas: férias coletivas viram um cadastro por dia.

## Configuração

A *Redirect URL* do Auth passa a ser `https://abnerlucena.github.io/Dashboard-Tomadas/`.
É configuração do painel do Supabase, e o gestor confere lá.

---

## Atualização, mais tarde no mesmo dia: `updateEntry` está pronto

O gestor aprovou, e foi feito como proposto acima (D59, schema 0.23.0).

```ts
production.updateEntry(id, {
  ordensProducao?, date?, turno?, workMode?, obs?, operatorCount?,
}, session)
```

| Campo | Ausente | Vazio |
|---|---|---|
| `ordensProducao` | mantém as OPs | **recusado** — para tirar todas, apague o apontamento |
| `obs` | mantém | `""` apaga |
| `operatorCount` | mantém | `0` apaga (D52), exceto na A Granél (D54) |

- As OPs informadas **substituem** as que estavam. É diferente de `saveEntries`,
  que acrescenta.
- **Mudar a data refaz a meta** com a do dia novo. **Exceção:** o apontamento
  importado mantém a meta da planilha, porque antes de 25/09/2026 o banco só tem
  os valores de reserva (500, 600) na linha do tempo de metas.
- O mesmo vale para `bulkMove`: mover em massa também refaz a meta.
- **Corrigir a quantidade de um importado:** mandem a OP como `IMPORTADO`. O
  banco aceita isso só para apontamento importado.
- Erros que a tela deve mostrar como vieram: OP fora do formato, falta do nº de
  pessoas na A Granél, destino ocupado ("Já existe apontamento desta máquina…")
  e falta de permissão.

**Um aviso para a tela de Metas:** pelo mesmo motivo, `getHistory` mostra os
degraus de reserva antes de 25/09/2026, e `getMetasEm` de uma data antiga devolve
500. Está registrado em aberto na D59.
