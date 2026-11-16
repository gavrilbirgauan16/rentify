-- Fara schimbari de structura: migrarea adauga doar date de care aplicatia are nevoie.

-- ===== Scris de mana =====

-- 1. Planul gratuit pentru proprietari: 1 proprietate si 1 anunt activ, ca sa poata incerca aplicatia.
INSERT INTO "plan_abonament" ("rol_id", "nume", "descriere", "pret_lunar", "pret_anual", "recomandat")
SELECT r."id", 'Gratuit', 'Încerci Rentify cu o singură locuință și un anunț activ.', 0.00, 0.00, false
FROM "rol" r
WHERE r."nume" = 'proprietar';

INSERT INTO "limita_plan" ("plan_id", "cheie", "valoare")
SELECT pa."id", l."cheie", l."valoare"
FROM (VALUES
  ('max_proprietati',     1),
  ('max_anunturi_active', 1)
) AS l("cheie", "valoare")
JOIN "rol" r ON r."nume" = 'proprietar'
JOIN "plan_abonament" pa ON pa."rol_id" = r."id" AND pa."nume" = 'Gratuit';

-- 2. Completare in urma (backfill): regula noua este "orice cont confirmat are un plan in curs".
--    Conturile confirmate de chirias / proprietar fara niciun abonament neanulat si neterminat
--    primesc planul gratuit al rolului lor, pe un an, exact ca un cont nou.
--    "Azi" se socoteste dupa ora Romaniei, ca in aplicatie (servicii/date.js).
INSERT INTO "abonament" ("utilizator_id", "plan_id", "perioada", "pret", "data_inceput", "data_sfarsit", "reinnoire_automata", "stare")
SELECT u."id", pa."id", 'anual', 0.00, azi."ziua", (azi."ziua" + INTERVAL '1 year' - INTERVAL '1 day')::date, true, 'activ'
FROM "utilizator" u
JOIN "rol" r ON r."id" = u."rol_id" AND r."nume" IN ('chirias', 'proprietar')
JOIN "plan_abonament" pa ON pa."rol_id" = r."id" AND pa."nume" = 'Gratuit' AND pa."activ"
CROSS JOIN (SELECT (now() AT TIME ZONE 'Europe/Bucharest')::date AS "ziua") azi
WHERE u."email_verificat"
  AND NOT EXISTS (
    SELECT 1 FROM "abonament" a
    WHERE a."utilizator_id" = u."id" AND a."stare" = 'activ' AND a."data_sfarsit" >= azi."ziua"
  );
