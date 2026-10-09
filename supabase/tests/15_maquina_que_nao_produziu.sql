-- Máquina que não produziu: motivo da parada no apontamento (migration 0040).
-- Decisões: D67, D16, D54. Ver README desta pasta.
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
create function pg_temp.resumo(p_turno int, p_maq integer default null) returns public.production_summary language sql as $$
  select * from public.production_summary
   where machine_id = coalesce(p_maq, pg_temp.vertical()) and production_date = pg_temp.amanha()
     and shift_id = p_turno and work_mode = 'regular'
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

-- ─── Grava a parada ─────────────────────────────────────────────────────────
do $$ declare r public.production_summary; begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint, pg_temp.vertical(),
    p_orders => '[]'::jsonb, p_stop_reason => '  Sem OP ', p_stop_planned => false);
  r := pg_temp.resumo(1);
  insert into rc values (1, 'parada não planejada: grava o motivo, sem peças, e o turno CONTA para a meta', 'aceita',
    case when r.stop_reason = 'Sem OP' and not r.stop_planned and r.total_quantity = 0 and r.counts_toward_target
         then 'ACEITOU' else format('RECUSOU: motivo=%s planejada=%s conta=%s', r.stop_reason, r.stop_planned, r.counts_toward_target) end);
exception when others then insert into rc values (1, 'parada não planejada', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare r public.production_summary; begin
  perform public.save_production_record(pg_temp.amanha(), 2::smallint, pg_temp.vertical(),
    p_stop_reason => 'Manutenção', p_stop_planned => true);
  r := pg_temp.resumo(2);
  insert into rc values (2, 'parada planejada SAI da meta, como o dia anulado', 'aceita',
    case when r.stop_planned and not r.counts_toward_target then 'ACEITOU'
         else format('RECUSOU: conta=%s', r.counts_toward_target) end);
exception when others then insert into rc values (2, 'parada planejada', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Parada e peças não andam juntas ────────────────────────────────────────
do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 3::smallint, pg_temp.vertical(),
    p_orders => '[{"order_number":"4502001","quantity":100}]'::jsonb, p_stop_reason => 'Setup / troca');
  insert into rc values (3, 'motivo de parada junto com peças', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (3, 'motivo de parada junto com peças, com mensagem clara', 'recusa',
    case when sqlerrm like 'Máquina que não produziu não tem peças%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

do $$ declare r public.production_summary; begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint, pg_temp.vertical(),
    p_orders => '[{"order_number":"4502002","quantity":300}]'::jsonb);
  r := pg_temp.resumo(1);
  insert into rc values (4, 'lançar peças depois tira a parada sozinho', 'aceita',
    case when r.stop_reason is null and not r.stop_planned and r.good_quantity = 300 then 'ACEITOU'
         else format('RECUSOU: motivo=%s peças=%s', r.stop_reason, r.good_quantity) end);
exception when others then insert into rc values (4, 'peças depois da parada', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint, pg_temp.vertical(), p_stop_reason => 'Sem operador');
  insert into rc values (5, 'parada num turno que já tem peças', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'parada num turno que já tem peças', 'recusa', 'RECUSOU'); end $$;

-- ─── Meta por pessoa (D54): parada não exige o nº de operadores ─────────────
do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint, pg_temp.maq('BANCADA EMBALAGEM A GRANÉL'),
    p_operator_count => 0::smallint, p_stop_reason => 'Sem operador', p_stop_planned => false);
  insert into rc values (6, 'máquina por pessoa parada "sem operador" não exige nº de pessoas', 'aceita', 'ACEITOU');
exception when others then insert into rc values (6, 'por pessoa parada', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 2::smallint, pg_temp.maq('BANCADA EMBALAGEM A GRANÉL'),
    p_orders => '[{"order_number":"4502003","quantity":100}]'::jsonb, p_operator_count => 0::smallint);
  insert into rc values (7, 'máquina por pessoa PRODUZINDO sem nº de pessoas (continua recusado)', 'recusa', 'ACEITOU');
exception when others then insert into rc values (7, 'por pessoa produzindo sem pessoas', 'recusa', 'RECUSOU'); end $$;

-- ─── Corrigir o apontamento ─────────────────────────────────────────────────
do $$ declare r public.production_summary; begin
  perform public.update_production_record((pg_temp.resumo(1)).id,
    p_orders => '[]'::jsonb, p_stop_reason => 'Falta de material', p_stop_planned => false);
  r := pg_temp.resumo(1);
  insert into rc values (8, 'corrigir: tirar as OPs e marcar a parada na mesma correção', 'aceita',
    case when r.stop_reason = 'Falta de material' and r.total_quantity = 0 then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (8, 'corrigir para parada', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare r public.production_summary; begin
  perform public.update_production_record((pg_temp.resumo(2)).id, p_stop_planned => false);
  r := pg_temp.resumo(2);
  insert into rc values (9, 'corrigir só a marcação: a planejada passa a contar para a meta', 'aceita',
    case when r.stop_reason = 'Manutenção' and not r.stop_planned and r.counts_toward_target then 'ACEITOU'
         else format('RECUSOU: planejada=%s', r.stop_planned) end);
exception when others then insert into rc values (9, 'corrigir a marcação', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare r public.production_summary; begin
  perform public.update_production_record((pg_temp.resumo(2)).id, p_stop_reason => '');
  r := pg_temp.resumo(2);
  insert into rc values (10, 'motivo vazio tira a parada', 'aceita',
    case when r.stop_reason is null and not r.stop_planned then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (10, 'tirar a parada', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── A trava da tabela vale por fora das funções ────────────────────────────
reset role;
do $$ begin
  update public.production_records set stop_planned = true, stop_reason = null
   where id = (pg_temp.resumo(2)).id;
  insert into rc values (11, 'parada planejada sem motivo, direto na tabela', 'recusa', 'ACEITOU');
exception when others then insert into rc values (11, 'planejada sem motivo, direto na tabela', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
