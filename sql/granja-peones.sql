-- =========================================================
-- LA GRANJA VIP — Peones
-- =========================================================
-- En La Granja los que pierden quedan como peones y hacen las labores. Es un
-- estado de hoy, no un historial, así que va como bandera en el granjero —
-- igual que is_abandono— y el admin la prende y apaga desde la pestaña de
-- Granjeros. No afecta puntajes ni ninguna dinámica: es informativo.
alter table public.granja_participants add column if not exists is_peon boolean not null default false;
