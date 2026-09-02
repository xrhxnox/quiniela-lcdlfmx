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
