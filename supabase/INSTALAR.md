# Instalar o banco do zero

Ordem para montar um projeto Supabase novo. **A ordem importa** — duas etapas
dependem de outra ter acontecido antes, e quando a ordem está errada o banco
**não dá erro**: ele simplesmente fica incompleto, em silêncio.

Conferido em 01/10/2026, com 28 migrations.

---

## A ordem

| # | O quê | Onde |
|---|---|---|
| 1 | Migrations **1 a 13**, na ordem do nome do arquivo | `migrations/` |
| 2 | **Seed estrutural** | `seed/01_estrutural.sql` |
| 3 | Migrations **14 a 28**, na ordem | `migrations/` |
| 4 | Feriados nacionais | `calendario/feriados.sql` |
| 5 | Histórico da planilha | `import/` (4 passos do README de lá) |
| 6 | Primeiro administrador | `select public.bootstrap_admin('<e-mail>', 'admin');` |

A migration 13 é `20260925100000_capacity_process_and_target_basis.sql`.
A 14 é `20260925110000_centros_de_trabalho_reais.sql`.

---

## As duas armadilhas

### 1. O seed vai DEPOIS da migration 13, não da 10

O cabeçalho do seed diz "migrations até `20260920170000`" (a 10). **Está
desatualizado.** O seed grava `process`, `pieces_per_minute`, `efficiency` e
`standard_operator_count` em `machines`, e `basis` em `machine_targets` — todas
colunas que a **migration 13** cria.

Rodar o seed antes da 13 dá erro de coluna inexistente. Esse pelo menos é
barulhento.

### 2. As migrations 14+ vão DEPOIS do seed — e esta falha calada

Os perfis (`roles`) nascem **no seed**, não numa migration. Mas a migration 16
concede as permissões de importação ao perfil `admin`:

```sql
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
  from public.roles r
  cross join (values ('import.review'), ('import.manage')) as p(code)
 where r.code = 'admin'
```

Sem o seed, `where r.code = 'admin'` não acha nada. O `insert ... select` insere
zero linhas e **não levanta erro nenhum**. O banco fica de pé, parecendo
completo, e só na hora de carregar o histórico alguém descobre que o
administrador não tem `import.manage`.

Como conferir depois (tem de dar 20 e 20):

```sql
select count(*) from public.permissions;                              -- 20
select count(*) from public.role_permissions rp
  join public.roles r on r.id = rp.role_id where r.code = 'admin';    -- 20
```

---

## Por que as migrations 14 e 15 não atrapalham o seed

As duas foram escritas para transformar o banco **antigo** (o de demonstração)
no real. Num banco novo elas não têm o que fazer, e sabem disso:

- **14** começa com `if not exists (select 1 from public.machines where name =
  'HORIZONTAL 1') then return; end if;` — o nome antigo não existe, então ela
  sai sem tocar em nada.
- **15** só insere degrau de meta `where not exists` um igual. Como o seed já
  gravou as metas acordadas, ela não cria nada.

Ou seja: rodar as duas depois do seed é seguro, e é o caminho certo.

---

## O que o seed traz

| Seção | Conteúdo |
|---|---|
| Perfis | 7 (`operator` … `tv_display`) |
| Permissões | **18** — as outras 2 (`import.review`, `import.manage`) vêm da migration 16 |
| Permissões por perfil | a matriz da seção 8 da referência técnica |
| Máquinas | os 22 centros reais, com nome final, processo, capacidade e lotação |
| Metas | as acordadas com o gestor: Tomadas 12.500, Plugue 6.500, Interruptores 4.500, A Granél 25.000 **por pessoa**, e 0 para os 10 centros por demanda |

O seed é repetível: tudo é `on conflict do nothing` ou `where not exists`. Ele
nunca sobrescreve meta — meta é histórico (D13).

---

## Conferência depois de instalar

```sql
select count(*) from public.machines where status = 'active';   -- 22
select count(*) from public.permissions;                        -- 20
select count(*) from public.roles;                              --  7
select count(*) from public.calendar_events;                    -- 28 (2026+2027)
select count(*) from public.shifts;                             --  3
select name, quantity_per_shift, basis
  from public.machines m
  join public.current_machine_targets t on t.machine_id = m.id
 where basis <> 'per_shift';   -- A Granél per_operator, as 2 horizontais prorated
```

E, depois do passo 6, que o administrador saiu com tudo:

```sql
select count(*) from public.user_permissions
 where user_id = (select id from auth.users where lower(email) = lower('<e-mail>'));   -- 20
```
