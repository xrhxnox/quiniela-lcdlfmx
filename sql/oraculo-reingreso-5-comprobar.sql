-- =========================================================
-- EL ORACULO / REINGRESO — COMPROBACION
-- =========================================================
-- Corre esto al final. Las tres filas deben decir OK.
select
  'cupos' as que,
  (select (count(*) + coalesce(sum(reentries), 0))::int
     from public.participants where is_infiltrado = false) as valor,
  case when (select (count(*) + coalesce(sum(reentries), 0))::int
               from public.participants where is_infiltrado = false) = 18
       then 'OK' else 'MAL (deberia ser 18)' end as estado
union all
select
  'posicion mas alta',
  (select max(position) from public.elimination_order_predictions),
  case when (select max(position) from public.elimination_order_predictions) = 18
       then 'OK' else 'MAL (deberia ser 18)' end
union all
select
  'jugadores con Mariana en el lugar 1',
  (select count(*) from public.elimination_order_predictions p
     join public.participants pa on pa.id = p.participant_id
    where p.position = 1 and pa.name = 'Mariana Ochoa'),
  case when (select count(*) from public.elimination_order_predictions p
               join public.participants pa on pa.id = p.participant_id
              where p.position = 1 and pa.name = 'Mariana Ochoa') = 28
       then 'OK' else 'MAL (deberian ser 28)' end;
