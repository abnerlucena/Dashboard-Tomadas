# Ocorrências do turno e cadastro de colaboradores: o que a interface precisa do banco

> Data: 15/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Pede: três tabelas, uma permissão e o contrato de leitura e gravação. **Não bloqueia a interface**: ela já funciona na demonstração e, com o banco, esconde a seção até o contrato existir.

## Em uma linha

A pedido do gestor da fábrica, o apontamento passou a registrar **materiais faltantes**
e **falta de pessoas (por nome)** de cada turno, como o bloco "Informações adicionais" da
planilha de produção. Os nomes vêm de um **cadastro de colaboradores** novo, separado das
contas do Dash. A linha "Qualidade" da planilha fica para depois (o usuário ainda vai alinhar).

## O que a interface faz hoje (`app/src/features/occurrences/`)

- **Apontamento, passo 3 (Conferir e terminar):** seção "Ocorrências do turno" com dois
  blocos. Cada item grava na hora, como o "Concluir" de cada máquina, e nenhum é obrigatório.
  - *Materiais faltantes:* busca por código ou descrição entre os materiais das OPs e os
    que já faltaram; se não achar, a pessoa digita código (só números, até 18) e descrição.
    Máquina afetada e observação são opcionais. Uma máquina que marcou "Não produziu" com
    motivo de falta de material faz o Dash perguntar qual material faltou, já com a máquina.
  - *Falta de pessoas:* escolhe o colaborador (os do turno primeiro), o tipo (faltou, saiu
    mais cedo, chegou atrasado), o horário (opcional, só nos dois últimos) e uma observação.
    A mesma pessoa não entra duas vezes no mesmo turno. Quem tem `collaborators.manage` pode
    cadastrar a pessoa ali mesmo, só com o nome.
- **Administração › Colaboradores** (`collaborators.manage`): cadastrar, editar, inativar e
  reativar; contagem de faltas e de saídas ou atrasos no mês, com os dias.
- **Histórico:** cada turno do dia mostra as ocorrências; corrige numa janela (quem tem
  `production.create` ou `production.edit`); copia o bloco no formato da planilha.
  Sem `collaborators.manage`, a pessoa vê só a quantidade de pessoas, sem os nomes.
- **Nunca** aparecem no Modo TV, nos rankings nem nos relatórios por enquanto.

## Proposta para o banco

### Tabelas (nomes em inglês, como o resto do schema)

1. **`collaborators`**: `id`, `name text not null` (nome e sobrenome), `badge_number text null`
   (só números, único quando preenchido), `shift_id` (turno de costume, só ordena a lista),
   `process null` (linha), `active boolean not null default true`, `created_at`, `created_by`.
   **Sem delete**: inativar mantém o nome nas ocorrências antigas. Nome único sem acento e
   sem diferença de maiúsculas (a interface já valida; o banco garante).
2. **`shift_absences`**: `id`, `production_date date`, `shift_id`, `collaborator_id`,
   `kind text check in ('absent','left_early','late')`, `at_time time null` (só nos dois
   últimos), `note text null`, `created_by`, `created_at`. Única por
   (`production_date`, `shift_id`, `collaborator_id`).
3. **`material_shortages`**: `id`, `production_date`, `shift_id`, `material_code text`
   (check só números, até 18, como `work_orders.material_code`), `material_description text`,
   `machine_id null`, `note null`, `created_by`, `created_at`.

### Permissão e RLS

- Permissão nova **`collaborators.manage`**: "Cadastrar colaboradores e ver as faltas por
  nome". Grupo Gestão. No modelo, para Gestor (e Líder, se existir).
- `collaborators`: ler quem tem `production.create` (para a busca do apontamento) ou
  `collaborators.manage`; gravar só `collaborators.manage`.
- `shift_absences`: gravar quem tem `production.create` (o apontamento) ou
  `production.edit`; **ler com nome** só `collaborators.manage` e quem gravou. Para os
  demais, a interface só precisa da contagem por turno (uma view ou RPC sem o nome).
- `material_shortages`: ler quem tem `history.view`; gravar como as ausências.
- **LGPD:** frequência por nome é dado pessoal. Sugestão: registrar em `audit_logs`, e
  combinar com o gestor por quanto tempo guardar.

### Contrato sugerido (para `src/lib/repositories/types.ts`)

Os tipos que a interface usa estão em `app/src/features/occurrences/occurrences.ts`
(`Collaborator`, `Absence`, `MaterialShortage`). Um repositório `occurrences` com:

```ts
listCollaborators(session): Promise<Collaborator[]>
createCollaborator(input, session): Promise<Collaborator>
updateCollaborator(id, input, session): Promise<void>
setCollaboratorActive(id, active, session): Promise<void>
listShiftOccurrences(from, to, session): Promise<{ absences: Absence[]; shortages: MaterialShortage[] }>
saveAbsence(input, session): Promise<Absence>       // com id = editar
removeAbsence(id, session): Promise<void>
saveShortage(input, session): Promise<MaterialShortage>
removeShortage(id, session): Promise<void>
```

Quando existir, a interface troca a fonte de demonstração (`OccurrencesProvider`) por esse
contrato. Nada nas telas muda.

## O que a sessão do banco precisa decidir

1. Os nomes e o formato acima, ou outro.
2. Se "saiu mais cedo" e "chegou atrasado" guardam só o horário ou também os minutos.
3. Por quanto tempo guardar as ausências por nome.
