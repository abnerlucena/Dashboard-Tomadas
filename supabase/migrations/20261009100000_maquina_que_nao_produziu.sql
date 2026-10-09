-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0040 — Máquina que não produziu: motivo da parada no apontamento
-- Decisões: D67 (nova), D08, D16, D27, D52, D54, D66
--
-- PEDIDO da sessão da interface (nota 2026-10-09-maquina-que-nao-produziu.md):
-- o Apontamento ganhou o botão "Não produziu", com o motivo. Sem campo no
-- banco, ele gravava um apontamento sem peças com a observação
-- "Não produziu: <motivo>" — que aparece em Feedbacks como observação comum,
-- não soma por motivo e deixa a meta do turno valendo.
--
-- DECISÕES DO GESTOR (09/10/2026):
--   • o motivo é TEXTO LIVRE, como o do retrabalho (D66); a tela sugere os
--     motivos;
--   • SÓ AS PARADAS PLANEJADAS SAEM DA META. As outras (sem OP, sem operador,
--     falta de material, máquina parada) continuam contando: são problemas que
--     a gestão precisa ver no atingimento.
--
-- COMO O BANCO SABE QUE A PARADA É PLANEJADA: com texto livre, ele não tem como
-- deduzir pelo motivo. A tela manda a marcação junto (`stop_planned`), e marca
-- as que o gestor definiu como planejadas (Manutenção e Setup / troca). O
-- banco usa a marcação, não o texto.
--
-- REGRAS
--   • o motivo só existe em apontamento SEM PEÇAS. Mandar motivo junto com
--     peças é recusado; e lançar peças depois num apontamento parado tira a
--     parada sozinho (a máquina produziu, afinal);
--   • parada planejada sai da meta como o dia anulado (`counts_toward_target`
--     falso): o turno não entra na conta do atingimento;
--   • a máquina parada não exige o nº de operadores (D54): exigir gente de quem
--     ficou "sem operador" não faz sentido;
--   • nas funções: motivo nulo = mantém; motivo vazio = tira a parada.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Colunas ─────────────────────────────────────────────────────────────
alter table public.production_records
  add column stop_reason  text,
  add column stop_planned boolean not null default false;

alter table public.production_records
  add constraint production_records_stop_check
  check (
    (stop_reason is null and not stop_planned)
    or (stop_reason is not null and nullif(trim(stop_reason), '') is not null)
  );

comment on column public.production_records.stop_reason is
  'Motivo de a máquina não ter produzido no turno, em texto livre (D67). Só em '
  'apontamento sem peças; lançar peças tira a parada.';
comment on column public.production_records.stop_planned is
  'A parada é planejada (manutenção, setup): o turno sai da meta, como o dia '
  'anulado. Marcada pela tela; só existe com stop_reason. [D67]';


-- ─── 2. Lançar peças tira a parada ──────────────────────────────────────────
-- Num gatilho, para valer por qualquer caminho que grave OPs.
create or replace function public.tira_parada_ao_lancar_pecas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.production_records
     set stop_reason = null, stop_planned = false
   where id = new.production_record_id
     and stop_reason is not null;
  return new;
end;
$$;

revoke all on function public.tira_parada_ao_lancar_pecas() from public, anon, authenticated;

create trigger tira_parada_ao_lancar_pecas
  after insert on public.production_orders
  for each row execute function public.tira_parada_ao_lancar_pecas();


-- ─── 3. A view: parada planejada sai da meta ────────────────────────────────
-- Igual à da 0027 (teto na meta rateada), mudando `counts_toward_target` e
-- acrescentando as duas colunas no fim (create or replace view só acrescenta
-- colunas no fim).
create or replace view public.production_summary
with (security_invoker = true)
as
select
  r.id,
  r.production_date,
  r.shift_id,
  s.name                                              as shift_name,
  r.machine_id,
  m.name                                              as machine_name,
  r.target_quantity,
  r.operator_count,
  r.work_mode,
  r.notes,
  r.created_by,
  r.updated_by,
  r.created_at,
  r.updated_at,
  coalesce(o.good_quantity, 0)::integer               as good_quantity,
  coalesce(o.rework_quantity, 0)::integer             as rework_quantity,
  (coalesce(o.good_quantity, 0) + coalesce(o.rework_quantity, 0))::integer as total_quantity,
  coalesce(o.order_count, 0)::integer                 as order_count,
  case when r.operator_count is not null and m.standard_operator_count > 0
       then round(r.operator_count::numeric / m.standard_operator_count, 4)
  end                                                 as staffing_ratio,
  -- Meta corrigida pela lotação (D12), como informação. 0 pessoas = não informado.
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(nullif(r.operator_count, 0),
                                         nullif(m.standard_operator_count, 0), 1))::integer
    when nullif(r.operator_count, 0) is not null and m.standard_operator_count > 0
      then round(r.target_quantity * r.operator_count::numeric / m.standard_operator_count)::integer
  end                                                 as adjusted_target,
  coalesce(x.is_excluded, false)                      as is_excluded_day,
  -- D67: parada planejada sai da meta, como o dia anulado (D16) e a hora extra (D27).
  (r.work_mode = 'regular' and not coalesce(x.is_excluded, false) and not r.stop_planned)
                                                      as counts_toward_target,
  -- A meta com que comparar a produção deste turno (D46, D47, D48).
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(nullif(r.operator_count, 0),
                                         nullif(m.standard_operator_count, 0), 1))::integer
    when r.target_basis = 'per_shift_prorated'
         and nullif(r.operator_count, 0) is not null
         and m.standard_operator_count > 0
      -- O `least` é o teto: gente ACIMA da lotação padrão não aumenta a meta.
      then round(r.target_quantity
                 * least(r.operator_count, m.standard_operator_count)::numeric
                 / m.standard_operator_count)::integer
    else r.target_quantity
  end                                                 as effective_target,
  r.target_basis,
  r.stop_reason,
  r.stop_planned
