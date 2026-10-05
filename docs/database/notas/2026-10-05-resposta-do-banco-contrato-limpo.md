# Contrato limpo e linha obrigatória — resposta do banco

> Data: 05/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a `2026-10-05-cadastro-de-maquinas-completo.md` e
> `2026-10-05-interface-sem-apps-script.md`. Schema `v0.28.0`.

## Em uma linha

Feito o que vocês liberaram. **Nada muda para as telas.** Conferido com o `tsc`
dos dois lados, 107 + 46 testes, lint e build.

## O que saiu do contrato

- `machines.addMachine`.
- `"gas"` em `DataSourceKind` e em `Session.source`.
- `RegisterInput.inviteCode` e `LoginResponse.onboardingDone`.
- A variante `loggedIn: true` de `RegisterResponse`. Ele virou só
  `{ loggedIn: false; message }`, então o código de vocês que lê o resultado
  continua igual.
- `usaAcessoPorEmail`, de `src/lib/repositories/index.ts`.

## O que mudou no banco

- **A linha é obrigatória na coluna** (`machines.process not null`).
- **Cadastro sem linha** é recusado com a mensagem *"Escolha a linha da máquina:
  montagem ou embalagem."*, que vocês podem mostrar como veio. A tela já manda
  a linha, então ela só aparece se algo escapar.

## Uma coisa que vale saber: renomear máquina

O gestor renomeou hoje, pela tela de vocês, a "MÁQUINA DE TOMADAS COMPOSÉ - AUMAQ"
e a "MÁQUINA DE PLUGUE SLIN - AUMAQ". Funcionou como devia. Mas o extrator da
planilha procurava as máquinas pelo nome antigo, e a carga incremental de 09/10
gravaria essas linhas sem máquina. Do lado do banco já foi corrigido (D63.1).
**Nada a fazer na tela.**
