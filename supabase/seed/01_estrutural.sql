-- ═══════════════════════════════════════════════════════════════════════════
-- Seed ESTRUTURAL — dados reais que o sistema precisa para funcionar
-- Pode rodar quantas vezes quiser: nada é duplicado nem sobrescrito
-- ("on conflict do nothing" / "where not exists").
--
-- Conteúdo:
--   1. Perfis-modelo (roles)                    — 7 linhas
--   2. Permissões (permissions)                 — 18 linhas (as outras 2,
--      import.review e import.manage, vêm da migration 16)
--   3. Permissões de cada perfil (role_permissions) — matriz da seção 8 da
--      referência técnica
--   4. Máquinas reais (machines)                — ids 1 a 18 do legado
--      (a 19 "RETRABALHO GERAL" não é recriada — decisão do desenho v0.1.0)
--   5. Metas vigentes (machine_targets)         — só para máquina SEM meta
--
-- Pré-requisito: migrations até 20260925100000 (a 13) aplicadas. O cabeçalho
-- dizia "até 20260920170000" e estava desatualizado: este seed grava process,
-- pieces_per_minute, efficiency e standard_operator_count em machines, e basis
-- em machine_targets — colunas que a migration 13 cria.
--
-- E as migrations 14 em diante vão DEPOIS deste seed: os perfis nascem aqui, e
-- a 16 concede as permissões de importação ao perfil admin com um
-- "where r.code = 'admin'" que, sem os perfis, não acha nada e não dá erro.
-- Ver supabase/INSTALAR.md.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Perfis-modelo ───────────────────────────────────────────────────────
insert into public.roles (id, code, name, description) values
  (1, 'operator',    'Operador',     'Aponta produção e corrige os próprios apontamentos por 24 h'),
  (2, 'preparer',    'Preparador',   'Operador + histórico, feedbacks, editar e apagar um por vez'),
  (3, 'distributor', 'Distribuidor', 'Preparador + edição/exclusão em massa e exportação de relatórios'),
  (4, 'technician',  'Técnico',      'Distribuidor + dashboard, metas (ver), máquinas, calendário, alertas e modo TV'),
  (5, 'manager',     'Gestor',       'Acesso total, incluindo alterar metas e aprovar usuários'),
  (6, 'admin',       'Admin',        'Acesso total, em conta compartilhada com identificação por crachá'),
  (7, 'tv_display',  'TV',           'Somente o modo TV')
on conflict (id) do nothing;


-- ─── 2. Permissões ──────────────────────────────────────────────────────────
insert into public.permissions (code, description, category, sort_order) values
  ('production.create',      'Apontar produção',                                   'Apontamento', 10),
  ('production.edit_own',    'Corrigir os próprios apontamentos (até 24 h)',       'Apontamento', 20),
  ('production.edit',        'Editar qualquer apontamento',                         'Apontamento', 30),
  ('production.delete',      'Apagar qualquer apontamento',                         'Apontamento', 40),
  ('production.bulk_edit',   'Editar vários apontamentos de uma vez',               'Apontamento', 50),
  ('production.bulk_delete', 'Apagar vários apontamentos de uma vez',               'Apontamento', 60),
  ('history.view',           'Ver histórico de apontamentos',                       'Análise',     110),
  ('feedbacks.view',         'Ver e editar observações (feedbacks)',                'Análise',     120),
  ('reports.export',         'Exportar relatórios (PDF/CSV)',                       'Análise',     130),
  ('dashboard.view',         'Ver o dashboard',                                     'Análise',     140),
  ('targets.view',           'Ver metas',                                           'Análise',     150),
  ('tv_mode.view',           'Usar o modo TV',                                      'Análise',     160),
  ('machines.manage',        'Cadastrar e alterar máquinas',                        'Gestão',      210),
  ('calendar.manage',        'Cadastrar feriados, eventos e dias anulados',         'Gestão',      220),
  ('alerts.manage',          'Configurar alertas',                                  'Gestão',      230),
  ('targets.manage',         'Alterar metas',                                       'Gestão',      240),
  ('users.approve',          'Aprovar usuários e ajustar permissões',               'Gestão',      250),
  ('system.admin',           'Administração do sistema (auditoria, turnos)',        'Sistema',     310)
