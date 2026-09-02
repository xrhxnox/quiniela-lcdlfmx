-- =========================================================
-- LA GRANJA VIP — duelo, traición y El Legado
-- =========================================================
-- Las tres dinámicas propias de La Granja que no existen en La Casa. Ninguna
-- cambia el puntaje: la quiniela sigue siendo el pick semanal y El Oráculo.
-- Lo que hacen es explicar CÓMO llegó cada quien a estar nominado.

-- ---------- DUELO (martes) ----------
-- Dos granjeros se enfrentan y el que pierde queda nominado directamente.
-- Un duelo por semana.
create table if not exists public.granja_duels (
  week_id bigint primary key references public.granja_weeks(id) on delete cascade,
  participant_a_id bigint not null references public.granja_participants(id) on delete cascade,
  participant_b_id bigint not null references public.granja_participants(id) on delete cascade,
  loser_id bigint references public.granja_participants(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint granja_duels_distintos check (participant_a_id <> participant_b_id),
  constraint granja_duels_loser_valido check (
    loser_id is null or loser_id in (participant_a_id, participant_b_id)
  )
);

-- ---------- TRAICIÓN (viernes) ----------
-- Quien se quedó con el poder de salvación intercambia a un nominado por uno
-- que no lo está: el de out_participant_id sale de riesgo y el de
-- in_participant_id entra. El traidor es normalmente el mismo que aparece en
-- granja_weeks.salvation_participant_id, pero se guarda aparte por si acaso.
create table if not exists public.granja_betrayals (
  week_id bigint primary key references public.granja_weeks(id) on delete cascade,
  traitor_id bigint references public.granja_participants(id) on delete set null,
  out_participant_id bigint not null references public.granja_participants(id) on delete cascade,
  in_participant_id bigint not null references public.granja_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint granja_betrayals_distintos check (out_participant_id <> in_participant_id)
);

-- ---------- EL LEGADO ----------
-- Tras su expulsión, el eliminado deja un voto que manda a alguien directo a
-- nominación. week_id es la semana en que SALIÓ; el efecto cae en la siguiente,
-- por eso no se aplica solo a ninguna lista de nominados.
create table if not exists public.granja_legacies (
  week_id bigint primary key references public.granja_weeks(id) on delete cascade,
  from_participant_id bigint not null references public.granja_participants(id) on delete cascade,
  to_participant_id bigint not null references public.granja_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint granja_legacies_distintos check (from_participant_id <> to_participant_id)
);

-- ---------- RLS: lectura pública, escritura solo admin ----------
alter table public.granja_duels enable row level security;
alter table public.granja_betrayals enable row level security;
alter table public.granja_legacies enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['granja_duels','granja_betrayals','granja_legacies']
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

-- =========================================================
-- PICKS DE PERFIL DE LA GRANJA
-- =========================================================
-- update_my_profile ya tiene 46 parámetros y es solo de La Casa, así que los
-- picks de La Granja van en su propia función en vez de seguir alargándola.
-- Cada bandera p_clear_* permite dejar un pick en "Sin elegir".
create or replace function public.update_my_granja_picks(
  p_favorite bigint default null,
  p_clear_favorite boolean default false,
  p_hated bigint default null,
  p_clear_hated boolean default false,
  p_surprise bigint default null,
  p_clear_surprise boolean default false,
  p_disappointment bigint default null,
  p_clear_disappointment boolean default false
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
      case when p_clear_favorite then null
           else coalesce(p_favorite, granja_favorite_participant_id) end,
    granja_hated_participant_id =
      case when p_clear_hated then null
           else coalesce(p_hated, granja_hated_participant_id) end,
    granja_surprise_participant_id =
      case when p_clear_surprise then null
           else coalesce(p_surprise, granja_surprise_participant_id) end,
    granja_disappointment_participant_id =
      case when p_clear_disappointment then null
           else coalesce(p_disappointment, granja_disappointment_participant_id) end
  where id = auth.uid()
  returning * into r;

  return r;
end $$;

grant execute on function public.update_my_granja_picks(bigint, boolean, bigint, boolean, bigint, boolean, bigint, boolean) to authenticated;
