-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0032 — Dois turnos importados estavam medidos contra a meta errada
-- Decisões: D60, D35, D08
--
-- COMO APARECEU: a reconstrução da linha do tempo (0031) confere cada
-- apontamento importado contra a meta do seu dia. Um não bateu.
--
-- A CAUSA, na importação: a planilha tinha duas células de retrabalho escritas
-- em texto, revisadas uma a uma pelo gestor (D35):
--   • SET 26!AB8  "H 01 - 4800"                → Horizontal N°1, 02/09, T1
--   • ABR 26!AN42 "Retrabalho Refinatto 4.510" → Prensa Placa Refinatto, 27/04, T1
-- O extrator deu a essas linhas a META DE HOJE (a do dia da importação), e não
-- a meta que a planilha usava naquele dia. O apontamento montado com elas
-- herdou a meta errada:
--   • Horizontal N°1, 02/09, T1: 10.000 em vez de 8.000
--   • Refinatto, 27/04, T1:           0 em vez de 1.000
-- E a reconstrução da 0031 herdou isso como dois degraus falsos.
--
-- A CORREÇÃO usa a mesma regra que o extrator aplica a qualquer linha sem meta
-- própria (D35, `planilha_arrastada`): a última meta da planilha naquela
-- máquina, antes daquele turno. O extrator foi corrigido no mesmo commit para
-- não repetir isto em cargas futuras.
--
-- O QUE É TOCADO: só os apontamentos importados que receberam meta de uma
-- linha de retrabalho com `meta_de_hoje` — neste banco, os dois acima. A
-- regra não tem nomes nem datas escritos, para servir em qualquer banco.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  r          record;
  v_anterior integer;
  v_count    integer := 0;
begin
  for r in
    select distinct pr.id, pr.machine_id, pr.production_date, pr.shift_id, pr.target_quantity
      from public.production_records pr
      join public.import_rows ir on ir.production_record_id = pr.id
     where pr.import_batch_id is not null
       and ir.kind = 'rework'
       and ir.target_source = 'meta_de_hoje'
  loop
    -- A última meta da planilha nesta máquina, antes deste turno.
    select p.target_quantity into v_anterior
      from public.production_records p
     where p.machine_id = r.machine_id
       and p.import_batch_id is not null
       and (p.production_date, p.shift_id) < (r.production_date, r.shift_id)
     order by p.production_date desc, p.shift_id desc
     limit 1;

    if v_anterior is not null and v_anterior is distinct from r.target_quantity then
      update public.production_records set target_quantity = v_anterior where id = r.id;
      v_count := v_count + 1;
      raise notice 'Migration 0032: apontamento % (%, turno %): meta % → %',
        r.id, to_char(r.production_date, 'DD/MM/YYYY'), r.shift_id, r.target_quantity, v_anterior;
    end if;
  end loop;

  -- A área de preparo conta de onde veio cada meta: deixa o rastro coerente.
  update public.import_rows ir
     set target_quantity = pr.target_quantity,
         target_source   = 'planilha_arrastada'
    from public.production_records pr
   where ir.production_record_id = pr.id
     and ir.kind = 'rework'
     and ir.target_source = 'meta_de_hoje';

  raise notice 'Migration 0032: % apontamento(s) corrigido(s).', v_count;
end $$;

-- Os dois degraus falsos saem refazendo a linha do tempo com as metas certas.
do $$ declare n integer; begin
  n := public.reconstruir_metas_historicas();
  raise notice 'Migration 0032: linha do tempo refeita, % degraus históricos.', n;
end $$;
