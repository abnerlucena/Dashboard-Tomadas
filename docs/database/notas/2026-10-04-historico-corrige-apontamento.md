# Histórico corrige o apontamento inteiro pelo `updateEntry`

> Data: 04/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Responde a [`2026-10-04-resposta-do-banco-historico.md`](2026-10-04-resposta-do-banco-historico.md).

## Em uma linha

Com a #28 na `main`, o "Editar" do Histórico corrige o apontamento inteiro pelo
`production.updateEntry`. Também entraram o import de `exigeOperadores` e a linha pelo
`Machine.process`. Nada muda no contrato.

## Como a tela usa o `updateEntry`

- **O que se corrige:** a lista de OPs (número, quantidade, retrabalho), data, turno,
  regime, nº de pessoas e observação. **Só vai o que mudou.** Se nada mudou, o botão Salvar
  fica desligado.
- **OPs:** a lista vai inteira quando qualquer OP muda. A observação de cada OP **volta
  igual** (`obs`): a tela não a edita, e não a perde.
- **Vazios:** observação vazia manda `obs: ""` (apaga). Nº de pessoas vazio, quando havia
  um gravado, manda `operatorCount: 0` (apaga). Sem nenhuma OP, manda lista vazia, e o
  diálogo avisa que o apontamento fica sem peça.
- **`IMPORTADO`:** só aceito se o apontamento já tinha OP `IMPORTADO`. Ela aparece só
  leitura, e dá para corrigir a quantidade. Num apontamento do app, a tela recusa antes de
  ir ao banco, como vocês.
- **Nº de pessoas obrigatório (D54):** a tela avisa antes, pela base vigente na data
  escolhida (`getMetasEm`). O erro de vocês continua valendo como rede.
- **Erros do banco** aparecem no diálogo **como vieram**, sem fechar: destino ocupado,
  formato da OP, permissão. Conferido no banco falso com a mensagem de destino ocupado no
  formato de vocês.
- **Mover/trocar turno em lote** continuam com `bulkMove`/`bulkEditTurno`. Obrigado pela
  correção da meta (D59).

## Mudança em `machines.ts` (compartilhado)

Só um campo opcional, aditivo: `ProductionRecordInfo.orders?: RecordOrder[]`. São as OPs
**exatamente como o contrato entrega** (`ordemId`, `quantidade`, `retrabalho`, `obs`),
preenchidas pelo `fromBackend.ts`. As linhas da tabela são derivadas, completam o total e
juntam a observação da OP com a do apontamento. Por isso não serviam de ponto de partida
para uma correção.

## Outros

- `lineOf(nome, process?)`: com `process`, a linha vem do banco. Sem ele (máquina
  cadastrada pelo app, que nasce sem `process`), a linha é deduzida pelo nome. A Granél
  continua "Granel" pelo nome.
- `exigeOperadores` vem de `src/lib/metas.ts`, e a cópia local foi apagada.
