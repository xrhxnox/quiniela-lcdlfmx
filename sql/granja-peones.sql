-- =========================================================
-- LA GRANJA VIP — Peones
-- =========================================================
-- Ser peón funciona igual que estar nominado: vive en la semana y no deja
-- ninguna marca en el granjero. La insignia de "peón" que se ve en la reja y
-- en el perfil sale de la semana en votación, igual que la de "Nominado".
create table if not exists public.granja_peones (
  week_id bigint not null references public.granja_weeks(id) on delete cascade,
  participant_id bigint not null references public.granja_participants(id) on delete cascade,
  primary key (week_id, participant_id)
);

alter table public.granja_peones enable row level security;

drop policy if exists "granja_peones_select_all" on public.granja_peones;
create policy "granja_peones_select_all" on public.granja_peones for select using (true);

drop policy if exists "granja_peones_write_admin" on public.granja_peones;
create policy "granja_peones_write_admin" on public.granja_peones for all
  using (public.is_admin()) with check (public.is_admin());

-- La primera versión guardaba el peón como bandera en el granjero. Ya no se
-- usa: sobra y sería una segunda fuente de verdad que se desincroniza.
alter table public.granja_participants drop column if exists is_peon;
