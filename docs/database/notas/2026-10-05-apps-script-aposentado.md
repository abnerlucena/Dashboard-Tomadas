# Apps Script aposentado — o que falta do lado da interface

> Data: 05/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Decisão D64.

## Em uma linha

O gestor confirmou que a fábrica **não usava** o Apps Script nem o app antigo: a
produção é registrada à mão na planilha `.xlsx`. O `Main.gs` e a camada que falava
com ele saíram do repositório. **Faltam os ramos "se for Apps Script" nas telas de
vocês.**

## O que saiu do lado do banco

- `Main.gs` e `src/lib/repositories/gas.ts`.
- `src/lib/api.ts` ficou **só com os tipos** (`Session`, `Machine`, `Holiday`,
  `ProdRecord`, `OrdemProducao`). Vocês só importavam tipos de lá, então nada muda.
- O **padrão** da camada de dados passou a ser o **Supabase**. Com
  `VITE_DATA_SOURCE=gas`, a camada entrega o Supabase.
- Operações que só o Apps Script tinha, e que vocês não chamavam: `adminCreateUser`,
  `resetPassword`, `generateInviteCode`, `completeOnboarding` e o grupo `alerts`.
- O `clearSession`, que apagava a sessão e o cache do **app antigo**
  (`prod_session_v3`). É o efeito colateral que vocês apontaram na nota de 01/10 e
  deixou de existir.

Conferido: tipos da interface, os 35 testes dela, o lint e o **build**. O pacote
publicado não leva mais o endereço do script.

## O que ficou, só para a interface compilar

| No contrato | Por que ficou | Quem usa |
|---|---|---|
| `"gas"` em `DataSourceKind` e em `Session.source` | comparar com um literal fora do tipo é erro do TypeScript | os ramos abaixo |
| `RegisterInput.inviteCode` (`@deprecated`) | | `AccessPage.tsx:329` |
| `RegisterResponse` com `loggedIn: true` | o cadastro do Apps Script "entrava direto" | `AccessPage.tsx:333` |
| `LoginResponse.onboardingDone` (agora opcional, `@deprecated`) | | `demoClient.ts:214, 216` |

## O que pedimos que vocês tirem

Os ramos "se for Apps Script", conferidos em 05/10:

| Arquivo | O ramo |
|---|---|
| `features/access/client.ts:81` | aceita `configuredSource === "gas"` |
| `features/access/AccessPage.tsx:23–24, 62–63, 79–80, 133–146, 180, 207, 328–333` | login por nome de usuário, código de convite, cadastro que entra direto |
| `features/access/AccessContext.ts:17` | comentário do cadastro que entra direto |
| `features/access/permissions.ts:76, 130` | dedução do perfil para o Apps Script |
| `features/calendar/CalendarPage.tsx:75–76` | só leitura no Apps Script |
| `features/entry/EntryPage.tsx:299–307` | aviso "aponte pela planilha" no Apps Script |
| `features/history/HistoryPage.tsx:70–73` | só leitura no Apps Script |
| `features/metas/MetasPage.tsx:70–72` | só leitura no Apps Script |
| `features/registry/MachineRegistryPage.tsx:47–48` | só leitura no Apps Script |
| `data/fromBackend.ts:115` | comentário sobre a fonte Apps Script |
| `features/access/demoClient.ts:214, 216` | `onboardingDone: true` |

**Quando tirarem, me avisem**, e eu tiro do contrato o literal `"gas"` e os três
campos obsoletos. O `tsc` vai mostrar se sobrou alguma comparação.

## Para depois, sem pressa: os formatos herdados

O contrato ainda devolve os dados no formato do Apps Script (status "ativo"/"inativo",
turno "TURNO 1", `savedAt` em texto, `getMetas` com `metas?`). Vocês convertem a partir
deles. Simplificar é mudar o contrato dos dois lados ao mesmo tempo. Se quiserem,
proponham o tipo numa nota e fazemos juntos.
