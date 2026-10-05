-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0037 — Cadastro completo de máquinas, e editar nome, linha e lotação
-- Decisões: D63 (nova), D38, D47, D53, D37
--
-- PEDIDO da sessão da interface (nota 2026-10-04-cadastro-de-maquinas.md),
-- com as três respostas aprovadas pelo gestor em 05/10/2026:
--
--   1. META 0 É "POR DEMANDA". Cadastrar com meta 0 criava uma máquina "com
--      meta" e meta zero, o que contradiz a D38 (por demanda = sem meta). Agora,
--      sem dizer o contrário, meta 0 → por demanda; meta > 0 → com meta. E as
--      duas combinações contraditórias são recusadas.
--   2. A LINHA (montagem ou embalagem) É OBRIGATÓRIA. Máquina sem linha some
--      dos agrupamentos por linha. Hoje as 30 têm.
--   3. EDITAR nome, linha e lotação de uma máquina existente, com uma função.
--
-- A LINHA OBRIGATÓRIA EM DOIS PASSOS. A tela de Cadastro de máquinas, já na
-- main, usa o contrato antigo (`addMachine(nome, meta)`), que não manda a
-- linha. Exigir agora no banco quebraria essa tela no próximo cadastro. Então:
--   • agora: o contrato novo (`createMachine`) exige a linha — o tsc cobra;
--   • quando a tela trocar: uma migration põe `not null` na coluna.
-- Até lá, `create_machine` aceita a linha ausente só para não quebrar quem
-- ainda chama do jeito antigo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. create_machine: linha, e meta 0 = por demanda ──────────────────────
-- Acrescentar parâmetro com valor padrão cria uma SEGUNDA função (D53.1).
drop function if exists public.create_machine(text, integer, boolean, smallint, text);

create function public.create_machine(
  p_name                    text,
  p_initial_target          integer  default 0,
  -- Nulo = deduzir da meta: 0 é por demanda (D38), maior que 0 é com meta.
  p_has_target              boolean  default null,
  p_standard_operator_count smallint default null,
  p_basis                   text     default 'per_shift',
  p_process                 text     default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    integer;
  v_meta  integer := greatest(coalesce(p_initial_target, 0), 0);
  v_tem   boolean := coalesce(p_has_target, v_meta > 0);
begin
  if not public.has_permission('machines.manage') then
    raise exception 'Você não tem permissão para cadastrar máquinas.' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'O nome da máquina é obrigatório.' using errcode = '22023';
  end if;
  if coalesce(p_basis, 'per_shift') not in ('per_shift', 'per_shift_prorated', 'per_operator') then
    raise exception 'Base de meta desconhecida: "%". Use per_shift, per_shift_prorated ou per_operator.',
      p_basis using errcode = '22023';
  end if;
  if p_process is not null and p_process not in ('assembly', 'packaging') then
    raise exception 'Linha desconhecida: "%". Use assembly (montagem) ou packaging (embalagem).',
      p_process using errcode = '22023';
  end if;
  if p_standard_operator_count is not null and p_standard_operator_count <= 0 then
    raise exception 'A lotação padrão tem de ser maior que zero.' using errcode = '22023';
  end if;
  -- D38: "com meta" e meta zero se contradizem, e "por demanda" não tem meta.
  if v_tem and v_meta = 0 then
    raise exception 'Máquina com meta precisa de meta maior que zero. Para máquina por demanda, cadastre sem meta.'
      using errcode = '22023';
  end if;
  if not v_tem and v_meta > 0 then
    raise exception 'Máquina por demanda não tem meta. Cadastre com meta 0 ou como máquina com meta.'
      using errcode = '22023';
  end if;
  -- Base que depende da lotação precisa da lotação (D47).
  if coalesce(p_basis, 'per_shift') = 'per_shift_prorated' and p_standard_operator_count is null then
    raise exception 'Para a meta conforme a lotação, informe a lotação padrão.' using errcode = '22023';
  end if;

  begin
    insert into public.machines (name, has_target, standard_operator_count, process, created_by)
    values (trim(p_name), v_tem, p_standard_operator_count, p_process, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe uma máquina com esse nome.' using errcode = '23505';
  end;

  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis, created_by)
  values (v_id, v_meta, (now() at time zone 'America/Sao_Paulo')::date,
          coalesce(p_basis, 'per_shift'), auth.uid());

  return v_id;
end;
$$;

revoke all on function public.create_machine(text, integer, boolean, smallint, text, text) from public, anon;
grant execute on function public.create_machine(text, integer, boolean, smallint, text, text) to authenticated;

comment on function public.create_machine(text, integer, boolean, smallint, text, text) is
  'Cadastra a máquina e a primeira meta. Meta 0 sem dizer o contrário = por '
  'demanda (D38). Linha montagem/embalagem, lotação e base opcionais por ora; a '
  'linha vira obrigatória quando a tela usar createMachine (D63). Exige machines.manage.';


-- ─── 2. update_machine: nome, linha e lotação ───────────────────────────────
-- Meta e base não se mexem aqui: elas têm vigência e histórico (D13, D53), e
-- mudam pela tela de Metas.
create or replace function public.update_machine(
  p_id                      integer,
  p_name                    text     default null,
  p_process                 text     default null,
  p_standard_operator_count smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_maq public.machines;
begin
  if not public.has_permission('machines.manage') then
    raise exception 'Você não tem permissão para alterar máquinas.' using errcode = '42501';
  end if;
  select * into v_maq from public.machines where id = p_id for update;
  if not found then
    raise exception 'Máquina não encontrada.' using errcode = 'P0002';
  end if;
  if p_name is not null and nullif(trim(p_name), '') is null then
    raise exception 'O nome da máquina não pode ficar vazio.' using errcode = '22023';
  end if;
  if p_process is not null and p_process not in ('assembly', 'packaging') then
    raise exception 'Linha desconhecida: "%". Use assembly (montagem) ou packaging (embalagem).',
      p_process using errcode = '22023';
  end if;
  -- Lotação não se apaga por aqui: ela é o divisor da meta rateada (D47) e o
  -- fallback da meta por pessoa (D54). Só troca por outro número.
  if p_standard_operator_count is not null and p_standard_operator_count <= 0 then
    raise exception 'A lotação padrão tem de ser maior que zero.' using errcode = '22023';
  end if;

  begin
    update public.machines
       set name                    = coalesce(trim(p_name), name),
           process                 = coalesce(p_process, process),
           standard_operator_count = coalesce(p_standard_operator_count, standard_operator_count),
           updated_by              = auth.uid()
     where id = p_id;
  exception when unique_violation then
    raise exception 'Já existe uma máquina com o nome "%".', trim(p_name) using errcode = '23505';
  end;
end;
$$;

revoke all on function public.update_machine(integer, text, text, smallint) from public, anon;
grant execute on function public.update_machine(integer, text, text, smallint) to authenticated;

comment on function public.update_machine(integer, text, text, smallint) is
  'Edita nome, linha e lotação padrão. Nulo mantém. Meta e base mudam pela tela '
  'de Metas, com vigência. Exige machines.manage. [D63]';
