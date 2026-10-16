# Ocorrências do turno — resposta do banco

> Data: 15/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> Responde a `2026-10-15-ocorrencias-do-turno.md`. Schema `v0.32.0`, decisão D70.

## Em uma linha

Está no banco (migration 0042, aplicada) e no contrato: o repositório **`occurrences`**
em `types.ts`. As tabelas e a permissão seguem a proposta de vocês, com **duas
diferenças**, que o gestor decidiu e mudam a tela.

## As duas diferenças

### 1. Só gestor e admin veem o nome. Nem quem registrou volta a ver

A proposta era "ler com nome: `collaborators.manage` **e quem gravou**". O gestor
escolheu a regra mais restrita: **só `collaborators.manage`**.

O que isso muda em `listShiftOccurrences` para quem **não** tem `collaborators.manage`:
- cada falta vem **sem** `collaboratorId`, `collaboratorName`, `time` e `note` (todos `null`);
- `kind`, `date` e `shiftId` vêm, então dá para mostrar "2 pessoas: 1 faltou, 1 saiu
  mais cedo";
- o `id` vem **só nas que a própria pessoa registrou há menos de 24 h**, com
  `mine: true`, para ela poder **desfazer ou corrigir** (`removeAbsence`,
  `saveAbsence` com `id`). Depois de 24 h, só o gestor corrige.

**Na tela:** logo depois de registrar, vocês ainda têm o nome na memória da página.
Ao recarregar, quem não é gestor vê só a contagem. A "cópia no formato da planilha"
com nomes só funciona para o gestor.

### 2. Inativar o colaborador tira o nome das faltas, sem volta

O gestor decidiu guardar a falta por nome **só enquanto a pessoa for colaboradora**.
`setCollaboratorActive(id, false)`:
- inativa a pessoa (o cadastro fica, e dá para reativar);
- **tira o nome e a observação de todas as faltas dela**. Elas continuam contando no
  turno, com `collaboratorId: null`;
- devolve **quantas faltas perderam o nome**.

Reativar **não devolve** os nomes. **Peçam confirmação na tela antes de inativar**, com
o número de faltas que vão perder o nome: o gestor vê esse número antes de decidir.
"Inativar" aqui quer dizer **saiu da empresa**. Para afastamento temporário, não inativem.

A falta por nome também **não vai para a auditoria**, que guardaria uma cópia.

## O contrato

```ts
occurrences.listCollaborators()            // inclui inativos; quem aponta ou é gestor
occurrences.createCollaborator({ name, shiftId, badgeNumber?, process? }) → id
occurrences.updateCollaborator(id, { name?, shiftId?, badgeNumber?: "" apaga, process?: null apaga })
occurrences.setCollaboratorActive(id, active) → nº de faltas que perderam o nome
occurrences.listShiftOccurrences(from, to) → { absences, shortages }   // até 400 dias
occurrences.saveAbsence({ id?, date, shiftId, collaboratorId, kind, time?, note? }) → id
occurrences.removeAbsence(id)
occurrences.saveShortage({ id?, date, shiftId, materialCode, materialDescription, machineIds?, note? }) → id
occurrences.removeShortage(id)
```

Diferenças de forma em relação aos tipos de `occurrences.ts`:
- **turno** é `shiftId: number`, e **linha** é `process: "assembly" | "packaging" | null`
  (o mesmo `MachineProcess` das máquinas). `Line` fica do lado de vocês.
- **cadastro** é `badgeNumber`; **máquinas** são `machineIds: number[]`.
- `save*` devolvem só o **id**: o resto vocês já têm.
- `time` é `"hh:mm"` nos dois sentidos.

## Regras que o banco garante (com mensagem pronta)

- Nome com **nome e sobrenome**; nome único **sem acento e sem maiúscula**; cadastro só
  números, até 12, e único.
- Cadastrar e editar colaborador: só `collaborators.manage`.
- A mesma pessoa **uma vez por turno**; "faltou" **sem horário**; colaborador inativo
  não recebe falta nova.
- O mesmo **material uma vez por turno**, com todas as máquinas afetadas. Corrigir
  substitui as máquinas. Código só números, até 18.
- Registrar: quem aponta (`production.create` ou `production.edit`). Corrigir ou apagar
  material: `production.edit`, ou quem registrou, em 24 h.

## Permissão

`collaborators.manage` ("Cadastrar colaboradores e ver as faltas por nome", Gestão),
para **Gestor e Admin**. O mock tem a mesma regra. Não existe perfil "Líder".
