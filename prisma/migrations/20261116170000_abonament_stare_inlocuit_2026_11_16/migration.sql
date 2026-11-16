-- Fara schimbari de structura in schema.prisma (coloana "stare" ramane text): se schimba doar regula CHECK.

-- ===== Scris de mana =====

-- Starea noua "inlocuit": abonamentul s-a oprit pentru ca utilizatorul a trecut la un plan mai mare (upgrade).
-- E diferita de "anulat" (utilizatorul a renuntat), ca istoricul sa spuna exact ce s-a intamplat.
-- O regula CHECK nu se poate modifica: se sterge si se pune din nou, cu valoarea noua.
ALTER TABLE "abonament" DROP CONSTRAINT "abonament_stare_check";
ALTER TABLE "abonament" ADD CONSTRAINT "abonament_stare_check" CHECK ("stare" IN ('activ', 'anulat', 'inlocuit'));
