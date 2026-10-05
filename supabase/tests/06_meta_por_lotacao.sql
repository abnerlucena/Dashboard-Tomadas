-- Testes da meta que depende da lotação (migrations 0021, 0022 e 0023).
-- Decisões: D39, D46, D47, D48. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do seed estrutural e do
-- 00_fixtures.sql, com as migrations 0021, 0022 e 0023 aplicadas.
--
-- Os apontamentos de teste são feitos para AMANHÃ: assim não encostam em nada
-- que a fábrica tenha apontado hoje, e a meta de amanhã já é o degrau novo das
-- horizontais, que a 0022 cria com vigência de hoje.

-- Tabelas e funções de apoio criadas ANTES de trocar de papel.
create temp table rc(n int, caso text, esperado text, resultado text);
create temp table ids(nome text primary key, id uuid);
grant all on rc, ids to authenticated;

-- Os centros pelo nome, não pelo id: o id é detalhe do banco.
create function pg_temp.maquina(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;
create function pg_temp.meta_efetiva(p_id uuid) returns integer language sql as $$
  select effective_target from public.production_summary where id = p_id
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;

-- ─── A base de cada centro depois das migrations ─────────────────────────────
do $$ declare b text; begin
  b := public.machine_target_basis_on(pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), pg_temp.amanha());
  insert into rc values (1, 'A Granél é por pessoa', 'aceita',
    case when b = 'per_operator' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
  b := public.machine_target_basis_on(pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), pg_temp.amanha());
  insert into rc values (2, 'Horizontal é rateada pela lotação', 'aceita',
    case when b = 'per_shift_prorated' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
  b := public.machine_target_basis_on(pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'), pg_temp.amanha());
  insert into rc values (3, 'Vertical continua com meta fixa', 'aceita',
    case when b = 'per_shift' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
end $$;

-- ─── Apontamentos do operador ────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

do $$ begin
  insert into ids values ('granel', public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), '[{"order_number":"000001008001","quantity":60000}]'::jsonb,
    null, 3::smallint));
  insert into ids values ('horizontal', public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), '[{"order_number":"000001008002","quantity":7000}]'::jsonb,
    null, 3::smallint));
  insert into ids values ('horizontal_sem_pessoas', public.save_production_record(pg_temp.amanha(), 2::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), '[{"order_number":"000001008003","quantity":9000}]'::jsonb));
  insert into ids values ('vertical', public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'), '[{"order_number":"000001008004","quantity":12000}]'::jsonb,
    null, 5::smallint));
  insert into ids values ('horizontal_lotada', public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°2'), '[{"order_number":"000001008005","quantity":11000}]'::jsonb,
    null, 6::smallint));
  insert into rc values (4, 'operador aponta os cinco turnos de teste', 'aceita', 'ACEITOU');
