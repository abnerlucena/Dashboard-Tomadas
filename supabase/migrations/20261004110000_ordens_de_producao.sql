-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0036 — A OP passa a existir por si: cadastro, situação e conversa
-- Decisões: D62 (nova), D57, D09, D10
--
-- ATÉ AQUI a OP era só um número escrito dentro de cada linha de apontamento
-- (`production_orders.order_number`). As telas de OPs e de Feedbacks da
-- interface nova tratam a OP como coisa própria: tem máquina, material,
-- quantidade pedida, situação, e uma conversa.
--
-- O QUE O GESTOR DEFINIU (04/10/2026):
--   • ORIGEM: por enquanto o DISTRIBUIDOR cadastra a OP na aba OPs. O objetivo
--     é puxar do SAP — e o terreno tem de ficar pronto para essa integração;
--   • OP NÃO CADASTRADA NO APONTAMENTO: entra, e a OP nasce "A CONFERIR";
--   • MATERIAL: pertence à OP (código e descrição), não ao apontamento;
--   • CONVERSA: como a tela desenha — gestão, preparadores e líderes
--     conversam; o operador não entra, mas a observação que ele escreve no
--     apontamento aparece na conversa.
--
-- AS PEÇAS:
--   1. permissão nova `work_orders.manage` (cadastrar e mudar a situação);
--   2. `work_orders` — a OP;
--   3. `work_order_messages` — a conversa; `work_order_reads` — até onde cada
--      pessoa leu;
--   4. o apontamento cria a OP "a conferir" quando o número é novo;
--   5. funções do app: cadastrar, corrigir, mudar situação, escrever, marcar
--      como lida;
--   6. a porta do SAP: `importar_ops_do_sap(jsonb)`, idempotente pelo número;
--   7. views: `work_order_summary` (OP + produzido) e `work_order_conversation`
--      (mensagens + observações do operador, na ordem).
--
-- A LIGAÇÃO COM O APONTAMENTO é pelo número, e não por chave estrangeira: o
-- histórico tem 2.713 linhas `IMPORTADO`, que não são OP nenhuma (D57).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Permissão ───────────────────────────────────────────────────────────
-- Distribuidor para cima. O catálogo da tela usava `feedbacks.view` para as OPs
-- porque só havia leitura; cadastrar e mudar a situação é outra coisa.
insert into public.permissions (code, description, category, sort_order)
values ('work_orders.manage', 'Cadastrar OPs e mudar a situação delas', 'Apontamento', 25)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, 'work_orders.manage'
  from public.roles r
 where r.code in ('distributor', 'technician', 'manager', 'admin')
on conflict do nothing;

-- Quem já foi aprovado recebe também (D22 e a lição da 0020).
select public.sincronizar_permissoes_dos_papeis();


-- ─── 2. A OP ────────────────────────────────────────────────────────────────
create table if not exists public.work_orders (
  id                   uuid primary key default gen_random_uuid(),
  -- O mesmo formato do apontamento (D57). É a chave natural: é por ela que o
  -- apontamento se liga à OP e que a carga do SAP reconhece a OP.
  order_number         text not null unique check (order_number ~ '^[0-9]{1,15}$'),
  machine_id           integer not null references public.machines(id),
  material_code        text check (material_code is null or material_code ~ '^[0-9]{1,18}$'),
  material_description text check (material_description is null or length(trim(material_description)) > 0),
  planned_quantity     integer check (planned_quantity is null or planned_quantity > 0),
  -- pending_review = "a conferir": nasceu de um apontamento com número novo.
  stage                text not null default 'waiting'
                       check (stage in ('pending_review', 'waiting', 'running', 'paused', 'done')),
  pause_reason         text,
  released_at          timestamptz,
  closed_at            timestamptz,
  -- De onde veio. 'sap' fica pronto para a integração.
  source               text not null default 'app' check (source in ('app', 'apontamento', 'sap')),
  sap_synced_at        timestamptz,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_by           uuid references public.profiles(id),
  updated_at           timestamptz not null default now(),
  -- Pausada sempre tem motivo; só pausada tem motivo.
  constraint work_orders_pause_reason
    check ((stage = 'paused') = (pause_reason is not null))
);

