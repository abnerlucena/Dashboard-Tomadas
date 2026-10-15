-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0042 — Ocorrências do turno: materiais faltantes, falta de pessoas
--                  e o cadastro de colaboradores
-- Decisões: D70 (nova), D20–D24, D37, D62
--
-- PEDIDO da sessão da interface (nota 2026-10-15-ocorrencias-do-turno.md), a
-- pedido do gestor da fábrica: o apontamento passa a registrar, por turno,
-- os MATERIAIS QUE FALTARAM e as PESSOAS QUE FALTARAM, saíram mais cedo ou
-- chegaram atrasadas — o bloco "Informações adicionais" da planilha. Os nomes
-- vêm de um CADASTRO DE COLABORADORES, separado das contas do Dash (quem
-- falta nem sempre tem conta).
--
-- DECISÕES DO GESTOR (15/10/2026) — falta por nome é dado pessoal (LGPD):
--   • SÓ GESTOR E ADMIN VEEM O NOME de quem faltou (permissão nova
--     `collaborators.manage`). Os demais veem só a CONTAGEM do turno; nem quem
--     registrou volta a ver o nome. Quem registrou pode desfazer o que
--     registrou nas primeiras 24 h, sem precisar ler.
--   • A FALTA POR NOME É GUARDADA ENQUANTO A PESSOA FOR COLABORADORA. Ao
--     inativar o colaborador (saiu da empresa), as faltas dele PERDEM O NOME e
--     a observação, e ficam só como contagem do turno. Isso não se desfaz:
--     reativar a pessoa não devolve o nome às faltas antigas.
--   • Por isso a falta por nome NÃO vai para a auditoria (`audit_logs`), que
--     guardaria uma cópia com o nome para sempre. O cadastro de colaboradores
--     e os materiais faltantes vão.
--   • "Saiu mais cedo" e "chegou atrasado" guardam SÓ O HORÁRIO.
--
-- ESCRITA só pelas funções (security definer); LEITURA pelas políticas abaixo
-- e por `list_shift_absences`, que esconde o nome de quem não pode vê-lo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Permissão ───────────────────────────────────────────────────────────
insert into public.permissions (code, description, category, sort_order)
values ('collaborators.manage', 'Cadastrar colaboradores e ver as faltas por nome', 'Gestão', 260)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, 'collaborators.manage'
  from public.roles r
 where r.code in ('manager', 'admin')
on conflict do nothing;

-- Quem já foi aprovado recebe também (D22 e a lição da 0020).
select public.sincronizar_permissoes_dos_papeis();