exception when others then insert into rc values (4, 'operador aponta os cinco turnos de teste', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare m int; begin
  m := pg_temp.meta_efetiva((select id from ids where nome = 'granel'));
  insert into rc values (5, 'A Granél com 3 pessoas: 25.000 × 3 = 75.000', 'aceita',
    case when m = 75000 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  m := pg_temp.meta_efetiva((select id from ids where nome = 'horizontal'));
  insert into rc values (6, 'Horizontal com 3 das 4 pessoas: 10.000 × 3 ÷ 4 = 7.500', 'aceita',
    case when m = 7500 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  m := pg_temp.meta_efetiva((select id from ids where nome = 'horizontal_sem_pessoas'));
  insert into rc values (7, 'Horizontal sem pessoas informadas: lotação padrão, meta cheia', 'aceita',
    case when m = 10000 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  m := pg_temp.meta_efetiva((select id from ids where nome = 'vertical'));
  insert into rc values (8, 'Vertical com 5 pessoas: a lotação não muda a meta', 'aceita',
    case when m = 13000 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  -- D49: o teto. Gente ACIMA da lotação padrão não aumenta a meta, porque quem
  -- limita a produção é a máquina, não a quantidade de pessoas. Sem o teto,
  -- este mesmo apontamento daria 15.000 (10.000 × 6 ÷ 4).
  m := pg_temp.meta_efetiva((select id from ids where nome = 'horizontal_lotada'));
  insert into rc values (13, 'Horizontal com 6 das 4 pessoas: o teto segura em 10.000', 'aceita',
    case when m = 10000 then 'ACEITOU' else format('RECUSOU: %s', m) end);
end $$;

-- A base fica congelada no apontamento (D46).
do $$ declare b text; begin
  select target_basis into b from public.production_records where id = (select id from ids where nome = 'granel');
  insert into rc values (9, 'o apontamento guarda a base do dia', 'aceita',
    case when b = 'per_operator' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
end $$;

-- Corrigir o nº de pessoas corrige a meta efetiva sozinho (a conta é na leitura).
do $$ declare m int; begin
  perform public.update_production_record((select id from ids where nome = 'granel'), null, 2::smallint);
  m := pg_temp.meta_efetiva((select id from ids where nome = 'granel'));
  insert into rc values (10, 'A Granél corrigida para 2 pessoas: 50.000', 'aceita',
    case when m = 50000 then 'ACEITOU' else format('RECUSOU: %s', m) end);
exception when others then insert into rc values (10, 'A Granél corrigida para 2 pessoas: 50.000', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Zero pessoas é "não informado" (0023, D48) ─────────────────────────────
-- Mesma regra de src/lib/metas.ts: 0 cai na lotação padrão, nunca vira meta 0.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

-- A Granél saiu daqui: desde a D54 ela RECUSA apontamento sem o número, e
-- quem cobra isso é a suíte 07. A mecânica do zero continua valendo nas
-- rateadas, que é onde ela ainda pode acontecer.
do $$ declare m int; v_id uuid; begin
  v_id := public.save_production_record(pg_temp.amanha(), 3::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°2'), '[{"order_number":"000001008005","quantity":1000}]'::jsonb,
    null, 0::smallint);
  m := pg_temp.meta_efetiva(v_id);
  insert into rc values (26, 'Horizontal N°2 com 0 pessoas: meta cheia, não meta 0', 'aceita',
    case when m = 10000 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  v_id := public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°2'), '[{"order_number":"000001008006","quantity":1000}]'::jsonb,
    null, 0::smallint);
  m := pg_temp.meta_efetiva(v_id);
  insert into rc values (27, 'Horizontal com 0 pessoas: meta cheia, não meta 0', 'aceita',
    case when m = 10000 then 'ACEITOU' else format('RECUSOU: %s', m) end);
exception when others then insert into rc values (13, 'zero pessoas', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── O buraco consertado na 0022: salvar meta não apaga a base ──────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');

do $$ declare b text; begin
  perform public.save_machine_targets(
    jsonb_build_object(pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL')::text, 26000),
    pg_temp.amanha() + 1);
  b := public.machine_target_basis_on(pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), pg_temp.amanha() + 1);
  insert into rc values (11, 'gestor muda a meta da Granél e ela continua por pessoa', 'aceita',
    case when b = 'per_operator' then 'ACEITOU' else 'RECUSOU: virou ' || coalesce(b, 'nulo') end);
exception when others then insert into rc values (11, 'gestor muda a meta da Granél e ela continua por pessoa', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- A lista fechada continua fechada. Como dono do banco: pelo app a escrita
-- direta já é barrada pelo RLS, e aqui interessa ver o CHECK recusar.
reset role;
do $$ begin
  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
  values (pg_temp.maquina('EMBALADORA HORIZONTAL N°2'), 10000, pg_temp.amanha() + 2, 'por_palpite');
  insert into rc values (12, 'base fora da lista', 'recusa', 'ACEITOU');
exception when others then insert into rc values (12, 'base fora da lista', 'recusa', 'RECUSOU'); end $$;

-- D52: dá para APAGAR o nº de operadores. Antes, "campo vazio" e "não mexi
-- nisso" chegavam ao banco do mesmo jeito (nulo), e o valor antigo ficava.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ declare v uuid; n int; begin
  -- informa 3 pessoas. Numa máquina RATEADA: a A Granél não aceita mais apagar
  -- (D54), e o que estes casos provam — gravar, manter, apagar — não é próprio
  -- dela.
  v := public.save_production_record(pg_temp.amanha() + 1, 3::smallint,
       pg_temp.maquina('EMBALADORA HORIZONTAL N°2'),
       '[{"order_number":"000001008006","quantity":40000}]'::jsonb, null, 3::smallint);
  select operator_count into n from public.production_records where id = v;
  insert into rc values (15, 'grava o nº de operadores informado', 'aceita',
    case when n = 3 then 'ACEITOU' else format('RECUSOU: %s', n) end);

  -- não manda nada: tem de MANTER
  perform public.save_production_record(pg_temp.amanha() + 1, 3::smallint,
       pg_temp.maquina('EMBALADORA HORIZONTAL N°2'), null, 'só uma observação');
  select operator_count into n from public.production_records where id = v;
  insert into rc values (16, 'sem informar, mantém o que estava', 'aceita',
    case when n = 3 then 'ACEITOU' else format('RECUSOU: %s', n) end);

  -- manda zero: tem de APAGAR
  perform public.save_production_record(pg_temp.amanha() + 1, 3::smallint,
       pg_temp.maquina('EMBALADORA HORIZONTAL N°2'), null, null, 0::smallint);
  select operator_count into n from public.production_records where id = v;
  insert into rc values (17, 'zero apaga o nº de operadores', 'aceita',
    case when n is null then 'ACEITOU' else format('RECUSOU: %s', n) end);

  -- apagado, a rateada volta à meta cheia do turno
  n := pg_temp.meta_efetiva(v);
  insert into rc values (18, 'apagado, a rateada volta à meta cheia: 10.000', 'aceita',
    case when n = 10000 then 'ACEITOU' else format('RECUSOU: %s', n) end);
exception when others then insert into rc values (15, 'apagar o nº de operadores', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- D53: a base da meta pode ser definida pelo app, e muda como qualquer outra
-- meta muda — criando um DEGRAU NOVO, nunca reescrevendo o passado.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare v_maq int; v_base text; v_qtd int; n int; begin
  v_maq := pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1');

  -- muda só o número: a base tem de ser PRESERVADA (o buraco da 0022)
  perform public.save_machine_targets(jsonb_build_object(v_maq::text, 14000));
  v_base := public.machine_target_basis_on(v_maq, (now() at time zone 'America/Sao_Paulo')::date);
  insert into rc values (19, 'mudar só o número preserva a base', 'aceita',
    case when v_base = 'per_shift' then 'ACEITOU' else format('RECUSOU: %s', v_base) end);

  -- agora muda a base junto
  perform public.save_machine_targets(jsonb_build_object(v_maq::text, 14000), null,
                                      jsonb_build_object(v_maq::text, 'per_operator'));
  v_base := public.machine_target_basis_on(v_maq, (now() at time zone 'America/Sao_Paulo')::date);
  v_qtd  := public.machine_target_on(v_maq, (now() at time zone 'America/Sao_Paulo')::date);
  insert into rc values (20, 'dá para mudar a base pelo app', 'aceita',
    case when v_base = 'per_operator' and v_qtd = 14000 then 'ACEITOU'
         else format('RECUSOU: base=%s qtd=%s', v_base, v_qtd) end);

  -- salvar igual de novo não cria degrau nenhum
  n := public.save_machine_targets(jsonb_build_object(v_maq::text, 14000), null,
                                   jsonb_build_object(v_maq::text, 'per_operator'));
  insert into rc values (21, 'salvar igual não cria degrau novo', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: gravou %s', n) end);

  -- base inventada é recusada, com mensagem que diz quais valem
  begin
    perform public.save_machine_targets(jsonb_build_object(v_maq::text, 14000), null,
                                        jsonb_build_object(v_maq::text, 'por_pessoa'));
    insert into rc values (22, 'base inventada', 'recusa', 'ACEITOU');
  exception when others then insert into rc values (22, 'base inventada', 'recusa', 'RECUSOU'); end;

  -- máquina nova já nasce com a base certa
  v_maq := public.create_machine('POSTO DE TESTE D53', 9000, true, 2::smallint, 'per_shift_prorated', 'packaging');
  v_base := public.machine_target_basis_on(v_maq, (now() at time zone 'America/Sao_Paulo')::date);
  insert into rc values (23, 'máquina nova nasce com a base pedida', 'aceita',
    case when v_base = 'per_shift_prorated' then 'ACEITOU' else format('RECUSOU: %s', v_base) end);

  -- sem pedir base, continua nascendo per_shift
  v_maq := public.create_machine('POSTO DE TESTE D53 SEM BASE', 500, p_process => 'assembly');
  v_base := public.machine_target_basis_on(v_maq, (now() at time zone 'America/Sao_Paulo')::date);
  insert into rc values (24, 'sem pedir base, nasce per_shift', 'aceita',
    case when v_base = 'per_shift' then 'ACEITOU' else format('RECUSOU: %s', v_base) end);
exception when others then insert into rc values (19, 'base da meta pelo app', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Operador não muda base, como não muda meta.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.save_machine_targets(jsonb_build_object('1', 1), null, jsonb_build_object('1', 'per_operator'));
  insert into rc values (25, 'operador muda a base', 'recusa', 'ACEITOU');
exception when others then insert into rc values (25, 'operador muda a base', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado = 'ACEITOU') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
