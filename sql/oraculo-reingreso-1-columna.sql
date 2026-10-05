-- =========================================================
-- EL ORACULO / REINGRESO — PASO 1 de 4
-- Agrega la columna reentries y marca el reingreso de Mariana
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

-- ---------- 1. Cuántos cupos extra da cada persona ----------
alter table public.participants add column if not exists reentries int not null default 0;
alter table public.granja_participants add column if not exists reentries int not null default 0;

update public.participants set reentries = 1 where name = 'Mariana Ochoa';
