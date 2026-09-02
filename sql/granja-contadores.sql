-- =========================================================
-- LA GRANJA VIP — contadores de peón y traicionado
-- =========================================================
-- Gemelas de nomination_counts / saved_counts, para las tarjetas de granjero.

-- Veces que cada granjero quedó como peón
create or replace view public.granja_peon_counts as
select participant_id, count(*) as times_peon
from public.granja_peones
group by participant_id;

-- Veces que a cada granjero lo metieron a riesgo por una traición
create or replace view public.granja_betrayed_counts as
select in_participant_id as participant_id, count(*) as times_betrayed
from public.granja_betrayals
group by in_participant_id;

grant select on public.granja_peon_counts to anon, authenticated;
grant select on public.granja_betrayed_counts to anon, authenticated;

-- =========================================================
-- Color de acento propio de La Granja
-- =========================================================
-- Cada jugador puede tener un color para La Casa y otro para La Granja.
alter table public.profiles add column if not exists granja_accent_color text;

-- update_my_granja_picks se amplía con el color. Se borra primero porque
-- agregar parámetros crea una sobrecarga en vez de reemplazar la función.
drop function if exists public.update_my_granja_picks(
  bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean,
  bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean
);

create or replace function public.update_my_granja_picks(
  p_favorite bigint default null,
  p_clear_favorite boolean default false,
  p_hated bigint default null,
  p_clear_hated boolean default false,
  p_surprise bigint default null,
  p_clear_surprise boolean default false,
  p_disappointment bigint default null,
  p_clear_disappointment boolean default false,
  p_fav_s1 bigint default null,
  p_clear_fav_s1 boolean default false,
  p_hated_s1 bigint default null,
  p_clear_hated_s1 boolean default false,
  p_surprise_s1 bigint default null,
  p_clear_surprise_s1 boolean default false,
  p_disappointment_s1 bigint default null,
  p_clear_disappointment_s1 boolean default false,
  p_accent_color text default null
)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  r public.profiles;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión';
  end if;

  update public.profiles set
    granja_favorite_participant_id =
      case when p_clear_favorite then null else coalesce(p_favorite, granja_favorite_participant_id) end,
    granja_hated_participant_id =
      case when p_clear_hated then null else coalesce(p_hated, granja_hated_participant_id) end,
    granja_surprise_participant_id =
      case when p_clear_surprise then null else coalesce(p_surprise, granja_surprise_participant_id) end,
    granja_disappointment_participant_id =
      case when p_clear_disappointment then null else coalesce(p_disappointment, granja_disappointment_participant_id) end,
    granja_fav_season1_id =
      case when p_clear_fav_s1 then null else coalesce(p_fav_s1, granja_fav_season1_id) end,
    granja_hated_season1_id =
      case when p_clear_hated_s1 then null else coalesce(p_hated_s1, granja_hated_season1_id) end,
    granja_surprise_season1_id =
      case when p_clear_surprise_s1 then null else coalesce(p_surprise_s1, granja_surprise_season1_id) end,
    granja_disappointment_season1_id =
      case when p_clear_disappointment_s1 then null else coalesce(p_disappointment_s1, granja_disappointment_season1_id) end,
    granja_accent_color = coalesce(p_accent_color, granja_accent_color)
  where id = auth.uid()
  returning * into r;

  return r;
end $$;

grant execute on function public.update_my_granja_picks(
  bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean,
  bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, text
) to authenticated;