from public.production_records r
join public.machines m on m.id = r.machine_id
join public.shifts   s on s.id = r.shift_id
left join lateral (
  select sum(po.quantity) filter (where not po.is_rework) as good_quantity,
         sum(po.quantity) filter (where po.is_rework)     as rework_quantity,
         count(*)                                         as order_count
    from public.production_orders po
   where po.production_record_id = r.id
) o on true
left join lateral (
  select true as is_excluded
    from public.calendar_events e
   where e.event_date = r.production_date
     and e.event_type = 'excluded_day'
     and (
       not exists (select 1 from public.calendar_event_shifts es where es.event_id = e.id)
       or exists (select 1 from public.calendar_event_shifts es
                   where es.event_id = e.id and es.shift_id = r.shift_id)
     )
   limit 1
) x on true;

comment on view public.production_summary is
  'Resumo por apontamento: produção boa, retrabalho, meta efetiva e se conta para '
  'a meta (não conta: hora extra, dia anulado, parada planejada). A meta rateada '
  'tem teto na lotação padrão. [D12, D46, D47, D48, D49, D67]';


-- ─── 4. Regra comum às duas funções ─────────────────────────────────────────
-- Recusa parada junto com peças. `p_orders` nulo = as OPs não mudam, então
-- valem as que o apontamento já tem.
create or replace function public.confere_parada(
  p_record_id uuid, p_stop_reason text, p_orders jsonb, p_replace boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pecas_novas boolean;
  v_pecas_atuais boolean;
begin
  if nullif(trim(p_stop_reason), '') is null then
    return;
  end if;
  v_pecas_novas := exists (select 1 from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) o
                            where coalesce((o ->> 'quantity')::numeric, 0) > 0);
  v_pecas_atuais := p_record_id is not null
                    and not (p_replace and p_orders is not null)
                    and exists (select 1 from public.production_orders where production_record_id = p_record_id);
  if v_pecas_novas or v_pecas_atuais then
    raise exception 'Máquina que não produziu não tem peças. Tire as OPs ou desmarque "Não produziu".'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.confere_parada(uuid, text, jsonb, boolean) from public, anon, authenticated;


-- ─── 5. save_production_record: motivo da parada ────────────────────────────
-- Acrescentar parâmetro cria uma SEGUNDA função (D53.1): derruba a antiga.
drop function if exists public.save_production_record(date, smallint, integer, jsonb, text, smallint, text, boolean);