on conflict (code) do nothing;


-- ─── 3. Permissões de cada perfil-modelo ────────────────────────────────────
-- Montado a partir da matriz: cada permissão lista os perfis que a recebem.
insert into public.role_permissions (role_id, permission_code)
select r.id, m.permission_code
  from (values
    ('production.create',      array['operator','preparer','distributor','technician','manager','admin']),
    ('production.edit_own',    array['operator','preparer','distributor','technician','manager','admin']),
    ('production.edit',        array['preparer','distributor','technician','manager','admin']),
    ('production.delete',      array['preparer','distributor','technician','manager','admin']),
    ('production.bulk_edit',   array['distributor','technician','manager','admin']),
    ('production.bulk_delete', array['distributor','technician','manager','admin']),
    ('history.view',           array['preparer','distributor','technician','manager','admin']),
    ('feedbacks.view',         array['preparer','distributor','technician','manager','admin']),
    ('reports.export',         array['distributor','technician','manager','admin']),
    ('dashboard.view',         array['technician','manager','admin']),
    ('targets.view',           array['technician','manager','admin']),
    ('tv_mode.view',           array['technician','manager','admin','tv_display']),
    ('machines.manage',        array['technician','manager','admin']),
    ('calendar.manage',        array['technician','manager','admin']),
    ('alerts.manage',          array['technician','manager','admin']),
    ('targets.manage',         array['manager','admin']),
    ('users.approve',          array['manager','admin']),
    ('system.admin',           array['manager','admin'])
  ) as m(permission_code, role_codes)
  cross join lateral unnest(m.role_codes) as rc(code)
  join public.roles r on r.code = rc.code
on conflict do nothing;


-- ─── 4. Centros de trabalho reais ───────────────────────────────────────────
-- Fonte: planilha ITAJAÍ_TI_CAPACIDADE_VS_PESSOAS 2026_2027_REV01.xlsx
-- (09/09/2026) e confirmações do gestor em 25/09/2026. Ver as decisões D37 a
-- D43 e o caderno docs/database/cadernos/07-mapa-da-fabrica.pdf.
--
-- 30 linhas: 22 centros ativos (13 montagem + 9 embalagem), 7 planejados
-- (previstos, ainda não existem na fábrica) e 1 inativo.
--
-- Os ids 1 a 18 são os do legado, preservados para a migração dos apontamentos
-- antigos casar direto. "overriding system value" permite informar o id numa
-- coluna que normalmente é numerada pelo banco.
--
-- peças/minuto e eficiência vêm da planilha de capacidade e servem só como
-- alarme de meta impossível (D40). A lotação é a do 1º turno — a planilha tem
-- lotação por turno, que o banco ainda não guarda.
-- Guarda dupla: pula a linha se o ID ja existir (on conflict) OU se o NOME ja
-- existir com outro id. Sem a segunda, rodar o seed depois da migration 0014
-- -- que cria os mesmos centros com ids escolhidos pelo banco -- poderia
-- esbarrar no indice de nome unico.
insert into public.machines
      (id, name, process, pieces_per_minute, efficiency, standard_operator_count, has_target, status)
