-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0030 — Corrigir um apontamento, e mover de dia leva a meta junto
-- Decisões: D59 (nova), D08, D52, D54, D57
--
-- O PEDIDO: a tela de Histórico da interface nova corrige UM apontamento —
-- quantidade, OPs, retrabalho, data, turno, modo, observação, nº de pessoas.
-- O banco já tinha `update_production_record`, mas ela era anterior a três
-- decisões, e havia um defeito em comum com a edição em massa.
--
-- O DEFEITO: mover um apontamento de dia NÃO atualizava a meta. Ele ficava com
-- a meta do dia antigo. Prova, num apontamento real (transação desfeita):
--   Horizontal N°1, 03/02/2026, meta 7.000 → movido para 08/10/2026, quando a
--   meta vigente é 10.000 → continuava 7.000.
-- O apontamento guarda uma FOTO da meta do seu dia (D08). Mudou o dia, a foto
-- tem de ser a do dia novo.
--
-- A EXCEÇÃO, e por que ela existe: para as datas anteriores a 25/09/2026, a
-- linha do tempo de metas do banco guarda os valores de RESERVA (500, 600,
-- 160) que vieram do código do app antigo e nunca foram reais (D38). As metas
-- verdadeiras daquela época estão na foto de cada apontamento IMPORTADO, vindas
-- da planilha. Recalcular um importado trocaria 7.000 por 500. Então:
--   • apontamento feito pelo app → ao mudar de data, pega a meta e a base do
--     dia de destino;
--   • apontamento importado      → mantém a meta da planilha.
-- Se um dia a linha do tempo antiga for corrigida, a regra continua certa: o
-- recálculo daria o mesmo valor da planilha.
--
-- AS TRÊS DECISÕES QUE `update_production_record` NÃO CONHECIA:
--   • D52 — zero apaga o nº de pessoas (ela fazia `coalesce` e não apagava);
--   • D54 — onde a meta é por pessoa, o número é obrigatório;
--   • D57 — o nº da OP é só números, até 15. Com uma ressalva nova: corrigir a
--     quantidade de um apontamento IMPORTADO não pode exigir trocar a OP
--     `IMPORTADO`, senão nenhum número do histórico seria corrigível.
--
-- Nenhuma linha existente é tocada por esta migration.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. insert_production_orders aceita IMPORTADO só quando pedido ──────────
-- Acrescentar um parâmetro com valor padrão cria uma SEGUNDA função (D53.1).
-- Derruba a assinatura antiga antes.
drop function if exists public.insert_production_orders(uuid, jsonb);

