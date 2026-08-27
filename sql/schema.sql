-- =========================================================
-- La Casa de los Famosos México T4 - Quiniela
-- Esquema de base de datos para Supabase (Postgres)
-- =========================================================
-- Cómo usar: en tu proyecto de Supabase, abre "SQL Editor",
-- pega TODO este archivo y dale "Run". Se puede correr una
-- sola vez sobre un proyecto nuevo.
-- =========================================================

-- ---------- PERFILES (uno por usuario/jugador) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null default 'player' check (role in ('admin','player')),
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil cuando el admin da de alta un usuario
-- en Authentication > Users (usando correo tipo usuario@lcdlfmx.app)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- PARTICIPANTES (habitantes de la casa) ----------
create table if not exists public.participants (
  id bigint generated always as identity primary key,
  name text not null,
  room text,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- columnas de perfil que dependen de que participants ya exista
alter table public.profiles add column if not exists favorite_participant_id bigint references public.participants(id) on delete set null;
alter table public.profiles add column if not exists accent_color text;
alter table public.profiles add column if not exists hated_participant_id bigint references public.participants(id) on delete set null;
alter table public.profiles add column if not exists favorite_room text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists surprise_participant_id bigint references public.participants(id) on delete set null;
alter table public.profiles add column if not exists disappointment_participant_id bigint references public.participants(id) on delete set null;
alter table public.profiles add column if not exists theme_mode text check (theme_mode in ('dark','light'));

-- ---------- FAVORITOS DE TEMPORADAS ANTERIORES (no son habitantes actuales) ----------
create table if not exists public.legacy_favorites (
  id bigint generated always as identity primary key,
  season int not null check (season in (1, 2, 3)),
  name text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists fav_season1_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists fav_season2_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists fav_season3_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists hated_season1_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists hated_season2_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists hated_season3_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists surprise_season1_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists surprise_season2_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists surprise_season3_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists disappointment_season1_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists disappointment_season2_id bigint references public.legacy_favorites(id) on delete set null;
alter table public.profiles add column if not exists disappointment_season3_id bigint references public.legacy_favorites(id) on delete set null;

alter table public.legacy_favorites enable row level security;

drop policy if exists "legacy_favorites_select_all" on public.legacy_favorites;
create policy "legacy_favorites_select_all" on public.legacy_favorites for select using (true);
drop policy if exists "legacy_favorites_write_admin" on public.legacy_favorites;
create policy "legacy_favorites_write_admin" on public.legacy_favorites for all
  using (public.is_admin()) with check (public.is_admin());

-- Cuartos de temporadas anteriores (opciones fijas por temporada)
alter table public.profiles add column if not exists legacy_room_t1 text check (legacy_room_t1 in ('Cielo','Infierno'));
alter table public.profiles add column if not exists legacy_room_t2 text check (legacy_room_t2 in ('Mar','Tierra'));
alter table public.profiles add column if not exists legacy_room_t3 text check (legacy_room_t3 in ('Día','Noche','Eclipse'));

-- Si ya habías creado la columna con el check viejo (sin Eclipse), esto lo actualiza.
do $$
begin
  alter table public.profiles drop constraint if exists profiles_legacy_room_t3_check;
  alter table public.profiles add constraint profiles_legacy_room_t3_check check (legacy_room_t3 in ('Día','Noche','Eclipse'));
end $$;

-- Agrega los teams nuevos (Solo Wendy Guevara en T1, Gomita Super Buena Onda en T2)
do $$
begin
  alter table public.profiles drop constraint if exists profiles_legacy_room_t1_check;
  alter table public.profiles add constraint profiles_legacy_room_t1_check check (legacy_room_t1 in ('Cielo','Infierno','Solo Wendy Guevara'));
  alter table public.profiles drop constraint if exists profiles_legacy_room_t2_check;
  alter table public.profiles add constraint profiles_legacy_room_t2_check check (legacy_room_t2 in ('Mar','Tierra','Gomita Super Buena Onda'));
end $$;

-- Permite que cada quien actualice SOLO su propio nombre, favorito, odiado,
-- cuarto favorito, foto, bio, color, favoritos y cuartos de temporadas
-- anteriores (nunca su rol), sin necesitar una política de UPDATE abierta
-- en profiles.
drop function if exists public.update_my_profile(text, bigint, boolean, text);
drop function if exists public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text);
drop function if exists public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text, text, text);
drop function if exists public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean);
drop function if exists public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, text, text, text);
drop function if exists public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean);
drop function if exists public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean);
drop function if exists public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, boolean, boolean, boolean, boolean, boolean);
create or replace function public.update_my_profile(
  new_display_name text default null,
  new_favorite_participant_id bigint default null,
  clear_favorite boolean default false,
  new_accent_color text default null,
  new_hated_participant_id bigint default null,
  clear_hated boolean default false,
  new_favorite_room text default null,
  new_avatar_url text default null,
  new_bio text default null,
  new_fav_season1_id bigint default null,
  clear_fav_season1 boolean default false,
  new_fav_season2_id bigint default null,
  clear_fav_season2 boolean default false,
  new_fav_season3_id bigint default null,
  clear_fav_season3 boolean default false,
  new_legacy_room_t1 text default null,
  new_legacy_room_t2 text default null,
  new_legacy_room_t3 text default null,
  new_hated_season1_id bigint default null,
  clear_hated_season1 boolean default false,
  new_hated_season2_id bigint default null,
  clear_hated_season2 boolean default false,
  new_hated_season3_id bigint default null,
  clear_hated_season3 boolean default false,
  new_surprise_participant_id bigint default null,
  clear_surprise boolean default false,
  new_disappointment_participant_id bigint default null,
  clear_disappointment boolean default false,
  new_surprise_season1_id bigint default null,
  clear_surprise_season1 boolean default false,
  new_surprise_season2_id bigint default null,
  clear_surprise_season2 boolean default false,
  new_surprise_season3_id bigint default null,
  clear_surprise_season3 boolean default false,
  new_disappointment_season1_id bigint default null,
  clear_disappointment_season1 boolean default false,
  new_disappointment_season2_id bigint default null,
  clear_disappointment_season2 boolean default false,
  new_disappointment_season3_id bigint default null,
  clear_disappointment_season3 boolean default false,
  clear_favorite_room boolean default false,
  clear_legacy_room_t1 boolean default false,
  clear_legacy_room_t2 boolean default false,
  clear_legacy_room_t3 boolean default false,
  clear_avatar boolean default false,
  new_theme_mode text default null
)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  result public.profiles;
begin
  update public.profiles
  set
    display_name = coalesce(new_display_name, display_name),
    favorite_participant_id = case when clear_favorite then null else coalesce(new_favorite_participant_id, favorite_participant_id) end,
    accent_color = coalesce(new_accent_color, accent_color),
    hated_participant_id = case when clear_hated then null else coalesce(new_hated_participant_id, hated_participant_id) end,
    favorite_room = case when clear_favorite_room then null else coalesce(new_favorite_room, favorite_room) end,
    avatar_url = case when clear_avatar then null else coalesce(new_avatar_url, avatar_url) end,
    bio = coalesce(new_bio, bio),
    fav_season1_id = case when clear_fav_season1 then null else coalesce(new_fav_season1_id, fav_season1_id) end,
    fav_season2_id = case when clear_fav_season2 then null else coalesce(new_fav_season2_id, fav_season2_id) end,
    fav_season3_id = case when clear_fav_season3 then null else coalesce(new_fav_season3_id, fav_season3_id) end,
    legacy_room_t1 = case when clear_legacy_room_t1 then null else coalesce(new_legacy_room_t1, legacy_room_t1) end,
    legacy_room_t2 = case when clear_legacy_room_t2 then null else coalesce(new_legacy_room_t2, legacy_room_t2) end,
    legacy_room_t3 = case when clear_legacy_room_t3 then null else coalesce(new_legacy_room_t3, legacy_room_t3) end,
    hated_season1_id = case when clear_hated_season1 then null else coalesce(new_hated_season1_id, hated_season1_id) end,
    hated_season2_id = case when clear_hated_season2 then null else coalesce(new_hated_season2_id, hated_season2_id) end,
    hated_season3_id = case when clear_hated_season3 then null else coalesce(new_hated_season3_id, hated_season3_id) end,
    surprise_participant_id = case when clear_surprise then null else coalesce(new_surprise_participant_id, surprise_participant_id) end,
    disappointment_participant_id = case when clear_disappointment then null else coalesce(new_disappointment_participant_id, disappointment_participant_id) end,
    surprise_season1_id = case when clear_surprise_season1 then null else coalesce(new_surprise_season1_id, surprise_season1_id) end,
    surprise_season2_id = case when clear_surprise_season2 then null else coalesce(new_surprise_season2_id, surprise_season2_id) end,
    surprise_season3_id = case when clear_surprise_season3 then null else coalesce(new_surprise_season3_id, surprise_season3_id) end,
    disappointment_season1_id = case when clear_disappointment_season1 then null else coalesce(new_disappointment_season1_id, disappointment_season1_id) end,
    disappointment_season2_id = case when clear_disappointment_season2 then null else coalesce(new_disappointment_season2_id, disappointment_season2_id) end,
    disappointment_season3_id = case when clear_disappointment_season3 then null else coalesce(new_disappointment_season3_id, disappointment_season3_id) end,
    theme_mode = coalesce(new_theme_mode, theme_mode)
  where id = auth.uid()
  returning * into result;
  return result;
