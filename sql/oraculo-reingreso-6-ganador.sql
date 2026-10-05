-- =========================================================
-- EL ORACULO / REINGRESO — PASO 6
-- Marca qué filas puso el admin y no el jugador
-- =========================================================
-- "Mi Ganador" en el perfil leía la posición 1. Desde el paso 3 esa posición es
-- Mariana para todos, así que a todo mundo le aparecía ella como su ganador
-- aunque hubiera elegido a otra persona.
--
-- El problema de fondo es que la tabla no distinguía entre "esto lo eligió el
-- jugador" y "esto lo insertó el admin". Con la columna forced sí: el perfil
-- muestra el primer lugar que SÍ es del jugador, que es el que tenían en 1
-- antes del corrimiento y ahora está en 2.
--
-- Se puede correr varias veces sin problema.

alter table public.elimination_order_predictions
  add column if not exists forced boolean not null default false;
alter table public.granja_elimination_order_predictions
  add column if not exists forced boolean not null default false;

-- El único cupo insertado por el admin hasta hoy: Mariana en el lugar 1.
update public.elimination_order_predictions p
set forced = true
where p.position = 1
  and p.participant_id = (select id from public.participants where name = 'Mariana Ochoa');

-- Comprobación: debe decir 28.
select count(*) as filas_marcadas_como_del_admin
from public.elimination_order_predictions
where forced;
