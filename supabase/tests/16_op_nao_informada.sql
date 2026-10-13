-- OP não informada: o apontamento grava sem número de OP (migration 0041).
-- Decisões: D68, D57, D62. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.

create temp table rc(n int, caso text, esperado text, resultado text);
grant all on rc to authenticated;

create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;
create function pg_temp.maq(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.vertical() returns integer language sql as $$
  select pg_temp.maq('EMBALADORA VERTICAL MÓDULOS N°1')
$$;
create function pg_temp.horizontal() returns integer language sql as $$
  select pg_temp.maq('EMBALADORA HORIZONTAL N°1')
$$;
-- Linhas de OP gravadas num apontamento de amanhã.
create function pg_temp.linhas(p_maq integer, p_turno int)
returns table(order_number text, quantity integer) language sql as $$
  select o.order_number, o.quantity from public.production_orders o
    join public.production_records r on r.id = o.production_record_id
   where r.machine_id = p_maq and r.production_date = pg_temp.amanha() and r.shift_id = p_turno
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

-- ─── Grava sem número ───────────────────────────────────────────────────────
do $$ declare v_op text; v_qtd int; v_ops_antes int; v_ops_depois int; begin
  select count(*) into v_ops_antes from public.work_orders;
  perform public.save_production_record(pg_temp.amanha(), 1::smallint, pg_temp.vertical(),
    '[{"order_number":"","quantity":1200}]'::jsonb);
  select order_number, quantity into v_op, v_qtd from pg_temp.linhas(pg_temp.vertical(), 1);
  select count(*) into v_ops_depois from public.work_orders;
  insert into rc values (1, 'sem número: grava as peças com a OP nula, e não cria OP na aba OPs', 'aceita',
    case when v_op is null and v_qtd = 1200 and v_ops_depois = v_ops_antes then 'ACEITOU'
         else format('RECUSOU: op=%s qtd=%s ops %s→%s', v_op, v_qtd, v_ops_antes, v_ops_depois) end);
exception when others then insert into rc values (1, 'sem número', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare v_op text; begin
  perform public.save_production_record(pg_temp.amanha(), 2::smallint, pg_temp.vertical(),
    '[{"order_number":"0","quantity":800}]'::jsonb);
  select order_number into v_op from pg_temp.linhas(pg_temp.vertical(), 2);
  insert into rc values (2, '"0" (o que a tela manda hoje) também é não informada', 'aceita',
    case when v_op is null then 'ACEITOU' else format('RECUSOU: gravou "%s"', v_op) end);
exception when others then insert into rc values (2, '"0"', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare v_op text; begin
  perform public.save_production_record(pg_temp.amanha(), 3::smallint, pg_temp.vertical(),
    '[{"order_number":"  000 ","quantity":500}]'::jsonb);
  select order_number into v_op from pg_temp.linhas(pg_temp.vertical(), 3);
  insert into rc values (3, '"000" com espaços também é não informada', 'aceita',
    case when v_op is null then 'ACEITOU' else format('RECUSOU: gravou "%s"', v_op) end);
exception when others then insert into rc values (3, '"000"', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Nenhuma "OP 0" juntando máquinas ───────────────────────────────────────
do $$ declare n int; begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint, pg_temp.horizontal(),
    '[{"order_number":"0","quantity":9000}]'::jsonb);
  select count(*) into n from public.work_orders where order_number ~ '^0*$';
  insert into rc values (4, 'duas máquinas sem número: nenhuma OP "0" nasce para juntar as duas', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s OP(s) "0"', n) end);
exception when others then insert into rc values (4, 'duas máquinas sem número', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Quem digitou continua conferido ────────────────────────────────────────
do $$ declare n int; begin
  perform public.save_production_record(pg_temp.amanha(), 2::smallint, pg_temp.horizontal(),
    '[{"order_number":"4503001","quantity":100},{"order_number":"","quantity":50}]'::jsonb);
  select count(*) into n from public.work_orders where order_number = '4503001';
  insert into rc values (5, 'com e sem número no mesmo turno: a digitada vira OP, a outra não', 'aceita',
    case when n = 1 and (select count(*) from pg_temp.linhas(pg_temp.horizontal(), 2)) = 2 then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (5, 'com e sem número', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 3::smallint, pg_temp.horizontal(),
    '[{"order_number":"45A01","quantity":100}]'::jsonb);
  insert into rc values (6, 'número digitado errado continua recusado', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (6, 'número digitado errado continua recusado, e a mensagem diz que pode deixar em branco', 'recusa',
    case when sqlerrm like '%deixe em branco%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

-- ─── Corrigir o apontamento ─────────────────────────────────────────────────
do $$ declare v_op text; begin
  perform public.update_production_record(
    (select id from public.production_records where machine_id = pg_temp.vertical()
       and production_date = pg_temp.amanha() and shift_id = 1),
    p_orders => '[{"order_number":"4503002","quantity":1200}]'::jsonb);
  select order_number into v_op from pg_temp.linhas(pg_temp.vertical(), 1);
  insert into rc values (7, 'completar depois: a correção troca a não informada pelo número', 'aceita',
    case when v_op = '4503002' and exists (select 1 from public.work_orders where order_number = '4503002')
         then 'ACEITOU' else format('RECUSOU: op=%s', v_op) end);
exception when others then insert into rc values (7, 'completar depois', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── "Só zeros" não é OP na aba OPs ─────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');   -- gestora
do $$ begin
  perform public.create_work_order('0000', pg_temp.vertical());
  insert into rc values (8, 'cadastrar a OP "0000" na aba OPs', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (8, 'cadastrar a OP "0000" na aba OPs, com mensagem clara', 'recusa',
    case when sqlerrm like '%só zeros%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

reset role;
do $$ begin
  update public.production_orders set order_number = '  '
   where order_number = '4503001';
  insert into rc values (9, 'número em branco direto na tabela (não informada é nulo, não vazio)', 'recusa', 'ACEITOU');
exception when others then insert into rc values (9, 'número em branco direto na tabela', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