create function public.save_production_record(
  p_production_date date,
  p_shift_id        smallint,
  p_machine_id      integer,
  p_orders          jsonb    default null,
  p_notes           text     default null,
  p_operator_count  smallint default null,
  p_work_mode       text     default 'regular',
  p_replace_orders  boolean  default false,
  -- D67: nulo = mantém; vazio = tira a parada.
  p_stop_reason     text     default null,
  p_stop_planned    boolean  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode    text := coalesce(p_work_mode, 'regular');
  v_exige   boolean := public.exige_numero_de_operadores(p_machine_id, p_production_date);
  v_rec     public.production_records;
  v_id      uuid;
  v_depois  smallint;
  v_parada  text;
  v_planej  boolean;
  v_existe  boolean;
begin
  select * into v_rec
    from public.production_records
   where machine_id = p_machine_id
     and production_date = p_production_date
     and shift_id = p_shift_id
     and work_mode = v_mode
   for update;  -- trava a linha: dois salvamentos simultâneos não se atropelam
  -- Guardado já: o PERFORM abaixo reescreve o FOUND.
  v_existe := found;

  v_depois := case when p_operator_count is null then v_rec.operator_count
                   when p_operator_count = 0 then null
                   else p_operator_count end;
  -- A parada DEPOIS deste salvamento (mesma lógica de nulo/vazio).
  v_parada := case when p_stop_reason is null then v_rec.stop_reason
                   else nullif(trim(p_stop_reason), '') end;
  v_planej := v_parada is not null
              and coalesce(p_stop_planned, case when p_stop_reason is null then v_rec.stop_planned end, false);

  perform public.confere_parada(v_rec.id, p_stop_reason, p_orders, p_replace_orders);

  -- Máquina parada não exige o nº de pessoas (D67 sobre a D54).
  if v_exige and v_parada is null and coalesce(v_depois, 0) = 0 then
    raise exception 'Informe quantas pessoas trabalharam neste turno: a meta desta máquina é por pessoa.'
      using errcode = '23514';
  end if;

  if not v_existe then
    if not public.has_permission('production.create') then
      raise exception 'Você não tem permissão para apontar produção.' using errcode = '42501';
    end if;

    insert into public.production_records
      (production_date, shift_id, machine_id, target_quantity, target_basis,
       operator_count, work_mode, notes, stop_reason, stop_planned, created_by)
    values (
      p_production_date,
      p_shift_id,
      p_machine_id,
      coalesce(public.machine_target_on(p_machine_id, p_production_date), 0),
      public.machine_target_basis_on(p_machine_id, p_production_date),
      case when p_operator_count = 0 then null
           else coalesce(p_operator_count,
                  (select m.standard_operator_count from public.machines m where m.id = p_machine_id))
      end,
      v_mode,
      nullif(trim(p_notes), ''),
      v_parada,
      v_planej,
      auth.uid()
    )
    returning id into v_id;
  else
    if not public.can_edit_production_record(v_rec.created_by, v_rec.created_at) then
      raise exception 'Já existe apontamento desta máquina neste dia e turno, e você não tem permissão para alterá-lo.'
        using errcode = '42501';
    end if;
    v_id := v_rec.id;

    update public.production_records
       set notes          = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
           operator_count = v_depois,
           stop_reason    = v_parada,
           stop_planned   = v_planej,
           updated_by     = auth.uid()
     where id = v_id;

    if p_replace_orders and p_orders is not null then
      delete from public.production_orders where production_record_id = v_id;
    end if;
  end if;

  perform public.insert_production_orders(v_id, p_orders);
  return v_id;
end;
$$;

revoke all on function public.save_production_record(date, smallint, integer, jsonb, text, smallint, text, boolean, text, boolean) from public, anon;
grant execute on function public.save_production_record(date, smallint, integer, jsonb, text, smallint, text, boolean, text, boolean) to authenticated, service_role;

comment on function public.save_production_record(date, smallint, integer, jsonb, text, smallint, text, boolean, text, boolean) is
  'Cria ou atualiza o apontamento de uma máquina num dia e turno. Onde a meta é '
  'por pessoa, o nº de operadores é obrigatório, exceto com a máquina parada. '
  'Parada (motivo + planejada) só sem peças; nulo mantém, vazio tira. '
  '[D08, D48, D52, D54, D67]';


-- ─── 6. update_production_record: motivo da parada ──────────────────────────
drop function if exists public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text);

create function public.update_production_record(
  p_id              uuid,
  p_notes           text     default null,
  p_operator_count  smallint default null,
  p_orders          jsonb    default null,
  p_production_date date     default null,
  p_shift_id        smallint default null,
  p_work_mode       text     default null,
  p_stop_reason     text     default null,
  p_stop_planned    boolean  default null
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
  v_parada    text;
  v_planej    boolean;
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
  v_parada    := case when p_stop_reason is null then v_rec.stop_reason
                      else nullif(trim(p_stop_reason), '') end;
  v_planej    := v_parada is not null
                 and coalesce(p_stop_planned, case when p_stop_reason is null then v_rec.stop_planned end, false);

  -- Aqui as OPs informadas SUBSTITUEM as atuais (p_replace = true).
  perform public.confere_parada(p_id, p_stop_reason, p_orders, true);

  if not v_importado
     and v_parada is null
     and public.exige_numero_de_operadores(v_rec.machine_id, v_data)
     and coalesce(v_pessoas, 0) = 0 then
    raise exception 'Informe quantas pessoas trabalharam neste turno: a meta desta máquina é por pessoa.'
      using errcode = '23514';
  end if;

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
         stop_reason     = v_parada,
         stop_planned    = v_planej,
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

revoke all on function public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text, text, boolean) from public, anon;
grant execute on function public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text, text, boolean) to authenticated, service_role;

comment on function public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text, text, boolean) is
  'Corrige um apontamento: OPs (substitui; lista vazia tira todas), data, turno, '
  'modo, observação, nº de pessoas e parada. Nulo mantém; zero apaga as pessoas; '
  'motivo vazio tira a parada. Destino ocupado é recusado com o destino na '
  'mensagem. Mudar a data refaz a meta, exceto nos importados. [D08, D52, D54, D57, D59, D67]';
