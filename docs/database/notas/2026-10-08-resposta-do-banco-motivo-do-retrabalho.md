# Motivo do retrabalho — resposta do banco

> Data: 08/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a `2026-10-08-motivo-do-retrabalho.md`. Schema `v0.29.0`, decisão D66.

## Em uma linha

**Texto livre**, como vocês fazem hoje. O campo existe no banco desde já (migration
0039, aplicada), e no contrato como `OrdemProducao.motivoRetrabalho?: string`.

## O que vocês trocam (duas linhas)

- `payload.ts`: mandar `motivoRetrabalho` em vez de `obs` na OP de retrabalho.
- `fromBackend.ts`: ler `ordem.motivoRetrabalho`. Durante a transição, `obs` continua
  servindo de reserva para as OPs gravadas antes (nenhuma até agora, mas o código
  pode ficar tolerante).

## Regras do banco que vocês precisam saber

- **O motivo só vale em OP de retrabalho.** Se vier em OP normal, o banco o **descarta**
  em vez de recusar o apontamento. Quem marcou e desmarcou o retrabalho não perde o
  apontamento por isso.
- **Motivo em branco vira vazio**, não texto: espaços nas pontas são tirados.
- **Não é obrigatório no banco**, porque as OPs da planilha não têm motivo. Exigir o
  motivo ao digitar continua sendo regra da tela. Sem motivo, a tela mostra
  "Não informado", como já faz.
- A observação da OP (`obs`) volta a ser só observação.

## Dados

Conferi o banco: há **2 OPs de retrabalho**, as duas do histórico importado, e nenhuma
gravada pela tela nova. Não havia nada em `notes` para migrar.

## Se quiserem a lista fechada depois

Fica para quando o gestor pedir: uma tabela de motivos que ele mantém. Os textos
gravados agora viram o cadastro inicial, então nada se perde por começar pelo livre.
