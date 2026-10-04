-- O nº da OP: só números, até 15 dígitos (migration 0029).
-- Decisões: D57, D35. Ver README desta pasta.
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
-- Aponta numa máquina de meta fixa, para a D54 não entrar no caminho.
create function pg_temp.aponta(p_turno int, p_op text) returns uuid language sql as $$
  select public.save_production_record(pg_temp.amanha(), p_turno::smallint, pg_temp.vertical(),
    jsonb_build_array(jsonb_build_object('order_number', p_op, 'quantity', 100)))
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

-- ─── Aceita ──────────────────────────────────────────────────────────────────
do $$ begin
  perform pg_temp.aponta(1, '4501234');
  insert into rc values (1, '7 dígitos', 'aceita', 'ACEITOU');
exception when others then insert into rc values (1, '7 dígitos', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform pg_temp.aponta(2, '123456789012345');
  insert into rc values (2, '15 dígitos, o limite', 'aceita', 'ACEITOU');
exception when others then insert into rc values (2, '15 dígitos', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare v text; begin
  perform pg_temp.aponta(3, '  4509999  ');
  select order_number into v from public.production_orders o
    join public.production_records r on r.id = o.production_record_id
   where r.machine_id = pg_temp.vertical() and r.production_date = pg_temp.amanha() and r.shift_id = 3;
  insert into rc values (3, 'espaço em volta é tirado, não recusado', 'aceita',
    case when v = '4509999' then 'ACEITOU' else format('RECUSOU: gravou "%s"', v) end);
exception when others then insert into rc values (3, 'espaço em volta', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Recusa ──────────────────────────────────────────────────────────────────
do $$ begin
  perform public.save_production_record(pg_temp.amanha() + 1, 1::smallint, pg_temp.vertical(),
    '[{"order_number":"1234567890123456","quantity":100}]'::jsonb);
  insert into rc values (4, '16 dígitos', 'recusa', 'ACEITOU');
exception when others then insert into rc values (4, '16 dígitos', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.save_production_record(pg_temp.amanha() + 1, 1::smallint, pg_temp.vertical(),
    '[{"order_number":"OP 4501234","quantity":100}]'::jsonb);
  insert into rc values (5, 'letra no número', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'letra no número', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.save_production_record(pg_temp.amanha() + 1, 1::smallint, pg_temp.vertical(),
    '[{"order_number":"","quantity":100}]'::jsonb);
  insert into rc values (6, 'OP vazia', 'recusa', 'ACEITOU');
exception when others then insert into rc values (6, 'OP vazia', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.save_production_record(pg_temp.amanha() + 1, 1::smallint, pg_temp.vertical(),
    '[{"quantity":100}]'::jsonb);
  insert into rc values (7, 'OP ausente', 'recusa', 'ACEITOU');
exception when others then insert into rc values (7, 'OP ausente', 'recusa', 'RECUSOU'); end $$;

-- A mensagem diz qual OP e o que fazer.
do $$ begin
  perform public.save_production_record(pg_temp.amanha() + 1, 2::smallint, pg_temp.vertical(),
    '[{"order_number":"45-01","quantity":100}]'::jsonb);
  insert into rc values (8, 'a mensagem cita a OP e a regra', 'aceita', 'RECUSOU: não deu erro');
exception when others then
  insert into rc values (8, 'a mensagem cita a OP e a regra', 'aceita',
    case when sqlerrm like '%"45-01"%' and sqlerrm like '%só números%' then 'ACEITOU' else 'RECUSOU: ' || sqlerrm end);
end $$;

-- Uma OP ruim no meio de várias barra o apontamento inteiro: nada entra pela metade.
do $$ declare n int; begin
  begin
    perform public.save_production_record(pg_temp.amanha() + 2, 1::smallint, pg_temp.vertical(),
      '[{"order_number":"4501111","quantity":100},{"order_number":"abc","quantity":50}]'::jsonb);
  exception when others then null; end;
  select count(*) into n from public.production_records
   where machine_id = pg_temp.vertical() and production_date = pg_temp.amanha() + 2;
  insert into rc values (9, 'uma OP ruim barra o apontamento inteiro', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s apontamento(s) gravado(s)', n) end);
end $$;

-- Linha sem quantidade é ignorada, como antes — não é cobrada.
do $$ begin
  perform public.save_production_record(pg_temp.amanha() + 3, 1::smallint, pg_temp.vertical(),
    '[{"order_number":"4502222","quantity":100},{"order_number":"","quantity":0}]'::jsonb);
  insert into rc values (10, 'linha vazia (quantidade 0) não é cobrada', 'aceita', 'ACEITOU');
exception when others then insert into rc values (10, 'linha vazia', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── O histórico importado continua lá ──────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare n int; begin
  select count(*) into n from public.production_orders where order_number = 'IMPORTADO';
  insert into rc values (11, 'as OPs IMPORTADO do histórico ficaram', 'aceita',
    case when n > 0 then 'ACEITOU' else 'ACEITOU: não há histórico neste banco' end);
end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
