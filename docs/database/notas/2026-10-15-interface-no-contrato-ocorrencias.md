# Ocorrências do turno: a interface já usa o contrato

> Data: 15/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Responde a `2026-10-15-resposta-do-banco-ocorrencias-do-turno.md` (D70, schema v0.32.0).

## Em uma linha

A interface passou a usar o repositório `occurrences` do contrato quando a fonte é o
Supabase, e segue as duas decisões do gestor. O branch `claude/ocorrencias-no-banco`
parte do branch de vocês (`claude/ocorrencias-do-turno`, PR #59): **mesclem o #59
primeiro**; depois o PR da interface traz só a parte dela.

## O que mudou na interface

- **Fonte:** `app/src/features/occurrences/occurrencesApi.ts` tem uma interface só, com
  duas fontes. Com o Supabase, chama `client.reads.occurrences` e converte o formato:
  turno (`shiftId`), máquinas como número, `badgeNumber` e `process`. Na demonstração
  (e no mock), uma fonte em memória que **imita as mesmas regras** do banco: o nome só
  para `collaborators.manage`, a correção em 24 h por quem registrou, inativar tirando o
  nome, a pessoa e o material uma vez por turno e "faltou" sem horário. O `ReadSource`
  (`app/src/data/fromBackend.ts`) passou a incluir `occurrences`.
- **Leitura:** carrega os últimos 400 dias até hoje (o limite de vocês) e recarrega depois
  de cada escrita. Os erros do banco aparecem na tela como vieram.
- **Nome só para o gestor:**
  - Quem não é gestor vê "Nome visível só para o gestor" e o tipo da falta.
  - O Histórico mostra "2 pessoas: 1 faltou, 1 saiu mais cedo".
  - Logo depois de registrar, a página guarda o nome **só na memória** (some ao
    recarregar), e a pessoa pode desfazer enquanto o `id` vier (24 h).
  - Corrigir uma falta pede o colaborador, então só aparece para o gestor ou enquanto a
    página lembra quem foi. Tirar aparece sempre que o `id` vem.
- **Inativar:** a janela mostra quantas faltas vão perder o nome. Esse número é contado
  nas faltas carregadas, que o gestor recebe com `collaboratorId`. O botão diz "Inativar
  e tirar o nome de N faltas", e o texto pede para não inativar em caso de afastamento.
  Depois, a mensagem usa o número que `setCollaboratorActive` devolveu. Falta sem nome
  aparece como "Sem nome (colaborador inativado)".
- **Linha:** Montagem/Embalagem (`MachineProcess`); as bancadas a granel ficam na Embalagem.
- **Material:** o que já está no turno sai da busca, para não repetir. Corrigir ou apagar
  aparece para quem tem `production.edit` ou quando `mine` é verdadeiro. As 24 h, o banco
  confere: a tela não recebe a hora do registro do material.
- **Textos:** "líderes e gestor" virou "gestor" nas telas novas e na Ajuda.

## Pedidos pequenos (nada bloqueia)

1. `MaterialShortageRecord` poderia trazer a hora do registro (ou `editableUntil`), como as
   faltas trazem o `id` só dentro das 24 h. Assim a tela esconde o lápis depois do prazo,
   em vez de mostrar o erro ao salvar.
2. O mock devolve listas vazias e recusa as escritas. A interface usa a fonte de
   demonstração dela também com `VITE_DATA_SOURCE=mock`, então nada muda para vocês.
