-- Testes da carga e da reversão do lote de importação (migration 0019).
-- Decisões: D35. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do seed estrutural e do
-- 00_fixtures.sql. Nada do que este arquivo escreve fica no banco.
--
-- A suíte monta o PRÓPRIO lote de rascunho, com um punhado de linhas. Antes ela
-- usava o lote real da planilha, e deixou de rodar no dia em que esse lote foi
-- carregado de verdade — um teste que só funciona uma vez na vida não é teste.
--
-- O que se perde com isso, dito na cara: ela não exercita mais a carga das
-- 2.507 linhas reais, só a mecânica. A conferência do volume real é outra
-- coisa, e é o passo 4 da importação (o relatório para o gestor).
--
-- As datas são de 2027 de propósito: assim nunca esbarram no histórico real,
-- que vai até 21/09/2026.
--
-- Os apontamentos de teste ficam DAQUI A 45 DIAS: desde 12/10/2026 a fábrica
-- aponta pelo site, e um apontamento real no mesmo dia, máquina e turno
-- confundiria as contagens.

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
  perform public.approve_user('00000000-0000-0000-0000-0000000000b2', 6::smallint);  -- admin
end $$;

create temp table rc(n int, caso text, esperado text, resultado text);

-- ─── O lote de teste ────────────────────────────────────────────────────────
-- Cinco linhas, escolhidas para cobrir o que a carga precisa saber fazer:
--   duas produções em chaves diferentes          → dois apontamentos
--   uma produção e um retrabalho na MESMA chave  → UM apontamento, DUAS ordens
--   uma parada de máquina                        → uma linha em machine_downtimes
--   um descarte                                  → fica como pulado
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');

do $$ begin
  insert into public.import_batches (id, source_file, description, status)
  values ('00000000-0000-0000-0000-00000000ca01'::uuid, 'planilha-de-teste.xlsx', 'lote da suíte 05', 'draft');

  insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,
    kind, machine_id, production_date, shift_id, work_mode, quantity, notes, discard_reason,
    target_quantity, target_source)
  values
    -- mesma chave: máquina 1, 04/01/2027, T1, normal
    ('00000000-0000-0000-0000-00000000ca01', 'TESTE', 'A1', 'HORIZONTAL 1', '5000',
     'production', 1, '2027-01-04', 1, 'regular', 5000, null, null, 10000, 'planilha'),
    ('00000000-0000-0000-0000-00000000ca01', 'TESTE', 'A2', 'RETRABALHO GERAL', '800',
     'rework', 1, '2027-01-04', 1, 'regular', 800, null, null, 10000, 'planilha'),
    -- outra chave
    ('00000000-0000-0000-0000-00000000ca01', 'TESTE', 'B1', 'HORIZONTAL 2', '3000',
     'production', 2, '2027-01-05', 1, 'regular', 3000, null, null, 10000, 'planilha'),
    -- parada: o "notes" já é o código que a tabela de paradas aceita
    ('00000000-0000-0000-0000-00000000ca01', 'TESTE', 'C1', 'HORIZONTAL 1', 'Manutenção',
     'downtime', 1, '2027-01-06', 1, null, null, 'maintenance', null, null, null),
    -- descarte
    ('00000000-0000-0000-0000-00000000ca01', 'TESTE', 'D1', 'HORIZONTAL 1', '0',
     'discard', 1, '2027-01-07', 1, null, null, null, 'turno sem produção', null, null);

  insert into rc values (1, 'lote de rascunho criado com 5 linhas', 'aceita', 'ACEITOU');