create function public.insert_production_orders(
  p_record_id         uuid,
  p_orders            jsonb,
  -- Só `update_production_record` liga isto, e só para apontamento importado.
  p_permite_importado boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count    integer;
  v_invalida text;
begin
  if p_orders is null then
    return 0;
  end if;
  if jsonb_typeof(p_orders) <> 'array' then
    raise exception 'As ordens de produção devem ser enviadas como lista.'
      using errcode = '22023';
  end if;

  -- D57: só números, de 1 a 15. Confere ANTES de gravar qualquer linha.
  select coalesce(trim(o ->> 'order_number'), '') into v_invalida
    from jsonb_array_elements(p_orders) as o
   where coalesce((o ->> 'quantity')::numeric, 0) > 0
     and coalesce(trim(o ->> 'order_number'), '') !~ '^[0-9]{1,15}$'
     and not (p_permite_importado and trim(o ->> 'order_number') = 'IMPORTADO')
   limit 1;

  if found then
    raise exception 'Nº da OP inválido: "%". Use só números, até 15 dígitos.', v_invalida
      using errcode = '23514';
  end if;

  insert into public.production_orders (production_record_id, order_number, quantity, is_rework, notes)
  select p_record_id,
         trim(o ->> 'order_number'),
         (o ->> 'quantity')::integer,
         coalesce((o ->> 'is_rework')::boolean, false),
         nullif(trim(o ->> 'notes'), '')
    from jsonb_array_elements(p_orders) as o
   where coalesce((o ->> 'quantity')::numeric, 0) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Função criada do zero nasce executável por qualquer um (D53.1). É interna.
revoke all on function public.insert_production_orders(uuid, jsonb, boolean) from public, anon, authenticated;

comment on function public.insert_production_orders(uuid, jsonb, boolean) is
  'Grava as OPs de um apontamento. Nº da OP só números, até 15 dígitos; '
  '"IMPORTADO" só quando se corrige um apontamento importado. Interna. [D08, D57, D59]';


-- ─── 2. A regra de recalcular a meta, num lugar só ──────────────────────────
-- Chamada pelas duas funções que mudam a data de um apontamento.
create or replace function public.refazer_meta_do_apontamento(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.production_records r
     set target_quantity = coalesce(public.machine_target_on(r.machine_id, r.production_date), 0),
         target_basis    = coalesce(public.machine_target_basis_on(r.machine_id, r.production_date), 'per_shift')
   where r.id = p_id
     -- Importado guarda a meta da planilha: o banco não tem meta melhor para
     -- aquela época (ver o cabeçalho desta migration).
     and r.import_batch_id is null;
$$;

revoke all on function public.refazer_meta_do_apontamento(uuid) from public, anon, authenticated;

comment on function public.refazer_meta_do_apontamento(uuid) is
  'Troca a foto da meta de um apontamento pela do seu dia atual. Não toca nos '
  'importados, que guardam a meta da planilha. Interna. [D08, D59]';


-- ─── 3. update_production_record: corrigir um apontamento ───────────────────
create or replace function public.update_production_record(
  p_id              uuid,
  p_notes           text     default null,
  p_operator_count  smallint default null,
  p_orders          jsonb    default null,
  p_production_date date     default null,
  p_shift_id        smallint default null,
  p_work_mode       text     default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec       public.production_records;
  v_data      date;
  v_importado boolean;
  v_pessoas   smallint;
begin
  select * into v_rec from public.production_records where id = p_id for update;
  if not found then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;
  if not public.can_edit_production_record(v_rec.created_by, v_rec.created_at) then
    raise exception 'Você não tem permissão para editar este apontamento.' using errcode = '42501';
  end if;
  if p_work_mode is not null and p_work_mode not in ('regular', 'overtime') then
    raise exception 'Modo de trabalho desconhecido: "%".', p_work_mode using errcode = '22023';
  end if;

  v_data      := coalesce(p_production_date, v_rec.production_date);
  v_importado := v_rec.import_batch_id is not null;

  -- D52: nulo = não mexi; zero = apagar; número = gravar.
  v_pessoas := case when p_operator_count is null then v_rec.operator_count
                    when p_operator_count = 0 then null
                    else p_operator_count end;

  -- D54, conferido na data FINAL: mover para um dia em que a meta é por pessoa
  -- também exige o número. O importado é isento, como em toda a D54.
  if not v_importado
     and public.exige_numero_de_operadores(v_rec.machine_id, v_data)
     and coalesce(v_pessoas, 0) = 0 then
    raise exception 'Informe quantas pessoas trabalharam neste turno: a meta desta máquina é por pessoa.'
      using errcode = '23514';
  end if;

  begin
    update public.production_records
       set notes           = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
           operator_count  = v_pessoas,
           production_date = v_data,
           shift_id        = coalesce(p_shift_id, shift_id),
           work_mode       = coalesce(p_work_mode, work_mode),
           updated_by      = auth.uid()
     where id = p_id;
  exception when unique_violation then
    raise exception 'Já existe apontamento desta máquina para a data, o turno e o modo escolhidos.'
      using errcode = '23505';
  end;

  -- D59: mudou o dia, muda a foto da meta.
  if v_data is distinct from v_rec.production_date then
    perform public.refazer_meta_do_apontamento(p_id);
  end if;

  -- As OPs são SUBSTITUÍDAS, não acrescentadas: aqui é correção, não o
  -- "completar" do apontamento (D30).
  if p_orders is not null then
    delete from public.production_orders where production_record_id = p_id;
    perform public.insert_production_orders(p_id, p_orders, v_importado);
  end if;

  return p_id;
end;
$$;

comment on function public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text) is
  'Corrige um apontamento: OPs (substitui), data, turno, modo, observação e nº de '
  'pessoas. Nulo mantém; zero apaga as pessoas. Mudar a data refaz a meta, exceto '
  'nos importados. [D08, D52, D54, D57, D59]';


-- ─── 4. bulk_update_production_records: mover em massa leva a meta junto ─────
create or replace function public.bulk_update_production_records(
  p_ids          uuid[],
  p_new_date     date     default null,
  p_new_shift_id smallint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_id    uuid;
begin
  if not public.has_permission('production.bulk_edit') then
    raise exception 'Você não tem permissão para editar apontamentos em massa.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'Nenhum apontamento selecionado.' using errcode = '22023';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'Limite de 200 apontamentos por operação.' using errcode = '22023';
  end if;
  if p_new_date is null and p_new_shift_id is null then
    raise exception 'Informe a nova data ou o novo turno.' using errcode = '22023';
  end if;

  -- D54 na data de destino: um apontamento do app, por pessoa e sem o número,
  -- não pode chegar a um dia que o exige. Tudo ou nada, como o resto da função.
  if p_new_date is not null and exists (
       select 1 from public.production_records r
        where r.id = any (p_ids)
          and r.import_batch_id is null
          and coalesce(r.operator_count, 0) = 0
          and public.exige_numero_de_operadores(r.machine_id, p_new_date)) then
    raise exception 'Há apontamento sem o nº de pessoas numa máquina com meta por pessoa. Corrija-o antes de mover. Nada foi alterado.'
      using errcode = '23514';
  end if;

  begin
    update public.production_records
       set production_date = coalesce(p_new_date, production_date),
           shift_id        = coalesce(p_new_shift_id, shift_id),
           updated_by      = auth.uid()
     where id = any (p_ids);
    get diagnostics v_count = row_count;
  exception when unique_violation then
    raise exception 'Algum apontamento selecionado já existe no destino (mesma máquina, data, turno e modo). Nada foi alterado.'
      using errcode = '23505';
  end;

  -- D59: trocar só o turno não muda a meta (ela é do dia, não do turno).
  if p_new_date is not null then
    foreach v_id in array p_ids loop
      perform public.refazer_meta_do_apontamento(v_id);
    end loop;
  end if;

  return v_count;
end;
$$;

comment on function public.bulk_update_production_records(uuid[], date, smallint) is
  'Move data e/ou troca turno de até 200 apontamentos, atomicamente. Mudar a data '
  'refaz a meta, exceto nos importados. Exige production.bulk_edit. [D59]';
