-- O gestor consegue manter o calendário sozinho, pelo app.
-- Decisões: D16, D17, D18. Ver README desta pasta.
--
-- Pergunta do gestor (03/10/2026): os feriados de SC, de Itajaí e as paradas da
-- fábrica serão cadastrados por ele, no site, depois da virada. Esta suíte faz
-- exatamente o que o app faz (src/lib/repositories/supabase/catalog.ts,
-- addHoliday e removeHoliday) e confere que funciona — e que só funciona para
-- quem tem calendar.manage.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.

create temp table rc(n int, caso text, esperado text, resultado text);
create temp table ids(nome text primary key, id uuid);
grant all on rc, ids to authenticated;

create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;

-- ─── Gestor: feriado de dia inteiro, como o app grava ───────────────────────
do $$ declare v uuid; begin
  insert into public.calendar_events (event_date, description, event_type, scope)
  values (pg_temp.amanha() + 30, 'Aniversário de Itajaí (teste)', 'holiday', 'company')
  returning id into v;
  insert into ids values ('feriado', v);
  insert into rc values (1, 'gestor cadastra feriado de dia inteiro', 'aceita', 'ACEITOU');
exception when others then insert into rc values (1, 'gestor cadastra feriado', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Gestor: parada só do T3, como o app grava (evento + turnos) ────────────
do $$ declare v uuid; begin
  insert into public.calendar_events (event_date, description, event_type, scope)
  values (pg_temp.amanha() + 31, 'Parada do T3 (teste)', 'excluded_day', 'company')
  returning id into v;
  insert into public.calendar_event_shifts (event_id, shift_id) values (v, 3);
  insert into ids values ('parada_t3', v);
  insert into rc values (2, 'gestor cadastra parada de um turno só', 'aceita', 'ACEITOU');
exception when others then insert into rc values (2, 'parada de um turno', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Gestor: o escopo estadual e municipal também é aceito pelo banco ───────
-- O app hoje grava sempre 'company'; o banco já aceita os outros.
do $$ begin
  insert into public.calendar_events (event_date, description, event_type, scope)
  values (pg_temp.amanha() + 32, 'Feriado municipal (teste)', 'holiday', 'municipal');
  insert into rc values (3, 'banco aceita escopo municipal', 'aceita', 'ACEITOU');
exception when others then insert into rc values (3, 'escopo municipal', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Dia anulado tira o turno do cálculo de atingimento (D16) ───────────────
-- É o que faz uma parada não derrubar o indicador.
do $$ declare r uuid; c boolean; begin
  r := public.save_production_record(pg_temp.amanha() + 31, 3::smallint,
    (select id from public.machines where name = 'EMBALADORA VERTICAL MÓDULOS N°1'),
    '[{"order_number":"000001010001","quantity":100}]'::jsonb);
  select counts_toward_target into c from public.production_summary where id = r;
  insert into rc values (4, 'turno anulado sai do atingimento', 'aceita',
    case when c = false then 'ACEITOU' else format('RECUSOU: counts_toward_target = %s', c) end);
exception when others then insert into rc values (4, 'turno anulado', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Gestor: remove o que cadastrou errado ──────────────────────────────────
do $$ declare n int; begin
  delete from public.calendar_events where id = (select id from ids where nome = 'feriado');
  get diagnostics n = row_count;
  insert into rc values (5, 'gestor remove um feriado', 'aceita',
    case when n = 1 then 'ACEITOU' else format('RECUSOU: %s linhas', n) end);
end $$;

-- ─── Vários dias numa operação só (0035) ────────────────────────────────────
do $$ declare n int; m int; begin
  n := public.add_calendar_events(
         array[pg_temp.amanha() + 50, pg_temp.amanha() + 51, pg_temp.amanha() + 52,
               pg_temp.amanha() + 52],                       -- repetido de propósito
         'Férias coletivas (teste)', 'excluded_day', 'company');
  select count(*) into m from public.calendar_events where description = 'Férias coletivas (teste)';
  insert into rc values (8, 'intervalo entra numa chamada, dia repetido conta uma vez', 'aceita',
    case when n = 3 and m = 3 then 'ACEITOU' else format('RECUSOU: devolveu %s, gravou %s', n, m) end);
exception when others then insert into rc values (8, 'intervalo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare s text; t int; begin
  perform public.add_calendar_events(array[pg_temp.amanha() + 60], 'Aniversário de Itajaí (teste)',
    'holiday', 'municipal', array[1, 2]::smallint[]);
  select e.scope, count(es.*) into s, t from public.calendar_events e
    left join public.calendar_event_shifts es on es.event_id = e.id
   where e.description = 'Aniversário de Itajaí (teste)' group by e.scope;
  insert into rc values (9, 'abrangência municipal e só T1 e T2', 'aceita',
    case when s = 'municipal' and t = 2 then 'ACEITOU' else format('RECUSOU: %s, %s turnos', s, t) end);
exception when others then insert into rc values (9, 'abrangência', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Tudo ou nada: um turno inexistente barra o intervalo inteiro.
do $$ declare m int; begin
  begin
    perform public.add_calendar_events(array[pg_temp.amanha() + 70, pg_temp.amanha() + 71],
      'Intervalo com turno errado (teste)', 'holiday', 'company', array[1, 9]::smallint[]);
  exception when others then null; end;
  select count(*) into m from public.calendar_events where description = 'Intervalo com turno errado (teste)';
  insert into rc values (10, 'um erro barra o intervalo inteiro', 'aceita',
    case when m = 0 then 'ACEITOU' else format('RECUSOU: %s dias entraram', m) end);
end $$;

do $$ begin
  perform public.add_calendar_events(array[pg_temp.amanha() + 80], 'X', 'holiday', 'regional');
  insert into rc values (11, 'abrangência inventada', 'recusa', 'ACEITOU');
exception when others then insert into rc values (11, 'abrangência inventada', 'recusa', 'RECUSOU'); end $$;

-- ─── Operador NÃO mexe no calendário ────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  insert into public.calendar_events (event_date, description, event_type, scope)
  values (pg_temp.amanha() + 40, 'Folga inventada', 'holiday', 'company');
  insert into rc values (6, 'operador cadastra feriado', 'recusa', 'ACEITOU');
exception when others then insert into rc values (6, 'operador cadastra feriado', 'recusa', 'RECUSOU'); end $$;

-- A RLS não dá erro no delete: só não apaga. Por isso o app confere as linhas.
do $$ declare n int; begin
  delete from public.calendar_events where id = (select id from ids where nome = 'parada_t3');
  get diagnostics n = row_count;
  insert into rc values (7, 'operador apaga uma parada', 'recusa',
    case when n = 0 then 'RECUSOU' else 'ACEITOU' end);
end $$;

do $$ begin
  perform public.add_calendar_events(array[pg_temp.amanha() + 90], 'Folga em lote', 'holiday');
  insert into rc values (12, 'operador cadastra intervalo', 'recusa', 'ACEITOU');
exception when others then insert into rc values (12, 'operador cadastra intervalo', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
