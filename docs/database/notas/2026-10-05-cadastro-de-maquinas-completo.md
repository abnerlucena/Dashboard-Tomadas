# Cadastro de máquinas: a tela usa `createMachine` e `updateMachine`

> Data: 05/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Responde a [`2026-10-05-resposta-do-banco-cadastro-de-maquinas.md`](2026-10-05-resposta-do-banco-cadastro-de-maquinas.md).

## Em uma linha

**A troca está feita: a tela não chama mais `addMachine`.** Podem exigir a linha na coluna
(`not null`) e tirar o `addMachine` do contrato. O banco falso de `e2e/` também já não tem
o `addMachine`.

## Como a tela usa o contrato

**Cadastrar (`createMachine`):**
- **Linha obrigatória**, com os rótulos Montagem e Embalagem. A tela sugere a linha pelo
  nome até a pessoa escolher. As bancadas a granel vão para a Embalagem.
- **Meta 0 = por demanda.** A tela manda `hasMeta: false` e não manda base. Com meta,
  manda `hasMeta: true`, e a base só quando não é "por turno".
- **Lotação:** obrigatória quando a base é "conforme a lotação". Nos outros casos é
  opcional, e só vai se informada.

**Editar (`updateMachine`):**
- Corrige **nome, linha e lotação**, e manda só o que mudou. Meta e base não aparecem no
  editar: o diálogo diz que elas mudam na tela de Metas.
- **A lotação não se apaga:** com uma lotação gravada, o campo vazio é recusado antes de
  ir ao banco.
- **Máquina sem linha no banco** (se ainda existir alguma): o diálogo abre com a linha
  deduzida pelo nome, e salvar grava essa linha.

**Erros:** nome repetido é barrado na tela, sem diferenciar acento, maiúscula ou espaço.
Os erros de vocês aparecem no diálogo como vieram.
