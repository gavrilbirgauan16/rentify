-- CreateTable
CREATE TABLE "token_cont" (
    "id" SERIAL NOT NULL,
    "utilizator_id" INTEGER NOT NULL,
    "tip" VARCHAR(30) NOT NULL,
    "hash_token" CHAR(64) NOT NULL,
    "email_nou" VARCHAR(150),
    "expira_la" TIMESTAMP(6) NOT NULL,
    "folosit_la" TIMESTAMP(6),
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_cont_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_cont_hash_token_key" ON "token_cont"("hash_token");

-- CreateIndex
CREATE INDEX "token_cont_utilizator_id_tip_idx" ON "token_cont"("utilizator_id", "tip");

-- AddForeignKey
ALTER TABLE "token_cont" ADD CONSTRAINT "token_cont_utilizator_id_fkey" FOREIGN KEY ("utilizator_id") REFERENCES "utilizator"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ===== Scris de mana =====

-- Tipurile de linkuri permise
ALTER TABLE "token_cont" ADD CONSTRAINT "token_cont_tip_check" CHECK ("tip" IN ('confirmare_email', 'resetare_parola', 'schimbare_email'));

-- Conturile care existau deja (admin, conturile de test) sunt considerate confirmate,
-- altfel nimeni nu s-ar mai putea conecta dupa ce confirmarea emailului devine obligatorie.
UPDATE "utilizator" SET "email_verificat" = true WHERE "email_verificat" = false;

-- Emailurile se compara mereu cu litere mici: le aducem pe toate la aceeasi forma.
UPDATE "utilizator" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
