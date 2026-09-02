-- =========================================================
-- LA GRANJA VIP — esquema propio, en paralelo al de La Casa
-- =========================================================
-- Los dos shows conviven en la misma base con tablas separadas: todo lo de
-- La Granja lleva el prefijo granja_ y nada aquí toca las tablas de La Casa,
-- que está en temporada. Lo único compartido son profiles (los jugadores son
-- los mismos), is_admin() y el bucket de fotos.
--
-- La forma de cada tabla es idéntica a su gemela de La Casa a propósito: el
-- front resuelve el prefijo según el show activo y reusa las mismas vistas,
-- así que las columnas tienen que llamarse igual aunque alguna no aplique
-- (is_infiltrado, exiles). Las dinámicas propias de La Granja —duelo,
-- traición, doble nombre del domingo y El Legado— se agregan aparte.
--
-- Equivalencias de vocabulario:
--   capataz  -> granja_immunities.is_leader = true
--   asamblea -> granja_nominations + granja_nomination_votes
--   salvación-> granja_weeks.salvation_* + granja_nominations.saved

-- ---------- HABITANTES (granjeros) ----------
create table if not exists public.granja_participants (
  id bigint generated always as identity primary key,
  name text not null,
  room text,
  photo_url text,
  active boolean not null default true,
  is_winner boolean not null default false,
  is_infiltrado boolean not null default false,
  is_exiliado boolean not null default false,
  is_abandono boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists granja_participants_one_winner
  on public.granja_participants ((is_winner)) where is_winner = true;

-- ---------- SEMANAS ----------
-- week_number es numeric desde el arranque, para poder meter una salida
-- imprevista a media semana como 4.5 sin renumerar nada.
create table if not exists public.granja_weeks (
  id bigint generated always as identity primary key,
  week_number numeric not null unique,
  label text,
  nomination_date date,
  elimination_date date,
  status text not null default 'draft' check (status in ('draft','voting_open','closed')),
  voting_closes_at timestamptz,
  salvation_participant_id bigint references public.granja_participants(id) on delete set null,
  salvation_mode text,
  created_at timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'granja_weeks_salvation_mode_check') then
    alter table public.granja_weeks add constraint granja_weeks_salvation_mode_check
      check (salvation_mode is null or salvation_mode in ('conservo','robo'));
  end if;
end $$;

-- ---------- CAPATAZ / INMUNES ----------
-- is_leader = true es el capataz de la semana (gana la prueba del lunes y no
-- puede ser nominado). false es cualquier otra inmunidad.
create table if not exists public.granja_immunities (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  is_leader boolean not null default true,
  primary key (week_id, participant_id)
);

-- ---------- NOMINADOS (asamblea del miércoles) ----------
create table if not exists public.granja_nominations (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  points int not null default 0,
  saved boolean not null default false,
  primary key (week_id, participant_id)
);

-- ---------- QUIÉN NOMINÓ A QUIÉN ----------
create table if not exists public.granja_nomination_votes (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  nominator_id bigint not null references public.granja_participants(id) on delete cascade,
  nominee_id bigint not null references public.granja_participants(id) on delete cascade,
  primary key (week_id, nominator_id, nominee_id)
);

-- ---------- ELIMINADOS ----------
create table if not exists public.granja_eliminations (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  reverted_by_exile boolean not null default false,
  gift_all boolean not null default false,
  primary key (week_id, participant_id)
);

-- ---------- EXILIO ----------
-- No es una dinámica de La Granja; existe solo para que el front comparta el
-- mismo código con La Casa. Se queda vacía.
create table if not exists public.granja_exiles (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  primary key (week_id, participant_id)
);

-- ---------- PICKS SEMANALES DE LOS JUGADORES ----------
create table if not exists public.granja_predictions (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (week_id, player_id)
);

-- ---------- HABITANTE SECRETO (bono al azar) ----------
create table if not exists public.granja_secret_assignments (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- EL ORÁCULO (orden de salida) ----------
create table if not exists public.granja_elimination_order_predictions (
  player_id uuid not null references public.profiles(id) on delete cascade,
  position int not null,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  primary key (player_id, position),
  unique (player_id, participant_id)
);

create table if not exists public.granja_oraculo_settings (
  id boolean primary key default true,
  locked boolean not null default false,
  constraint granja_oraculo_settings_single_row check (id)
);
insert into public.granja_oraculo_settings (id, locked) values (true, false)
on conflict (id) do nothing;

create table if not exists public.granja_oraculo_auto_filled (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =========================================================
-- RLS: mismas reglas que La Casa
-- lectura pública para todo; escritura solo admin, salvo el pick semanal y
-- El Oráculo, que cada jugador escribe para sí mismo dentro de su ventana.
-- =========================================================
alter table public.granja_participants enable row level security;
alter table public.granja_weeks enable row level security;
alter table public.granja_immunities enable row level security;
alter table public.granja_nominations enable row level security;
alter table public.granja_nomination_votes enable row level security;
alter table public.granja_eliminations enable row level security;
alter table public.granja_exiles enable row level security;
alter table public.granja_predictions enable row level security;
alter table public.granja_secret_assignments enable row level security;
alter table public.granja_elimination_order_predictions enable row level security;
alter table public.granja_oraculo_settings enable row level security;
alter table public.granja_oraculo_auto_filled enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'granja_participants','granja_weeks','granja_immunities','granja_nominations',
    'granja_nomination_votes','granja_eliminations','granja_exiles',
    'granja_secret_assignments','granja_oraculo_settings'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_all', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_select_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_write_admin', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      t || '_write_admin', t
    );
  end loop;
end $$;

-- Picks semanales: se leen todos, pero cada quien solo escribe el suyo y solo
-- mientras la semana sigue en votación (y antes de voting_closes_at si está).
drop policy if exists "granja_predictions_select" on public.granja_predictions;
create policy "granja_predictions_select" on public.granja_predictions for select using (true);

drop policy if exists "granja_predictions_insert_own" on public.granja_predictions;
create policy "granja_predictions_insert_own" on public.granja_predictions for insert with check (
  player_id = auth.uid()
  and exists (
    select 1 from public.granja_weeks w
    where w.id = week_id
      and w.status = 'voting_open'
      and (w.voting_closes_at is null or now() < w.voting_closes_at)
  )
);

drop policy if exists "granja_predictions_update_own" on public.granja_predictions;
create policy "granja_predictions_update_own" on public.granja_predictions for update using (
  player_id = auth.uid()
  and exists (
    select 1 from public.granja_weeks w
    where w.id = week_id
      and w.status = 'voting_open'
      and (w.voting_closes_at is null or now() < w.voting_closes_at)
  )
) with check (
  player_id = auth.uid()
  and exists (
    select 1 from public.granja_weeks w
    where w.id = week_id
      and w.status = 'voting_open'
      and (w.voting_closes_at is null or now() < w.voting_closes_at)
  )
);

-- El Oráculo: la propia siempre; la de los demás solo cuando está bloqueado.
drop policy if exists "granja_eop_select" on public.granja_elimination_order_predictions;
create policy "granja_eop_select" on public.granja_elimination_order_predictions for select using (
  player_id = auth.uid()
  or public.is_admin()
  or coalesce((select locked from public.granja_oraculo_settings limit 1), false)
);

drop policy if exists "granja_eop_write_own" on public.granja_elimination_order_predictions;
create policy "granja_eop_write_own" on public.granja_elimination_order_predictions for all using (
  public.is_admin()
  or (player_id = auth.uid() and not coalesce((select locked from public.granja_oraculo_settings limit 1), false))
) with check (
  public.is_admin()
  or (player_id = auth.uid() and not coalesce((select locked from public.granja_oraculo_settings limit 1), false))
);

drop policy if exists "granja_oraculo_auto_filled_select" on public.granja_oraculo_auto_filled;
create policy "granja_oraculo_auto_filled_select" on public.granja_oraculo_auto_filled for select using (true);
drop policy if exists "granja_oraculo_auto_filled_insert_admin" on public.granja_oraculo_auto_filled;
create policy "granja_oraculo_auto_filled_insert_admin" on public.granja_oraculo_auto_filled for insert with check (public.is_admin());
drop policy if exists "granja_oraculo_auto_filled_delete" on public.granja_oraculo_auto_filled;
create policy "granja_oraculo_auto_filled_delete" on public.granja_oraculo_auto_filled for delete
  using (player_id = auth.uid() or public.is_admin());

-- =========================================================
-- FUNCIÓN: quiénes ya votaron esta semana
-- =========================================================
create or replace function public.granja_get_voted_player_ids(p_week_id bigint)
returns table(player_id uuid)
language sql
security definer set search_path = public
stable
as $$
  select player_id from public.granja_predictions where week_id = p_week_id;
$$;

grant execute on function public.granja_get_voted_player_ids(bigint) to authenticated;

-- =========================================================
-- VISTAS (gemelas de las de La Casa)
-- =========================================================
create or replace view public.granja_secret_assignment_bonus as
select sa.player_id, 3 as points
from public.granja_secret_assignments sa
join public.granja_participants p on p.id = sa.participant_id
where p.is_winner = true;

create or replace view public.granja_nomination_counts as
select participant_id, count(*) as times_nominated
from public.granja_nominations group by participant_id;

create or replace view public.granja_immunity_counts as
select participant_id, count(*) as times_leader
from public.granja_immunities where is_leader = true group by participant_id;

create or replace view public.granja_special_immunity_counts as
select participant_id, count(*) as times_immune
from public.granja_immunities where is_leader = false group by participant_id;

create or replace view public.granja_saved_counts as
select participant_id, count(*) as times_saved
from public.granja_nominations where saved = true group by participant_id;

-- Puntaje del orden de salida. Misma lógica de bloques que La Casa: una semana
-- es un bloque, y la posición 1 es el ganador de la temporada.
create or replace view public.granja_elimination_order_score as
with total_participants as (
  select count(*)::int as n from public.granja_participants where is_infiltrado = false
),
actual_blocks as (
  select e.participant_id, dense_rank() over (order by w.week_number asc) as block_no
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

create or replace view public.granja_leaderboard as
select
  p.id as player_id,
  p.username,
  p.display_name,
  coalesce(pred_pts.pts, 0) + coalesce(sab.points, 0) + coalesce(eos.points, 0) as points
from public.profiles p
left join (
  select pr.player_id, count(*) as pts
  from public.granja_predictions pr
  join public.granja_eliminations e on e.week_id = pr.week_id and e.participant_id = pr.participant_id
  group by pr.player_id
) pred_pts on pred_pts.player_id = p.id
left join public.granja_secret_assignment_bonus sab on sab.player_id = p.id
left join public.granja_elimination_order_score eos on eos.player_id = p.id
order by points desc, display_name asc;

grant select on public.granja_secret_assignment_bonus to anon, authenticated;
grant select on public.granja_elimination_order_score to anon, authenticated;
grant select on public.granja_leaderboard to anon, authenticated;
grant select on public.granja_nomination_counts to anon, authenticated;
grant select on public.granja_immunity_counts to anon, authenticated;
grant select on public.granja_special_immunity_counts to anon, authenticated;
grant select on public.granja_saved_counts to anon, authenticated;

-- =========================================================
-- PICKS DE PERFIL PROPIOS DE LA GRANJA
-- Los jugadores son los mismos, pero su favorito y su funado de La Granja son
-- independientes de los de La Casa.
-- =========================================================
alter table public.profiles add column if not exists granja_favorite_participant_id bigint references public.granja_participants(id) on delete set null;
alter table public.profiles add column if not exists granja_hated_participant_id bigint references public.granja_participants(id) on delete set null;
alter table public.profiles add column if not exists granja_surprise_participant_id bigint references public.granja_participants(id) on delete set null;
alter table public.profiles add column if not exists granja_disappointment_participant_id bigint references public.granja_participants(id) on delete set null;
alter table public.profiles add column if not exists granja_favorite_room text;

-- =========================================================
-- GRANJEROS de arranque
-- =========================================================
insert into public.granja_participants (name)
select v.name
from (values
  ('Carlos Trejo'),
  ('Ivonne Montero'),
  ('Niurka Marcos'),
  ('Kunno'),
  ('Fernando Lozada'),
  ('La Bebeshita'),
  ('Kenny Avilés'),
  ('Kevyn Contreras'),
  ('Rafael Mercadante'),
  ('María Karunna'),
  ('Mónica Escobedo'),
  ('La Coreañera'),
  ('Natalia Alcocer'),
  ('Manelyk González')
) as v(name)
where not exists (
  select 1 from public.granja_participants g where g.name = v.name
);
