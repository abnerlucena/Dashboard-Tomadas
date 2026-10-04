-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0028 — Nº de operadores obrigatório onde a meta é por pessoa
-- Decisões: D54 (nova), D52, D48, D47, D12
--
-- O PROBLEMA: na A Granél a meta é POR PESSOA (`per_operator`), e a conta é
--
--     meta = meta_cadastrada × nº de pessoas
--
-- Quando ninguém informava o número, a função preenchia com a lotação padrão —
-- que nessa máquina é 1. O gestor confirmou em 01/10/2026 que o padrão 1 está
-- certo, **e que o posto tem rotatividade constante**. As duas coisas juntas
-- são o problema: estando 3 pessoas e ninguém digitando, o turno é comparado
-- com a meta de UMA, e a máquina aparece com 300% sem ninguém desconfiar.
--
-- POR QUE SÓ NESSA BASE: em `per_shift` o campo não entra na conta, e em
-- `per_shift_prorated` esquecer é conservador — a meta fica a cheia, nunca
-- maior. Só em `per_operator` o esquecimento INFLA a meta... ou melhor, deixa
-- a meta pequena demais e o atingimento grande demais, em silêncio.
--
-- O QUE NÃO MUDA, por decisão do gestor:
--   • o passado continua lido como 1 pessoa. Os 289 turnos importados não têm
--     o número e nunca vão ter — a planilha nunca teve essa coluna (D35). O
--     `coalesce(..., standard_operator_count, 1)` da view FICA, e passa a
--     valer só para eles;
--   • a importação continua podendo gravar sem o número, pelo mesmo motivo;
--   • nenhuma linha existente é tocada.
--
-- POR QUE NA FUNÇÃO E NÃO NUMA RESTRIÇÃO OU GATILHO: `production_records` só
-- tem política de SELECT, então a RLS já impede escrita direta — estas funções
-- são a única porta. Uma restrição `check` também teria de nascer `not valid`
-- para não brigar com os 289 turnos antigos, e restrição `not valid` é a que
-- todo mundo esquece que existe.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Quem exige, em um lugar só ──────────────────────────────────────────
-- Função à parte para a regra não ficar copiada nos dois ramos (criar e
-- alterar) de `save_production_record`.
create or replace function public.exige_numero_de_operadores(
  p_machine_id integer,
  p_date       date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.machine_target_basis_on(p_machine_id, p_date) = 'per_operator';
$$;

comment on function public.exige_numero_de_operadores(integer, date) is
  'Verdadeiro quando a meta da máquina naquela data é por pessoa, e portanto o '
  'nº de operadores é obrigatório no apontamento. [D54]';


-- ─── 2. save_production_record cobra o número ───────────────────────────────
create or replace function public.save_production_record(
  p_production_date date,
  p_shift_id        smallint,
  p_machine_id      integer,
  p_orders          jsonb    default null,
  p_notes           text     default null,
  p_operator_count  smallint default null,
  p_work_mode       text     default 'regular',
  p_replace_orders  boolean  default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode   text := coalesce(p_work_mode, 'regular');
  v_exige  boolean := public.exige_numero_de_operadores(p_machine_id, p_production_date);
  v_rec    public.production_records;
  v_id     uuid;
  v_depois smallint;
begin
  select * into v_rec
    from public.production_records
   where machine_id = p_machine_id
     and production_date = p_production_date
     and shift_id = p_shift_id
     and work_mode = v_mode
   for update;  -- trava a linha: dois salvamentos simultâneos não se atropelam

  -- Quanta gente a linha vai ter DEPOIS deste salvamento. Precisa ser calculado
  -- antes de gravar, porque "não veio no pedido" quer dizer "mantém o que
  -- estava" — e o que estava pode ser nulo.
  v_depois := case when p_operator_count is null then v_rec.operator_count
                   when p_operator_count = 0 then null
                   else p_operator_count end;

  if v_exige and coalesce(v_depois, 0) = 0 then
    raise exception 'Informe quantas pessoas trabalharam neste turno: a meta desta máquina é por pessoa.'
      using errcode = '23514';
  end if;

  if not found then
    if not public.has_permission('production.create') then
      raise exception 'Você não tem permissão para apontar produção.' using errcode = '42501';
    end if;

    insert into public.production_records
      (production_date, shift_id, machine_id, target_quantity, target_basis,
       operator_count, work_mode, notes, created_by)
    values (
      p_production_date,
      p_shift_id,
      p_machine_id,
      coalesce(public.machine_target_on(p_machine_id, p_production_date), 0),
      -- A base vem da mesma meta de onde veio o número, no mesmo dia.
      public.machine_target_basis_on(p_machine_id, p_production_date),
      -- Zero é "não informado" (D48), e vira nulo em vez de virar zero na
      -- tabela: nulo é o que o resto do banco entende como ausência. Onde a
      -- meta é por pessoa não se chega aqui sem número — a checagem acima
      -- barrou —, então a lotação padrão só preenche as outras máquinas.
      case when p_operator_count = 0 then null
           else coalesce(p_operator_count,
                  (select m.standard_operator_count from public.machines m where m.id = p_machine_id))
      end,
      v_mode,
      nullif(trim(p_notes), ''),
      auth.uid()
    )
    returning id into v_id;
  else
    if not public.can_edit_production_record(v_rec.created_by, v_rec.created_at) then
      raise exception 'Já existe apontamento desta máquina neste dia e turno, e você não tem permissão para alterá-lo.'
        using errcode = '42501';
    end if;
    v_id := v_rec.id;

    update public.production_records
       set notes          = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
           -- Três casos distintos, e é isto que permite APAGAR (D52):
           --   nulo  → não veio no pedido: mantém o que estava
           --   zero  → veio vazio da tela: apaga
           --   outro → grava
           -- Onde a meta é por pessoa, apagar foi barrado lá em cima.
           operator_count = v_depois,
           updated_by     = auth.uid()
     where id = v_id;

    if p_replace_orders and p_orders is not null then
      delete from public.production_orders where production_record_id = v_id;
    end if;
  end if;

  perform public.insert_production_orders(v_id, p_orders);
  return v_id;
end;
$$;

comment on function public.save_production_record(date, smallint, integer, jsonb, text, smallint, text, boolean) is
  'Cria ou atualiza o apontamento de uma máquina num dia e turno. Onde a meta é '
  'por pessoa, o nº de operadores é obrigatório e não pode ser apagado. [D08, D48, D52, D54]';
