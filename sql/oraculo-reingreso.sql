-- =========================================================
-- EL ORÁCULO: reingresos a la casa
-- =========================================================
-- Mariana Ochoa salió en la semana 1, volvió a entrar y ganó la temporada. Eso
-- rompe un supuesto que tenía El Oráculo: que cada persona ocupa UN lugar en el
-- orden. Mariana ocupa dos — el de su primera salida y el de ganadora — así que
-- la temporada tiene 18 cupos, no 17.
--
-- Con 17, el lugar 1 lo compartían la ganadora y la última eliminación, y todas
-- las posiciones quedaban corridas una de menos.
--
-- Correr este archivo completo una sola vez. El paso 3 se protege solo: si ya
-- se aplicó, avisa y no vuelve a mover nada.

-- ---------- 1. Cuántos cupos extra da cada persona ----------
alter table public.participants add column if not exists reentries int not null default 0;
alter table public.granja_participants add column if not exists reentries int not null default 0;

update public.participants set reentries = 1 where name = 'Mariana Ochoa';

-- ---------- 2. Una persona puede ocupar más de un lugar ----------
-- El unique (player_id, participant_id) impedía que alguien apareciera dos
-- veces en el mismo orden. Se quita en los dos shows para que las dos tablas
-- sigan siendo iguales.
do $$
declare
  c record;
begin
  for c in
    select t.relname as tabla, con.conname as nombre
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('elimination_order_predictions', 'granja_elimination_order_predictions')
      and con.contype = 'u'
  loop
    execute format('alter table public.%I drop constraint %I', c.tabla, c.nombre);
  end loop;
end $$;

-- ---------- 3. Correr los órdenes y poner a Mariana de ganadora ----------
-- Al pasar de 17 a 18 cupos, TODAS las posiciones reales se corren una hacia
-- arriba (el primero en salir pasa de 17 a 18). Para que las predicciones sigan
-- significando lo mismo, los órdenes de los jugadores se corren igual: lo que
-- tenían en 1..17 pasa a 2..18. Eso libera el lugar 1, y ahí entra Mariana para
-- todos: nadie podía predecir que la primera eliminada iba a volver y ganar.
do $$
declare
  mariana bigint;
  n_jugadores int;
begin
  select id into mariana from public.participants where name = 'Mariana Ochoa';
  if mariana is null then
    raise exception 'No encontré a Mariana Ochoa en participants';
  end if;

  if exists (
    select 1 from public.elimination_order_predictions
    where position = 1 and participant_id = mariana
  ) then
    raise notice 'Ya estaba aplicado: Mariana ya aparece en el lugar 1. No se mueve nada.';
    return;
  end if;

  -- Se corre en dos pasos pasando por un rango libre: un solo
  -- "position = position + 1" choca contra el primary key (player_id, position)
  -- en cuanto la primera fila intenta ocupar un lugar que todavía existe.
  update public.elimination_order_predictions set position = position + 1000;
  update public.elimination_order_predictions set position = position - 999;

  insert into public.elimination_order_predictions (player_id, position, participant_id)
  select distinct player_id, 1, mariana
  from public.elimination_order_predictions;

  select count(distinct player_id) into n_jugadores from public.elimination_order_predictions;
  raise notice 'Listo: % jugadores corridos a 2..18 y Mariana puesta en el lugar 1.', n_jugadores;
end $$;

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
