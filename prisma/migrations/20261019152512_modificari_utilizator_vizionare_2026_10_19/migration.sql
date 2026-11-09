-- AlterTable
ALTER TABLE "utilizator" ADD COLUMN     "limba_preferata" VARCHAR(5) NOT NULL DEFAULT 'ro',
ADD COLUMN     "oras" VARCHAR(50),
ALTER COLUMN "telefon" SET DATA TYPE VARCHAR(30);

-- CreateTable
CREATE TABLE "vizionare" (
    "id" SERIAL NOT NULL,
    "anunt_id" INTEGER NOT NULL,
    "chirias_id" INTEGER NOT NULL,
    "data_ora" TIMESTAMP(6) NOT NULL,
    "mesaj" VARCHAR(300),
    "stare" VARCHAR(20) NOT NULL DEFAULT 'programata',
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vizionare_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vizionare" ADD CONSTRAINT "vizionare_anunt_id_fkey" FOREIGN KEY ("anunt_id") REFERENCES "anunt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vizionare" ADD CONSTRAINT "vizionare_chirias_id_fkey" FOREIGN KEY ("chirias_id") REFERENCES "utilizator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
