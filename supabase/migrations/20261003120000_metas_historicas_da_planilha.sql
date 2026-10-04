-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0031 — A linha do tempo de metas antes de 25/09 vira a da planilha
-- Decisões: D60 (nova), D13, D35, D38, D59
--
-- O PROBLEMA: antes de 25/09/2026 a linha do tempo de metas guardava 18
-- degraus de RESERVA, todos com vigência 20/09/2026 — os valores 150 a 600 que
-- vieram do código do app antigo e nunca foram reais (D38). Como a função
-- `machine_target_on` usa o primeiro degrau para qualquer data anterior a ele,
-- dezembro, fevereiro, agosto… todos davam 500.
--
-- Isso aparecia para o usuário em três lugares:
--   • o histórico de metas da tela de Metas mostrava "500 desde 20/09";
--   • apontar com data anterior a 25/09 calculava a porcentagem contra 500;
--   • a D59 teve de abrir exceção para os importados ao mover de dia.
--
-- AS METAS VERDADEIRAS JÁ ESTAVAM NO BANCO: cada apontamento importado guarda
-- a meta e a base que a planilha usava no seu dia (D35, D08). Esta migration
-- reconstrói a linha do tempo a partir delas: para cada máquina, um degrau
-- começa no primeiro dia de cada valor diferente.
--
-- POR QUE UMA FUNÇÃO, E NÃO VALORES ESCRITOS AQUI: numa instalação do zero
-- (INSTALAR.md) as migrations rodam ANTES da importação, e não haveria do que
-- derivar. A função é chamada aqui e de novo depois da importação, e é
-- repetível: rodar duas vezes dá o mesmo resultado.
--
-- POR QUE ISTO NÃO FERE A D13 ("meta não se reescreve"): a D13 protege o que
-- foi meta de verdade, para um mês fechado continuar batendo. Os degraus de
-- reserva nunca foram meta de ninguém. E nenhum apontamento é tocado: cada um
-- continua com a foto da meta do seu dia, que é a fonte desta reconstrução.
-- Decisão do gestor, 03/10/2026.
--
-- O QUE NÃO MUDA: os degraus de 25/09/2026 em diante — as metas acordadas.
-- ═══════════════════════════════════════════════════════════════════════════


create or replace function public.reconstruir_metas_historicas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- A partir daqui vale a linha do tempo acordada com o gestor (0015).
  v_corte constant date := date '2026-09-25';
  v_count integer;
begin
  if not public.pode_importar() then
    raise exception 'Você não tem permissão para reconstruir as metas históricas.' using errcode = '42501';
  end if;

  -- O gatilho de vigência (D15) recusa meta com início no passado, e com razão:
  -- no uso normal, meta nova vale de hoje em diante. Esta é a única exceção, e
  -- só quem é dono da tabela consegue desligá-lo. Volta a valer no fim desta
  -- mesma transação; a auditoria continua ligada e registra cada linha.
  alter table public.machine_targets disable trigger validate_target_valid_from;

  -- Tudo o que há antes do corte é reserva ou reconstrução anterior.
  delete from public.machine_targets where valid_from < v_corte;

  -- Um degrau por mudança de valor (ou de base), na ordem dos dias.
  with por_dia as (
    select r.machine_id, r.production_date,
           -- a meta não varia dentro de um dia nos importados (conferido);
           -- `max` só torna isso explícito
           max(r.target_quantity) as quantidade,
           max(r.target_basis)    as base
      from public.production_records r
     where r.import_batch_id is not null
       and r.production_date < v_corte
     group by r.machine_id, r.production_date
  ), marcados as (
    select *,
           lag(quantidade) over w is distinct from quantidade
             or lag(base) over w is distinct from base as comeca_degrau
      from por_dia
    window w as (partition by machine_id order by production_date)
  )
  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis, created_by)
  select machine_id, quantidade, production_date, coalesce(base, 'per_shift'), null
    from marcados
   where comeca_degrau;

  get diagnostics v_count = row_count;

  alter table public.machine_targets enable trigger validate_target_valid_from;
  return v_count;
end;
$$;

revoke all on function public.reconstruir_metas_historicas() from public, anon, authenticated;

comment on function public.reconstruir_metas_historicas() is
  'Refaz a linha do tempo de metas anterior a 25/09/2026 a partir da meta '
  'gravada nos apontamentos importados (a da planilha). Repetível. Rodar depois '
  'de cada importação de histórico. Só o dono do banco ou quem tem '
  'import.manage. [D60]';


-- Neste banco o histórico já está carregado: reconstrói agora.
do $$ declare n integer; begin
  n := public.reconstruir_metas_historicas();
  raise notice 'Migration 0031: % degraus históricos reconstruídos a partir da planilha.', n;
end $$;
