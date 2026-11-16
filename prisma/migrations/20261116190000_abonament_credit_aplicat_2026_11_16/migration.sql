-- AlterTable
ALTER TABLE "abonament" ADD COLUMN     "credit_aplicat" DECIMAL(8,2) NOT NULL DEFAULT 0;

-- ===== Scris de mana =====

-- credit_aplicat = creditul adus din abonamentul anterior la un upgrade (zilele platite si nefolosite).
-- "pret" ramane suma platita CASH; valoarea abonamentului = pret + credit_aplicat.
-- Fara coloana asta, la doua upgrade-uri la rand creditul primului se pierdea (bug gasit la testare, 16 nov).
ALTER TABLE "abonament" ADD CONSTRAINT "abonament_credit_check" CHECK ("credit_aplicat" >= 0);
