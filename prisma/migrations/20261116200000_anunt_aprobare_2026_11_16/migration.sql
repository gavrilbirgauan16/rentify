-- AlterTable
ALTER TABLE "anunt" ADD COLUMN     "aprobat_la" TIMESTAMP(6),
ADD COLUMN     "motiv_respingere" VARCHAR(300);

-- ===== Scris de mana =====

-- Moderarea anunturilor de catre admin. Starile unui anunt:
--   ciorna       - salvat doar pentru proprietar
--   in_asteptare - trimis spre publicare, asteapta aprobarea adminului
--   activ        - aprobat si vizibil pe site
--   inactiv      - scos de pe site
--   respins      - adminul l-a respins (motivul e in motiv_respingere)
-- Pana acum coloana "stare" nu avea nicio regula in baza de date (se putea scrie orice text).
ALTER TABLE "anunt" ADD CONSTRAINT "anunt_stare_check"
  CHECK ("stare" IN ('ciorna', 'in_asteptare', 'activ', 'inactiv', 'respins'));

-- Un anunt respins are mereu un motiv; motivul nu ramane pe un anunt care nu e respins.
ALTER TABLE "anunt" ADD CONSTRAINT "anunt_motiv_check"
  CHECK (("stare" = 'respins') = ("motiv_respingere" IS NOT NULL));

-- Completare in urma (backfill): anunturile active de acum au fost publicate inainte de moderare,
-- deci le consideram aprobate (altfel ar trebui reaprobate la prima dezactivare / reactivare).
UPDATE "anunt" SET "aprobat_la" = now() WHERE "stare" = 'activ';
