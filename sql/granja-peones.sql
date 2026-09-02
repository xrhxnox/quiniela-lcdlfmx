-- =========================================================
-- LA GRANJA VIP — Peones
-- =========================================================
-- En La Granja los que pierden quedan como peones y hacen las labores. Es un
-- estado de hoy, no un historial, así que va como bandera en el granjero —
-- igual que is_abandono— y el admin la prende y apaga desde la pestaña de
-- Granjeros. No afecta puntajes ni ninguna dinámica: es informativo.
alter table public.granja_participants add column if not exists is_peon boolean not null default false;

-- ---------- PEONES por semana ----------
-- El historial: quiénes fueron peones en cada semana. La bandera is_peon de
-- arriba sigue siendo el estado de hoy (la que pinta la insignia en Granjeros);
-- esta tabla guarda el registro semana por semana, como nominados o inmunes.
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
