-- CreateIndex
CREATE INDEX "anunt_stare_idx" ON "anunt"("stare");

-- CreateIndex
CREATE INDEX "contactare_chirias_id_creat_la_idx" ON "contactare"("chirias_id", "creat_la");

-- ===== Scris de mana =====

-- anunt_stare_idx: cautarea publica filtreaza mereu dupa stare = 'activ' (si panoul numara anunturile in asteptare).
-- contactare_chirias_id_creat_la_idx: "cate contactari a facut chiriasul luna asta" (limita din plan) fara sa citeasca tot tabelul.

-- Starile unei contactari (chiriasul a vazut telefonul / a trimis un mesaj; proprietarul a raspuns).
ALTER TABLE "contactare" ADD CONSTRAINT "contactare_stare_check" CHECK ("stare" IN ('trimisa', 'raspunsa'));
