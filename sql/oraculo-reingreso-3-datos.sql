-- =========================================================
-- EL ORACULO / REINGRESO — PASO 3 de 4
-- Corre los ordenes a 2..18 y pone a Mariana en el lugar 1
-- =========================================================
-- Correr los 4 pasos EN ORDEN, cada uno por separado. Si uno truena, el
-- mensaje de error te dice en cual fue sin arrastrar a los demas.
--
-- EL ORÁCULO: reingresos a la casa
-- Mariana Ochoa salió en la semana 1, volvió a entrar y ganó la temporada. Eso
-- rompe un supuesto que tenía El Oráculo: que cada persona ocupa UN lugar en el
-- orden. Mariana ocupa dos — el de su primera salida y el de ganadora — así que
-- la temporada tiene 18 cupos, no 17.
--
-- Con 17, el lugar 1 lo compartían la ganadora y la última eliminación, y todas
-- las posiciones quedaban corridas una de menos.
--

-- ---------- 3. Correr los órdenes y poner a Mariana de ganadora ----------
-- Al pasar de 17 a 18 cupos, TODAS las posiciones reales se corren una hacia
-- arriba (el primero en salir pasa de 17 a 18). Para que las predicciones sigan
-- significando lo mismo, los órdenes de los jugadores se corren igual: lo que
-- tenían en 1..17 pasa a 2..18. Eso libera el lugar 1, y ahí entra Mariana para
-- todos: nadie podía predecir que la primera eliminada iba a volver y ganar.
do $$
declare
  mariana bigint;
  n_jugadores int;
begin
  select id into mariana from public.participants where name = 'Mariana Ochoa';
  if mariana is null then
    raise exception 'No encontré a Mariana Ochoa en participants';
  end if;

  if exists (
    select 1 from public.elimination_order_predictions
    where position = 1 and participant_id = mariana
  ) then
    raise notice 'Ya estaba aplicado: Mariana ya aparece en el lugar 1. No se mueve nada.';
    return;
  end if;

  -- Se corre en dos pasos pasando por un rango libre: un solo
  -- "position = position + 1" choca contra el primary key (player_id, position)
  -- en cuanto la primera fila intenta ocupar un lugar que todavía existe.
  update public.elimination_order_predictions set position = position + 1000;
  update public.elimination_order_predictions set position = position - 999;

  insert into public.elimination_order_predictions (player_id, position, participant_id)
  select distinct player_id, 1, mariana
  from public.elimination_order_predictions;

  select count(distinct player_id) into n_jugadores from public.elimination_order_predictions;
  raise notice 'Listo: % jugadores corridos a 2..18 y Mariana puesta en el lugar 1.', n_jugadores;
end $$;