overriding system value
select v.id, v.name, v.process, v.ppm, v.efic, v.ops, v.tem_meta, v.status
  from (values
  -- ── Embalagem: 9 centros, todos cobrados por meta ────────────────────────
  ( 1::integer, 'EMBALADORA HORIZONTAL N°1'::text, 'packaging'::text, 33.330::numeric, 0.70::numeric, 4::smallint, true, 'active'::text),
  ( 2, 'EMBALADORA HORIZONTAL N°2',              'packaging', 33.330, 0.70, 4, true,  'active'),
  ( 3, 'EMBALADORA 4X2 SUPORTES/PLACAS N°1',     'packaging', 21.739, 0.70, 2, true,  'active'),
  ( 4, 'EMBALADORA 4X2 SUPORTES/PLACAS N°2',     'packaging', 21.739, 0.70, 2, true,  'active'),
  ( 5, 'EMBALADORA VERTICAL MÓDULOS N°1',        'packaging', 32.258, 0.80, 2, true,  'active'),
  ( 6, 'EMBALADORA VERTICAL MÓDULOS N°2',        'packaging', 32.258, 0.80, 1, true,  'active'),
  ( 7, 'BANCADA EMBALAGEM A GRANÉL',             'packaging', 65.000, 0.70, 1, true,  'active'),
  (19, 'EMBALADORA VERTICAL CONJUNTOS N°1',      'packaging', 14.000, 0.70, 2, true,  'active'),
  (20, 'EMBALADORA VERTICAL CONJUNTOS N°2',      'packaging', 14.000, 0.70, 2, true,  'active'),

  -- ── Montagem: 13 centros, 3 cobrados por meta e 10 por demanda (D38) ─────
  ( 8, 'MÁQUINA DE INTERRUPTORES COMPOSÉ N°1',   'assembly',  12.048, 0.90, 1, true,  'active'),
  (16, 'MÁQUINA DE TOMADAS COMPOSÉ - AUMAQ',     'assembly',  30.000, 0.85, 1, true,  'active'),
  (21, 'MÁQUINA DE PLUGUE SLIN - AUMAQ',         'assembly',  16.000, 0.60, 1, true,  'active'),
  (13, 'EMBALADORA KIT PARAFUSOS N°1',           'assembly',  30.000, 0.60, 1, false, 'active'),
  (14, 'EMBALADORA KIT PARAFUSOS N°2',           'assembly',  30.000, 0.60, 1, false, 'active'),
  ( 9, 'BANCADA N°1 - TESTE INTERRUPTORES',      'assembly',  13.000, 0.60, 1, false, 'active'),
  (10, 'BANCADA N°2 - MONTAGEM INTERRUPTORES',   'assembly',   4.000, 0.60, 1, false, 'active'),
  (15, 'BANCADA N°3 - DIVERSOS',                 'assembly',   6.000, 0.60, 1, false, 'active'),
  (11, 'BANCADA N°4 - DIVERSOS',                 'assembly',   6.000, 0.60, 1, false, 'active'),
  (22, 'BANCADA N°5 - ELETRÔNICOS',              'assembly',   4.000, 0.60, 1, false, 'active'),
  (17, 'PRENSA INSERÇÃO CONTATOS INTERRUPTORES', 'assembly',   4.000, 0.60, 2, false, 'active'),
  (23, 'PRENSA TOX',                             'assembly',   6.000, 0.60, 1, false, 'active'),
  (12, 'PRENSA PLACA REFINATTO',                 'assembly',   6.000, 0.60, 1, false, 'active'),

  -- ── Planejados: previstos ou comprados, sem funcionamento real (D41) ─────
  -- Ao chegarem: mudar para 'active', preencher started_on e, se forem
  -- cobrados, marcar has_target e definir a meta na tela de Metas.
  (24, 'MÁQUINA DE INTERRUPTORES (NOVA BASE)',   'assembly',  null,   null, 1, false, 'planned'),
  (25, 'MÁQUINA DE PLUGUE FÊMEA',                'assembly',  null,   null, 1, false, 'planned'),
  (26, 'MÁQUINA DE TOMADAS N°2',                 'assembly',  null,   null, 1, false, 'planned'),
  (27, 'EMBALADORA VERTICAL LUFATI KLIN PADRÃO', 'packaging', 40.000, 0.70, 1, false, 'planned'),
  (28, 'EMBALADORA VERTICAL LUFATI PL+SUP 4X4',  'packaging', 40.000, 0.70, 2, false, 'planned'),
  (29, 'EMBALADORA VERTICAL PLUGUES',            'packaging', 25.000, 0.70, 1, false, 'planned'),
  (30, 'EMBALADORA VERTICAL CONJUNTOS N°3',      'packaging', 25.000, 0.70, 1, false, 'planned'),

  -- ── Inativo: centro renomeado e readequado na fábrica (D43) ──────────────
  -- O que era feito aqui hoje é feito na Bancada N°3. Nunca apagar: o
  -- histórico da planilha aponta para este id.
  (18, 'FECHAMENTO TECLA INTERRUPTORES',         'assembly',  null,   null, null, false, 'inactive')
  ) as v(id, name, process, ppm, efic, ops, tem_meta, status)
 where not exists (
   select 1 from public.machines m where lower(m.name) = lower(v.name)
 )
