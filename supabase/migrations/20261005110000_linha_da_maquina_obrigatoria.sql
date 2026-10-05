-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0038 — A linha da máquina passa a ser obrigatória no banco
-- Decisões: D63 (segundo passo), D37
--
-- A 0037 deixou a linha obrigatória só no contrato novo (`createMachine`),
-- porque a tela de Cadastro ainda chamava o caminho antigo, sem linha. A
-- interface trocou (PR #36, nota 2026-10-05-cadastro-de-maquinas-completo.md),
-- e este é o segundo passo combinado:
--   • `machines.process` ganha `not null`. Conferido em 05/10/2026: as 30
--     máquinas (22 ativas, 7 planejadas, 1 inativa) têm linha;
--   • `create_machine` recusa a linha ausente com uma mensagem que a tela
--     consegue mostrar, em vez do erro genérico da coluna.
--
-- A assinatura de `create_machine` não muda (o `p_process` continua com
-- `default null`): o PostgreSQL não deixa tirar o valor padrão com
-- `create or replace`, e trocar a assinatura obrigaria a refazer os `grant`
-- (D53.1). A recusa fica no corpo da função.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.machines alter column process set not null;

comment on column public.machines.process is
  'Linha (processo) do centro: assembly = montagem, packaging = embalagem (D37). '
  'Obrigatória desde a migration 0038 (D63).';


create or replace function public.create_machine(
  p_name                    text,
  p_initial_target          integer  default 0,
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
  if p_process is null then
    raise exception 'Escolha a linha da máquina: montagem ou embalagem.' using errcode = '22023';
  end if;
  if coalesce(p_basis, 'per_shift') not in ('per_shift', 'per_shift_prorated', 'per_operator') then
    raise exception 'Base de meta desconhecida: "%". Use per_shift, per_shift_prorated ou per_operator.',
      p_basis using errcode = '22023';
  end if;
  if p_process not in ('assembly', 'packaging') then
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

comment on function public.create_machine(text, integer, boolean, smallint, text, text) is
  'Cadastra a máquina e a primeira meta. A linha (montagem/embalagem) é '
  'obrigatória (D63). Meta 0 sem dizer o contrário = por demanda (D38). Lotação '
  'e base opcionais; a meta conforme a lotação exige a lotação. Exige machines.manage.';
