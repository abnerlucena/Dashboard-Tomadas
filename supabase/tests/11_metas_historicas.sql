-- A linha do tempo de metas antes de 25/09/2026 vem da planilha (migration 0031).
-- Decisões: D60, D13, D38. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.
-- Precisa do histórico importado; sem ele, os casos de valor aparecem como
-- "não há histórico neste banco".

create temp table rc(n int, caso text, esperado text, resultado text);
grant all on rc to authenticated;

create function pg_temp.maquina(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.meta(p_nome text, p_dia date) returns integer language sql as $$
  select public.machine_target_on(pg_temp.maquina(p_nome), p_dia)
$$;

-- ─── Os degraus de reserva sumiram ──────────────────────────────────────────
do $$ declare n int; begin
  select count(*) into n from public.machine_targets
   where valid_from < date '2026-09-25' and quantity_per_shift in (150,160,180,200,220,250,300,350,400,500,600);
  insert into rc values (1, 'nenhum degrau de reserva (150 a 600) antes de 25/09', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s degraus de reserva', n) end);
end $$;

-- ─── As metas que a planilha usava ──────────────────────────────────────────
do $$ declare tem boolean; begin
  select exists (select 1 from public.production_records where import_batch_id is not null) into tem;
  if not tem then
    insert into rc values (2, 'metas da planilha', 'aceita', 'ACEITOU: não há histórico neste banco');
    return;
  end if;
  insert into rc values (2, 'Horizontal N°1 em fevereiro: 7.000', 'aceita',
    case when pg_temp.meta('EMBALADORA HORIZONTAL N°1', '2026-02-10') = 7000 then 'ACEITOU'
         else format('RECUSOU: %s', pg_temp.meta('EMBALADORA HORIZONTAL N°1', '2026-02-10')) end);
  insert into rc values (3, 'Horizontal N°1 a partir de 02/03: 8.000', 'aceita',
    case when pg_temp.meta('EMBALADORA HORIZONTAL N°1', '2026-03-05') = 8000 then 'ACEITOU'
         else format('RECUSOU: %s', pg_temp.meta('EMBALADORA HORIZONTAL N°1', '2026-03-05')) end);
  insert into rc values (4, 'A Granél em dezembro: 15.000', 'aceita',
    case when pg_temp.meta('BANCADA EMBALAGEM A GRANÉL', '2025-12-22') = 15000 then 'ACEITOU'
         else format('RECUSOU: %s', pg_temp.meta('BANCADA EMBALAGEM A GRANÉL', '2025-12-22')) end);
end $$;

-- ─── As metas acordadas, de 25/09 em diante, não mudaram ────────────────────
do $$ begin
  insert into rc values (5, 'Horizontal N°1 hoje: 10.000', 'aceita',
    case when pg_temp.meta('EMBALADORA HORIZONTAL N°1', (now() at time zone 'America/Sao_Paulo')::date) = 10000 then 'ACEITOU'
         else 'RECUSOU' end);
  insert into rc values (6, 'Tomadas hoje: 12.500', 'aceita',
    case when pg_temp.meta('MÁQUINA DE TOMADAS COMPOSÉ - AUMAQ', (now() at time zone 'America/Sao_Paulo')::date) = 12500 then 'ACEITOU'
         else 'RECUSOU' end);
end $$;

-- ─── Cada degrau histórico bate com os apontamentos do seu período ──────────
-- A prova de que a reconstrução é fiel: nenhum apontamento importado anterior
-- ao corte tem meta diferente da que a linha do tempo dá para o dia dele.
do $$ declare n int; begin
  select count(*) into n from public.production_records r
   where r.import_batch_id is not null and r.production_date < date '2026-09-25'
     and r.target_quantity is distinct from public.machine_target_on(r.machine_id, r.production_date);
  insert into rc values (7, 'todo importado bate com a linha do tempo do seu dia', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s apontamentos divergem', n) end);
end $$;

-- ─── Repetível ──────────────────────────────────────────────────────────────
do $$ declare a int; b int; begin
  select count(*) into a from public.machine_targets;
  perform public.reconstruir_metas_historicas();
  select count(*) into b from public.machine_targets;
  insert into rc values (8, 'rodar de novo dá o mesmo número de degraus', 'aceita',
    case when a = b then 'ACEITOU' else format('RECUSOU: %s virou %s', a, b) end);
end $$;

-- ─── Nenhuma máquina que tinha meta ficou sem (0033) ────────────────────────
-- Máquina sem histórico importado e sem degrau acordado mantém o que tinha. Só
-- as planejadas, que nunca tiveram degrau, podem aparecer sem nenhum.
do $$ declare n int; nomes text; begin
  select count(*), string_agg(m.name, ', ') into n, nomes from public.machines m
   where m.status <> 'planned'
     and not exists (select 1 from public.machine_targets t where t.machine_id = m.id);
  insert into rc values (11, 'toda máquina não planejada continua com algum degrau', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: sem degrau: %s', nomes) end);
end $$;

-- ─── A trava de vigência voltou a valer ─────────────────────────────────────
do $$ begin
  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
  values (pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), 9999, date '2026-01-01', 'per_shift');
  insert into rc values (9, 'depois da reconstrução, meta no passado volta a ser recusada', 'recusa', 'ACEITOU');
exception when others then insert into rc values (9, 'meta no passado recusada', 'recusa', 'RECUSOU'); end $$;

-- ─── Ninguém de fora reconstrói ─────────────────────────────────────────────
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');   -- gestora, sem import.manage
do $$ begin
  perform public.reconstruir_metas_historicas();
  insert into rc values (10, 'gestora reconstrói as metas históricas', 'recusa', 'ACEITOU');
exception when others then insert into rc values (10, 'gestora reconstrói', 'recusa', 'RECUSOU'); end $$;
reset role;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
