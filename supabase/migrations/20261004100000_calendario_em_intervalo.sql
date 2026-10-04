-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0035 — Calendário: vários dias numa operação só, com abrangência
-- Decisões: D61 (nova), D16, D17, D18
--
-- PEDIDO da sessão da interface (nota 2026-10-04-calendario-ligado.md), depois
-- de ligar a tela de Calendário:
--
-- 1. INTERVALO ATÔMICO. Férias coletivas ou uma ponte viravam uma chamada por
--    dia. Se a 5ª falhasse, as 4 primeiras ficavam, e o calendário ficava pela
--    metade sem ninguém pedir. Agora a lista de dias entra inteira ou não entra.
--
-- 2. ABRANGÊNCIA. A coluna `scope` aceitava nacional, estadual, municipal e da
--    empresa desde o começo, mas o app gravava tudo como "da empresa". O gestor
--    vai cadastrar os feriados de SC e de Itajaí, e a tela passa a poder dizer
--    de onde vem cada um.
--
-- ONDE: uma função nova, e não `insert` direto da tela, porque só função
-- consegue ser tudo ou nada numa chamada só da API. As permissões são as mesmas
-- da RLS: quem tem `calendar.manage`.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.add_calendar_events(
  p_dates       date[],
  p_description text,
  p_event_type  text,
  p_scope       text       default 'company',
  -- Vazio ou nulo = o dia inteiro (D17).
  p_shift_ids   smallint[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia   date;
  v_id    uuid;
  v_count integer := 0;
begin
  if not public.has_permission('calendar.manage') then
    raise exception 'Você não tem permissão para alterar o calendário.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_dates), 0) = 0 then
    raise exception 'Informe ao menos um dia.' using errcode = '22023';
  end if;
  -- Um ano inteiro de uma vez já é engano de quem chamou.
  if cardinality(p_dates) > 366 then
    raise exception 'No máximo 366 dias por cadastro.' using errcode = '22023';
  end if;
  if nullif(trim(p_description), '') is null then
    raise exception 'Informe a descrição.' using errcode = '22023';
  end if;
  if p_event_type not in ('holiday', 'special_event', 'excluded_day') then
    raise exception 'Tipo de evento desconhecido: "%".', p_event_type using errcode = '22023';
  end if;
  if coalesce(p_scope, 'company') not in ('national', 'state', 'municipal', 'company') then
    raise exception 'Abrangência desconhecida: "%".', p_scope using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_shift_ids, '{}')) s
              where not exists (select 1 from public.shifts t where t.id = s)) then
    raise exception 'Turno inexistente na lista.' using errcode = '22023';
  end if;

  -- Dia repetido na própria lista conta uma vez só.
  foreach v_dia in array (select array_agg(distinct d order by d) from unnest(p_dates) d) loop
    insert into public.calendar_events (event_date, description, event_type, scope)
    values (v_dia, trim(p_description), p_event_type, coalesce(p_scope, 'company'))
    returning id into v_id;

    insert into public.calendar_event_shifts (event_id, shift_id)
    select v_id, s from unnest(coalesce(p_shift_ids, '{}')) s;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.add_calendar_events(date[], text, text, text, smallint[]) from public, anon;
grant execute on function public.add_calendar_events(date[], text, text, text, smallint[]) to authenticated;

comment on function public.add_calendar_events(date[], text, text, text, smallint[]) is
  'Cadastra o mesmo evento em vários dias, tudo ou nada. Abrangência nacional, '
  'estadual, municipal ou da empresa; turnos vazios = dia inteiro. Exige '
  'calendar.manage. [D16, D17, D61]';
