-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0033 — A reconstrução das metas não deixa máquina sem degrau
-- Decisões: D60
--
-- O DEFEITO, na 0031: `reconstruir_metas_historicas` apagava todo degrau
-- anterior a 25/09/2026 e punha no lugar os derivados da planilha. Para uma
-- máquina SEM histórico importado e SEM degrau acordado, não havia nada para pôr
-- no lugar — e ela ficava sem meta nenhuma.
--
-- Neste banco atingiu uma: a 18, Fechamento Tecla Interruptores (inativa, sem
-- meta, sem apontamento). O único degrau dela, com meta 0, saiu junto com os de
-- reserva. Apareceu na suíte 02, cujo caso sobre essa máquina passou a dar
-- resultado NULO em vez de falhar — e por isso não foi contado nem como acerto
-- nem como erro. (As planejadas, 60 a 66, nunca tiveram degrau.)
--
-- A REGRA CERTA: os degraus antigos de uma máquina só saem quando há o que pôr
-- no lugar — degraus derivados da planilha, ou degraus acordados de 25/09 em
-- diante. Sem nenhum dos dois, a máquina fica como estava.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. A função, com a guarda ──────────────────────────────────────────────
create or replace function public.reconstruir_metas_historicas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corte constant date := date '2026-09-25';
  v_count integer;
begin
  if not public.pode_importar() then
    raise exception 'Você não tem permissão para reconstruir as metas históricas.' using errcode = '42501';
  end if;

  -- Exceção única à trava de vigência (D15); volta a valer no fim desta
  -- transação. A auditoria continua ligada.
  alter table public.machine_targets disable trigger validate_target_valid_from;

  -- Só sai o degrau antigo de quem vai continuar com meta: tem histórico
  -- importado para derivar, ou tem degrau acordado a partir do corte.
  delete from public.machine_targets t
   where t.valid_from < v_corte
     and (exists (select 1 from public.production_records r
                   where r.machine_id = t.machine_id
                     and r.import_batch_id is not null
                     and r.production_date < v_corte)
          or exists (select 1 from public.machine_targets f
                      where f.machine_id = t.machine_id
                        and f.valid_from >= v_corte));

  with por_dia as (
    select r.machine_id, r.production_date,
           max(r.target_quantity) as quantidade,
           max(r.target_basis)    as base
      from public.production_records r
     where r.import_batch_id is not null
       and r.production_date < v_corte
     group by r.machine_id, r.production_date
  ), marcados as (
    select *,
           lag(quantidade) over w is distinct from quantidade
             or lag(base) over w is distinct from base as comeca_degrau
      from por_dia
    window w as (partition by machine_id order by production_date)
  )
  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis, created_by)
  select machine_id, quantidade, production_date, coalesce(base, 'per_shift'), null
    from marcados
   where comeca_degrau
  -- Repetível: o degrau antigo que ficou (máquina sem nada para pôr no lugar)
  -- não é derivado de novo.
  on conflict (machine_id, valid_from) do nothing;

  get diagnostics v_count = row_count;

  alter table public.machine_targets enable trigger validate_target_valid_from;
  return v_count;
end;
$$;

revoke all on function public.reconstruir_metas_historicas() from public, anon, authenticated;

comment on function public.reconstruir_metas_historicas() is
  'Refaz a linha do tempo de metas anterior a 25/09/2026 a partir da meta '
  'gravada nos apontamentos importados (a da planilha). Não deixa máquina sem '
  'degrau. Repetível. Rodar depois de cada importação de histórico. Só o dono '
  'do banco ou quem tem import.manage. [D60]';


-- ─── 2. Devolver o degrau que a 0031 tirou de quem ficou sem nada ───────────
-- A auditoria guardou cada linha apagada. Para toda máquina que hoje não tem
-- degrau nenhum, volta o último degrau anterior ao corte que foi apagado.
do $$
declare
  v_count integer;
begin
  alter table public.machine_targets disable trigger validate_target_valid_from;

  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis, created_by, created_at)
  select distinct on ((a.old_data ->> 'machine_id')::integer)
         (a.old_data ->> 'machine_id')::integer,
         (a.old_data ->> 'quantity_per_shift')::integer,
         (a.old_data ->> 'valid_from')::date,
         coalesce(a.old_data ->> 'basis', 'per_shift'),
         nullif(a.old_data ->> 'created_by', '')::uuid,
         coalesce((a.old_data ->> 'created_at')::timestamptz, now())
    from public.audit_logs a
   where a.table_name = 'machine_targets'
     and a.action = 'DELETE'
     and (a.old_data ->> 'valid_from')::date < date '2026-09-25'
     and not exists (select 1 from public.machine_targets t
                      where t.machine_id = (a.old_data ->> 'machine_id')::integer)
   order by (a.old_data ->> 'machine_id')::integer, a.occurred_at desc;

  get diagnostics v_count = row_count;
  alter table public.machine_targets enable trigger validate_target_valid_from;
  raise notice 'Migration 0033: % máquina(s) recuperaram o degrau.', v_count;
end $$;
