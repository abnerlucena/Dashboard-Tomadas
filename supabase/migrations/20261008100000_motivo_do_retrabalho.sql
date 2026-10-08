-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0039 — Motivo do retrabalho: campo próprio na OP do apontamento
-- Decisões: D66 (nova), D11
--
-- PEDIDO da sessão da interface (nota 2026-10-08-motivo-do-retrabalho.md): a
-- tela de Apontamento passou a pedir o motivo quando a OP é retrabalho, e o
-- banco não tinha onde guardá-lo. Provisoriamente ele ia na observação da OP
-- (`notes`), que é texto livre de qualquer tipo: uma anotação comum de um
-- operador aparecia no gráfico como se fosse motivo.
--
-- DECISÃO DO GESTOR (08/10/2026): texto livre, com sugestões na tela. Sem
-- lista fechada por ora (D66).
--
--   • coluna nova `production_orders.rework_reason`;
--   • só existe quando a OP é retrabalho (CHECK) e nunca é vazia;
--   • a tela manda `rework_reason` dentro de cada item de `p_orders`; as
--     funções de apontamento não mudam de assinatura, porque a lista já é jsonb;
--   • OP que não é retrabalho descarta o motivo em vez de recusar: quem marcou
--     e desmarcou o retrabalho não deve perder o apontamento por isso;
--   • o motivo NÃO é obrigatório no banco: as OPs da planilha (carga de
--     supabase/import/) não têm motivo e entram sem ele. Exigir motivo ao
--     digitar é regra da tela.
--
-- DADOS QUE JÁ ESTAVAM EM `notes`: a tela gravava o motivo ali desde 08/10. As
-- OPs de retrabalho com observação, criadas a partir dessa data, têm a
-- observação copiada para o campo novo. A observação fica como está.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.production_orders
  add column rework_reason text;

alter table public.production_orders
  add constraint production_orders_rework_reason_check
  check (
    rework_reason is null
    or (is_rework and nullif(trim(rework_reason), '') is not null)
  );

comment on column public.production_orders.rework_reason is
  'Motivo do retrabalho, em texto livre (D66). Só existe quando is_rework = true '
  'e nunca é vazio. OPs vindas da planilha não têm motivo. Não confundir com notes, '
  'a observação da OP.';


-- ─── Cópia dos motivos que a tela já gravava em `notes` ────────────────────
update public.production_orders
   set rework_reason = nullif(trim(notes), '')
 where is_rework
   and nullif(trim(notes), '') is not null
   and created_at >= '2026-10-08'::date;


-- ─── insert_production_orders lê o motivo ───────────────────────────────────
-- Igual à da 0036, mais a coluna. Mesma assinatura: create or replace basta.
create or replace function public.insert_production_orders(
  p_record_id         uuid,
  p_orders            jsonb,
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

  insert into public.production_orders
    (production_record_id, order_number, quantity, is_rework, notes, rework_reason)
  select p_record_id,
         trim(o ->> 'order_number'),
         (o ->> 'quantity')::integer,
         coalesce((o ->> 'is_rework')::boolean, false),
         nullif(trim(o ->> 'notes'), ''),
         -- D66: o motivo só vale para retrabalho; nas outras OPs é descartado.
         case when coalesce((o ->> 'is_rework')::boolean, false)
              then nullif(trim(o ->> 'rework_reason'), '') end
    from jsonb_array_elements(p_orders) as o
   where coalesce((o ->> 'quantity')::numeric, 0) > 0;

  get diagnostics v_count = row_count;

  -- D62: número que ainda não é OP vira OP "a conferir", na máquina do
  -- apontamento. Não trava o chão de fábrica se a liberação atrasou.
  insert into public.work_orders (order_number, machine_id, stage, source, created_by)
  select distinct trim(o ->> 'order_number'), r.machine_id, 'pending_review', 'apontamento', auth.uid()
    from jsonb_array_elements(p_orders) as o
    join public.production_records r on r.id = p_record_id
   where coalesce((o ->> 'quantity')::numeric, 0) > 0
     and trim(o ->> 'order_number') ~ '^[0-9]{1,15}$'
  on conflict (order_number) do nothing;

  return v_count;
end;
$$;

revoke all on function public.insert_production_orders(uuid, jsonb, boolean) from public, anon, authenticated;
