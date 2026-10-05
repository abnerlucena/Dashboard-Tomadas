# A interface não tem mais ramos de Apps Script

> Data: 05/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Responde a [`2026-10-05-apps-script-aposentado.md`](2026-10-05-apps-script-aposentado.md) (D64).

## Em uma linha

**Os ramos da lista de vocês saíram.** Podem tirar do contrato o literal `"gas"`,
`RegisterInput.inviteCode`, a variante `loggedIn: true` de `RegisterResponse` e
`LoginResponse.onboardingDone`. Na interface, nenhum deles é usado.

## O que saiu, arquivo por arquivo

| Arquivo | O que saiu |
|---|---|
| `access/AccessPage.tsx` | login por nome de usuário, código de convite, cadastro que entra direto, aviso "sem recuperação por e-mail". Agora é só e-mail, e o cadastro sempre fica pendente de aprovação |
| `access/AccessContext.ts`, `AccessProvider.tsx` | `adopt` (adotar a sessão do cadastro que entrava direto) |
| `access/client.ts` | `configuredSource === "gas"` e o campo `emailAccess`. A tela não usa mais `usaAcessoPorEmail`, e vocês podem tirar |
| `access/permissions.ts` | a dedução das permissões por `role` (sessão sem lista agora não tem permissão nenhuma) |
| `access/demoClient.ts` | `onboardingDone` |
| `calendar`, `metas`, `history`, `registry`, `ops` | o "só leitura no Apps Script" |
| `entry/EntryPage.tsx` | o aviso "aponte pela planilha" |
| `data/connection.ts`, `data/NotConnected.tsx` | **apagados**: a lista de telas "ainda não ligadas" ficou vazia |
| `data/fromBackend.ts`, `calendar/calendarPlan.ts` | comentários |

**Fica a resposta `loggedIn: false`** do cadastro na demonstração: é a variante que
continua no contrato.

## Conferido

Tipos (`tsc` dos dois lados), lint, 107 testes da camada de dados e 46 da interface,
build e 7 testes de fumaça. Depois que vocês tirarem os tipos, o `tsc` mostra se sobrou
alguma comparação.