end;
$$;

grant execute on function public.update_my_profile(text, bigint, boolean, text, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, text, text, text, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

-- ---------- SEMANAS ----------
create table if not exists public.weeks (
  id bigint generated always as identity primary key,
  week_number numeric not null unique,
  label text,
  nomination_date date,
  elimination_date date,
  status text not null default 'draft' check (status in ('draft','voting_open','closed')),
  created_at timestamptz not null default now()
);

-- Corte automático de votación: si se define, nadie puede insertar/editar
-- su predicción después de esta hora, sin importar cuándo el admin cierre
-- la semana manualmente (evita que alguien vea el resultado en vivo y
-- cambie su pick antes de que se confirme la eliminación).
alter table public.weeks add column if not exists voting_closes_at timestamptz;

-- La Salvación de la semana. El líder la tiene y salva a un nominado, pero otro
-- habitante puede robársela para salvarse él o salvar a alguien más. Aquí se
-- guarda solo quién terminó con ella (salvation_participant_id) y cómo la
-- obtuvo (salvation_mode: 'conservo' = nadie se la robó al líder, 'robo' = sí).
-- A quién salvó NO se duplica acá: eso sigue siendo el flag "saved" de
-- nominations, que es el que alimenta el contador "Salvado N veces".
alter table public.weeks add column if not exists salvation_participant_id bigint references public.participants(id) on delete set null;
alter table public.weeks add column if not exists salvation_mode text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weeks_salvation_mode_check'
  ) then
    alter table public.weeks add constraint weeks_salvation_mode_check
      check (salvation_mode is null or salvation_mode in ('conservo','robo'));
  end if;