exception when others then insert into rc values (1, 'lote de rascunho criado com 5 linhas', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Um apontamento feito À MÃO, que a importação não pode encostar ─────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.save_production_record(((now() at time zone 'America/Sao_Paulo')::date + 45), 1::smallint, 3,
    '[{"order_number":"000001009999","quantity":1234}]'::jsonb, 'apontado por uma pessoa');
  insert into rc values (2, 'apontamento manual criado', 'aceita', 'ACEITOU');
exception when others then insert into rc values (2, 'apontamento manual criado', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- O operador não pode carregar lote.
do $$ begin
  perform public.carregar_lote_importacao('00000000-0000-0000-0000-00000000ca01'::uuid);
  insert into rc values (3, 'operador carrega lote', 'recusa', 'ACEITOU');
exception when others then insert into rc values (3, 'operador carrega lote', 'recusa', 'RECUSOU'); end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');

-- ─── Carga ──────────────────────────────────────────────────────────────────
do $$ declare r jsonb; begin
  r := public.carregar_lote_importacao('00000000-0000-0000-0000-00000000ca01'::uuid);
  insert into rc values (4, 'admin carrega o lote', 'aceita',
    case when (r->>'apontamentos')::int = 2 and (r->>'ordens')::int = 3
          and (r->>'paradas')::int = 1 and (r->>'descartados')::int = 1
         then 'ACEITOU' else 'RECUSOU: ' || r::text end);
exception when others then insert into rc values (4, 'admin carrega o lote', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Carregar duas vezes tem que ser recusado.
do $$ begin
  perform public.carregar_lote_importacao('00000000-0000-0000-0000-00000000ca01'::uuid);
  insert into rc values (5, 'carregar o mesmo lote de novo', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'carregar o mesmo lote de novo', 'recusa', 'RECUSOU'); end $$;

-- O apontamento manual continua lá, e sem marca de lote.
do $$ declare n int; begin
  select count(*) into n from public.production_records
   where machine_id = 3 and import_batch_id is null
     and production_date = (now() at time zone 'America/Sao_Paulo')::date + 45;
  insert into rc values (6, 'apontamento manual sobreviveu à carga', 'aceita',
    case when n = 1 then 'ACEITOU' else format('RECUSOU: achei %s', n) end);
end $$;

-- Importado nasce sem autor e com a origem na planilha registrada.
do $$ declare n int; begin
  select count(*) into n from public.production_records
   where import_batch_id = '00000000-0000-0000-0000-00000000ca01'::uuid
     and (created_by is not null or source_ref is null);
  insert into rc values (7, 'importado sem autor e com origem', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s fora do padrão', n) end);
end $$;

-- As duas linhas da mesma chave viraram UM apontamento com DUAS ordens,
-- sendo uma marcada como retrabalho.
do $$ declare ordens int; retrab int; begin
  select count(*), count(*) filter (where o.is_rework) into ordens, retrab
    from public.production_orders o
    join public.production_records p on p.id = o.production_record_id
   where p.production_date = '2027-01-04' and p.machine_id = 1 and p.shift_id = 1;
  insert into rc values (8, 'produção e retrabalho no mesmo apontamento', 'aceita',
    case when ordens = 2 and retrab = 1 then 'ACEITOU'
         else format('RECUSOU: %s ordens, %s retrabalho', ordens, retrab) end);
end $$;

-- A ordem importada entra com a marcação, não com uma OP de verdade (D35 item 12).
do $$ declare n int; begin
  select count(*) into n from public.production_orders o
    join public.production_records p on p.id = o.production_record_id
   where p.import_batch_id = '00000000-0000-0000-0000-00000000ca01'::uuid
     and o.order_number <> 'IMPORTADO';
  insert into rc values (9, 'ordem importada marcada como IMPORTADO', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s com outro número', n) end);
end $$;

-- O apontamento importado guarda a base que valia NAQUELE dia, não a de hoje
-- nem o valor padrão da coluna. A Horizontal N°1 é `per_shift_prorated` desde
-- 27/09/2026, então as linhas de 2027 têm de nascer com essa base.
do $$ declare fora int; base_1 text; begin
  select count(*) into fora
    from public.production_records p
   where p.import_batch_id = '00000000-0000-0000-0000-00000000ca01'::uuid
     and p.target_basis is distinct from
         coalesce(public.machine_target_basis_on(p.machine_id, p.production_date), 'per_shift');
  select target_basis into base_1 from public.production_records
   where import_batch_id = '00000000-0000-0000-0000-00000000ca01'::uuid
     and machine_id = 1 and production_date = '2027-01-04';
  insert into rc values (14, 'importado guarda a base do dia', 'aceita',
    case when fora = 0 and base_1 = 'per_shift_prorated' then 'ACEITOU'
         else format('RECUSOU: %s fora da linha do tempo, máquina 1 = %s', fora, base_1) end);
end $$;

-- ─── Reversão ───────────────────────────────────────────────────────────────
do $$ declare r jsonb; begin
  r := public.reverter_lote_importacao('00000000-0000-0000-0000-00000000ca01'::uuid);
  insert into rc values (10, 'admin reverte o lote', 'aceita',
    case when (r->>'apontamentos_apagados')::int = 2 and (r->>'paradas_apagadas')::int = 1
         then 'ACEITOU' else 'RECUSOU: ' || r::text end);
exception when others then insert into rc values (10, 'admin reverte o lote', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Depois de reverter: nada deste lote, e o manual intacto.
do $$ declare imp int; man int; begin
  select count(*) into imp from public.production_records
   where import_batch_id = '00000000-0000-0000-0000-00000000ca01'::uuid;
  select count(*) into man from public.production_records
   where machine_id = 3 and import_batch_id is null
     and production_date = (now() at time zone 'America/Sao_Paulo')::date + 45;
  insert into rc values (11, 'reversão apagou só o importado', 'aceita',
    case when imp = 0 and man = 1 then 'ACEITOU' else format('RECUSOU: importados=%s manuais=%s', imp, man) end);
end $$;

-- A parada deste lote saiu. As de outros lotes não são conferidas aqui de
-- propósito: o que importa é a reversão apagar só o que ELA criou.
do $$ declare n int; begin
  select count(*) into n from public.machine_downtimes
   where external_id = 'TESTE!C1';
  insert into rc values (12, 'parada importada apagada', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: sobraram %s', n) end);
end $$;

-- A área de preparo voltou a poder ser carregada de novo.
do $$ declare n int; begin
  select count(*) into n from public.import_rows
   where batch_id = '00000000-0000-0000-0000-00000000ca01'::uuid and status <> 'pending';
  insert into rc values (13, 'preparo voltou ao estado inicial', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s linhas fora de pending', n) end);
end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado = 'ACEITOU') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