create index if not exists work_orders_machine_stage_idx on public.work_orders (machine_id, stage);

create trigger set_updated_at before update on public.work_orders
  for each row execute function public.set_updated_at();
create trigger audit_row_change after insert or update or delete on public.work_orders
  for each row execute function public.audit_row_change();

comment on table public.work_orders is
  'Ordem de produção. Liga-se ao apontamento pelo número (order_number). Nasce '
  'no app, num apontamento com número novo (a conferir) ou, no futuro, do SAP. [D62]';


-- ─── 3. A conversa, e até onde cada um leu ──────────────────────────────────
create table if not exists public.work_order_messages (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  -- Nulo = mensagem do sistema ("OP liberada", "Pausada: falta de material").
  author_id     uuid references public.profiles(id),
  body          text not null check (length(trim(body)) > 0),
  created_at    timestamptz not null default now()
);
create index if not exists work_order_messages_order_idx on public.work_order_messages (work_order_id, created_at);

create table if not exists public.work_order_reads (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (user_id, work_order_id)
);

comment on table public.work_order_messages is
  'Conversa de uma OP. O operador não escreve aqui: a observação dele no '
  'apontamento aparece na view work_order_conversation. [D62]';


-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
-- Toda escrita passa pelas funções abaixo. Leitura: a OP é vista por quem
-- aponta (a tela de apontamento lista as OPs liberadas da máquina) e por quem
-- vê feedbacks; a conversa, só por quem vê feedbacks.
alter table public.work_orders         enable row level security;
alter table public.work_order_messages enable row level security;
alter table public.work_order_reads    enable row level security;

create policy work_orders_select on public.work_orders for select to authenticated
  using ((select public.has_permission('production.create')) or (select public.has_permission('feedbacks.view')));
create policy work_order_messages_select on public.work_order_messages for select to authenticated
  using ((select public.has_permission('feedbacks.view')));
create policy work_order_reads_select on public.work_order_reads for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.work_orders, public.work_order_messages, public.work_order_reads to authenticated;
revoke all on public.work_orders, public.work_order_messages, public.work_order_reads from anon;


-- ─── 5. O apontamento cria a OP "a conferir" ───────────────────────────────
-- Igual à 0030, mais o bloco do fim. Número novo vira OP pendente na máquina
-- do apontamento. `IMPORTADO` não é OP e fica de fora.
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

  insert into public.production_orders (production_record_id, order_number, quantity, is_rework, notes)
  select p_record_id,
         trim(o ->> 'order_number'),
         (o ->> 'quantity')::integer,
         coalesce((o ->> 'is_rework')::boolean, false),
         nullif(trim(o ->> 'notes'), '')
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


-- ─── 6. Funções do app ──────────────────────────────────────────────────────