on conflict (id) do nothing;

-- Acerta o contador de ids: a próxima máquina cadastrada pelo app recebe
-- (maior id existente + 1), e não 1 — que já está em uso.
select setval(
  pg_get_serial_sequence('public.machines', 'id'),
  greatest((select max(id) from public.machines), 1)
);


-- ─── 5. Metas vigentes ───────────────────────────────────────────
-- Metas REAIS, confirmadas com o gestor em 25/09/2026 (D38). Substituem os
-- valores de reserva de 150 a 600 que vieram do código do app e nunca foram
-- reais.
--
-- Onze centros têm meta fixa por turno. A Bancada Embalagem A Granél é medida
-- POR PESSOA: 25.000 × número de operadores do apontamento (D39).
--
-- Os dez centros por demanda entram com meta 0 e "tem meta = não": a marca na
-- ficha da máquina é o que manda no cálculo; o zero evita que o histórico de
-- metas mostre um valor que nunca existiu.
--
-- Só insere para máquina que ainda não tem NENHUMA meta: rodar de novo não
-- altera metas já existentes, porque a meta é histórico e não se sobrescreve.
-- Vigência: hoje (fuso de Brasília).
--
-- ATENÇÃO: aqui só estão as metas de HOJE. Os degraus do passado (horizontais
-- 8.000, placas 7.000, a granel 15.000) entram com a importação do histórico
-- da planilha (D35).
insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
select m.id, v.quantidade, (now() at time zone 'America/Sao_Paulo')::date, v.base
  from (values
    ('EMBALADORA HORIZONTAL N°1',              10000, 'per_shift'   ),
    ('EMBALADORA HORIZONTAL N°2',              10000, 'per_shift'   ),
    ('EMBALADORA 4X2 SUPORTES/PLACAS N°1',      7500, 'per_shift'   ),
    ('EMBALADORA 4X2 SUPORTES/PLACAS N°2',      7500, 'per_shift'   ),
    ('EMBALADORA VERTICAL MÓDULOS N°1',        13000, 'per_shift'   ),
    ('EMBALADORA VERTICAL MÓDULOS N°2',        13000, 'per_shift'   ),
    ('EMBALADORA VERTICAL CONJUNTOS N°1',       5000, 'per_shift'   ),
    ('EMBALADORA VERTICAL CONJUNTOS N°2',       5000, 'per_shift'   ),
    ('BANCADA EMBALAGEM A GRANÉL',             25000, 'per_operator'),
    ('MÁQUINA DE TOMADAS COMPOSÉ - AUMAQ',     12500, 'per_shift'   ),
    ('MÁQUINA DE PLUGUE SLIN - AUMAQ',          6500, 'per_shift'   ),
    ('MÁQUINA DE INTERRUPTORES COMPOSÉ N°1',    4500, 'per_shift'   ),
    -- por demanda: meta 0, fora do cálculo de atingimento
    ('EMBALADORA KIT PARAFUSOS N°1',               0, 'per_shift'   ),
    ('EMBALADORA KIT PARAFUSOS N°2',               0, 'per_shift'   ),
    ('BANCADA N°1 - TESTE INTERRUPTORES',           0, 'per_shift'   ),
    ('BANCADA N°2 - MONTAGEM INTERRUPTORES',        0, 'per_shift'   ),
    ('BANCADA N°3 - DIVERSOS',                      0, 'per_shift'   ),
    ('BANCADA N°4 - DIVERSOS',                      0, 'per_shift'   ),
    ('BANCADA N°5 - ELETRÔNICOS',                   0, 'per_shift'   ),
    ('PRENSA INSERÇÃO CONTATOS INTERRUPTORES',      0, 'per_shift'   ),
    ('PRENSA TOX',                                  0, 'per_shift'   ),
    ('PRENSA PLACA REFINATTO',                      0, 'per_shift'   )
  ) as v(nome, quantidade, base)
  join public.machines m on lower(m.name) = lower(v.nome)
 where not exists (select 1 from public.machine_targets t where t.machine_id = m.id);
