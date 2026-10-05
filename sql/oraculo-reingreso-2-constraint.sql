-- =========================================================
-- EL ORACULO / REINGRESO — PASO 2 de 4
-- Permite que una persona ocupe mas de un lugar en un orden
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

-- ---------- 2. Una persona puede ocupar más de un lugar ----------
-- El unique (player_id, participant_id) impedía que alguien apareciera dos
-- veces en el mismo orden. Se quita en los dos shows para que las dos tablas
-- sigan siendo iguales.
do $$
declare
  c record;
begin
  for c in
    select t.relname as tabla, con.conname as nombre
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('elimination_order_predictions', 'granja_elimination_order_predictions')
      and con.contype = 'u'
  loop
    execute format('alter table public.%I drop constraint %I', c.tabla, c.nombre);
  end loop;
end $$;
