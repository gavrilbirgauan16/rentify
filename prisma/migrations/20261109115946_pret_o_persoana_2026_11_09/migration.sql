-- AlterTable
ALTER TABLE "anunt" ADD COLUMN     "pret_o_persoana" DECIMAL(12,2);

-- Regula scrisa de mana (Prisma nu genereaza reguli CHECK):
-- pretul pentru o singura persoana e optional, dar daca exista trebuie sa fie pozitiv si mai mic decat pretul intreg.
ALTER TABLE "anunt" ADD CONSTRAINT "anunt_pret_o_persoana_check"
  CHECK ("pret_o_persoana" IS NULL OR ("pret_o_persoana" > 0 AND "pret_o_persoana" < "pret"));