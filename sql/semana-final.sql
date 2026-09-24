-- =========================================================
-- SEMANA FINAL
-- =========================================================
-- En la última semana no sale una sola persona: van saliendo varias a lo largo
-- de los días hasta quedar el ganador. Por eso esa semana cambia en dos cosas:
--   1. Las eliminaciones llevan orden (exit_order): 1 = la primera en salir.
--   2. El pick semanal deja de ser "quién sale" y pasa a ser el orden completo,
--      de la primera salida al ganador. +1 punto por cada posición acertada.
--
-- Se aplica a los dos shows: cada bloque corre sobre sus propias tablas.

-- ---------- LA CASA ----------
alter table public.weeks add column if not exists is_final boolean not null default false;
alter table public.eliminations add column if not exists exit_order int;

create table if not exists public.final_predictions (
  week_id bigint not null references public.weeks(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  position int not null,
  participant_id bigint not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (week_id, player_id, position),
  unique (week_id, player_id, participant_id)
);

-- ---------- LA GRANJA ----------
alter table public.granja_weeks add column if not exists is_final boolean not null default false;
alter table public.granja_eliminations add column if not exists exit_order int;

create table if not exists public.granja_final_predictions (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  position int not null,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (week_id, player_id, position),
  unique (week_id, player_id, participant_id)
);

-- =========================================================
-- RLS: mismas reglas que el pick semanal
-- Se leen todos, pero cada quien escribe el suyo y solo mientras la semana
-- sigue en votación (y antes de voting_closes_at si el admin la definió).
-- =========================================================
alter table public.final_predictions enable row level security;
alter table public.granja_final_predictions enable row level security;

do $$
declare
  t text;
  w text;
begin
  foreach t in array array['final_predictions', 'granja_final_predictions']
  loop
    w := case when t like 'granja%' then 'granja_weeks' else 'weeks' end;

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_write_own', t);
    execute format(
      'create policy %I on public.%I for all using (
         player_id = auth.uid()
         and exists (
           select 1 from public.%I w
           where w.id = week_id
             and w.status = ''voting_open''
             and (w.voting_closes_at is null or now() < w.voting_closes_at)
         )
       ) with check (
         player_id = auth.uid()
         and exists (
           select 1 from public.%I w
           where w.id = week_id
             and w.status = ''voting_open''
             and (w.voting_closes_at is null or now() < w.voting_closes_at)
         )
       )',
      t || '_write_own', t, w, w
    );
  end loop;
end $$;

-- =========================================================
-- VISTAS: puntaje del orden de la final
-- =========================================================
-- El orden real es: las eliminaciones de la semana final ordenadas por
-- exit_order y, al final, el ganador de la temporada (que no tiene fila en
-- eliminations). +1 por cada posición que el jugador haya acertado.
create or replace view public.final_week_score as
with salidas as (
  select
    e.week_id,
    e.participant_id,
    row_number() over (partition by e.week_id order by e.exit_order) as position
  from public.eliminations e
  join public.weeks w on w.id = e.week_id
  where w.is_final and e.exit_order is not null
),
ganador as (
  select
    w.id as week_id,
    p.id as participant_id,
    (select count(*) from salidas s where s.week_id = w.id) + 1 as position
  from public.weeks w
  cross join public.participants p
  where w.is_final and p.is_winner
),
orden_real as (
  select week_id, participant_id, position from salidas
  union all
  select week_id, participant_id, position from ganador
)
select fp.player_id, count(*)::bigint as points
from public.final_predictions fp
join orden_real o
  on o.week_id = fp.week_id
 and o.position = fp.position
 and o.participant_id = fp.participant_id
group by fp.player_id;

create or replace view public.granja_final_week_score as
with salidas as (
  select
    e.week_id,
    e.participant_id,
    row_number() over (partition by e.week_id order by e.exit_order) as position
  from public.granja_eliminations e
  join public.granja_weeks w on w.id = e.week_id
  where w.is_final and e.exit_order is not null
),
ganador as (
  select
    w.id as week_id,
    p.id as participant_id,
    (select count(*) from salidas s where s.week_id = w.id) + 1 as position
  from public.granja_weeks w
  cross join public.granja_participants p
  where w.is_final and p.is_winner
),
orden_real as (
  select week_id, participant_id, position from salidas
  union all
  select week_id, participant_id, position from ganador
)
select fp.player_id, count(*)::bigint as points
from public.granja_final_predictions fp
join orden_real o
  on o.week_id = fp.week_id
 and o.position = fp.position
 and o.participant_id = fp.participant_id
group by fp.player_id;

grant select on public.final_week_score to anon, authenticated;
grant select on public.granja_final_week_score to anon, authenticated;

-- =========================================================
-- EL ORÁCULO interpreta las salidas de la final
-- =========================================================
-- Fuera de la final, todas las eliminaciones de una semana forman UN bloque y
-- el orden entre ellas da igual. En la final sí se conoce el orden exacto, así
-- que cada salida se vuelve su propio bloque y el acierto tiene que ser en la
-- posición justa. Es el único cambio: el resto de la vista queda igual.
create or replace view public.elimination_order_score as
with total_participants as (
  select count(*)::int as n from public.participants where is_infiltrado = false
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
  select count(*)::int as n from public.granja_participants where is_infiltrado = false
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

-- =========================================================
-- LEADERBOARD: suma el puntaje de la final
-- =========================================================
create or replace view public.leaderboard as
select
  p.id as player_id,
  p.username,
  p.display_name,
  coalesce(pred_pts.pts, 0) + coalesce(sab.points, 0) + coalesce(eos.points, 0) + coalesce(fws.points, 0) as points
from public.profiles p
left join (
  select pr.player_id, count(*) as pts
  from public.predictions pr
  join public.eliminations e on e.week_id = pr.week_id and e.participant_id = pr.participant_id
  group by pr.player_id
) pred_pts on pred_pts.player_id = p.id
left join public.secret_assignment_bonus sab on sab.player_id = p.id
left join public.elimination_order_score eos on eos.player_id = p.id
left join public.final_week_score fws on fws.player_id = p.id
order by points desc, display_name asc;

create or replace view public.granja_leaderboard as
select
  p.id as player_id,
  p.username,
  p.display_name,
  coalesce(pred_pts.pts, 0) + coalesce(sab.points, 0) + coalesce(eos.points, 0) + coalesce(fws.points, 0) as points
from public.profiles p
left join (
  select pr.player_id, count(*) as pts
  from public.granja_predictions pr
  join public.granja_eliminations e on e.week_id = pr.week_id and e.participant_id = pr.participant_id
  group by pr.player_id
) pred_pts on pred_pts.player_id = p.id
left join public.granja_secret_assignment_bonus sab on sab.player_id = p.id
left join public.granja_elimination_order_score eos on eos.player_id = p.id
left join public.granja_final_week_score fws on fws.player_id = p.id
order by points desc, display_name asc;

grant select on public.elimination_order_score to anon, authenticated;
grant select on public.granja_elimination_order_score to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
grant select on public.granja_leaderboard to anon, authenticated;
