-- =========================================================
-- EL ORACULO / REINGRESO — PASO 4 de 4
-- Las vistas de puntaje cuentan los cupos extra
-- =========================================================
-- Correr los 4 pasos EN ORDEN, cada uno por separado. Si uno truena, el
-- mensaje de error te dice en cual fue sin arrastrar a los demas.
--
-- EL ORÁCULO: reingresos a la casa
-- Mariana Ochoa salió en la semana 1, volvió a entrar y ganó la temporada. Eso
-- rompe un supuesto que tenía El Oráculo: que cada persona ocupa UN lugar en el
-- orden. Mariana ocupa dos — el de su primera salida y el de ganadora — así que
-- la temporada tiene 18 cupos, no 17.
--
-- Con 17, el lugar 1 lo compartían la ganadora y la última eliminación, y todas
-- las posiciones quedaban corridas una de menos.
--

-- ---------- 4. Las vistas cuentan los cupos extra ----------
create or replace view public.elimination_order_score as
with total_participants as (
  -- Un cupo por persona, MÁS uno extra por cada reingreso: quien vuelve a
  -- entrar tiene que volver a salir, así que ocupa dos lugares en el orden.
  select (count(*) + coalesce(sum(reentries), 0))::int as n
  from public.participants where is_infiltrado = false
),
actual_blocks as (
  select
    e.participant_id,
    dense_rank() over (
      order by w.week_number asc,
      case when w.is_final then coalesce(e.exit_order, 0) else 0 end asc
    ) as block_no
  from public.eliminations e
  join public.weeks w on w.id = e.week_id
  join public.participants p on p.id = e.participant_id
  where p.is_infiltrado = false
    and e.reverted_by_exile = false
    and e.gift_all = false
),
gift_count as (
  select count(*)::int as n
  from public.eliminations e
  join public.participants p on p.id = e.participant_id
  where e.gift_all = true and p.is_infiltrado = false
),
players_with_predictions as (
  select distinct player_id from public.elimination_order_predictions
),
block_sizes as (
  select block_no, count(*) as block_size from actual_blocks group by block_no
),
block_bounds as (
  select
    block_no,
    coalesce(sum(block_size) over (order by block_no rows between unbounded preceding and 1 preceding), 0) + 1 as fwd_start,
    sum(block_size) over (order by block_no) as fwd_end
  from block_sizes
),
block_membership as (
  select
    ab.block_no,
    ab.participant_id,
    (tp.n - bb.fwd_end + 1) as start_pos,
    (tp.n - bb.fwd_start + 1) as end_pos
  from actual_blocks ab
  join block_bounds bb using (block_no)
  cross join total_participants tp
),
winner_hits as (
  select pr.player_id
  from public.elimination_order_predictions pr
  join public.participants p on p.id = pr.participant_id and p.is_winner = true
  where pr.position = 1
),
elimination_hits as (
  select pr.player_id
  from public.elimination_order_predictions pr
  join block_membership bm
    on pr.position between bm.start_pos and bm.end_pos
    and pr.participant_id = bm.participant_id
),
all_hits as (
  select player_id from winner_hits
  union all
  select player_id from elimination_hits
),
hit_counts as (
  select player_id, count(*) as c from all_hits group by player_id
)
select
  pwp.player_id,
  (coalesce(hc.c, 0) + (select n from gift_count))::bigint as points
from players_with_predictions pwp
left join hit_counts hc on hc.player_id = pwp.player_id;

create or replace view public.granja_elimination_order_score as
with total_participants as (
  -- Un cupo por persona, MÁS uno extra por cada reingreso: quien vuelve a
  -- entrar tiene que volver a salir, así que ocupa dos lugares en el orden.
  select (count(*) + coalesce(sum(reentries), 0))::int as n
  from public.granja_participants where is_infiltrado = false
),
actual_blocks as (
  select
    e.participant_id,
    dense_rank() over (
      order by w.week_number asc,
      case when w.is_final then coalesce(e.exit_order, 0) else 0 end asc
    ) as block_no
  from public.granja_eliminations e
  join public.granja_weeks w on w.id = e.week_id
  join public.granja_participants p on p.id = e.participant_id
  where p.is_infiltrado = false
    and e.reverted_by_exile = false
    and e.gift_all = false
),
gift_count as (
  select count(*)::int as n
  from public.granja_eliminations e
  join public.granja_participants p on p.id = e.participant_id
  where e.gift_all = true and p.is_infiltrado = false
),
players_with_predictions as (
  select distinct player_id from public.granja_elimination_order_predictions
),
block_sizes as (
  select block_no, count(*) as block_size from actual_blocks group by block_no
),
block_bounds as (
  select
    block_no,
    coalesce(sum(block_size) over (order by block_no rows between unbounded preceding and 1 preceding), 0) + 1 as fwd_start,
    sum(block_size) over (order by block_no) as fwd_end
  from block_sizes
),
block_membership as (
  select
    ab.block_no,
    ab.participant_id,
    (tp.n - bb.fwd_end + 1) as start_pos,
    (tp.n - bb.fwd_start + 1) as end_pos
  from actual_blocks ab
  join block_bounds bb using (block_no)
  cross join total_participants tp
),
winner_hits as (
  select pr.player_id
  from public.granja_elimination_order_predictions pr
  join public.granja_participants p on p.id = pr.participant_id and p.is_winner = true
  where pr.position = 1
),
elimination_hits as (
  select pr.player_id
  from public.granja_elimination_order_predictions pr
  join block_membership bm
    on pr.position between bm.start_pos and bm.end_pos
    and pr.participant_id = bm.participant_id
),
all_hits as (
  select player_id from winner_hits
  union all
  select player_id from elimination_hits
),
hit_counts as (
  select player_id, count(*) as c from all_hits group by player_id
)
select
  pwp.player_id,
  (coalesce(hc.c, 0) + (select n from gift_count))::bigint as points
from players_with_predictions pwp
left join hit_counts hc on hc.player_id = pwp.player_id;

grant select on public.elimination_order_score to anon, authenticated;
grant select on public.granja_elimination_order_score to anon, authenticated;