end $$;

-- week_number es numeric (no int) para permitir semanas intermedias: una salida
-- imprevista a media semana entra como 4.5 y queda en su lugar cronológico sin
-- tener que renumerar las demás. En bases creadas cuando todavía era int hay que
-- soltar las vistas que dependen de la columna para poder cambiar el tipo; se
-- recrean más abajo con "create or replace view".
do $$
begin
  if (
    select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'weeks' and column_name = 'week_number'
  ) = 'integer' then
    drop view if exists public.leaderboard;
    drop view if exists public.elimination_order_score;
    alter table public.weeks alter column week_number type numeric;
  end if;
end $$;

-- ---------- INMUNES de la semana ----------
-- is_leader distingue al líder de la semana (inmunidad "de oficio") de un
-- habitante marcado inmune por otro motivo (reto especial, etc.). Las filas
-- existentes se quedan como líder (true) para no alterar el historial.
create table if not exists public.immunities (
  week_id bigint not null references public.weeks(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  primary key (week_id, participant_id)
);
alter table public.immunities add column if not exists is_leader boolean not null default true;

-- ---------- NOMINADOS de la semana (con puntos de nominación) ----------
create table if not exists public.nominations (
  week_id bigint not null references public.weeks(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  points int not null default 0,
  primary key (week_id, participant_id)
);
alter table public.nominations add column if not exists saved boolean not null default false;

-- ---------- QUIÉN NOMINÓ A QUIÉN (detalle por habitante, no solo el total) ----------
create table if not exists public.nomination_votes (
  week_id bigint not null references public.weeks(id) on delete cascade,
  nominator_id bigint not null references public.participants(id) on delete cascade,
  nominee_id bigint not null references public.participants(id) on delete cascade,
  primary key (week_id, nominator_id, nominee_id)
);

-- ---------- ELIMINADOS confirmados de la semana ----------
create table if not exists public.eliminations (
  week_id bigint not null references public.weeks(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  primary key (week_id, participant_id)
);

-- Exilio: un eliminado puede volver a la casa. Estas dos marcas solo afectan a
-- El Oráculo; el pick semanal sigue contando la eliminación normalmente, porque
-- esa noche la persona sí salió.
--   reverted_by_exile: la salida no fue definitiva (regresó), así que no ocupa
--     lugar en el orden final y su posición se libera.
--   gift_all: la salida definitiva de alguien que ya había vuelto. Como nadie
--     pudo preverla, no se compara contra la predicción: le suma +1 a todos.
alter table public.eliminations add column if not exists reverted_by_exile boolean not null default false;
alter table public.eliminations add column if not exists gift_all boolean not null default false;

-- ---------- PREDICCIONES (los picks de cada jugador) ----------
create table if not exists public.predictions (
  week_id bigint not null references public.weeks(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (week_id, player_id)
);

-- =========================================================
-- FUNCIÓN AUXILIAR: ¿el usuario actual es admin?
-- =========================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =========================================================
-- RLS (Row Level Security)
-- =========================================================
alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.weeks enable row level security;
alter table public.immunities enable row level security;
alter table public.nominations enable row level security;
alter table public.nomination_votes enable row level security;
alter table public.eliminations enable row level security;
alter table public.predictions enable row level security;

-- profiles: todos pueden leer (para mostrar nombres en el ranking)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);

-- profiles: el admin puede editar nombre para mostrar / rol de cualquiera
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- participants: lectura pública, escritura solo admin
drop policy if exists "participants_select_all" on public.participants;
create policy "participants_select_all" on public.participants for select using (true);
drop policy if exists "participants_write_admin" on public.participants;
create policy "participants_write_admin" on public.participants for all
  using (public.is_admin()) with check (public.is_admin());

-- weeks: lectura pública, escritura solo admin
drop policy if exists "weeks_select_all" on public.weeks;
create policy "weeks_select_all" on public.weeks for select using (true);
drop policy if exists "weeks_write_admin" on public.weeks;
create policy "weeks_write_admin" on public.weeks for all
  using (public.is_admin()) with check (public.is_admin());

-- immunities: lectura pública, escritura solo admin
drop policy if exists "immunities_select_all" on public.immunities;
create policy "immunities_select_all" on public.immunities for select using (true);
drop policy if exists "immunities_write_admin" on public.immunities;
create policy "immunities_write_admin" on public.immunities for all
  using (public.is_admin()) with check (public.is_admin());

-- nominations: lectura pública, escritura solo admin
drop policy if exists "nominations_select_all" on public.nominations;
create policy "nominations_select_all" on public.nominations for select using (true);
drop policy if exists "nominations_write_admin" on public.nominations;
create policy "nominations_write_admin" on public.nominations for all
  using (public.is_admin()) with check (public.is_admin());

-- nomination_votes: lectura pública, escritura solo admin
drop policy if exists "nomination_votes_select_all" on public.nomination_votes;
create policy "nomination_votes_select_all" on public.nomination_votes for select using (true);
drop policy if exists "nomination_votes_write_admin" on public.nomination_votes;
create policy "nomination_votes_write_admin" on public.nomination_votes for all
  using (public.is_admin()) with check (public.is_admin());

-- eliminations: lectura pública, escritura solo admin
drop policy if exists "eliminations_select_all" on public.eliminations;
create policy "eliminations_select_all" on public.eliminations for select using (true);
drop policy if exists "eliminations_write_admin" on public.eliminations;
create policy "eliminations_write_admin" on public.eliminations for all
  using (public.is_admin()) with check (public.is_admin());

-- predictions:
--   - cada quien ve su propio pick siempre
--   - todos ven los picks de una semana ya CERRADA (para transparencia del ranking)
--   - el admin ve todo
drop policy if exists "predictions_select" on public.predictions;
create policy "predictions_select" on public.predictions for select using (
  player_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.weeks w where w.id = week_id and w.status = 'closed')
);

-- Expone SOLO quién ya votó en una semana (sin revelar por quién), para
-- poder mostrar un indicador de "ya votó" incluso mientras la votación
-- sigue abierta, sin filtrar el pick de nadie.
create or replace function public.get_voted_player_ids(p_week_id bigint)
returns table(player_id uuid)
language sql
security definer set search_path = public
stable
as $$
  select player_id from public.predictions where week_id = p_week_id;
$$;

grant execute on function public.get_voted_player_ids(bigint) to authenticated;

-- insertar/editar tu propio pick, solo mientras la semana está en votación
-- Y (si el admin definió voting_closes_at) solo antes de esa hora exacta,
-- así el corte es automático y no depende de que el admin cierre a tiempo.
drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_own" on public.predictions for insert with check (
  player_id = auth.uid()
  and exists (
    select 1 from public.weeks w
    where w.id = week_id
      and w.status = 'voting_open'
      and (w.voting_closes_at is null or now() < w.voting_closes_at)
  )
);

drop policy if exists "predictions_update_own" on public.predictions;
create policy "predictions_update_own" on public.predictions for update using (
  player_id = auth.uid()
  and exists (
    select 1 from public.weeks w
    where w.id = week_id
      and w.status = 'voting_open'
      and (w.voting_closes_at is null or now() < w.voting_closes_at)
  )
) with check (
  player_id = auth.uid()
  and exists (
    select 1 from public.weeks w
    where w.id = week_id
      and w.status = 'voting_open'
      and (w.voting_closes_at is null or now() < w.voting_closes_at)
  )
);

-- =========================================================
-- DINÁMICA 1: Habitante al azar ("amigo secreto")
-- Cada jugador tiene un habitante asignado; si ese habitante
-- gana la temporada, el jugador se lleva +3 puntos. Es pública
-- (se muestra en el perfil de cada jugador).
-- =========================================================
alter table public.participants add column if not exists is_winner boolean not null default false;

drop index if exists participants_one_winner;
create unique index if not exists participants_one_winner on public.participants ((is_winner)) where is_winner = true;

-- Habitante "infiltrado": puede ser nominado y eliminado normalmente, pero no
-- puede ganar la temporada, así que se excluye del Sorteo (Dinámica 1).
alter table public.participants add column if not exists is_infiltrado boolean not null default false;

-- Habitante en "Exilio": es un estado aparte del de eliminado, así que se
-- muestra junto con el estado normal (un eliminado puede estar exiliado).
-- No afecta puntajes ni ninguna dinámica, es solo informativo.
alter table public.participants add column if not exists is_exiliado boolean not null default false;

create table if not exists public.secret_assignments (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.secret_assignments enable row level security;

drop policy if exists "secret_assignments_select" on public.secret_assignments;
create policy "secret_assignments_select" on public.secret_assignments for select using (true);
drop policy if exists "secret_assignments_write_admin" on public.secret_assignments;
create policy "secret_assignments_write_admin" on public.secret_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- =========================================================
-- DINÁMICA 2: Orden de salida
-- Cada jugador predice, antes de la primera eliminación
-- confirmada, el orden completo en el que cree que irán
-- saliendo los habitantes. +1 punto por cada posición que
-- caiga dentro del "bloque" (semana) correcto.
-- =========================================================
create table if not exists public.elimination_order_predictions (
  player_id uuid not null references public.profiles(id) on delete cascade,
  position int not null,
  participant_id bigint not null references public.participants(id) on delete cascade,
  primary key (player_id, position),
  unique (player_id, participant_id)
);
alter table public.elimination_order_predictions enable row level security;

-- Bloqueo de El Oráculo controlado por el admin (independiente del estado de la
-- Semana 1, para poder reabrirlo si hace falta, p.ej. cuando se revela info nueva
-- del programa y se decide reiniciar las predicciones de todos). Fila única.
create table if not exists public.oraculo_settings (
  id boolean primary key default true,
  locked boolean not null default false,
  constraint oraculo_settings_single_row check (id)
);
insert into public.oraculo_settings (id, locked)
values (true, exists (select 1 from public.weeks w where w.week_number = 1 and w.status <> 'draft'))
on conflict (id) do nothing;
alter table public.oraculo_settings enable row level security;

drop policy if exists "oraculo_settings_select" on public.oraculo_settings;
create policy "oraculo_settings_select" on public.oraculo_settings for select using (true);

drop policy if exists "oraculo_settings_write_admin" on public.oraculo_settings;
create policy "oraculo_settings_write_admin" on public.oraculo_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- Marca a los jugadores a quienes se les puso el orden estándar (alfabético)
-- porque no guardaron su propia predicción antes de que se cerrara El Oráculo.
-- Se borra sola si el jugador guarda su propio orden más adelante.
create table if not exists public.oraculo_auto_filled (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.oraculo_auto_filled enable row level security;

drop policy if exists "oraculo_auto_filled_select" on public.oraculo_auto_filled;
create policy "oraculo_auto_filled_select" on public.oraculo_auto_filled for select using (true);

drop policy if exists "oraculo_auto_filled_insert_admin" on public.oraculo_auto_filled;
create policy "oraculo_auto_filled_insert_admin" on public.oraculo_auto_filled for insert with check (public.is_admin());

drop policy if exists "oraculo_auto_filled_delete" on public.oraculo_auto_filled;
create policy "oraculo_auto_filled_delete" on public.oraculo_auto_filled for delete
  using (player_id = auth.uid() or public.is_admin());

-- se ve la propia siempre; la de los demás solo si El Oráculo está bloqueado
drop policy if exists "eop_select" on public.elimination_order_predictions;
create policy "eop_select" on public.elimination_order_predictions for select using (
  player_id = auth.uid()
  or public.is_admin()
  or coalesce((select locked from public.oraculo_settings limit 1), false)
);

-- solo puedes escribir/borrar tu propia predicción, y solo mientras El Oráculo NO esté
-- bloqueado; el admin puede escribir/borrar cualquier fila en cualquier momento (para
-- poder reiniciar las predicciones de todos)
drop policy if exists "eop_write_own" on public.elimination_order_predictions;
create policy "eop_write_own" on public.elimination_order_predictions for all using (
  public.is_admin()
  or (player_id = auth.uid() and not coalesce((select locked from public.oraculo_settings limit 1), false))
) with check (
  public.is_admin()
  or (player_id = auth.uid() and not coalesce((select locked from public.oraculo_settings limit 1), false))
);

-- =========================================================
-- VISTAS de apoyo
-- =========================================================

-- Bono de +3 pts para quien tenga asignado (al azar) al ganador de la temporada
create or replace view public.secret_assignment_bonus as
select sa.player_id, 3 as points
from public.secret_assignments sa
join public.participants p on p.id = sa.participant_id
where p.is_winner = true;

-- Puntaje de la predicción de "orden de salida". Posición 1 = predicho ganador
-- (acierta si coincide con participants.is_winner). Posiciones 2+ = orden de
-- salida en reversa (posición = total de habitantes + 1 - lugar cronológico
-- real de salida, así que el primero en salir SIEMPRE cae en la última
-- posición, sin importar cuántas eliminaciones falten para el resto de la
-- temporada), por bloques: una semana = un bloque, basta con haber puesto a
-- cualquiera de los eliminados de esa semana en alguna de las posiciones de
-- ese bloque, sin importar el orden exacto entre ellos. Los habitantes marcados
-- como "infiltrado" (is_infiltrado) no pueden ganar la temporada, así que su
-- eliminación no genera bloque de puntaje: nadie gana ni pierde puntos por
-- predecir su lugar de salida (esa posición queda pendiente para siempre).
create or replace view public.elimination_order_score as
with total_participants as (
  select count(*)::int as n from public.participants where is_infiltrado = false
),
actual_blocks as (
  select e.participant_id, dense_rank() over (order by w.week_number asc) as block_no
  from public.eliminations e
  join public.weeks w on w.id = e.week_id
  join public.participants p on p.id = e.participant_id
  where p.is_infiltrado = false
    and e.reverted_by_exile = false
    and e.gift_all = false
),
-- Salidas marcadas como "regalo": +1 para todos, sin comparar contra su orden.
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
-- points se mantiene como bigint para no romper la vista existente ni leaderboard
select
  pwp.player_id,
  (coalesce(hc.c, 0) + (select n from gift_count))::bigint as points
from players_with_predictions pwp
left join hit_counts hc on hc.player_id = pwp.player_id;

-- Puntaje total por jugador (aciertos de eliminación semanal + bono habitante al azar + orden de salida)
create or replace view public.leaderboard as
select
  p.id as player_id,
  p.username,
  p.display_name,
  coalesce(pred_pts.pts, 0) + coalesce(sab.points, 0) + coalesce(eos.points, 0) as points
from public.profiles p
left join (
  select pr.player_id, count(*) as pts
  from public.predictions pr
  join public.eliminations e on e.week_id = pr.week_id and e.participant_id = pr.participant_id
  group by pr.player_id
) pred_pts on pred_pts.player_id = p.id
left join public.secret_assignment_bonus sab on sab.player_id = p.id
left join public.elimination_order_score eos on eos.player_id = p.id
order by points desc, display_name asc;

-- Veces que cada participante ha sido nominado
create or replace view public.nomination_counts as
select participant_id, count(*) as times_nominated
from public.nominations
group by participant_id;

-- Veces que cada participante ha sido líder de la semana
create or replace view public.immunity_counts as
select participant_id, count(*) as times_leader
from public.immunities
where is_leader = true
group by participant_id;

-- Veces que cada participante ha sido inmune por otro motivo (no líder)
create or replace view public.special_immunity_counts as
select participant_id, count(*) as times_immune
from public.immunities
where is_leader = false
group by participant_id;

-- Veces que cada participante ha ganado la salvación
create or replace view public.saved_counts as
select participant_id, count(*) as times_saved
from public.nominations
where saved = true
group by participant_id;

-- =========================================================
-- STORAGE: bucket público para fotos de participantes
-- =========================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read" on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "photos_admin_write" on storage.objects;
create policy "photos_admin_write" on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_admin());

drop policy if exists "photos_admin_update" on storage.objects;
create policy "photos_admin_update" on storage.objects for update
  using (bucket_id = 'photos' and public.is_admin());

drop policy if exists "photos_admin_delete" on storage.objects;
create policy "photos_admin_delete" on storage.objects for delete
  using (bucket_id = 'photos' and public.is_admin());

-- =========================================================
-- STORAGE: bucket público para fotos de perfil (cada quien sube la suya)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

-- Solo puedes subir/editar/borrar dentro de tu propia carpeta: avatars/<tu-uid>/...
drop policy if exists "avatars_own_write" on storage.objects;
create policy "avatars_own_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_own_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- Después de correr este script:
-- 1. Ve a Authentication > Users > Add user, crea tu propio
--    usuario admin con email  tuusuario@lcdlfmx.app  y una contraseña.
-- 2. En SQL Editor corre (cambia 'tuusuario'):
--    update public.profiles set role = 'admin' where username = 'tuusuario';
-- 3. Repite "Add user" para cada participante de la quiniela.
-- =========================================================
