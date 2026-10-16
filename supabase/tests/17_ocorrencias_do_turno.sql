-- Ocorrências do turno: colaboradores, falta de pessoas e materiais faltantes
-- (migration 0042). Decisões: D70. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do 00_fixtures.sql.

create temp table rc(n int, caso text, esperado text, resultado text);
create temp table ids(nome text primary key, id uuid);
grant all on rc, ids to authenticated;

create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;
create function pg_temp.maq(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select id from ids where nome = p_nome
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');   -- gestora (admin)
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
  perform public.approve_user('00000000-0000-0000-0000-0000000000b2', 1::smallint);  -- operador
end $$;

-- ─── Cadastro de colaboradores ──────────────────────────────────────────────
do $$ begin
  insert into ids values ('ana', public.create_collaborator('  Ana   Paula Ribeiro ', 1::smallint, '12345', 'assembly'));
  insert into rc values (1, 'gestora cadastra colaboradora (espaços arrumados)', 'aceita',
    case when (select name from public.collaborators where id = pg_temp.id('ana')) = 'Ana Paula Ribeiro' then 'ACEITOU' else 'RECUSOU' end);
exception when others then insert into rc values (1, 'cadastra colaboradora', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.create_collaborator('Gabriel', 2::smallint);
  insert into rc values (2, 'só o primeiro nome', 'recusa', 'ACEITOU');
exception when others then insert into rc values (2, 'só o primeiro nome', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.create_collaborator('ana paula RIBEIRO', 2::smallint);
  insert into rc values (3, 'mesmo nome com outra caixa e sem acento', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (3, 'mesmo nome com outra caixa: recusa e explica', 'recusa',
    case when sqlerrm like 'Já existe alguém com este nome%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

do $$ begin
  perform public.create_collaborator('Bruno Souza', 2::smallint, '12345');
  insert into rc values (4, 'cadastro (nº) repetido', 'recusa', 'ACEITOU');
exception when others then
  insert into rc values (4, 'cadastro (nº) repetido: recusa e explica', 'recusa',
    case when sqlerrm like 'Este cadastro já é de outra pessoa%' then 'RECUSOU' else 'ACEITOU: ' || sqlerrm end);
end $$;

do $$ begin
  insert into ids values ('gabriel', public.create_collaborator('Gabriel Martins', 1::smallint));
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');   -- operador 1
do $$ begin
  perform public.create_collaborator('Carlos Lima', 1::smallint);
  insert into rc values (5, 'operador cadastra colaborador', 'recusa', 'ACEITOU');
exception when others then insert into rc values (5, 'operador cadastra colaborador', 'recusa', 'RECUSOU'); end $$;

-- ─── Falta de pessoas ───────────────────────────────────────────────────────
do $$ begin
  insert into ids values ('falta_ana', public.save_shift_absence(pg_temp.amanha(), 1::smallint, pg_temp.id('ana'), 'absent'));
  insert into rc values (6, 'operador registra a falta de uma colaboradora', 'aceita', 'ACEITOU');
exception when others then insert into rc values (6, 'operador registra falta', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.save_shift_absence(pg_temp.amanha(), 1::smallint, pg_temp.id('ana'), 'late', '06:40');
  insert into rc values (7, 'a mesma pessoa duas vezes no turno', 'recusa', 'ACEITOU');
exception when others then insert into rc values (7, 'a mesma pessoa duas vezes no turno', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.save_shift_absence(pg_temp.amanha(), 1::smallint, pg_temp.id('gabriel'), 'absent', '07:00');
  insert into rc values (8, '"faltou" com horário', 'recusa', 'ACEITOU');
exception when others then insert into rc values (8, '"faltou" com horário', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  insert into ids values ('saida_gabriel',
    public.save_shift_absence(pg_temp.amanha(), 1::smallint, pg_temp.id('gabriel'), 'left_early', '12:30', 'consulta médica'));
end $$;

-- ─── Quem vê o nome ─────────────────────────────────────────────────────────
do $$ declare n int; begin
  select count(*) into n from public.shift_absences;
  insert into rc values (9, 'operador lendo a tabela direto não vê nenhuma falta', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: viu %s', n) end);
end $$;

do $$ declare n int; nomes int; com_id int; detalhes int; begin
  select count(*), count(collaborator_name), count(id), count(note) + count(at_time)
    into n, nomes, com_id, detalhes
    from public.list_shift_absences(pg_temp.amanha(), pg_temp.amanha());
  insert into rc values (10, 'operador que registrou: vê as 2 contadas, sem nome nem detalhe, com o id para desfazer', 'aceita',
    case when n = 2 and nomes = 0 and detalhes = 0 and com_id = 2 then 'ACEITOU'
         else format('RECUSOU: n=%s nomes=%s ids=%s detalhes=%s', n, nomes, com_id, detalhes) end);
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');   -- operador 2
do $$ declare n int; nomes int; com_id int; begin
  select count(*), count(collaborator_name), count(id) into n, nomes, com_id
    from public.list_shift_absences(pg_temp.amanha(), pg_temp.amanha());
  insert into rc values (11, 'outro operador: só a contagem, sem nome e sem id', 'aceita',
    case when n = 2 and nomes = 0 and com_id = 0 then 'ACEITOU'
         else format('RECUSOU: n=%s nomes=%s ids=%s', n, nomes, com_id) end);
end $$;

do $$ begin
  perform public.remove_shift_absence(pg_temp.id('falta_ana'));
  insert into rc values (12, 'outro operador apaga a falta que não registrou', 'recusa', 'ACEITOU');
exception when others then insert into rc values (12, 'outro operador apaga a falta que não registrou', 'recusa', 'RECUSOU'); end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.remove_shift_absence(pg_temp.id('saida_gabriel'));
  insert into rc values (13, 'quem registrou desfaz, nas primeiras 24 h', 'aceita',
    case when not exists (select 1 from public.list_shift_absences(pg_temp.amanha(), pg_temp.amanha()) where id = pg_temp.id('saida_gabriel'))
         then 'ACEITOU' else 'RECUSOU: continuou lá' end);
exception when others then insert into rc values (13, 'quem registrou desfaz', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare v text; begin
  select collaborator_name into v from public.list_shift_absences(pg_temp.amanha(), pg_temp.amanha()) where id = pg_temp.id('falta_ana');
  insert into rc values (14, 'gestora vê o nome', 'aceita',
    case when v = 'Ana Paula Ribeiro' then 'ACEITOU' else format('RECUSOU: "%s"', v) end);
end $$;

-- ─── Inativar: a falta perde o nome, a contagem fica ───────────────────────
do $$ declare n int; v_colab uuid; v_total int; begin
  n := public.set_collaborator_active(pg_temp.id('ana'), false);
  select collaborator_id into v_colab from public.shift_absences where id = pg_temp.id('falta_ana');
  select count(*) into v_total from public.list_shift_absences(pg_temp.amanha(), pg_temp.amanha());
  insert into rc values (15, 'inativar tira o nome das faltas, que continuam contando no turno', 'aceita',
    case when n = 1 and v_colab is null and v_total = 1 then 'ACEITOU'
         else format('RECUSOU: tiradas=%s colab=%s total=%s', n, v_colab, v_total) end);
exception when others then insert into rc values (15, 'inativar', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.save_shift_absence(pg_temp.amanha() + 1, 1::smallint, pg_temp.id('ana'), 'absent');
  insert into rc values (16, 'falta de colaborador inativo', 'recusa', 'ACEITOU');
exception when others then insert into rc values (16, 'falta de colaborador inativo', 'recusa', 'RECUSOU'); end $$;

-- ─── Materiais faltantes ────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ declare v integer[]; begin
  insert into ids values ('filme', public.save_material_shortage(pg_temp.amanha(), 2::smallint, '19189479',
    'FILME PET+PE 0,5X270mm', array[pg_temp.maq('EMBALADORA HORIZONTAL N°1'), pg_temp.maq('EMBALADORA HORIZONTAL N°2')]));
  select machine_ids into v from public.material_shortage_summary where id = pg_temp.id('filme');
  insert into rc values (17, 'operador registra material faltante em duas máquinas', 'aceita',
    case when cardinality(v) = 2 then 'ACEITOU' else format('RECUSOU: %s', v) end);
exception when others then insert into rc values (17, 'material faltante', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  perform public.save_material_shortage(pg_temp.amanha(), 2::smallint, '19189479', 'FILME PET+PE 0,5X270mm');
  insert into rc values (18, 'o mesmo material duas vezes no turno', 'recusa', 'ACEITOU');
exception when others then insert into rc values (18, 'o mesmo material duas vezes no turno', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  perform public.save_material_shortage(pg_temp.amanha(), 3::smallint, '19A89', 'Material');
  insert into rc values (19, 'código de material com letra', 'recusa', 'ACEITOU');
exception when others then insert into rc values (19, 'código de material com letra', 'recusa', 'RECUSOU'); end $$;

do $$ declare v integer[]; begin
  perform public.save_material_shortage(pg_temp.amanha(), 2::smallint, '19189479',
    'FILME PET+PE 0,5X270mm', array[pg_temp.maq('EMBALADORA HORIZONTAL N°1')], 'acabou às 15h', pg_temp.id('filme'));
  select machine_ids into v from public.material_shortage_summary where id = pg_temp.id('filme');
  insert into rc values (20, 'quem registrou corrige: as máquinas são substituídas', 'aceita',
    case when cardinality(v) = 1 then 'ACEITOU' else format('RECUSOU: %s', v) end);
exception when others then insert into rc values (20, 'corrigir material', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  perform public.remove_material_shortage(pg_temp.id('filme'));
  insert into rc values (21, 'outro operador apaga o material que não registrou', 'recusa', 'ACEITOU');
exception when others then insert into rc values (21, 'outro operador apaga o material que não registrou', 'recusa', 'RECUSOU'); end $$;

-- ─── Auditoria: a falta por nome não vai para lá ───────────────────────────
reset role;
do $$ declare faltas int; cadastro int; materiais int; begin
  select count(*) filter (where table_name = 'shift_absences'),
         count(*) filter (where table_name = 'collaborators'),
         count(*) filter (where table_name = 'material_shortages')
    into faltas, cadastro, materiais
    from public.audit_logs where occurred_at >= now() - interval '1 minute';
  insert into rc values (22, 'auditoria: cadastro e materiais sim, falta por nome não', 'aceita',
    case when faltas = 0 and cadastro > 0 and materiais > 0 then 'ACEITOU'
         else format('RECUSOU: faltas=%s cadastro=%s materiais=%s', faltas, cadastro, materiais) end);
end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado like 'ACEITOU%') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
