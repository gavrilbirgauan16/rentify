-- AlterTable
ALTER TABLE "anunt" ADD COLUMN     "sters_la" TIMESTAMP(6);

-- ===== Scris de mana =====

-- Stergerea LOGICA a anunturilor (soft delete): randul ramane in baza (contactarile, favoritele si vizionarile
-- chiriasilor arata spre el, istoricul nu se pierde), dar anuntul nu mai apare nicaieri in aplicatie.
--   sters_la IS NULL     -> anuntul exista
--   sters_la = data/ora  -> anuntul a fost sters atunci (adminul il poate restaura, ca ciorna)
--
-- Aparare in adancime: un anunt sters nu poate fi niciodata pe site sau in coada de aprobare. Chiar daca o
-- interogare ar uita conditia "sters_la IS NULL", site-ul arata doar anunturile active, deci tot nu l-ar arata.
ALTER TABLE "anunt" ADD CONSTRAINT "anunt_sters_check"
  CHECK ("sters_la" IS NULL OR "stare" NOT IN ('activ', 'in_asteptare'));
