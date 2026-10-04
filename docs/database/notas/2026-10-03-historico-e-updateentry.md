# Histórico ligado ao banco, e resposta sobre o `updateEntry`

> Data: 03/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Responde a [`2026-10-03-resposta-do-banco-ui-antiga-aposentada.md`](2026-10-03-resposta-do-banco-ui-antiga-aposentada.md).

## O que o Histórico já faz com o contrato de hoje

A unidade do banco é o **apontamento** (máquina + dia + turno + regime, D10). As linhas
da tabela são as OPs dele. Por isso as ações agem no apontamento inteiro, e o diálogo diz
isso com a conta de linhas ("Apaga o apontamento inteiro: todas as OPs da máquina no
turno (3 linhas, 2 além das marcadas)").

| Ação | Contrato |
|---|---|
| Excluir (uma linha ou várias) | `bulkDelete(ids dos apontamentos)` |
| Mover para outra data | `bulkMove` |
| Alterar turno | `bulkEditTurno` |
| Editar observação | `updateObs` (vazia apaga) |
| Corrigir quantidade, OP, retrabalho | **espera o `updateEntry`**. O diálogo avisa |

Depois de cada ação, a tela recarrega os dados. Se der erro (sem permissão, D24; já existe
apontamento no destino), aparece a mensagem de vocês e nada muda na tela. No modo Apps
Script, o Histórico fica só de leitura.

**Atenção ao defeito que vocês acharam:** `bulkMove` e `bulkEditTurno` já estão ligados.
Até a correção de vocês entrar, mover um apontamento mantém a meta do dia antigo. Como o
contrato não muda, a tela não precisa de nada quando vocês corrigirem. Peço prioridade
para essa correção.

## O formato do `updateEntry`: serve

```ts
production.updateEntry(id: string, changes: {
  ordensProducao?: OrdemProducao[];
  date?: string;
  turno?: string;
  workMode?: "regular" | "overtime";
  obs?: string;
  operatorCount?: number;
}, session): Promise<void>
```

Quatro pontos para deixar escrito no comentário do tipo, porque a tela depende deles:

1. **`obs`: ausente mantém, `""` apaga.** É diferente do `saveEntries`, em que vazio
   mantém. Sem isso escrito, alguém "conserta" um dos dois.
2. **`ordensProducao` substitui a lista inteira.** Lista vazia vale: o apontamento fica
   sem peça (máquina parada), como no `saveEntries` com observação. Se preferirem recusar
   a lista vazia, digam, e a tela passa a oferecer "Excluir" nesse caso.
3. **Destino ocupado:** mudar `date`, `turno` ou `workMode` para um lugar onde já existe
   apontamento deve **recusar**, com a mensagem citando o destino ("Já existe apontamento
   da Horizontal N°1 em 08/10, Turno 2"). Juntar os dois apontamentos parece prático, mas
   esconde a correção. Se vocês preferirem juntar, combinamos antes.
4. **Meta recalculada** ao mudar `date` ou `workMode` (o defeito acima), e D52/D54 valendo
   como no `saveEntries`.

Assim que o tipo estiver em `types.ts` na `main`, o diálogo "Editar" do Histórico passa a
editar o apontamento inteiro: lista de OPs com quantidade e retrabalho, turno, regime,
observação e nº de pessoas.

## Metas também gravam

A aba **Metas vigentes** lê e grava pelo contrato de hoje, sem mudança:

- **Leitura:** metas, bases e "desde quando" vêm de `getMetasEm(hoje)`, e a lotação vem
  de `getMachines` (`standardOperatorCount`).
- **Salvar:** chama `saveMetas(metas, vigência, session, bases)` só com as máquinas
  alteradas, seja o número ou a base. `bases` leva só as bases que mudaram (D53).
- **Vigência:** o padrão é amanhã. Hoje é permitido (D31), e o aviso diz que os
  apontamentos feitos antes guardam a meta antiga. O passado fica bloqueado.
- **Depois de salvar:** a tela recarrega. O histórico vem de `getHistory`, e o Apontamento
  já usa a meta nova.
- **O que saiu com dados reais:** a coluna de capacidade e a comparação com o simulador.
  "Turnos ativos" também saiu, porque era só simulação e o banco não guarda. A capacidade
  volta quando o contrato trouxer os dados reais (D58). Até lá, o simulador avisa que usa
  valores de exemplo.
- **"Meta do mês" nesta tela é prevista:** turno × turnos × dias úteis, com as metas de
  hoje. O atingimento é o de verdade (D08).

**Pedido pequeno, sem pressa:** `TargetHistoryItem` com `basis?`. O histórico de metas
hoje mostra "meta por turno 9.200 a partir de 04/10" quando a mudança foi só de base, e
não dá para dizer "base: conforme a lotação → por turno".

## Outros

- **`Machine.process`:** obrigado. Quando chegar à `main`, troco a dedução da linha pelo
  nome (`lineOf` em `fromBackend.ts`) pelo campo, e A Granél continua como "Granel".
- **`exigeOperadores`:** a tela de Apontamento já usa uma cópia local. Troco pelo import
  quando o branch de vocês entrar (ver `2026-10-03-apontamento-gravando.md`).
- **Calendário:** é a próxima tela depois de Metas. Férias coletivas como intervalo seriam
  bem-vindas (`addHoliday` com `dateTo?`), mas não bloqueiam: a tela pode cadastrar dia a
  dia num intervalo.
