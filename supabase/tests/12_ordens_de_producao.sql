-- A OP existe por si: cadastro, situação, conversa e a porta do SAP (0036).
-- Decisões: D62, D57. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.
-- Os números de OP desta suíte começam com 97, para não encostar em nada real.

create temp table rc(n int, caso text, esperado text, resultado text);
create temp table ids(nome text primary key, id uuid);
grant all on rc, ids to authenticated;

create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;
create function pg_temp.maquina(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.op(p_numero text) returns public.work_orders language sql as $$
  select * from public.work_orders where order_number = p_numero
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');   -- gestora
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;

-- ─── Cadastro ───────────────────────────────────────────────────────────────
do $$ declare v uuid; o public.work_orders; begin
  v := public.create_work_order('9700001', pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'),
                                '10012345', 'Módulo 4x2 branco', 20000);
  insert into ids values ('a', v);
  o := pg_temp.op('9700001');
  insert into rc values (1, 'gestora cadastra OP: nasce aguardando, origem app', 'aceita',
    case when o.stage = 'waiting' and o.source = 'app' and o.material_code = '10012345' then 'ACEITOU'
         else format('RECUSOU: %s / %s', o.stage, o.source) end);
exception when others then insert into rc values (1, 'cadastrar OP', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.create_work_order('OP-97', pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'));
  insert into rc values (2, 'número fora do formato (D57)', 'recusa', 'ACEITOU');
exception when others then insert into rc values (2, 'número fora do formato', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.create_work_order('9700001', pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'));
  insert into rc values (3, 'OP repetida', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (3, 'OP repetida, e a mensagem diz qual', 'recusa',
    case when sqlerrm like '%9700001%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

-- ─── Situação ───────────────────────────────────────────────────────────────
do $$ declare o public.work_orders; n int; begin
  perform public.set_work_order_stage((select id from ids where nome = 'a'), 'running');
  o := pg_temp.op('9700001');
  select count(*) into n from public.work_order_messages
   where work_order_id = o.id and author_id is null and body like 'OP liberada%';
  insert into rc values (4, 'liberar: em produção, com data e mensagem do sistema', 'aceita',
    case when o.stage = 'running' and o.released_at is not null and n = 1 then 'ACEITOU'
         else format('RECUSOU: %s, msgs %s', o.stage, n) end);
exception when others then insert into rc values (4, 'liberar', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.set_work_order_stage((select id from ids where nome = 'a'), 'paused');
  insert into rc values (5, 'pausar sem motivo', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'pausar sem motivo', 'recusa', 'RECUSOU'); end $$;

do $$ declare o public.work_orders; n int; begin
  perform public.set_work_order_stage((select id from ids where nome = 'a'), 'paused', 'Falta de material');
  o := pg_temp.op('9700001');
  select count(*) into n from public.work_order_messages where work_order_id = o.id and body like '%Falta de material%';
  insert into rc values (6, 'pausar com motivo: o motivo vai para a conversa', 'aceita',
    case when o.stage = 'paused' and o.pause_reason = 'Falta de material' and n = 1 then 'ACEITOU'
         else format('RECUSOU: %s, %s', o.stage, n) end);
exception when others then insert into rc values (6, 'pausar com motivo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.set_work_order_stage((select id from ids where nome = 'a'), 'waiting');
  insert into rc values (7, 'pausada de volta para aguardando', 'recusa', 'ACEITOU');
exception when others then insert into rc values (7, 'passagem que a tela não oferece', 'recusa', 'RECUSOU'); end $$;

do $$ declare o public.work_orders; begin
  perform public.set_work_order_stage((select id from ids where nome = 'a'), 'running');
  o := pg_temp.op('9700001');
  insert into rc values (8, 'retomar limpa o motivo da pausa', 'aceita',
    case when o.stage = 'running' and o.pause_reason is null then 'ACEITOU' else format('RECUSOU: %s', o.pause_reason) end);
exception when others then insert into rc values (8, 'retomar', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Apontamento ────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');   -- operador
do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'),
    '[{"order_number":"9700001","quantity":5000},
      {"order_number":"9700001","quantity":300,"is_rework":true},
      {"order_number":"9700002","quantity":700,"notes":"Rolo de filme acabou no meio do turno"}]'::jsonb);
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare o public.work_orders; begin
  o := pg_temp.op('9700002');
  insert into rc values (9, 'OP nova no apontamento nasce "a conferir", na máquina dele', 'aceita',
    case when o.stage = 'pending_review' and o.source = 'apontamento'
              and o.machine_id = pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1') then 'ACEITOU'
         else format('RECUSOU: %s / %s', o.stage, o.source) end);
  o := pg_temp.op('9700001');
  insert into rc values (10, 'OP já cadastrada não muda por causa do apontamento', 'aceita',
    case when o.stage = 'running' and o.source = 'app' then 'ACEITOU' else format('RECUSOU: %s', o.stage) end);
end $$;

do $$ declare p int; r int; begin
  select produced_quantity, rework_quantity into p, r from public.work_order_summary where order_number = '9700001';
  insert into rc values (11, 'produzido soma o apontamento, e o retrabalho fica fora', 'aceita',
    case when p = 5000 and r = 300 then 'ACEITOU' else format('RECUSOU: produzido %s, retrabalho %s', p, r) end);
end $$;

do $$ declare o public.work_orders; begin
  perform public.update_work_order((select id from public.work_orders where order_number = '9700002'),
    null, '10099999', 'Placa cega', 1000);
  o := pg_temp.op('9700002');
  insert into rc values (12, 'conferir a OP: completa os dados e passa a aguardar', 'aceita',
    case when o.stage = 'waiting' and o.planned_quantity = 1000 then 'ACEITOU' else format('RECUSOU: %s', o.stage) end);
exception when others then insert into rc values (12, 'conferir', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Conversa ───────────────────────────────────────────────────────────────
do $$ begin
  perform public.post_work_order_message((select id from ids where nome = 'a'), 'Material chega às 10h.');
  insert into rc values (13, 'gestora escreve na conversa', 'aceita', 'ACEITOU');
exception when others then insert into rc values (13, 'gestora escreve', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare n int; begin
  select count(*) into n from public.work_order_conversation c
    join public.work_orders w on w.id = c.work_order_id
   where w.order_number = '9700002' and c.kind = 'operator_note' and c.body like 'Rolo de filme%';
  insert into rc values (14, 'a observação do operador aparece na conversa da OP', 'aceita',
    case when n = 1 then 'ACEITOU' else format('RECUSOU: %s', n) end);
end $$;

do $$ declare n int; begin
  select count(*) into n from public.work_order_reads
   where work_order_id = (select id from ids where nome = 'a') and user_id = '00000000-0000-0000-0000-0000000000a1';
  insert into rc values (15, 'quem escreve fica com a conversa lida', 'aceita',
    case when n = 1 then 'ACEITOU' else 'RECUSOU' end);
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');   -- operador
do $$ begin
  perform public.post_work_order_message((select id from ids where nome = 'a'), 'oi');
  insert into rc values (16, 'operador escreve na conversa', 'recusa', 'ACEITOU');
exception when others then insert into rc values (16, 'operador escreve na conversa', 'recusa', 'RECUSOU'); end $$;

do $$ declare ops int; msgs int; begin
  select count(*) into ops from public.work_orders where order_number like '97%';
  select count(*) into msgs from public.work_order_messages;
  insert into rc values (17, 'operador vê as OPs (para apontar), mas não a conversa', 'aceita',
    case when ops = 2 and msgs = 0 then 'ACEITOU' else format('RECUSOU: %s OPs, %s mensagens', ops, msgs) end);
end $$;

do $$ begin
  perform public.create_work_order('9700003', pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'));
  insert into rc values (18, 'operador cadastra OP', 'recusa', 'ACEITOU');
exception when others then insert into rc values (18, 'operador cadastra OP', 'recusa', 'RECUSOU'); end $$;

-- ─── Concluir e reabrir ─────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare o public.work_orders; begin
  perform public.set_work_order_stage((select id from ids where nome = 'a'), 'done');
  o := pg_temp.op('9700001');
  insert into rc values (19, 'concluir: data de fim', 'aceita',
    case when o.stage = 'done' and o.closed_at is not null then 'ACEITOU' else 'RECUSOU' end);
end $$;

do $$ begin
  perform public.post_work_order_message((select id from ids where nome = 'a'), 'mais uma');
  insert into rc values (20, 'escrever numa OP concluída', 'recusa', 'ACEITOU');
exception when others then insert into rc values (20, 'conversa encerrada na OP concluída', 'recusa', 'RECUSOU'); end $$;

do $$ declare o public.work_orders; begin
  perform public.set_work_order_stage((select id from ids where nome = 'a'), 'running');
  o := pg_temp.op('9700001');
  insert into rc values (21, 'reabrir (o "desfazer" da tela): volta à produção, sem data de fim', 'aceita',
    case when o.stage = 'running' and o.closed_at is null then 'ACEITOU' else 'RECUSOU' end);
end $$;

-- ─── A porta do SAP ─────────────────────────────────────────────────────────
do $$ begin
  perform public.importar_ops_do_sap('[{"order_number":"9700010","machine_id":1}]'::jsonb);
  insert into rc values (22, 'gestora importa do SAP (precisa de import.manage)', 'recusa', 'ACEITOU');
exception when others then insert into rc values (22, 'gestora importa do SAP', 'recusa', 'RECUSOU'); end $$;

-- Como dono do banco, que é como a integração vai rodar.
reset role;
select set_config('request.jwt.claims', '', true);
do $$ declare n int; nova public.work_orders; viva public.work_orders; begin
  n := public.importar_ops_do_sap(jsonb_build_array(
    jsonb_build_object('order_number', '9700010', 'machine_id', pg_temp.maquina('EMBALADORA HORIZONTAL N°1'),
                       'material_code', '10055555', 'material_description', 'Plugue 2P', 'planned_quantity', 30000),
    jsonb_build_object('order_number', '9700001', 'machine_id', pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'),
                       'planned_quantity', 25000)));
  nova := pg_temp.op('9700010');
  viva := pg_temp.op('9700001');
  insert into rc values (23, 'SAP cria a OP nova aguardando, com origem sap', 'aceita',
    case when nova.stage = 'waiting' and nova.source = 'sap' and nova.sap_synced_at is not null then 'ACEITOU'
         else format('RECUSOU: %s / %s', nova.stage, nova.source) end);
  insert into rc values (24, 'SAP atualiza os dados, mas não rebaixa a OP em produção', 'aceita',
    case when viva.stage = 'running' and viva.planned_quantity = 25000 then 'ACEITOU'
         else format('RECUSOU: %s, %s', viva.stage, viva.planned_quantity) end);
  perform public.importar_ops_do_sap('[{"order_number":"9700010","machine_id":1}]'::jsonb);
  insert into rc values (25, 'SAP repetido não duplica e mantém o que não veio', 'aceita',
    case when (select count(*) from public.work_orders where order_number = '9700010') = 1
          and (pg_temp.op('9700010')).material_code = '10055555' then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (23, 'SAP', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
