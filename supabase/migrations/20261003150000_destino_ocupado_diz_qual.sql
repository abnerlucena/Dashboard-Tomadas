-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0034 — Destino ocupado: a mensagem diz qual
-- Decisões: D59
--
-- Pedido da sessão da interface (nota 2026-10-03-historico-e-updateentry.md):
-- mudar data, turno ou modo de um apontamento para onde já existe outro deve
-- RECUSAR — juntar os dois esconderia a correção — e a mensagem precisa dizer
-- o destino. A recusa já existia; a mensagem era genérica ("Já existe
-- apontamento desta máquina para a data, o turno e o modo escolhidos").
--
-- Agora: "Já existe apontamento da EMBALADORA HORIZONTAL N°1 em 08/10/2026,
-- Turno 2. Corrija ou apague aquele antes." E o mesmo na edição em massa,
-- citando o primeiro choque.
-- ═══════════════════════════════════════════════════════════════════════════


-- Texto do destino, num lugar só.
create or replace function public.descrever_destino(
  p_machine_id integer, p_date date, p_shift_id smallint, p_work_mode text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select format('%s em %s, Turno %s%s',
           (select m.name from public.machines m where m.id = p_machine_id),
           to_char(p_date, 'DD/MM/YYYY'),
           p_shift_id,
           case when p_work_mode = 'overtime' then ' (hora extra)' else '' end);
$$;

revoke all on function public.descrever_destino(integer, date, smallint, text) from public, anon, authenticated;


-- ─── update_production_record ───────────────────────────────────────────────
-- Igual à 0030, mudando só a mensagem do choque.
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
  v_turno     smallint;
  v_modo      text;
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
  v_turno     := coalesce(p_shift_id, v_rec.shift_id);
  v_modo      := coalesce(p_work_mode, v_rec.work_mode);
  v_importado := v_rec.import_batch_id is not null;
  v_pessoas   := case when p_operator_count is null then v_rec.operator_count
                      when p_operator_count = 0 then null
                      else p_operator_count end;

  if not v_importado
     and public.exige_numero_de_operadores(v_rec.machine_id, v_data)
     and coalesce(v_pessoas, 0) = 0 then
    raise exception 'Informe quantas pessoas trabalharam neste turno: a meta desta máquina é por pessoa.'
      using errcode = '23514';
  end if;

  -- Destino ocupado: recusa e diz qual. Conferido antes, para a mensagem ter o
  -- destino exato em vez de depender do texto do erro de chave única.
  if exists (select 1 from public.production_records x
              where x.id <> p_id and x.machine_id = v_rec.machine_id
                and x.production_date = v_data and x.shift_id = v_turno and x.work_mode = v_modo) then
    raise exception 'Já existe apontamento da %. Corrija ou apague aquele antes.',
      public.descrever_destino(v_rec.machine_id, v_data, v_turno, v_modo)
      using errcode = '23505';
  end if;

  update public.production_records
     set notes           = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
         operator_count  = v_pessoas,
         production_date = v_data,
         shift_id        = v_turno,
         work_mode       = v_modo,
         updated_by      = auth.uid()
   where id = p_id;

  if v_data is distinct from v_rec.production_date then
    perform public.refazer_meta_do_apontamento(p_id);
  end if;

  if p_orders is not null then
    delete from public.production_orders where production_record_id = p_id;
    perform public.insert_production_orders(p_id, p_orders, v_importado);
  end if;

  return p_id;
end;
$$;

comment on function public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text) is
  'Corrige um apontamento: OPs (substitui; lista vazia tira todas), data, turno, '
  'modo, observação e nº de pessoas. Nulo mantém; zero apaga as pessoas. Destino '
  'ocupado é recusado com o destino na mensagem. Mudar a data refaz a meta, '
  'exceto nos importados. [D08, D52, D54, D57, D59]';


-- ─── bulk_update_production_records ─────────────────────────────────────────
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
  v_count  integer;
  v_id     uuid;
  v_choque text;
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

  if p_new_date is not null and exists (
       select 1 from public.production_records r
        where r.id = any (p_ids)
          and r.import_batch_id is null
          and coalesce(r.operator_count, 0) = 0
          and public.exige_numero_de_operadores(r.machine_id, p_new_date)) then
    raise exception 'Há apontamento sem o nº de pessoas numa máquina com meta por pessoa. Corrija-o antes de mover. Nada foi alterado.'
      using errcode = '23514';
  end if;

  -- Choque com quem NÃO está na seleção (dois selecionados trocando de lugar
  -- entre si ainda caem na chave única, abaixo).
  select public.descrever_destino(r.machine_id, coalesce(p_new_date, r.production_date),
                                  coalesce(p_new_shift_id, r.shift_id), r.work_mode)
    into v_choque
    from public.production_records r
   where r.id = any (p_ids)
     and exists (select 1 from public.production_records x
                  where not (x.id = any (p_ids))
                    and x.machine_id = r.machine_id
                    and x.production_date = coalesce(p_new_date, r.production_date)
                    and x.shift_id = coalesce(p_new_shift_id, r.shift_id)
                    and x.work_mode = r.work_mode)
   order by r.production_date, r.shift_id
   limit 1;

  if v_choque is not null then
    raise exception 'Já existe apontamento da %. Nada foi alterado.', v_choque using errcode = '23505';
  end if;

  begin
    update public.production_records
       set production_date = coalesce(p_new_date, production_date),
           shift_id        = coalesce(p_new_shift_id, shift_id),
           updated_by      = auth.uid()
     where id = any (p_ids);
    get diagnostics v_count = row_count;
  exception when unique_violation then
    raise exception 'Dois apontamentos selecionados iriam para o mesmo lugar (mesma máquina, data, turno e modo). Nada foi alterado.'
      using errcode = '23505';
  end;

  if p_new_date is not null then
    foreach v_id in array p_ids loop
      perform public.refazer_meta_do_apontamento(v_id);
    end loop;
  end if;

  return v_count;
end;
$$;

comment on function public.bulk_update_production_records(uuid[], date, smallint) is
  'Move data e/ou troca turno de até 200 apontamentos, atomicamente. Destino '
  'ocupado é recusado citando o primeiro choque. Mudar a data refaz a meta, '
  'exceto nos importados. Exige production.bulk_edit. [D59]';
