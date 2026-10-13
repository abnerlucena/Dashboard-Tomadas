-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0041 — OP não informada: o apontamento grava sem número de OP
-- Decisões: D68 (nova), D57, D62
--
-- CONTEXTO (12/10/2026): no teste na fábrica, digitar o nº da OP (número
-- longo, uma por máquina e turno) tomava tempo demais do distribuidor. Sem a
-- integração com o SAP, o gestor tornou a OP OPCIONAL no Apontamento. Sem
-- valor próprio para "não informada", a tela mandava a OP como "0" — o único
-- número que o banco aceitava — e a D62 criaria UMA OP "0" "a conferir",
-- juntando os apontamentos sem número de TODAS as máquinas, com a produção
-- somada e as observações misturadas.
--
-- O QUE MUDA
--   • `production_orders.order_number` aceita nulo = OP NÃO INFORMADA. A linha
--     guarda as peças normalmente; produção, meta e atingimento não dependem
--     da OP.
--   • `insert_production_orders`: número vazio, ausente ou SÓ ZEROS ("0",
--     "000") vira nulo. O "só zeros" está aí de propósito: a tela já em uso
--     manda "0", e assim ela funciona sem esperar a troca do lado dela.
--   • OP não informada NÃO cria OP na aba OPs (como o IMPORTADO, D57).
--   • "Só zeros" não é OP: `work_orders` passa a recusar, e o cadastro da aba
--     OPs também. Nenhum número real de OP do SAP é só zeros.
--
-- Conferido antes de aplicar: nenhuma OP "0" em `work_orders` nem em
-- `production_orders`. Não há o que limpar.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. A coluna aceita "não informada" ────────────────────────────────────
alter table public.production_orders
  alter column order_number drop not null;

-- Vazio não é "não informada": não informada é nulo, e só nulo.
alter table public.production_orders
  add constraint production_orders_order_number_not_blank
  check (order_number is null or trim(order_number) <> '');

comment on column public.production_orders.order_number is
  'Nº da OP, em texto (preserva zeros à esquerda). Nulo = OP não informada '
  '(D68). Só números de 1 a 15 dígitos pelo app (D57); o histórico importado é IMPORTADO.';


-- ─── 2. "Só zeros" não é OP ─────────────────────────────────────────────────
alter table public.work_orders
  add constraint work_orders_order_number_not_zero
  check (order_number !~ '^0+$');


-- ─── 3. insert_production_orders: vazio ou zeros = não informada ────────────
-- Igual à da 0039 (motivo do retrabalho), mais o tratamento do número.
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

  -- Só confere o formato de quem DIGITOU um número. Vazio e "só zeros" são
  -- "não informada" (D68) e passam.
  select trim(o ->> 'order_number') into v_invalida
    from jsonb_array_elements(p_orders) as o
   where coalesce((o ->> 'quantity')::numeric, 0) > 0
     and coalesce(trim(o ->> 'order_number'), '') !~ '^0*$'
     and trim(o ->> 'order_number') !~ '^[0-9]{1,15}$'
     and not (p_permite_importado and trim(o ->> 'order_number') = 'IMPORTADO')
   limit 1;

  if found then
    raise exception 'Nº da OP inválido: "%". Use só números, até 15 dígitos, ou deixe em branco.', v_invalida
      using errcode = '23514';
  end if;

  insert into public.production_orders
    (production_record_id, order_number, quantity, is_rework, notes, rework_reason)
  select p_record_id,
         case when coalesce(trim(o ->> 'order_number'), '') ~ '^0*$' then null
              else trim(o ->> 'order_number') end,
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
  -- apontamento. OP não informada (nulo, vazio, só zeros) não vira OP (D68).
  insert into public.work_orders (order_number, machine_id, stage, source, created_by)
  select distinct trim(o ->> 'order_number'), r.machine_id, 'pending_review', 'apontamento', auth.uid()
    from jsonb_array_elements(p_orders) as o
    join public.production_records r on r.id = p_record_id
   where coalesce((o ->> 'quantity')::numeric, 0) > 0
     and trim(o ->> 'order_number') ~ '^[0-9]{1,15}$'
     and trim(o ->> 'order_number') !~ '^0+$'
  on conflict (order_number) do nothing;

  return v_count;
end;
$$;

revoke all on function public.insert_production_orders(uuid, jsonb, boolean) from public, anon, authenticated;


-- ─── 4. create_work_order: "só zeros" com mensagem clara ────────────────────
-- Igual à da 0036, mais a recusa do "só zeros". Mesma assinatura: as
-- permissões ficam.
create or replace function public.create_work_order(
  p_order_number         text,
  p_machine_id           integer,
  p_material_code        text    default null,
  p_material_description text    default null,
  p_planned_quantity     integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('work_orders.manage') then
    raise exception 'Você não tem permissão para cadastrar OPs.' using errcode = '42501';
  end if;
  if trim(coalesce(p_order_number, '')) !~ '^[0-9]{1,15}$' then
    raise exception 'Nº da OP inválido: "%". Use só números, até 15 dígitos.', p_order_number using errcode = '23514';
  end if;
  if trim(p_order_number) ~ '^0+$' then
    raise exception 'Nº da OP inválido: "%". Uma OP não pode ser só zeros.', p_order_number using errcode = '23514';
  end if;

  begin
    insert into public.work_orders (order_number, machine_id, material_code, material_description,
                                    planned_quantity, stage, source, created_by)
    values (trim(p_order_number), p_machine_id, nullif(trim(p_material_code), ''),
            nullif(trim(p_material_description), ''), p_planned_quantity, 'waiting', 'app', auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A OP % já está cadastrada.', trim(p_order_number) using errcode = '23505';
  end;

  return v_id;
end;
$$;
