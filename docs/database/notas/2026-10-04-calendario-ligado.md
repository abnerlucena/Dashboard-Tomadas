# Calendário: tela nova, ligada ao banco

> Data: 04/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Continua a [passagem de 04/10](2026-10-04-passagem-da-sessao-da-interface.md), item 1.

## Em uma linha

A tela **Calendário** (`#/calendario`) lê e grava pelo contrato de hoje
(`getHolidays`, `addHoliday`, `removeHoliday`). Não precisou de mudança no contrato nem
no banco.

## Como a tela usa o contrato

| O que a pessoa faz | Contrato |
|---|---|
| Ver os dias do ano, agrupados por mês | `getHolidays` (abrir a tela e depois de cada gravação) |
| Cadastrar um dia, ou um intervalo (férias coletivas, ponte) | `addHoliday` **uma vez por dia**, em sequência. Opção de pular sábado e domingo. Teto de 62 dias por cadastro |
| Só alguns turnos | `shiftIds` (vazio = dia inteiro) |
| Remover um dia, ou vários marcados | `removeHoliday` um por um |
| Depois de gravar | `reloadBackendData`: os dias úteis das outras telas vêm do calendário |

- **Tipos oferecidos:** "Feriado" (`holiday`) e "Dia anulado" (`excluded_day`). O texto
  da tela segue a D16: feriado é contexto e sai dos dias úteis previstos, mas a produção
  dele conta; dia anulado tira o dia ou o turno da meta, **inclusive de apontamentos já
  feitos** (`production_summary.is_excluded_day` é calculado na leitura). Se isso não for
  verdade, me avisem, porque a tela diz isso ao cadastrar e ao remover.
- **`special_event`** aparece como "Evento", e a tela não cadastra esse tipo.
- **Repetido:** a tela não manda um dia que já tem cadastro do mesmo tipo cobrindo os
  mesmos turnos (dia inteiro cobre qualquer turno). Tipos diferentes no mesmo dia vão
  (D16).
- **Erro no meio de um intervalo:** a tela para no primeiro erro, diz quantos dias já
  foram e recarrega. Não desfaz os que entraram.
- **Permissões:** abrir a tela pede `dashboard.view`, e cadastrar ou remover pede
  `calendar.manage`. No modo Apps Script, fica só leitura.

## Pedidos, sem pressa (nada bloqueia)

1. **Cadastro em intervalo atômico.** Hoje um intervalo são N chamadas. Se a 5ª falhar,
   as 4 primeiras ficam. Um `addHolidays(dates[], label, type, shiftIds?)` em uma
   transação (ou `addHoliday` com `dateTo?`) resolveria. É o mesmo pedido da nota de 03/10.
2. **`scope`.** Tudo entra como `company`. Se quiserem separar estadual e municipal
   (feriados de SC e de Itajaí), proponham o campo no tipo e a tela ganha um seletor.

## Outros (só para saber)

- `e2e/support/banco-falso.mjs` agora grava no calendário (`window.__calls`, e o 31/12
  simula erro de permissão) e funciona no Windows: o caminho `/@fs/` saía sem a barra
  antes da letra do disco.

## Atualização (04/10, depois da resposta de vocês)

Com a #30 na `main`, a tela passou a usar o `addHolidays`: **uma chamada** para o
intervalo inteiro, com os dias que a tela escolheu (sem fim de semana, se pedido). Se der
erro, o diálogo diz que nenhum dia entrou. O diálogo ganhou a **Abrangência**, com os
rótulos sugeridos (padrão "Da empresa"), e a lista mostra a abrangência de cada dia. A
permissão `work_orders.manage` entrou no catálogo da tela.
