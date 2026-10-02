-- =========================================================
-- ARREGLO: orden de salida de la semana final
-- =========================================================
-- Las dos salidas de la final quedaron guardadas con exit_order = 1. El bug
-- estaba en el admin: la consulta que trae las eliminaciones de la semana no
-- pedía la columna exit_order, así que la pantalla siempre creía que no había
-- ninguna salida registrada y mandaba 1 otra vez. Ya está corregido en
-- js/data.js (ahora el número lo calcula la base, no la pantalla).
--
-- Con las dos en 1, El Oráculo las metía en UN solo bloque (posiciones 5-6
-- indistintas) en vez de 6 = Ernesto y 5 = Yahir, y daba el punto por igual a
-- quien hubiera puesto a cualquiera de los dos en cualquiera de las dos
-- posiciones.
--
-- Correr este archivo completo una sola vez. Es idempotente.

-- ---------- 1. Renumerar las salidas ya registradas ----------
update public.eliminations
set exit_order = 1
where week_id = (select id from public.weeks where is_final limit 1)
  and participant_id = (select id from public.participants where name = 'Ernesto Laguardia');

update public.eliminations
set exit_order = 2
where week_id = (select id from public.weeks where is_final limit 1)
  and participant_id = (select id from public.participants where name = 'Yahir');

-- ---------- 2. Que no vuelva a pasar ----------
-- Dos salidas de la misma semana no pueden compartir lugar. Con esto, si algún
-- día el cliente vuelve a mandar un número repetido, la base lo rechaza en vez
-- de guardarlo y falsear el puntaje en silencio.
create unique index if not exists eliminations_exit_order_unico
  on public.eliminations (week_id, exit_order)
  where exit_order is not null;

create unique index if not exists granja_eliminations_exit_order_unico
  on public.granja_eliminations (week_id, exit_order)
  where exit_order is not null;
