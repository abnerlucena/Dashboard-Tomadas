-- Testes das políticas de acesso RLS (migration 0010). Ver README desta pasta.
-- Testes de RLS (depois de aprovar usuários e gravar dados como no t7)
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);
  perform public.approve_user('00000000-0000-0000-0000-0000000000b2', 1::smallint);
  perform public.approve_user('00000000-0000-0000-0000-0000000000e1', 7::smallint);
end $$;
-- op1 aponta
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.save_production_record('2026-09-19'::date, 1::smallint, 18, '[{"order_number":"4500006","quantity":400},{"order_number":"4500007","quantity":100,"is_rework":true}]'::jsonb);
insert into results(test, ok, info) select 'op1 vê o próprio apontamento', count(*) = 1, count(*)::text from public.production_records where machine_id = 18;
insert into results(test, ok, info) select 'op1 vê as próprias ordens', count(*) = 2, count(*)::text from public.production_orders o join public.production_records r on r.id = o.production_record_id where r.machine_id = 18;
insert into results(test, ok, info) select 'op1 vê resumo com boa x retrabalho', bool_and(good_quantity = 400 and rework_quantity = 100 and target_quantity = public.machine_target_on(18, '2026-09-19')), string_agg(format('boa=%s retr=%s meta=%s', good_quantity, rework_quantity, target_quantity), ';') from public.production_summary where machine_id = 18;
-- Uma linha por maquina que tem meta: a view escolhe o degrau vigente e nao
-- duplica. Comparar com um numero fixo quebraria a cada centro novo.
insert into results(test, ok, info) select 'op1 lê máquinas e metas vigentes',
  count(*) = (select count(distinct machine_id) from public.machine_targets
               where valid_from <= (now() at time zone 'America/Sao_Paulo')::date),
  count(*)::text from public.current_machine_targets;
insert into results(test, ok, info) select 'op1 vê só o próprio profile', count(*) = 1, count(*)::text from public.profiles;
insert into results(test, ok, info) select 'op1 NÃO vê auditoria', count(*) = 0, count(*)::text from public.audit_logs;
do $$ begin
  insert into public.production_records (production_date, shift_id, machine_id, target_quantity) values ('2026-09-18', 1, 2, 1);
  insert into results(test, ok, info) values ('op1 NÃO grava direto na tabela', false, 'gravou!');
exception when others then insert into results(test, ok, info) values ('op1 NÃO grava direto na tabela', true, sqlerrm); end $$;
do $$ declare c int; begin
  update public.machines set name = 'HACK' where id = 1;
  get diagnostics c = row_count;
  insert into results(test, ok, info) values ('op1 NÃO altera máquina', c = 0, c::text || ' linha(s)');
end $$;
do $$ declare c int; begin
  update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000d1';
  get diagnostics c = row_count;
  insert into results(test, ok, info) values ('op1 NÃO aprova ninguém por UPDATE', c = 0, c::text || ' linha(s)');
end $$;
do $$ begin
  insert into public.user_permissions (user_id, permission_code) values ('00000000-0000-0000-0000-0000000000b1', 'system.admin');
  insert into results(test, ok, info) values ('op1 NÃO se dá permissão', false, 'deu!');
exception when others then insert into results(test, ok, info) values ('op1 NÃO se dá permissão', true, sqlerrm); end $$;
-- op2 não vê o apontamento do op1
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into results(test, ok, info) select 'op2 NÃO vê apontamento do op1', count(*) = 0, count(*)::text from public.production_records where created_by = '00000000-0000-0000-0000-0000000000b1';
insert into results(test, ok, info) select 'op2 NÃO vê ordens do op1', count(*) = 0, count(*)::text from public.production_orders;
-- TV (display) vê produção por tv_mode.view
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into results(test, ok, info) select 'conta TV vê produção (inclusive a do op1)', count(*) filter (where created_by = '00000000-0000-0000-0000-0000000000b1') = 1, count(*)::text from public.production_summary;
-- pendente: vê só o próprio perfil, nada mais
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
insert into results(test, ok, info) select 'pendente vê o próprio perfil (pending)', count(*) = 1, max(status) from public.profiles;
insert into results(test, ok, info) select 'pendente NÃO vê máquinas', count(*) = 0, count(*)::text from public.machines;
-- gestora: vê tudo, recebe notificação, marca como lida mas não reescreve
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into results(test, ok, info) select 'gestora vê todos os perfis', count(*) >= 7, count(*)::text from public.profiles;
insert into results(test, ok, info) select 'gestora vê auditoria', count(*) > 0, count(*)::text from public.audit_logs;
insert into results(test, ok, info) select 'gestora vê aviso do pendente', count(*) >= 1, string_agg(body, ' | ') from public.notifications where read_at is null;
do $$ declare c int; begin
  update public.notifications set read_at = now() where recipient_id = auth.uid();
  get diagnostics c = row_count;
  insert into results(test, ok, info) values ('gestora marca aviso como lido', c >= 1, c::text);
end $$;
do $$ begin
  update public.notifications set body = 'alterado' where recipient_id = auth.uid();
  insert into results(test, ok, info) values ('gestora NÃO reescreve texto do aviso', false, 'reescreveu!');
exception when others then insert into results(test, ok, info) values ('gestora NÃO reescreve texto do aviso', true, sqlerrm); end $$;
do $$ declare c int; begin
  insert into public.calendar_events (event_date, description, event_type, scope) values ('2026-12-25', 'Natal', 'holiday', 'national');
  update public.machines set status = 'maintenance' where id = 3;
  get diagnostics c = row_count;
  insert into results(test, ok, info) values ('gestora cadastra feriado e muda status', c = 1, 'ok');
exception when others then insert into results(test, ok, info) values ('gestora cadastra feriado e muda status', false, sqlerrm); end $$;
-- D33 (0.10.2): sem production.edit_own, o operador deixa de ver os próprios apontamentos
delete from public.user_permissions where user_id = '00000000-0000-0000-0000-0000000000b1' and permission_code = 'production.edit_own';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into results(test, ok, info) select 'op1 sem edit_own NÃO vê os próprios', count(*) = 0, count(*)::text from public.production_records where created_by = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
-- anon: nada
reset role;
set local role anon;
do $$ declare c int; begin
  select count(*) into c from public.machines;
  insert into results(test, ok, info) values ('anon NÃO lê máquinas', false, c::text);
exception when others then insert into results(test, ok, info) values ('anon NÃO lê máquinas', true, sqlerrm); end $$;
reset role;
select test, ok, info from results order by n;
select c.relname as tabela_sem_rls from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity;
select tablename, count(*) as politicas from pg_policies where schemaname = 'public' group by 1 order by 1;
