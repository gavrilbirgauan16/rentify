-- AlterTable
ALTER TABLE "abonament" ADD COLUMN     "pret" DECIMAL(8,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "abonament_utilizator_id_idx" ON "abonament"("utilizator_id");

-- CreateIndex
CREATE INDEX "abonament_plan_id_idx" ON "abonament"("plan_id");

-- CreateIndex
CREATE INDEX "jurnal_admin_creat_la_idx" ON "jurnal_admin"("creat_la");

-- CreateIndex
CREATE INDEX "jurnal_admin_entitate_entitate_id_idx" ON "jurnal_admin"("entitate", "entitate_id");

-- CreateIndex
CREATE INDEX "plata_abonament_abonament_id_idx" ON "plata_abonament"("abonament_id");

-- ===== Scris de mana: valorile permise (Prisma nu genereaza reguli CHECK) =====

ALTER TABLE "abonament" ADD CONSTRAINT "abonament_perioada_check" CHECK ("perioada" IN ('lunar', 'anual'));
ALTER TABLE "abonament" ADD CONSTRAINT "abonament_stare_check" CHECK ("stare" IN ('activ', 'anulat'));
ALTER TABLE "abonament" ADD CONSTRAINT "abonament_date_check" CHECK ("data_sfarsit" >= "data_inceput");
ALTER TABLE "abonament" ADD CONSTRAINT "abonament_pret_check" CHECK ("pret" >= 0);

ALTER TABLE "plata_abonament" ADD CONSTRAINT "plata_abonament_suma_check" CHECK ("suma" > 0);
ALTER TABLE "plata_abonament" ADD CONSTRAINT "plata_abonament_metoda_check" CHECK ("metoda" IN ('card', 'transfer', 'numerar'));
ALTER TABLE "plata_abonament" ADD CONSTRAINT "plata_abonament_stare_check" CHECK ("stare" IN ('reusita', 'esuata', 'rambursata'));

ALTER TABLE "utilizator" ADD CONSTRAINT "utilizator_stare_check" CHECK ("stare" IN ('activ', 'blocat'));