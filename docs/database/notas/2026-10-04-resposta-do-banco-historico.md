# Resposta do banco — Histórico e `updateEntry`

> Data: 04/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a [`2026-10-03-historico-e-updateentry.md`](2026-10-03-historico-e-updateentry.md).

## O defeito do mover já está corrigido no banco

Vocês pediram prioridade, e o contrato não muda. **`bulkMove` e `bulkEditTurno`
já levam a meta do dia novo**: as migrations estão aplicadas no banco de
produção (D59). A tela não precisa de nada.

## O `updateEntry` está no contrato (PR #28)

Os quatro pontos de vocês, como ficaram:

| Ponto | Como está |
|---|---|
| 1. `obs`: ausente mantém, `""` apaga | ✅ e escrito no comentário do tipo, com o aviso de que é o **contrário** do `saveEntries` de propósito |
| 2. Lista de OPs vazia vale | ✅ aceita: tira todas as OPs e o apontamento continua, sem peça. Eu tinha recusado; vocês estavam certos, e o `saveEntries` só com observação já cria apontamento sem OP |
| 3. Destino ocupado recusa citando o destino | ✅ *"Já existe apontamento da EMBALADORA HORIZONTAL N°1 em 08/10/2026, Turno 2. Corrija ou apague aquele antes."* O mesmo vale em massa, citando o primeiro choque |
| 4. Meta recalculada, D52 e D54 | ✅ ao mudar a **data**. Mudar o **modo** (hora extra) não muda a meta: ela é do dia. A hora extra só fica fora do atingimento, e isso é calculado na leitura (`counts_toward_target`) |

Duas coisas que a tela precisa saber:
- **Apontamento importado:** a OP dele é `IMPORTADO`. Para corrigir a quantidade,
  mandem a OP como `IMPORTADO`. O banco aceita isso **só** em apontamento
  importado; num apontamento do app, `IMPORTADO` é recusado (D57).
- **Erros para mostrar como vieram:** OP fora do formato, falta do nº de pessoas
  na A Granél, destino ocupado e falta de permissão.

## As metas antigas passaram a ser as reais (D60)

Antes de 25/09/2026, a linha do tempo de metas tinha os valores de reserva do
app antigo (500, 600…). Agora ela vem da planilha. Para a tela de **Metas**:

- **`getHistory`** mostra os degraus reais. Exemplo: Horizontal N°1 com 7.000
  desde 03/02, 8.000 desde 02/03 e 10.000 desde 25/09.
- **`getMetasEm(data)`** de uma data antiga devolve a meta daquela época.

Os degraus antigos não têm autor (`createdBy` vazio): vieram da planilha, não de
alguém do app.

## Outros pontos da nota

- **`Machine.process`** e **`exigeOperadores`**: entram na `main` com a #28.
- **Calendário com intervalo (`dateTo`)**: anotado para quando chegarem à tela.
  Não bloqueia.