-- ─── 2. Chave do nome: sem acento, sem maiúscula, um espaço só ──────────────
-- "Ana  Paula Ribeiro" e "ana paula ribeiro" são a mesma pessoa. O banco não
-- tem a extensão unaccent; a troca é feita aqui, só com as letras do português.
create or replace function public.chave_do_nome(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
           lower(translate(trim(p_nome),
             'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
             'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
           '\s+', ' ', 'g');
$$;


-- ─── 3. Colaboradores ───────────────────────────────────────────────────────
create table if not exists public.collaborators (
  id            uuid primary key default gen_random_uuid(),
  -- Nome e sobrenome: duas pessoas com o mesmo primeiro nome são comuns.
  name          text not null check (trim(name) ~ '^\S+(\s+\S+)+$' and length(trim(name)) <= 120),
  -- O "Cadastro" da pessoa na empresa.
  badge_number  text check (badge_number ~ '^[0-9]{1,12}$'),
  -- Turno de costume: só ordena a lista do apontamento.
  shift_id      smallint not null references public.shifts(id),
  process       text check (process in ('assembly', 'packaging')),
  -- Nunca se apaga: quem sai é inativado (e as faltas dele perdem o nome).
  active        boolean not null default true,
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id),
  updated_at    timestamptz
);

create unique index if not exists collaborators_name_key
  on public.collaborators (public.chave_do_nome(name));
create unique index if not exists collaborators_badge_key
  on public.collaborators (badge_number) where badge_number is not null;

comment on table public.collaborators is
  'Pessoas da fábrica, para registrar faltas por nome. Separado das contas do '
  'Dash: quem falta nem sempre tem conta. Nunca se apaga; inativar tira o nome '
  'das faltas antigas (D70).';

create trigger audit_row_change after insert or update or delete on public.collaborators
  for each row execute function public.audit_row_change();


-- ─── 4. Falta de pessoas ────────────────────────────────────────────────────
create table if not exists public.shift_absences (
  id               uuid primary key default gen_random_uuid(),
  production_date  date not null,
  shift_id         smallint not null references public.shifts(id),
  -- Nulo = a pessoa foi inativada e a falta perdeu o nome (D70). Conta para o
  -- turno, mas não diz mais de quem é.
  collaborator_id  uuid references public.collaborators(id),
  kind             text not null check (kind in ('absent', 'left_early', 'late')),
  -- Saída ou chegada. "Faltou" não tem horário.
  at_time          time,
  note             text check (note is null or length(trim(note)) between 1 and 500),
  created_by       uuid references public.profiles(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id),
  updated_at       timestamptz,
  constraint shift_absences_time_check check (kind <> 'absent' or at_time is null)
);

-- A mesma pessoa não entra duas vezes no mesmo turno.
create unique index if not exists shift_absences_one_per_turn
  on public.shift_absences (production_date, shift_id, collaborator_id)
  where collaborator_id is not null;
create index if not exists shift_absences_date_idx on public.shift_absences (production_date, shift_id);
create index if not exists shift_absences_collaborator_idx on public.shift_absences (collaborator_id);

comment on table public.shift_absences is
  'Quem faltou, saiu mais cedo ou chegou atrasado num turno. Dado pessoal: o '
  'nome só é visto por collaborators.manage, e não vai para audit_logs (D70).';


-- ─── 5. Materiais faltantes ─────────────────────────────────────────────────
create table if not exists public.material_shortages (
  id                    uuid primary key default gen_random_uuid(),
  production_date       date not null,
  shift_id              smallint not null references public.shifts(id),
  -- O mesmo formato de work_orders.material_code (D62).
  material_code         text not null check (material_code ~ '^[0-9]{1,18}$'),
  material_description  text not null check (length(trim(material_description)) between 1 and 200),
  note                  text check (note is null or length(trim(note)) between 1 and 500),
  created_by            uuid references public.profiles(id) default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles(id),
  updated_at            timestamptz
);

-- O mesmo material não entra duas vezes no mesmo turno: as máquinas afetadas
-- vão juntas, num registro só.
create unique index if not exists material_shortages_one_per_turn
  on public.material_shortages (production_date, shift_id, material_code);

create table if not exists public.material_shortage_machines (
  material_shortage_id  uuid not null references public.material_shortages(id) on delete cascade,
  machine_id            integer not null references public.machines(id),
  primary key (material_shortage_id, machine_id)
);

comment on table public.material_shortages is
  'Material que faltou num turno. As máquinas afetadas (nenhuma, uma ou várias) '
  'ficam em material_shortage_machines. [D70]';

create trigger audit_row_change after insert or update or delete on public.material_shortages
  for each row execute function public.audit_row_change();


-- ─── 6. RLS ─────────────────────────────────────────────────────────────────
alter table public.collaborators              enable row level security;
alter table public.shift_absences             enable row level security;
alter table public.material_shortages         enable row level security;
alter table public.material_shortage_machines enable row level security;

-- A busca do apontamento precisa da lista de pessoas.
create policy collaborators_select on public.collaborators for select to authenticated
  using ((select public.has_permission('production.create'))
      or (select public.has_permission('collaborators.manage')));

-- A falta por nome: só gestor e admin. Os demais usam list_shift_absences.
create policy shift_absences_select on public.shift_absences for select to authenticated
  using ((select public.has_permission('collaborators.manage')));

create policy material_shortages_select on public.material_shortages for select to authenticated
  using ((select public.has_permission('history.view'))
      or (select public.has_permission('production.create')));
create policy material_shortage_machines_select on public.material_shortage_machines for select to authenticated
  using ((select public.has_permission('history.view'))
      or (select public.has_permission('production.create')));

revoke all on public.collaborators, public.shift_absences,
              public.material_shortages, public.material_shortage_machines from anon;
grant select on public.collaborators, public.shift_absences,
                public.material_shortages, public.material_shortage_machines to authenticated;


-- ─── 7. Os materiais com as máquinas, numa linha ────────────────────────────
create or replace view public.material_shortage_summary
with (security_invoker = true)
as
select s.id, s.production_date, s.shift_id, s.material_code, s.material_description, s.note,
       coalesce(array_agg(m.machine_id order by m.machine_id) filter (where m.machine_id is not null),
                '{}'::integer[]) as machine_ids,
       s.created_by, s.created_at
  from public.material_shortages s
  left join public.material_shortage_machines m on m.material_shortage_id = s.id
 group by s.id;

grant select on public.material_shortage_summary to authenticated;


-- ─── 8. Apoio ───────────────────────────────────────────────────────────────
-- Quem registra uma ocorrência: quem aponta ou quem corrige apontamentos.
create or replace function public.pode_registrar_ocorrencia()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('production.create') or public.has_permission('production.edit');
$$;

-- Quem desfaz/corrige: quem gravou, nas primeiras 24 h (como o edit_own, D24).
create or replace function public.foi_eu_ha_pouco(p_created_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_created_by = auth.uid() and p_created_at > now() - interval '24 hours';
$$;

revoke all on function public.pode_registrar_ocorrencia() from public, anon, authenticated;
revoke all on function public.foi_eu_ha_pouco(uuid, timestamptz) from public, anon, authenticated;


-- ─── 9. Colaboradores: cadastrar, editar, inativar ─────────────────────────
create or replace function public.create_collaborator(
  p_name          text,
  p_shift_id      smallint,
  p_badge_number  text default null,
  p_process       text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('collaborators.manage') then
    raise exception 'Você não tem permissão para cadastrar colaboradores.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') !~ '^\S+(\s+\S+)+$' then
    raise exception 'Escreva nome e sobrenome, para não confundir pessoas com o mesmo nome.' using errcode = '22023';
  end if;
  if nullif(trim(p_badge_number), '') is not null and trim(p_badge_number) !~ '^[0-9]{1,12}$' then
    raise exception 'O cadastro tem só números (até 12).' using errcode = '22023';
  end if;
  if p_process is not null and p_process not in ('assembly', 'packaging') then
    raise exception 'Linha desconhecida: "%". Use assembly (montagem) ou packaging (embalagem).', p_process using errcode = '22023';
  end if;

  begin
    insert into public.collaborators (name, badge_number, shift_id, process)
    values (regexp_replace(trim(p_name), '\s+', ' ', 'g'), nullif(trim(p_badge_number), ''), p_shift_id, p_process)
    returning id into v_id;
  exception when unique_violation then
    if sqlerrm like '%collaborators_badge_key%' then
      raise exception 'Este cadastro já é de outra pessoa.' using errcode = '23505';
    end if;
    raise exception 'Já existe alguém com este nome. Confira a lista ou acrescente outro sobrenome.' using errcode = '23505';
  end;
  return v_id;
end;
$$;

-- Nulo mantém. Cadastro e linha: '' apaga.
create or replace function public.update_collaborator(
  p_id            uuid,
  p_name          text     default null,
  p_shift_id      smallint default null,
  p_badge_number  text     default null,
  p_process       text     default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('collaborators.manage') then
    raise exception 'Você não tem permissão para alterar colaboradores.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.collaborators where id = p_id) then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;
  if p_name is not null and trim(p_name) !~ '^\S+(\s+\S+)+$' then
    raise exception 'Escreva nome e sobrenome, para não confundir pessoas com o mesmo nome.' using errcode = '22023';
  end if;
  if nullif(trim(p_badge_number), '') is not null and trim(p_badge_number) !~ '^[0-9]{1,12}$' then
    raise exception 'O cadastro tem só números (até 12).' using errcode = '22023';
  end if;
  if nullif(p_process, '') is not null and p_process not in ('assembly', 'packaging') then
    raise exception 'Linha desconhecida: "%". Use assembly (montagem) ou packaging (embalagem).', p_process using errcode = '22023';
  end if;

  begin
    update public.collaborators
       set name         = coalesce(regexp_replace(trim(p_name), '\s+', ' ', 'g'), name),
           shift_id     = coalesce(p_shift_id, shift_id),
           badge_number = case when p_badge_number is null then badge_number else nullif(trim(p_badge_number), '') end,
           process      = case when p_process is null then process else nullif(p_process, '') end,
           updated_by   = auth.uid(),
           updated_at   = now()
     where id = p_id;
  exception when unique_violation then
    if sqlerrm like '%collaborators_badge_key%' then
      raise exception 'Este cadastro já é de outra pessoa.' using errcode = '23505';
    end if;
    raise exception 'Já existe alguém com este nome. Confira a lista ou acrescente outro sobrenome.' using errcode = '23505';
  end;
end;
$$;

-- Inativar = a pessoa saiu da empresa: as faltas dela perdem o nome e a
-- observação (D70). Devolve quantas faltas perderam o nome.
create or replace function public.set_collaborator_active(p_id uuid, p_active boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
begin
  if not public.has_permission('collaborators.manage') then
    raise exception 'Você não tem permissão para alterar colaboradores.' using errcode = '42501';
  end if;
  update public.collaborators
     set active = p_active, updated_by = auth.uid(), updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;

  if not p_active then
    update public.shift_absences
       set collaborator_id = null, note = null, updated_by = auth.uid(), updated_at = now()
     where collaborator_id = p_id;
    get diagnostics v_n = row_count;
  end if;
  return v_n;
end;
$$;


-- ─── 10. Falta de pessoas: registrar, corrigir, desfazer, listar ────────────
-- Sem p_id = registrar. Com p_id = corrigir.
create or replace function public.save_shift_absence(
  p_production_date  date,
  p_shift_id         smallint,
  p_collaborator_id  uuid,
  p_kind             text,
  p_at_time          time default null,
  p_note             text default null,
  p_id               uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_atual public.shift_absences;
begin
  if p_kind not in ('absent', 'left_early', 'late') then
    raise exception 'Tipo de ocorrência desconhecido: "%".', p_kind using errcode = '22023';
  end if;
  if p_kind = 'absent' and p_at_time is not null then
    raise exception '"Faltou" não tem horário.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.collaborators where id = p_collaborator_id and active) then
    raise exception 'Colaborador não encontrado ou inativo.' using errcode = 'P0002';
  end if;

  if p_id is null then
    if not (public.pode_registrar_ocorrencia() or public.has_permission('collaborators.manage')) then
      raise exception 'Você não tem permissão para registrar ocorrências do turno.' using errcode = '42501';
    end if;
  else
    select * into v_atual from public.shift_absences where id = p_id for update;
    if not found then
      raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
    end if;
    if not (public.has_permission('collaborators.manage') or public.foi_eu_ha_pouco(v_atual.created_by, v_atual.created_at)) then
      raise exception 'Você não tem permissão para corrigir esta ocorrência.' using errcode = '42501';
    end if;
  end if;

  begin
    if p_id is null then
      insert into public.shift_absences (production_date, shift_id, collaborator_id, kind, at_time, note)
      values (p_production_date, p_shift_id, p_collaborator_id, p_kind, p_at_time, nullif(trim(p_note), ''))
      returning id into v_id;
    else
      update public.shift_absences
         set production_date = p_production_date, shift_id = p_shift_id,
             collaborator_id = p_collaborator_id, kind = p_kind, at_time = p_at_time,
             note = nullif(trim(p_note), ''), updated_by = auth.uid(), updated_at = now()
       where id = p_id
      returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Esta pessoa já tem ocorrência neste turno. Corrija a que existe.' using errcode = '23505';
  end;
  return v_id;
end;
$$;

create or replace function public.remove_shift_absence(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.shift_absences;
begin
  select * into v_atual from public.shift_absences where id = p_id for update;
  if not found then
    raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
  end if;
  if not (public.has_permission('collaborators.manage') or public.foi_eu_ha_pouco(v_atual.created_by, v_atual.created_at)) then
    raise exception 'Você não tem permissão para apagar esta ocorrência.' using errcode = '42501';
  end if;
  delete from public.shift_absences where id = p_id;
end;
$$;

-- A leitura de todos. Gestor e admin recebem tudo. Os demais recebem uma linha
-- por ocorrência, SEM nome, sem horário e sem observação; e o id só das que
-- eles mesmos registraram há menos de 24 h, para poderem desfazer.
create or replace function public.list_shift_absences(p_from date, p_to date)
returns table (
  id                uuid,
  production_date   date,
  shift_id          smallint,
  kind              text,
  at_time           time,
  note              text,
  collaborator_id   uuid,
  collaborator_name text,
  is_mine           boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ve_nome boolean := public.has_permission('collaborators.manage');
begin
  if not (v_ve_nome or public.pode_registrar_ocorrencia() or public.has_permission('history.view')) then
    raise exception 'Você não tem permissão para ver as ocorrências do turno.' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Período inválido: até 400 dias, com o início antes do fim.' using errcode = '22023';
  end if;

  return query
  select case when v_ve_nome or public.foi_eu_ha_pouco(a.created_by, a.created_at) then a.id end,
         a.production_date, a.shift_id, a.kind,
         case when v_ve_nome then a.at_time end,
         case when v_ve_nome then a.note end,
         case when v_ve_nome then a.collaborator_id end,
         case when v_ve_nome then c.name end,
         a.created_by = auth.uid()
    from public.shift_absences a
    left join public.collaborators c on c.id = a.collaborator_id
   where a.production_date between p_from and p_to
   order by a.production_date, a.shift_id, a.created_at;
end;
$$;


-- ─── 11. Materiais faltantes: registrar, corrigir, desfazer ────────────────
create or replace function public.save_material_shortage(
  p_production_date       date,
  p_shift_id              smallint,
  p_material_code         text,
  p_material_description  text,
  p_machine_ids           integer[] default '{}',
  p_note                  text      default null,
  p_id                    uuid      default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_atual public.material_shortages;
begin
  if coalesce(trim(p_material_code), '') !~ '^[0-9]{1,18}$' then
    raise exception 'Código do material inválido: "%". Use só números, até 18.', p_material_code using errcode = '23514';
  end if;
  if nullif(trim(p_material_description), '') is null then
    raise exception 'Escreva a descrição do material.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_machine_ids, '{}')) as m(id)
              where not exists (select 1 from public.machines x where x.id = m.id)) then
    raise exception 'Máquina não encontrada na lista de máquinas afetadas.' using errcode = 'P0002';
  end if;

  if p_id is null then
    if not public.pode_registrar_ocorrencia() then
      raise exception 'Você não tem permissão para registrar ocorrências do turno.' using errcode = '42501';
    end if;
  else
    select * into v_atual from public.material_shortages where id = p_id for update;
    if not found then
      raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
    end if;
    if not (public.has_permission('production.edit') or public.foi_eu_ha_pouco(v_atual.created_by, v_atual.created_at)) then
      raise exception 'Você não tem permissão para corrigir esta ocorrência.' using errcode = '42501';
    end if;
  end if;

  begin
    if p_id is null then
      insert into public.material_shortages (production_date, shift_id, material_code, material_description, note)
      values (p_production_date, p_shift_id, trim(p_material_code), trim(p_material_description), nullif(trim(p_note), ''))
      returning id into v_id;
    else
      update public.material_shortages
         set production_date = p_production_date, shift_id = p_shift_id,
             material_code = trim(p_material_code), material_description = trim(p_material_description),
             note = nullif(trim(p_note), ''), updated_by = auth.uid(), updated_at = now()
       where id = p_id
      returning id into v_id;
      delete from public.material_shortage_machines where material_shortage_id = v_id;
    end if;
  exception when unique_violation then
    raise exception 'Este material já está registrado neste turno. Corrija o registro que existe.' using errcode = '23505';
  end;

  insert into public.material_shortage_machines (material_shortage_id, machine_id)
  select distinct v_id, m.id from unnest(coalesce(p_machine_ids, '{}')) as m(id);

  return v_id;
end;
$$;

create or replace function public.remove_material_shortage(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.material_shortages;
begin
  select * into v_atual from public.material_shortages where id = p_id for update;
  if not found then
    raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
  end if;
  if not (public.has_permission('production.edit') or public.foi_eu_ha_pouco(v_atual.created_by, v_atual.created_at)) then
    raise exception 'Você não tem permissão para apagar esta ocorrência.' using errcode = '42501';
  end if;
  delete from public.material_shortages where id = p_id;
end;
$$;


-- ─── 12. Quem executa ───────────────────────────────────────────────────────
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'create_collaborator(text, smallint, text, text)',
    'update_collaborator(uuid, text, smallint, text, text)',
    'set_collaborator_active(uuid, boolean)',
    'save_shift_absence(date, smallint, uuid, text, time, text, uuid)',
    'remove_shift_absence(uuid)',
    'list_shift_absences(date, date)',
    'save_material_shortage(date, smallint, text, text, integer[], text, uuid)',
    'remove_material_shortage(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', v_fn);
    execute format('grant execute on function public.%s to authenticated', v_fn);
  end loop;
end $$;
