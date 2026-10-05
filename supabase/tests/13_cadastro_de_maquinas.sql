-- Cadastro completo de máquinas, e editar nome, linha e lotação (migration 0037).
-- Decisões: D63, D38, D47. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.

create temp table rc(n int, caso text, esperado text, resultado text);
grant all on rc to authenticated;

create function pg_temp.maq(p_nome text) returns public.machines language sql as $$
  select * from public.machines where name = p_nome
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');   -- gestora
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);
end $$;

-- ─── Meta 0 = por demanda (D38) ─────────────────────────────────────────────
do $$ declare m public.machines; begin
  perform public.create_machine(p_name => 'TESTE D63 POR DEMANDA', p_initial_target => 0, p_process => 'assembly');
  m := pg_temp.maq('TESTE D63 POR DEMANDA');
  insert into rc values (1, 'meta 0 sem dizer nada vira por demanda', 'aceita',
    case when m.has_target = false then 'ACEITOU' else 'RECUSOU: ficou com meta' end);
exception when others then insert into rc values (1, 'meta 0', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare m public.machines; begin
  perform public.create_machine(p_name => 'TESTE D63 COM META', p_initial_target => 5000, p_process => 'packaging');
  m := pg_temp.maq('TESTE D63 COM META');
  insert into rc values (2, 'meta maior que 0 vira máquina com meta, com a linha', 'aceita',
    case when m.has_target and m.process = 'packaging' then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (2, 'com meta', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.create_machine(p_name => 'TESTE D63 CONTRADICAO 1', p_initial_target => 0, p_has_target => true);
  insert into rc values (3, '"com meta" e meta zero', 'recusa', 'ACEITOU');
exception when others then insert into rc values (3, '"com meta" e meta zero', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.create_machine(p_name => 'TESTE D63 CONTRADICAO 2', p_initial_target => 800, p_has_target => false);
  insert into rc values (4, '"por demanda" com meta', 'recusa', 'ACEITOU');
exception when others then insert into rc values (4, '"por demanda" com meta', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.create_machine(p_name => 'TESTE D63 LINHA', p_initial_target => 100, p_process => 'pintura');
  insert into rc values (5, 'linha inventada', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'linha inventada', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.create_machine(p_name => 'TESTE D63 RATEADA', p_initial_target => 9000,
    p_basis => 'per_shift_prorated', p_process => 'packaging');
  insert into rc values (6, 'meta conforme a lotação, sem lotação', 'recusa', 'ACEITOU');
exception when others then insert into rc values (6, 'rateada sem lotação', 'recusa', 'RECUSOU'); end $$;

-- O caminho antigo (addMachine: só nome e meta) continua funcionando.
do $$ declare m public.machines; begin
  perform public.create_machine('TESTE D63 CAMINHO ANTIGO', 0);
  m := pg_temp.maq('TESTE D63 CAMINHO ANTIGO');
  insert into rc values (7, 'chamada antiga (nome e meta) ainda funciona, e meta 0 vira por demanda', 'aceita',
    case when m.id is not null and m.has_target = false then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (7, 'caminho antigo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Editar ─────────────────────────────────────────────────────────────────
do $$ declare m public.machines; begin
  perform public.update_machine((pg_temp.maq('TESTE D63 COM META')).id, 'TESTE D63 RENOMEADA', 'assembly', 3::smallint);
  m := pg_temp.maq('TESTE D63 RENOMEADA');
  insert into rc values (8, 'edita nome, linha e lotação', 'aceita',
    case when m.process = 'assembly' and m.standard_operator_count = 3 then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (8, 'editar', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare m public.machines; begin
  perform public.update_machine((pg_temp.maq('TESTE D63 RENOMEADA')).id, p_standard_operator_count => 4::smallint);
  m := pg_temp.maq('TESTE D63 RENOMEADA');
  insert into rc values (9, 'o que não vem fica como está', 'aceita',
    case when m.name = 'TESTE D63 RENOMEADA' and m.process = 'assembly' and m.standard_operator_count = 4
         then 'ACEITOU' else 'RECUSOU' end);
end $$;

do $$ begin
  perform public.update_machine((pg_temp.maq('TESTE D63 RENOMEADA')).id, 'EMBALADORA HORIZONTAL N°1');
  insert into rc values (10, 'renomear para um nome que já existe', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (10, 'nome repetido recusado, e a mensagem diz qual', 'recusa',
    case when sqlerrm like '%EMBALADORA HORIZONTAL N°1%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

do $$ begin
  perform public.update_machine((pg_temp.maq('TESTE D63 RENOMEADA')).id, p_standard_operator_count => 0::smallint);
  insert into rc values (11, 'lotação zero', 'recusa', 'ACEITOU');
exception when others then insert into rc values (11, 'lotação zero', 'recusa', 'RECUSOU'); end $$;

-- ─── Operador não cadastra nem edita ────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.update_machine((pg_temp.maq('TESTE D63 RENOMEADA')).id, 'MEXI');
  insert into rc values (12, 'operador edita máquina', 'recusa', 'ACEITOU');
exception when others then insert into rc values (12, 'operador edita máquina', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
