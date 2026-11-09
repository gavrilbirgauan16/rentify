/*
  Warnings:

  - A unique constraint covering the columns `[rol_id,nume]` on the table `plan_abonament` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "plan_abonament" ADD COLUMN     "recomandat" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "plan_abonament_rol_id_nume_key" ON "plan_abonament"("rol_id", "nume");

-- ===== Scris de mana =====

-- Preturile nu pot fi negative.
ALTER TABLE "plan_abonament" ADD CONSTRAINT "plan_abonament_preturi_check"
  CHECK ("pret_lunar" >= 0 AND "pret_anual" >= 0);

-- Planurile de pornire (date de care aplicatia are nevoie ca sa functioneze, deci stau in migrare).
-- Rolul se cauta dupa nume, nu dupa un id scris fix.
INSERT INTO "plan_abonament" ("rol_id", "nume", "descriere", "pret_lunar", "pret_anual", "recomandat")
SELECT r."id", p."nume", p."descriere", p."pret_lunar", p."pret_anual", p."recomandat"
FROM (VALUES
  (1, 'proprietar', 'Basic',    'Pentru cine închiriază o singură locuință.',                    250.00, 2500.00, false),
  (2, 'proprietar', 'Standard', 'Pentru proprietarii cu câteva locuințe.',                       450.00, 4500.00, true),
  (3, 'proprietar', 'Premium',  'Pentru cine administrează multe locuințe.',                     600.00, 6000.00, false),
  (4, 'chirias',    'Gratuit',  'Cauți o locuință și iei legătura cu proprietarii.',               0.00,    0.00, false),
  (5, 'chirias',    'Plus',     'Tot ce ai nevoie după ce te-ai mutat: plăți, dovezi, sesizări.',  20.00,  200.00, true)
) AS p("ordine", "rol", "nume", "descriere", "pret_lunar", "pret_anual", "recomandat")
JOIN "rol" r ON r."nume" = p."rol"
ORDER BY p."ordine";

-- Limitele si beneficiile fiecarui plan.
-- max_* lipsa = nelimitat; beneficiile: 1 = inclus, 0 = neinclus.
INSERT INTO "limita_plan" ("plan_id", "cheie", "valoare")
SELECT pa."id", l."cheie", l."valoare"
FROM (VALUES
  ('proprietar', 'Basic',    'max_proprietati',     1),
  ('proprietar', 'Standard', 'max_proprietati',     3),
  ('chirias',    'Gratuit',  'max_contactari_luna', 5),
  ('chirias',    'Gratuit',  'chirie_impartita',    0),
  ('chirias',    'Gratuit',  'dovezi_utilitati',    0),
  ('chirias',    'Gratuit',  'amanare_plata',       0),
  ('chirias',    'Gratuit',  'raport_pdf',          0),
  ('chirias',    'Gratuit',  'sesizari',            0),
  ('chirias',    'Plus',     'chirie_impartita',    1),
  ('chirias',    'Plus',     'dovezi_utilitati',    1),
  ('chirias',    'Plus',     'amanare_plata',       1),
  ('chirias',    'Plus',     'raport_pdf',          1),
  ('chirias',    'Plus',     'sesizari',            1)
) AS l("rol", "plan", "cheie", "valoare")
JOIN "rol" r ON r."nume" = l."rol"
JOIN "plan_abonament" pa ON pa."rol_id" = r."id" AND pa."nume" = l."plan";