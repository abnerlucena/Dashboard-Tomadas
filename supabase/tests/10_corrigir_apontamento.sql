-- Corrigir um apontamento, e mover de dia leva a meta junto (migration 0030).
-- Decisões: D59, D08, D52, D54, D57. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.
-- Precisa do histórico importado no banco para os casos 9 e 10; sem ele, os
-- dois aparecem como "não há importado neste banco".

create temp table rc(n int, caso text, esperado text, resultado text);
create temp table ids(nome text primary key, id uuid);
grant all on rc, ids to authenticated;

create function pg_temp.hoje() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;
create function pg_temp.maquina(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.meta(p_id uuid) returns integer language sql as $$
  select target_quantity from public.production_records where id = p_id
$$;

-- Para provar que a meta acompanha o dia, a Horizontal N°1 ganha um degrau de
-- teste daqui a 20 dias, com 12.000. Antes dele vale a meta de hoje, 10.000.
insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
values (pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), 12000, pg_temp.hoje() + 20, 'per_shift_prorated');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');   -- gestora

-- Apontamento do app, para amanhã, na Horizontal N°1 (meta 10.000).
do $$ begin
  insert into ids values ('h', public.save_production_record(pg_temp.hoje() + 1, 1::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), '[{"order_number":"4600001","quantity":8000}]'::jsonb,
    null, 4::smallint));
end $$;

-- ─── Corrigir quantidade e OPs: substitui, não acrescenta ───────────────────
do $$ declare q int; n int; begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'),
    p_orders => '[{"order_number":"4600002","quantity":7500},{"order_number":"4600003","quantity":300,"is_rework":true}]'::jsonb);
  select sum(quantity), count(*) into q, n from public.production_orders
   where production_record_id = (select id from ids where nome = 'h');
  insert into rc values (1, 'corrigir as OPs substitui as antigas', 'aceita',
    case when q = 7800 and n = 2 then 'ACEITOU' else format('RECUSOU: %s peças em %s OPs', q, n) end);
