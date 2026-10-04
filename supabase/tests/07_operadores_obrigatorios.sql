-- Testes do nº de operadores obrigatório onde a meta é por pessoa (0028).
-- Decisões: D54, D52, D48, D47, D12. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do seed estrutural e do
-- 00_fixtures.sql, com a migration 0028 aplicada.
--
-- Os apontamentos são feitos para AMANHÃ, para não encostar no que a fábrica
-- apontou hoje.

create temp table rc(n int, caso text, esperado text, resultado text);
grant all on rc to authenticated;

create function pg_temp.maquina(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

-- ─── Quem exige ──────────────────────────────────────────────────────────────
do $$ declare b boolean; begin
  b := public.exige_numero_de_operadores(pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), pg_temp.amanha());
  insert into rc values (1, 'A Granél exige o número (per_operator)', 'aceita',
    case when b then 'ACEITOU' else 'RECUSOU' end);

  b := public.exige_numero_de_operadores(pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), pg_temp.amanha());
  insert into rc values (2, 'rateada NÃO exige: esquecer é conservador', 'recusa',
    case when b then 'ACEITOU' else 'RECUSOU' end);

  b := public.exige_numero_de_operadores(pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'), pg_temp.amanha());
  insert into rc values (3, 'meta fixa NÃO exige: o campo nem entra na conta', 'recusa',
    case when b then 'ACEITOU' else 'RECUSOU' end);
end $$;

-- ─── Criar sem o número: tem de recusar ──────────────────────────────────────
-- É o caso que motivou a D54. Antes isto era ACEITO e gravava 1 em silêncio,
-- comparando um turno de 3 pessoas com a meta de uma.
do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'),
    '[{"order_number":"000001009001","quantity":60000}]'::jsonb);
  insert into rc values (4, 'A Granél sem informar o número', 'recusa', 'ACEITOU');
exception when others then insert into rc values (4, 'A Granél sem informar o número', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 2::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'),
    '[{"order_number":"000001009002","quantity":60000}]'::jsonb, null, 0::smallint);
  insert into rc values (5, 'A Granél com zero (= não informado, D48)', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'A Granél com zero', 'recusa', 'RECUSOU'); end $$;

-- A mensagem tem de dizer o que fazer, não só que deu errado.
do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'),
    '[{"order_number":"000001009003","quantity":60000}]'::jsonb);
  insert into rc values (6, 'a mensagem explica o motivo', 'aceita', 'RECUSOU: não deu erro');
exception when others then
  insert into rc values (6, 'a mensagem explica o motivo', 'aceita',
    case when sqlerrm like '%meta desta máquina é por pessoa%' then 'ACEITOU'
         else 'RECUSOU: ' || sqlerrm end);
end $$;

-- ─── Com o número: entra normalmente, e a meta multiplica ───────────────────
do $$ declare v uuid; m int; n int; begin
  v := public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'),
    '[{"order_number":"000001009004","quantity":60000}]'::jsonb, null, 3::smallint);
  select operator_count into n from public.production_records where id = v;
  insert into rc values (7, 'com 3 pessoas, entra e grava o número', 'aceita',
    case when n = 3 then 'ACEITOU' else format('RECUSOU: %s', n) end);

  select effective_target into m from public.production_summary where id = v;
  insert into rc values (8, 'a meta multiplica: 25.000 × 3 = 75.000', 'aceita',
    case when m = 75000 then 'ACEITOU' else format('RECUSOU: %s', m) end);
exception when others then
  insert into rc values (7, 'com 3 pessoas', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Alterar sem mandar o número: mantém, não recusa ─────────────────────────
-- "Não veio no pedido" continua querendo dizer "mantém o que estava" (D52).
-- Recusar aqui impediria corrigir uma observação sem redigitar a lotação.
do $$ declare n int; begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), null, 'corrigindo a observação');
  select operator_count into n from public.production_records
   where machine_id = pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL')
     and production_date = pg_temp.amanha() and shift_id = 1;
  insert into rc values (9, 'alterar sem mandar o número mantém as 3 pessoas', 'aceita',
    case when n = 3 then 'ACEITOU' else format('RECUSOU: %s', n) end);
exception when others then
  insert into rc values (9, 'alterar sem mandar o número', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Apagar o número numa máquina por pessoa: tem de recusar ────────────────
-- A D52 deu o direito de apagar. A D54 tira esse direito SÓ onde o número é
-- indispensável — senão daria para esvaziar e voltar ao problema de origem.
do $$ begin
  perform public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), null, null, 0::smallint);
  insert into rc values (10, 'apagar o número na A Granél', 'recusa', 'ACEITOU');
exception when others then insert into rc values (10, 'apagar o número na A Granél', 'recusa', 'RECUSOU'); end $$;

-- ─── As outras máquinas não foram afetadas ──────────────────────────────────
do $$ declare v uuid; m int; begin
  v := public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°1'),
    '[{"order_number":"000001009005","quantity":7000}]'::jsonb);
  select effective_target into m from public.production_summary where id = v;
  insert into rc values (11, 'rateada sem o número: entra, com a meta cheia', 'aceita',
    case when m = 10000 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  v := public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'),
    '[{"order_number":"000001009006","quantity":12000}]'::jsonb);
  insert into rc values (12, 'meta fixa sem o número: entra', 'aceita',
    case when v is not null then 'ACEITOU' else 'RECUSOU' end);
exception when others then
  insert into rc values (11, 'as outras máquinas', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── O passado continua lido como 1 pessoa ──────────────────────────────────
-- Decisão do gestor (01/10/2026): os turnos importados não têm o número e nunca
-- vão ter — a planilha nunca teve a coluna. O `coalesce` da view FICA.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
-- A meta esperada é a do PRÓPRIO apontamento (D08: cada um guarda a foto da
-- meta do seu dia), multiplicada por 1. Comparar com os 25.000 de hoje estaria
-- errado: os turnos de dezembro guardam a meta retroativa de 15.000 (D35).
do $$ declare m int; alvo int; begin
  select s.effective_target, r.target_quantity into m, alvo
    from public.production_summary s
    join public.production_records r on r.id = s.id
   where s.machine_name = 'BANCADA EMBALAGEM A GRANÉL'
     and s.operator_count is null
   limit 1;
  insert into rc values (13, 'turno importado sem o número: lido como 1 pessoa', 'aceita',
    case when m is null then 'ACEITOU: não há turno assim neste banco'
         when m = alvo then 'ACEITOU'
         else format('RECUSOU: meta %s para um apontamento de %s', m, alvo) end);
end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
