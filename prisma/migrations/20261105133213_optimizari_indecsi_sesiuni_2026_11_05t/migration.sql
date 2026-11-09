-- CreateTable
CREATE TABLE "sesiune" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sesiune_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "sesiune_expire_idx" ON "sesiune"("expire");

-- CreateIndex
CREATE INDEX "anunt_proprietate_id_idx" ON "anunt"("proprietate_id");

-- CreateIndex
CREATE INDEX "fisier_entitate_entitate_id_idx" ON "fisier"("entitate", "entitate_id");

-- CreateIndex
CREATE INDEX "proprietate_proprietar_id_idx" ON "proprietate"("proprietar_id");

-- CreateIndex
CREATE INDEX "utilizator_rol_id_idx" ON "utilizator"("rol_id");