-- Mensagem do sistema, num lugar só.
create or replace function public.registrar_na_conversa(p_work_order_id uuid, p_texto text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.work_order_messages (work_order_id, author_id, body)
  values (p_work_order_id, null, p_texto);
$$;
revoke all on function public.registrar_na_conversa(uuid, text) from public, anon, authenticated;

-- Cadastrar uma OP (aba OPs). Nasce aguardando liberação.
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

-- Corrigir os dados de uma OP. É também como se confere uma OP "a conferir":
-- completa máquina, material e quantidade, e ela passa a aguardar liberação.
create or replace function public.update_work_order(
  p_id                   uuid,
  p_machine_id           integer default null,
  p_material_code        text    default null,
  p_material_description text    default null,
  p_planned_quantity     integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.work_orders;
begin
  if not public.has_permission('work_orders.manage') then
    raise exception 'Você não tem permissão para alterar OPs.' using errcode = '42501';
  end if;
  select * into v_op from public.work_orders where id = p_id for update;
  if not found then
    raise exception 'OP não encontrada.' using errcode = 'P0002';
  end if;

  update public.work_orders
     set machine_id           = coalesce(p_machine_id, machine_id),
         material_code        = coalesce(nullif(trim(p_material_code), ''), material_code),
         material_description = coalesce(nullif(trim(p_material_description), ''), material_description),
         planned_quantity     = coalesce(p_planned_quantity, planned_quantity),
         -- Conferida: sai de "a conferir" e passa a aguardar liberação.
         stage                = case when stage = 'pending_review' then 'waiting' else stage end,
         updated_by           = auth.uid()
   where id = p_id;

  if v_op.stage = 'pending_review' then
    perform public.registrar_na_conversa(p_id, 'OP conferida.');
  end if;
end;
$$;

-- Mudar a situação. As passagens permitidas são as da tela:
--   aguardando → em produção (liberar)
--   em produção → pausada (com motivo) | concluída
--   pausada → em produção (retomar) | concluída
--   concluída → em produção (reabrir, o "desfazer" da tela)
create or replace function public.set_work_order_stage(
  p_id     uuid,
  p_stage  text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op     public.work_orders;
  v_quem   text;
begin
  if not public.has_permission('work_orders.manage') then
    raise exception 'Você não tem permissão para mudar a situação de OPs.' using errcode = '42501';
  end if;
  select * into v_op from public.work_orders where id = p_id for update;
  if not found then
    raise exception 'OP não encontrada.' using errcode = 'P0002';
  end if;
  if p_stage = 'paused' and nullif(trim(p_reason), '') is null then
    raise exception 'Informe o motivo da pausa.' using errcode = '22023';
  end if;
  if not (
       (v_op.stage = 'waiting' and p_stage = 'running')
    or (v_op.stage = 'running' and p_stage in ('paused', 'done'))
    or (v_op.stage = 'paused'  and p_stage in ('running', 'done'))
    or (v_op.stage = 'done'    and p_stage = 'running')
  ) then
    raise exception 'Não dá para passar a OP de "%" para "%".', v_op.stage, p_stage using errcode = '22023';
  end if;

  update public.work_orders
     set stage        = p_stage,
         pause_reason = case when p_stage = 'paused' then trim(p_reason) end,
         released_at  = case when p_stage = 'running' and released_at is null then now() else released_at end,
         closed_at    = case when p_stage = 'done' then now() when p_stage = 'running' then null else closed_at end,
         updated_by   = auth.uid()
   where id = p_id;

  select full_name into v_quem from public.profiles where id = auth.uid();
  perform public.registrar_na_conversa(p_id, case
    when v_op.stage = 'waiting' then format('OP liberada para produção por %s.', coalesce(v_quem, 'alguém'))
    when p_stage = 'paused'     then format('Pausada por %s: %s.', coalesce(v_quem, 'alguém'), trim(p_reason))
    when p_stage = 'done'       then format('OP concluída por %s.', coalesce(v_quem, 'alguém'))
    when v_op.stage = 'done'    then format('OP reaberta por %s.', coalesce(v_quem, 'alguém'))
    else                             format('Produção retomada por %s.', coalesce(v_quem, 'alguém'))
  end);
end;
$$;

-- Escrever na conversa. Quem vê feedbacks escreve; o operador não (D62).
create or replace function public.post_work_order_message(p_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('feedbacks.view') then
    raise exception 'Você não tem permissão para escrever na conversa da OP.' using errcode = '42501';
  end if;
  if nullif(trim(p_body), '') is null then
    raise exception 'A mensagem está vazia.' using errcode = '22023';
  end if;
  if (select stage from public.work_orders where id = p_id) = 'done' then
    raise exception 'A OP está concluída e a conversa foi encerrada.' using errcode = '22023';
  end if;

  insert into public.work_order_messages (work_order_id, author_id, body)
  values (p_id, auth.uid(), trim(p_body))
  returning id into v_id;

  -- Quem escreveu leu tudo até aqui.
  perform public.mark_work_order_read(p_id);
  return v_id;
exception when foreign_key_violation then
  raise exception 'OP não encontrada.' using errcode = 'P0002';
end;
$$;

create or replace function public.mark_work_order_read(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.work_order_reads (user_id, work_order_id, last_read_at)
  values (auth.uid(), p_id, now())
  on conflict (user_id, work_order_id) do update set last_read_at = excluded.last_read_at;
$$;


-- ─── 7. A porta do SAP ──────────────────────────────────────────────────────
-- Recebe uma lista de OPs e faz upsert pelo número. Feita agora para que a
-- integração, quando vier, seja só "mandar a lista" — sem migration nova.
--
--   [{ "order_number": "4501234", "machine_id": 2, "material_code": "10012345",
--      "material_description": "...", "planned_quantity": 50000 }]
--
-- O SAP manda nos DADOS da OP (máquina, material, quantidade). A SITUAÇÃO é da
-- fábrica: uma OP que já está em produção não volta para "aguardando" porque o
-- SAP a mandou de novo. OP nova chega aguardando liberação. Uma OP que nasceu
-- "a conferir" no apontamento é conferida pelo SAP.
create or replace function public.importar_ops_do_sap(p_ops jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.pode_importar() then
    raise exception 'Você não tem permissão para importar OPs.' using errcode = '42501';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'As OPs devem ser enviadas como lista.' using errcode = '22023';
  end if;

  insert into public.work_orders as w
         (order_number, machine_id, material_code, material_description, planned_quantity,
          stage, source, sap_synced_at)
  select trim(o ->> 'order_number'), (o ->> 'machine_id')::integer,
         nullif(trim(o ->> 'material_code'), ''), nullif(trim(o ->> 'material_description'), ''),
         (o ->> 'planned_quantity')::integer, 'waiting', 'sap', now()
    from jsonb_array_elements(p_ops) as o
  on conflict (order_number) do update
     set machine_id           = excluded.machine_id,
         material_code        = coalesce(excluded.material_code, w.material_code),
         material_description = coalesce(excluded.material_description, w.material_description),
         planned_quantity     = coalesce(excluded.planned_quantity, w.planned_quantity),
         stage                = case when w.stage = 'pending_review' then 'waiting' else w.stage end,
         sap_synced_at        = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ─── 8. Views ───────────────────────────────────────────────────────────────
-- A OP com o produzido. Retrabalho não conta como produzido (§ 4.1 da nota de
-- 27/09). `security_invoker`: quem lê vê só o que a RLS deixa.
create or replace view public.work_order_summary
with (security_invoker = true) as
select w.*,
       coalesce(p.produced, 0)  as produced_quantity,
       coalesce(p.rework, 0)    as rework_quantity,
       coalesce(p.entries, 0)   as entry_count,
       p.last_entry_at
  from public.work_orders w
  left join lateral (
    select sum(po.quantity) filter (where not po.is_rework) as produced,
           sum(po.quantity) filter (where po.is_rework)     as rework,
           count(*)                                         as entries,
           max(po.created_at)                               as last_entry_at
      from public.production_orders po
     where po.order_number = w.order_number
  ) p on true;

-- A conversa inteira, na ordem: mensagens, mais as observações que o operador
-- escreveu no apontamento daquela OP. O operador não entra na conversa, mas o
-- que ele escreveu aparece nela (decisão do gestor).
create or replace view public.work_order_conversation
with (security_invoker = true) as
select m.id, m.work_order_id, m.created_at, m.author_id,
       case when m.author_id is null then 'system' else 'message' end as kind,
       m.body, null::smallint as shift_id, false as is_rework
  from public.work_order_messages m
union all
select po.id, w.id, po.created_at, r.created_by, 'operator_note', po.notes, r.shift_id, po.is_rework
  from public.production_orders po
  join public.production_records r on r.id = po.production_record_id
  join public.work_orders w on w.order_number = po.order_number
 where po.notes is not null;

grant select on public.work_order_summary, public.work_order_conversation to authenticated;


-- ─── 9. Quem executa ────────────────────────────────────────────────────────
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'create_work_order(text, integer, text, text, integer)',
    'update_work_order(uuid, integer, text, text, integer)',
    'set_work_order_stage(uuid, text, text)',
    'post_work_order_message(uuid, text)',
    'mark_work_order_read(uuid)',
    'importar_ops_do_sap(jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', v_fn);
    execute format('grant execute on function public.%s to authenticated', v_fn);
  end loop;
end $$;
