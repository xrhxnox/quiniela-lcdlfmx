-- =========================================================
-- LA GRANJA VIP — favoritos históricos (Temporada 1)
-- =========================================================
-- La Granja va en su Temporada 2, así que tiene su propia temporada pasada.
-- Gemela de legacy_favorites, que es solo de La Casa.
create table if not exists public.granja_legacy_favorites (
  id bigint generated always as identity primary key,
  season int not null check (season >= 1 and season <= 10),
  name text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.granja_legacy_favorites enable row level security;

drop policy if exists "granja_legacy_favorites_select_all" on public.granja_legacy_favorites;
create policy "granja_legacy_favorites_select_all" on public.granja_legacy_favorites for select using (true);

drop policy if exists "granja_legacy_favorites_write_admin" on public.granja_legacy_favorites;
create policy "granja_legacy_favorites_write_admin" on public.granja_legacy_favorites for all
  using (public.is_admin()) with check (public.is_admin());

-- Picks de la Temporada 1 de La Granja en el perfil de cada jugador.
alter table public.profiles add column if not exists granja_fav_season1_id bigint references public.granja_legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists granja_hated_season1_id bigint references public.granja_legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists granja_surprise_season1_id bigint references public.granja_legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists granja_disappointment_season1_id bigint references public.granja_legacy_favorites(id) on delete set null;

-- =========================================================
-- update_my_granja_picks: se amplía con los picks de Temporada 1.
-- Se borra primero porque agregar parámetros no reemplaza la función, crea
-- una sobrecarga — y dos versiones dejarían la llamada ambigua.
-- =========================================================
drop function if exists public.update_my_granja_picks(bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean);

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
  p_clear_disappointment_s1 boolean default false
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
      case when p_clear_disappointment_s1 then null else coalesce(p_disappointment_s1, granja_disappointment_season1_id) end
  where id = auth.uid()
  returning * into r;

  return r;
end $$;

grant execute on function public.update_my_granja_picks(
  bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean,
  bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean
) to authenticated;
