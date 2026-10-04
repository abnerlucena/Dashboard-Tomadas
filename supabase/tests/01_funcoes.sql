-- Testes das funções de regra de negócio (migration 0009). Ver README desta pasta.
set local role authenticated;
-- 1. gestora aprova operadores (perfil operator=1) e a conta Admin (admin=6)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);
  perform public.approve_user('00000000-0000-0000-0000-0000000000b2', 1::smallint);
  perform public.approve_user('00000000-0000-0000-0000-0000000000c1', 6::smallint);
  insert into results(test, ok, info) values ('gestora aprova 3 usuários', true, cardinality(public.my_permissions())::text || ' permissões da gestora');
exception when others then insert into results(test, ok, info) values ('gestora aprova 3 usuários', false, sqlerrm); end $$;
-- 2. operador 1 aponta (cria)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ declare v uuid; begin
  v := public.save_production_record(((now() at time zone 'America/Sao_Paulo')::date), 1::smallint, 1,
        '[{"order_number":"000001004521","quantity":3000},{"order_number":"000001004522","quantity":1000,"is_rework":true}]'::jsonb, 'obs 1');
  insert into results(test, ok, info) values ('op1 cria apontamento', true, (select format('meta=%s boa=%s retr=%s total=%s conta=%s', target_quantity, good_quantity, rework_quantity, total_quantity, counts_toward_target) from public.production_summary where id=v));
exception when others then insert into results(test, ok, info) values ('op1 cria apontamento', false, sqlerrm); end $$;
-- 3. operador 1 completa o próprio (D30: acrescenta)
do $$ declare v uuid; begin
  v := public.save_production_record(((now() at time zone 'America/Sao_Paulo')::date), 1::smallint, 1, '[{"order_number":"000001004530","quantity":500}]'::jsonb);
  insert into results(test, ok, info) values ('op1 completa o próprio (acrescenta)', true, (select format('ordens=%s boa=%s', order_count, good_quantity) from public.production_summary where id=v));
exception when others then insert into results(test, ok, info) values ('op1 completa o próprio', false, sqlerrm); end $$;
-- 4. hora extra no mesmo turno vira outra linha e não conta para meta
do $$ declare v uuid; begin
  v := public.save_production_record(((now() at time zone 'America/Sao_Paulo')::date), 1::smallint, 1, '[{"order_number":"4500001","quantity":100}]'::jsonb, null, null, 'overtime');
  insert into results(test, ok, info) values ('hora extra separada', true, (select format('modo=%s conta_meta=%s', work_mode, counts_toward_target) from public.production_summary where id=v));
exception when others then insert into results(test, ok, info) values ('hora extra separada', false, sqlerrm); end $$;
-- 4b. operador lê os próprios apontamentos? (antes do RLS: nenhuma política → deve ver 0)
insert into results(test, ok, info) values ('op1 leitura direta (sem RLS ainda)', true, (select count(*)::text from public.production_records));
-- 5. operador 2 tenta completar o apontamento do operador 1 → deve FALHAR
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  perform public.save_production_record(((now() at time zone 'America/Sao_Paulo')::date), 1::smallint, 1, '[{"order_number":"4500002","quantity":1}]'::jsonb);
  insert into results(test, ok, info) values ('op2 NÃO pode mexer no do op1', false, 'deixou gravar!');
exception when others then insert into results(test, ok, info) values ('op2 NÃO pode mexer no do op1', true, sqlerrm); end $$;
-- 6. operador 2 tenta mover em massa → deve FALHAR
do $$ begin
  perform public.bulk_update_production_records(array['00000000-0000-0000-0000-000000000000'::uuid], '2026-01-01'::date);
  insert into results(test, ok, info) values ('op2 NÃO pode editar em massa', false, 'deixou!');
exception when others then insert into results(test, ok, info) values ('op2 NÃO pode editar em massa', true, sqlerrm); end $$;
-- 7. operador 2 tenta alterar meta → deve FALHAR
do $$ begin
  perform public.save_machine_targets('{"1": 999}'::jsonb);
  insert into results(test, ok, info) values ('op2 NÃO pode alterar meta', false, 'deixou!');
exception when others then insert into results(test, ok, info) values ('op2 NÃO pode alterar meta', true, sqlerrm); end $$;
-- 8. usuário pendente não tem permissão nenhuma
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  perform public.save_production_record('2026-09-19'::date, 2::smallint, 2, '[{"order_number":"4500003","quantity":1}]'::jsonb);
  insert into results(test, ok, info) values ('pendente NÃO aponta', false, 'deixou!');
exception when others then insert into results(test, ok, info) values ('pendente NÃO aponta', true, sqlerrm); end $$;
-- 9. conta Admin sem identificação: sem permissões; com crachá: permissões do perfil admin
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222');
insert into results(test, ok, info) values ('Admin sem crachá = sem permissão', cardinality(public.my_permissions()) = 0, cardinality(public.my_permissions())::text);
do $$ declare n text; begin
  n := public.identify_shared_session('201');
  insert into results(test, ok, info) values ('Admin identifica crachá 201', cardinality(public.my_permissions()) = (select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.code = 'admin'), n || ' / permissões=' || cardinality(public.my_permissions()));
exception when others then insert into results(test, ok, info) values ('Admin identifica crachá 201', false, sqlerrm); end $$;
do $$ begin perform public.identify_shared_session('999');
  insert into results(test, ok, info) values ('crachá inexistente recusado', false, 'aceitou!');
