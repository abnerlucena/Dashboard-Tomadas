-- Motivo do retrabalho na OP do apontamento (migration 0039).
-- Decisões: D66, D11. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.

create temp table rc(n int, caso text, esperado text, resultado text);
grant all on rc to authenticated;

create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;
create function pg_temp.vertical() returns integer language sql as $$
  select id from public.machines where name = 'EMBALADORA VERTICAL MÓDULOS N°1'
$$;
-- Aponta no turno dado, com as linhas de OP indicadas, e devolve o apontamento.
create function pg_temp.aponta(p_turno int, p_orders jsonb) returns uuid language sql as $$
  select public.save_production_record(pg_temp.amanha(), p_turno::smallint, pg_temp.vertical(), p_orders)
$$;
create function pg_temp.motivo(p_turno int, p_op text) returns text language sql as $$
  select o.rework_reason from public.production_orders o
    join public.production_records r on r.id = o.production_record_id
   where r.machine_id = pg_temp.vertical() and r.production_date = pg_temp.amanha()
     and r.shift_id = p_turno and o.order_number = p_op
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

-- ─── Grava o motivo ─────────────────────────────────────────────────────────
do $$ begin
  perform pg_temp.aponta(1, '[{"order_number":"4501001","quantity":100,"is_rework":true,"rework_reason":"  Rebarba na peça "}]'::jsonb);
  insert into rc values (1, 'retrabalho com motivo grava o motivo, sem espaços nas pontas', 'aceita',
    case when pg_temp.motivo(1, '4501001') = 'Rebarba na peça' then 'ACEITOU'
         else format('RECUSOU: gravou "%s"', pg_temp.motivo(1, '4501001')) end);
exception when others then insert into rc values (1, 'retrabalho com motivo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform pg_temp.aponta(2, '[{"order_number":"4501002","quantity":100,"is_rework":true}]'::jsonb);
  insert into rc values (2, 'retrabalho sem motivo é aceito (planilha e apontamentos antigos não têm)', 'aceita',
    case when pg_temp.motivo(2, '4501002') is null then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (2, 'retrabalho sem motivo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform pg_temp.aponta(3, '[{"order_number":"4501003","quantity":100,"is_rework":true,"rework_reason":"   "}]'::jsonb);
  insert into rc values (3, 'motivo só de espaços vira vazio, não texto', 'aceita',
    case when pg_temp.motivo(3, '4501003') is null then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (3, 'motivo em branco', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Só retrabalho tem motivo ───────────────────────────────────────────────
do $$ begin
  perform pg_temp.aponta(1, '[{"order_number":"4501004","quantity":50,"rework_reason":"Não devia ficar"}]'::jsonb);
  insert into rc values (4, 'OP que não é retrabalho descarta o motivo, sem recusar o apontamento', 'aceita',
    case when pg_temp.motivo(1, '4501004') is null then 'ACEITOU' else 'RECUSOU: gravou o motivo' end);
exception when others then insert into rc values (4, 'motivo em OP normal', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- A trava da tabela vale mesmo por fora das funções (o operador não tem
-- escrita direta, então estes dois casos rodam como dono).
reset role;
do $$ begin
  update public.production_orders set rework_reason = 'à força' where order_number = '4501004';
  insert into rc values (5, 'motivo em OP que não é retrabalho, direto na tabela', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'motivo em OP que não é retrabalho, direto na tabela', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  update public.production_orders set rework_reason = '' where order_number = '4501001';
  insert into rc values (6, 'motivo vazio direto na tabela', 'recusa', 'ACEITOU');
exception when others then insert into rc values (6, 'motivo vazio direto na tabela', 'recusa', 'RECUSOU'); end $$;

-- ─── Corrigir o apontamento troca as OPs, e o motivo vai junto ──────────────
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ declare v_id uuid; begin
  select r.id into v_id from public.production_records r
   where r.machine_id = pg_temp.vertical() and r.production_date = pg_temp.amanha() and r.shift_id = 1;
  perform public.update_production_record(v_id,
    p_orders => '[{"order_number":"4501001","quantity":100,"is_rework":true,"rework_reason":"Cor fora do padrão"}]'::jsonb);
  insert into rc values (7, 'corrigir o apontamento troca o motivo', 'aceita',
    case when pg_temp.motivo(1, '4501001') = 'Cor fora do padrão' then 'ACEITOU'
         else format('RECUSOU: ficou "%s"', pg_temp.motivo(1, '4501001')) end);
exception when others then insert into rc values (7, 'corrigir troca o motivo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare v_id uuid; begin
  select r.id into v_id from public.production_records r
   where r.machine_id = pg_temp.vertical() and r.production_date = pg_temp.amanha() and r.shift_id = 1;
  perform public.update_production_record(v_id,
    p_orders => '[{"order_number":"4501001","quantity":100}]'::jsonb);
  insert into rc values (8, 'desmarcar o retrabalho tira o motivo, sem recusar', 'aceita',
    case when pg_temp.motivo(1, '4501001') is null then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (8, 'desmarcar retrabalho', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
