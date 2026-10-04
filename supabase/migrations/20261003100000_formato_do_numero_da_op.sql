-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0029 — O nº da OP passa a ter formato: só números, até 15
-- Decisões: D57 (nova), D35
--
-- O QUE ESTAVA SOLTO: o banco aceitava qualquer texto como nº da OP, inclusive
-- vazio. Foi de propósito: enquanto a fábrica não registrava OP, não havia o
-- que validar, e o histórico inteiro entrou como `IMPORTADO` (D35).
--
-- A interface nova pede a OP em todo apontamento. O gestor definiu em
-- 03/10/2026: **só números, no máximo 15**.
--
-- ONDE A REGRA FICA: em `insert_production_orders`, que é por onde passam o
-- apontamento novo e o completar. A tabela `production_orders` só tem
-- política de SELECT — a RLS já impede escrita direta —, então esta função é
-- a única porta do app.
--
-- O QUE NÃO MUDA:
--   • os 2.713 registros `IMPORTADO` continuam como estão. A importação grava
--     direto na tabela, por dentro do banco, e não passa por esta função;
--   • nenhuma linha existente é tocada;
--   • por isso NÃO é uma restrição `check`: ela teria de nascer `not valid`
--     para não brigar com o histórico, e restrição `not valid` é a que todo
--     mundo esquece que existe (o mesmo raciocínio da D54).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.insert_production_orders(p_record_id uuid, p_orders jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count   integer;
  v_invalida text;
begin
  if p_orders is null then
    return 0;
  end if;
  if jsonb_typeof(p_orders) <> 'array' then
    raise exception 'As ordens de produção devem ser enviadas como lista.'
      using errcode = '22023';
  end if;

  -- D57: só números, de 1 a 15. Confere ANTES de gravar qualquer linha, para
  -- o apontamento entrar inteiro ou não entrar. Linha sem quantidade é
  -- ignorada logo abaixo, então não é cobrada aqui.
  select coalesce(trim(o ->> 'order_number'), '') into v_invalida
    from jsonb_array_elements(p_orders) as o
   where coalesce((o ->> 'quantity')::numeric, 0) > 0
     and coalesce(trim(o ->> 'order_number'), '') !~ '^[0-9]{1,15}$'
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

-- create or replace preserva as permissões, mas a função é interna (só as
-- funções de apontamento a chamam): ninguém de fora deve executá-la.
revoke execute on function public.insert_production_orders(uuid, jsonb) from public, anon, authenticated;

comment on function public.insert_production_orders(uuid, jsonb) is
  'Grava as OPs de um apontamento. O nº da OP tem de ser só números, até 15 '
  'dígitos; a importação não passa por aqui. [D08, D57]';