exception when others then insert into results(test, ok, info) values ('crachá inexistente recusado', true, sqlerrm); end $$;
-- 9b. outra sessão da mesma conta Admin continua sem permissão
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', '33333333-3333-3333-3333-333333333333');
insert into results(test, ok, info) values ('Admin em OUTRA sessão = sem permissão', cardinality(public.my_permissions()) = 0, cardinality(public.my_permissions())::text);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222');
-- 10. Admin (identificado) troca turno em massa, e colisão é recusada
do $$ declare c int; begin
  reset role;  -- só para buscar os ids (sem RLS de leitura ainda)
  create temp table ids as select id from public.production_records
    where work_mode = 'regular' and created_by = '00000000-0000-0000-0000-0000000000b1';  -- só o que o teste criou
  grant select on ids to authenticated;
  set local role authenticated;
  c := public.bulk_update_production_records(array(select id from ids), null, 2::smallint);
  insert into results(test, ok, info) values ('Admin troca turno em massa', c = 1, c::text);
exception when others then insert into results(test, ok, info) values ('Admin troca turno em massa', false, sqlerrm); end $$;
do $$ begin
  perform public.save_production_record(((now() at time zone 'America/Sao_Paulo')::date), 1::smallint, 1, '[{"order_number":"4500004","quantity":1}]'::jsonb);
  perform public.bulk_update_production_records(array(select id from ids), null, 1::smallint);
  insert into results(test, ok, info) values ('colisão em massa recusada', false, 'deixou!');
exception when others then insert into results(test, ok, info) values ('colisão em massa recusada', true, sqlerrm); end $$;
-- 11. metas: gestora salva; só grava o que mudou; corrige no mesmo dia; passado recusado
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare c0 int; c int; c2 int; begin
  -- parte de valores conhecidos, em vez de supor o que o seed deixou
  c0 := public.save_machine_targets('{"1": 550, "2": 560}'::jsonb);   -- as duas mudam
  c  := public.save_machine_targets('{"1": 550, "2": 500}'::jsonb);   -- so a 2 muda
  c2 := public.save_machine_targets('{"1": 560}'::jsonb);             -- correcao no mesmo dia
  insert into results(test, ok, info) values ('metas: só a que mudou + correção no dia',
    c0 = 2 and c = 1 and c2 = 1,
    format('definiu=%s, so a que mudou=%s, correcao=%s', c0, c, c2));
exception when others then insert into results(test, ok, info) values ('metas: só a que mudou', false, sqlerrm); end $$;
do $$ begin perform public.save_machine_targets('{"1": 1}'::jsonb, '2020-01-01'::date);
  insert into results(test, ok, info) values ('meta no passado recusada', false, 'aceitou!');
exception when others then insert into results(test, ok, info) values ('meta no passado recusada', true, sqlerrm); end $$;
-- 12. gestora cria máquina com meta inicial
do $$ declare v int; begin
  v := public.create_machine('Máquina Teste Noturno', 321);
  insert into results(test, ok, info) values ('create_machine', v > 18, format('id=%s', v));
exception when others then insert into results(test, ok, info) values ('create_machine', false, sqlerrm); end $$;
do $$ begin perform public.create_machine('embaladora horizontal n°1', 1);
  insert into results(test, ok, info) values ('máquina duplicada recusada', false, 'aceitou!');
exception when others then insert into results(test, ok, info) values ('máquina duplicada recusada', true, sqlerrm); end $$;
-- 13. nomes para exibição e exclusão
insert into results(test, ok, info) values ('list_profile_names', (select count(*) from public.list_profile_names() where full_name in ('Admin','Gestora','Operador Dois','Operador Um','Pendente')) = 5, (select string_agg(full_name, ', ' order by full_name) from public.list_profile_names()));
do $$ declare c int; begin
  c := public.bulk_delete_production_records(array(select id from ids));
  insert into results(test, ok, info) values ('gestora apaga em massa', c = 1, c::text || ' apagado(s)');
exception when others then insert into results(test, ok, info) values ('gestora apaga em massa', false, sqlerrm); end $$;
-- 13b. (0.10.3) apontamento SEM AUTOR: operador não completa nem apaga; gestora sim
reset role;
insert into public.production_records (production_date, shift_id, machine_id, target_quantity, created_by)
values ('2026-09-10', 3, 17, 0, null);  -- autor vazio de propósito
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.save_production_record('2026-09-10'::date, 3::smallint, 17, '[{"order_number":"4500005","quantity":1}]'::jsonb);
  insert into results(test, ok, info) values ('op1 NÃO completa apontamento sem autor', false, 'deixou!');
exception when others then insert into results(test, ok, info) values ('op1 NÃO completa apontamento sem autor', true, sqlerrm); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.save_production_record('2026-09-10'::date, 3::smallint, 17, '[{"order_number":"4500005","quantity":1}]'::jsonb);
  insert into results(test, ok, info) values ('gestora completa apontamento sem autor', true, 'ok');
exception when others then insert into results(test, ok, info) values ('gestora completa apontamento sem autor', false, sqlerrm); end $$;
-- 14. anon não executa funções
reset role;
set local role anon;
do $$ begin perform public.my_permissions();
  insert into results(test, ok, info) values ('anon NÃO executa RPC', false, 'executou!');
exception when others then insert into results(test, ok, info) values ('anon NÃO executa RPC', true, sqlerrm); end $$;
reset role;
select test, ok, info from results order by n;
select r.work_mode, r.shift_id, s.good_quantity, s.total_quantity, r.target_quantity from public.production_records r join public.production_summary s using (id);
select m.id, t.quantity_per_shift, t.valid_from::text from public.current_machine_targets t join public.machines m on m.id=t.machine_id where m.id in (1,2) or m.id > 18;
select table_name, action, count(*) from public.audit_logs group by 1,2 order by 1,2;