exception when others then insert into rc values (1, 'corrigir as OPs', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── D52: zero apaga o nº de pessoas ────────────────────────────────────────
do $$ declare p int; begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'), p_operator_count => 0::smallint);
  select operator_count into p from public.production_records where id = (select id from ids where nome = 'h');
  insert into rc values (2, 'zero apaga o nº de pessoas (D52)', 'aceita',
    case when p is null then 'ACEITOU' else format('RECUSOU: ficou %s', p) end);
exception when others then insert into rc values (2, 'zero apaga', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── D59: mover de dia refaz a meta ─────────────────────────────────────────
do $$ declare m int; begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'),
    p_production_date => pg_temp.hoje() + 25);
  m := pg_temp.meta((select id from ids where nome = 'h'));
  insert into rc values (3, 'mover um apontamento para depois do degrau: meta 12.000', 'aceita',
    case when m = 12000 then 'ACEITOU' else format('RECUSOU: meta %s', m) end);
exception when others then insert into rc values (3, 'mover um apontamento', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Mudar só o turno NÃO mexe na meta (ela é do dia).
do $$ declare m int; begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'), p_shift_id => 2::smallint);
  m := pg_temp.meta((select id from ids where nome = 'h'));
  insert into rc values (4, 'trocar só o turno mantém a meta', 'aceita',
    case when m = 12000 then 'ACEITOU' else format('RECUSOU: meta %s', m) end);
exception when others then insert into rc values (4, 'trocar o turno', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Em massa, voltando para amanhã: a meta volta a 10.000.
do $$ declare m int; begin
  perform public.bulk_update_production_records(array[(select id from ids where nome = 'h')], pg_temp.hoje() + 1);
  m := pg_temp.meta((select id from ids where nome = 'h'));
  insert into rc values (5, 'mover em massa também refaz a meta: 10.000', 'aceita',
    case when m = 10000 then 'ACEITOU' else format('RECUSOU: meta %s', m) end);
exception when others then insert into rc values (5, 'mover em massa', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── D54: na A Granél, não dá para apagar o número ──────────────────────────
do $$ begin
  insert into ids values ('g', public.save_production_record(pg_temp.hoje() + 1, 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), '[{"order_number":"4600004","quantity":50000}]'::jsonb,
    null, 2::smallint));
  perform public.update_production_record(p_id => (select id from ids where nome = 'g'), p_operator_count => 0::smallint);
  insert into rc values (6, 'apagar o nº de pessoas da A Granél pela correção', 'recusa', 'ACEITOU');
exception when others then insert into rc values (6, 'apagar pessoas na A Granél', 'recusa', 'RECUSOU'); end $$;

-- ─── D57: a correção também cobra o formato da OP ───────────────────────────
do $$ begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'),
    p_orders => '[{"order_number":"OP-1","quantity":100}]'::jsonb);
  insert into rc values (7, 'corrigir para uma OP fora do formato', 'recusa', 'ACEITOU');
exception when others then insert into rc values (7, 'OP fora do formato', 'recusa', 'RECUSOU'); end $$;

-- ...e nada mudou: a recusa não deixou o apontamento sem OP nenhuma.
do $$ declare n int; begin
  select count(*) into n from public.production_orders where production_record_id = (select id from ids where nome = 'h');
  insert into rc values (8, 'a OP recusada não apagou as antigas', 'aceita',
    case when n = 2 then 'ACEITOU' else format('RECUSOU: sobraram %s OPs', n) end);
end $$;

-- ─── Importado: mantém a meta da planilha, e aceita a OP IMPORTADO ──────────
do $$ declare v uuid; antes int; depois int; begin
  select r.id, r.target_quantity into v, antes from public.production_records r
   where r.import_batch_id is not null
     and r.machine_id = pg_temp.maquina('EMBALADORA HORIZONTAL N°1')
   order by r.production_date limit 1;
  if v is null then
    insert into rc values (9, 'importado mantém a meta da planilha ao mudar de dia', 'aceita', 'ACEITOU: não há importado neste banco');
    insert into rc values (10, 'corrigir a quantidade de um importado', 'aceita', 'ACEITOU: não há importado neste banco');
    return;
  end if;

  -- Um dia em que esta máquina não tem apontamento neste turno e modo: a
  -- Horizontal aponta quase todo dia, e o destino não pode estar ocupado.
  perform public.update_production_record(p_id => v, p_production_date => (
    select d::date from public.production_records r0,
           generate_series(r0.production_date + 1, r0.production_date + 60, interval '1 day') as d
     where r0.id = v
       and not exists (select 1 from public.production_records x
                        where x.machine_id = r0.machine_id and x.production_date = d::date
                          and x.shift_id = r0.shift_id and x.work_mode = r0.work_mode)
     order by d limit 1));
  depois := pg_temp.meta(v);
  insert into rc values (9, 'importado mantém a meta da planilha ao mudar de dia', 'aceita',
    case when depois = antes then 'ACEITOU' else format('RECUSOU: %s virou %s', antes, depois) end);

  perform public.update_production_record(p_id => v,
    p_orders => '[{"order_number":"IMPORTADO","quantity":1234}]'::jsonb);
  insert into rc values (10, 'corrigir a quantidade de um importado', 'aceita',
    case when (select sum(quantity) from public.production_orders where production_record_id = v) = 1234
         then 'ACEITOU' else 'RECUSOU: quantidade não mudou' end);
exception when others then insert into rc values (9, 'importado', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ...mas IMPORTADO continua proibido num apontamento novo.
do $$ begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'),
    p_orders => '[{"order_number":"IMPORTADO","quantity":100}]'::jsonb);
  insert into rc values (11, 'IMPORTADO num apontamento do app', 'recusa', 'ACEITOU');
exception when others then insert into rc values (11, 'IMPORTADO num apontamento do app', 'recusa', 'RECUSOU'); end $$;

-- ─── Destino ocupado: recusa e diz qual (0034) ──────────────────────────────
-- 'h' está em amanhã, Turno 2. Cria outro no Turno 3 e tenta levar 'h' para lá.
-- Bloco próprio: se ficasse no bloco que dá erro de propósito, a criação seria
-- desfeita junto com ele e o destino nem existiria.
do $$ begin
  insert into ids values ('h3', public.save_production_record(pg_temp.hoje() + 1, 3::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), '[{"order_number":"4600005","quantity":100}]'::jsonb,
    null, 4::smallint));
end $$;

do $$ begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'), p_shift_id => 3::smallint);
  insert into rc values (13, 'levar para um turno ocupado', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (13, 'destino ocupado recusa citando máquina, data e turno', 'recusa',
    case when sqlerrm like '%EMBALADORA HORIZONTAL N°1 em ' || to_char(pg_temp.hoje() + 1, 'DD/MM/YYYY') || ', Turno 3%'
         then 'RECUSOU' else 'ACEITOU: a mensagem não diz o destino — ' || sqlerrm end);
end $$;

do $$ begin
  perform public.bulk_update_production_records(array[(select id from ids where nome = 'h')], null, 3::smallint);
  insert into rc values (14, 'em massa para um turno ocupado', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (14, 'em massa: recusa citando o destino', 'recusa',
    case when sqlerrm like '%Turno 3%Nada foi alterado%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

-- ─── Lista de OPs vazia: o apontamento fica sem peça (máquina parada) ───────
-- Pedido da interface: vale como no saveEntries só com observação.
do $$ declare n int; existe boolean; begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h3'), p_orders => '[]'::jsonb);
  select count(*) into n from public.production_orders where production_record_id = (select id from ids where nome = 'h3');
  select exists (select 1 from public.production_records where id = (select id from ids where nome = 'h3')) into existe;
  insert into rc values (15, 'lista vazia tira as OPs e o apontamento continua', 'aceita',
    case when n = 0 and existe then 'ACEITOU' else format('RECUSOU: %s OPs, existe=%s', n, existe) end);
exception when others then insert into rc values (15, 'lista vazia', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Permissão: operador não corrige o apontamento de outra pessoa ──────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.update_production_record(p_id => (select id from ids where nome = 'h'), p_notes => 'mexi');
  insert into rc values (12, 'operador corrige o apontamento da gestora', 'recusa', 'ACEITOU');
exception when others then insert into rc values (12, 'operador corrige o de outra pessoa', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
