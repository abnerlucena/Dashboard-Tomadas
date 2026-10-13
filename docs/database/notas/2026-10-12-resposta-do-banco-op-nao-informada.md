# OP não informada — resposta do banco

> Data: 12/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a `2026-10-12-op-nao-informada.md`. Schema `v0.31.0`, decisão D68.

## Em uma linha

O banco já aceita a OP sem número (migration 0041, aplicada). **A #51 pode entrar como
está**: o `0` que vocês mandam hoje também vira "não informada", e a OP `0` nunca nasce.

## O que o banco faz agora

- Número **vazio, ausente ou só zeros** (`""`, `"0"`, `"000"`) → a linha grava com a OP
  **nula**. As peças contam normalmente.
- OP não informada **não cria OP** na aba OPs, então não há a OP `0` juntando máquinas.
  Conferido antes de aplicar: ela não existia, e não há nada a limpar.
- Número **digitado** continua conferido (só números, até 15). A mensagem de erro agora
  termina com "ou deixe em branco".
- O cadastro da aba OPs recusa OP só de zeros.
- **Leitura:** a OP nula chega como `ordemId: ""`.

## O que vocês podem trocar (sem pressa)

- `NO_OP` pode passar de `"0"` para `""`. Na leitura, o que vem do banco já é `""`, e
  nenhum apontamento novo vai trazer `"0"` de volta.
- `opLabel("")` → "Não informado". Hoje vocês tratam o `"0"`; o `""` é o que vai chegar.

## A sugestão maior: o distribuidor quase não digitar

O gestor contou que o tempo vai na **digitação** do número, que é longo, multiplicada
pelas máquinas e OPs do turno. O que mais ajuda, e é de vocês:

1. **Sugerir a OP do último apontamento da mesma máquina.** A mesma OP costuma rodar
   vários turnos seguidos. O campo já vem preenchido com a OP do turno anterior daquela
   máquina, e o distribuidor só confirma. Digita só quando a OP muda. Os dados já
   estão carregados na tela (`ALL_ORDERS`, por máquina e data). Somado à "OP liberada
   já escolhida" (etapa A), o caso comum fica com zero digitação.
2. **"Sem OP" no Histórico:** um filtro dos apontamentos com OP não informada, para quem
   tem o número completar depois (o `updateEntry` já troca as OPs).

E para o futuro, a ser confirmado na fábrica: se o SAP exportar a lista de OPs
liberadas em planilha, ela entra pela `importar_ops_do_sap` (D62) sem digitação, e a
lista do Apontamento passa a ter todas as OPs.
