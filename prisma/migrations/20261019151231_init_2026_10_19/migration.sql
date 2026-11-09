-- CreateTable
CREATE TABLE "abonament" (
    "id" SERIAL NOT NULL,
    "utilizator_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "perioada" VARCHAR(10) NOT NULL,
    "data_inceput" DATE NOT NULL,
    "data_sfarsit" DATE NOT NULL,
    "reinnoire_automata" BOOLEAN NOT NULL DEFAULT false,
    "stare" VARCHAR(20) NOT NULL DEFAULT 'activ',
    "referinta_externa" VARCHAR(100),
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anunt" (
    "id" SERIAL NOT NULL,
    "proprietate_id" INTEGER NOT NULL,
    "tip" VARCHAR(20) NOT NULL,
    "titlu" VARCHAR(120) NOT NULL,
    "descriere" TEXT,
    "pret" DECIMAL(12,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'RON',
    "garantie" DECIMAL(10,2),
    "disponibil_de_la" DATE,
    "locuri_libere" INTEGER,
    "stare" VARCHAR(20) NOT NULL DEFAULT 'ciorna',
    "promovat" BOOLEAN NOT NULL DEFAULT false,
    "promovat_pana_la" DATE,
    "vizualizari" INTEGER NOT NULL DEFAULT 0,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_la" DATE,

    CONSTRAINT "anunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cerere_prelungire" (
    "id" SERIAL NOT NULL,
    "obligatie_id" INTEGER NOT NULL,
    "data_noua" DATE NOT NULL,
    "motiv" VARCHAR(300),
    "stare" VARCHAR(20) NOT NULL DEFAULT 'trimisa',
    "raspuns" VARCHAR(300),
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raspuns_la" TIMESTAMP(6),

    CONSTRAINT "cerere_prelungire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactare" (
    "id" SERIAL NOT NULL,
    "anunt_id" INTEGER NOT NULL,
    "chirias_id" INTEGER NOT NULL,
    "mesaj" TEXT,
    "stare" VARCHAR(20) NOT NULL DEFAULT 'trimisa',
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raspuns_la" TIMESTAMP(6),

    CONSTRAINT "contactare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" SERIAL NOT NULL,
    "proprietate_id" INTEGER NOT NULL,
    "data_inceput" DATE NOT NULL,
    "data_sfarsit" DATE,
    "zi_scadenta" INTEGER NOT NULL,
    "mod_calcul" VARCHAR(20) NOT NULL DEFAULT 'pe_apartament',
    "chirie_totala" DECIMAL(10,2),
    "chirie_pe_persoana" DECIMAL(10,2),
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'RON',
    "garantie" DECIMAL(10,2),
    "reducere_la_timp" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "luni_gratie" INTEGER NOT NULL DEFAULT 1,
    "notificari_proprietar" VARCHAR(20) NOT NULL DEFAULT 'doar_final',
    "stare" VARCHAR(20) NOT NULL DEFAULT 'ciorna',
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizat_la" TIMESTAMP(6),

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_chirias" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "chirias_id" INTEGER NOT NULL,
    "parte_chirie" DECIMAL(10,2) NOT NULL,
    "parte_manuala" BOOLEAN NOT NULL DEFAULT false,
    "data_intrare" DATE NOT NULL,
    "data_iesire" DATE,
    "reguli_acceptate_la" TIMESTAMP(6),
    "stare" VARCHAR(20) NOT NULL DEFAULT 'invitat',

    CONSTRAINT "contract_chirias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dovada_plata" (
    "id" SERIAL NOT NULL,
    "contract_chirias_id" INTEGER NOT NULL,
    "tip" VARCHAR(30) NOT NULL,
    "luna" DATE NOT NULL,
    "suma" DECIMAL(10,2),
    "observatii" VARCHAR(200),
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dovada_plata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorit" (
    "id" SERIAL NOT NULL,
    "utilizator_id" INTEGER NOT NULL,
    "anunt_id" INTEGER NOT NULL,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fisier" (
    "id" SERIAL NOT NULL,
    "incarcat_de" INTEGER NOT NULL,
    "entitate" VARCHAR(30) NOT NULL,
    "entitate_id" INTEGER NOT NULL,
    "tip" VARCHAR(20) NOT NULL,
    "nume_fisier" VARCHAR(200) NOT NULL,
    "cale" VARCHAR(300) NOT NULL,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fisier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurnal_admin" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "actiune" VARCHAR(50) NOT NULL,
    "entitate" VARCHAR(30),
    "entitate_id" INTEGER,
    "detalii" TEXT,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jurnal_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limita_plan" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "cheie" VARCHAR(50) NOT NULL,
    "valoare" INTEGER NOT NULL,

    CONSTRAINT "limita_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesaj_sesizare" (
    "id" SERIAL NOT NULL,
    "sesizare_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "continut" TEXT NOT NULL,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mesaj_sesizare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificare" (
    "id" SERIAL NOT NULL,
    "utilizator_id" INTEGER NOT NULL,
    "tip" VARCHAR(30) NOT NULL,
    "titlu" VARCHAR(120) NOT NULL,
    "continut" VARCHAR(500),
    "link" VARCHAR(200),
    "citita" BOOLEAN NOT NULL DEFAULT false,
    "trimisa_email" BOOLEAN NOT NULL DEFAULT false,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligatie" (
    "id" SERIAL NOT NULL,
    "contract_chirias_id" INTEGER NOT NULL,
    "tip" VARCHAR(20) NOT NULL,
    "descriere" VARCHAR(200),
    "luna" DATE NOT NULL,
    "suma" DECIMAL(10,2) NOT NULL,
    "scadenta" DATE NOT NULL,
    "scadenta_initiala" DATE NOT NULL,
    "sesizare_id" INTEGER,
    "stare" VARCHAR(20) NOT NULL DEFAULT 'in_asteptare',
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obligatie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_abonament" (
    "id" SERIAL NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "nume" VARCHAR(50) NOT NULL,
    "descriere" VARCHAR(300),
    "pret_lunar" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "pret_anual" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "activ" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_abonament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plata" (
    "id" SERIAL NOT NULL,
    "obligatie_id" INTEGER NOT NULL,
    "suma" DECIMAL(10,2) NOT NULL,
    "reducere_aplicata" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "data_platii" DATE NOT NULL,
    "metoda" VARCHAR(20) NOT NULL DEFAULT 'transfer',
    "stare" VARCHAR(20) NOT NULL DEFAULT 'declarata',
    "confirmata_la" TIMESTAMP(6),
    "motiv_respingere" VARCHAR(200),
    "referinta_externa" VARCHAR(100),
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plata_abonament" (
    "id" SERIAL NOT NULL,
    "abonament_id" INTEGER NOT NULL,
    "suma" DECIMAL(8,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'RON',
    "data_platii" TIMESTAMP(6) NOT NULL,
    "metoda" VARCHAR(20) NOT NULL DEFAULT 'card',
    "stare" VARCHAR(20) NOT NULL DEFAULT 'reusita',
    "referinta" VARCHAR(100),

    CONSTRAINT "plata_abonament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietate" (
    "id" SERIAL NOT NULL,
    "proprietar_id" INTEGER NOT NULL,
    "denumire" VARCHAR(100) NOT NULL,
    "tip" VARCHAR(20) NOT NULL,
    "judet" VARCHAR(50) NOT NULL,
    "oras" VARCHAR(50) NOT NULL,
    "zona" VARCHAR(80),
    "adresa" VARCHAR(200),
    "latitudine" DECIMAL(9,6),
    "longitudine" DECIMAL(9,6),
    "etaj" INTEGER,
    "nr_camere" INTEGER NOT NULL,
    "suprafata_mp" DECIMAL(6,2),
    "an_constructie" INTEGER,
    "stare_imobil" VARCHAR(20),
    "mobilat" VARCHAR(20),
    "dotari" JSONB,
    "descriere" TEXT,
    "max_locatari" INTEGER NOT NULL DEFAULT 1,
    "stare" VARCHAR(20) NOT NULL DEFAULT 'liber',
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizat_la" TIMESTAMP(6),
    "are_balcon" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "proprietate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recenzie" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "destinatar_id" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentariu" TEXT,
    "vizibila" BOOLEAN NOT NULL DEFAULT true,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recenzie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_contract" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "continut" VARCHAR(300) NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "regula_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" SERIAL NOT NULL,
    "nume" VARCHAR(30) NOT NULL,
    "descriere" VARCHAR(200),

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesizare" (
    "id" SERIAL NOT NULL,
    "proprietate_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "tip" VARCHAR(20) NOT NULL,
    "titlu" VARCHAR(120) NOT NULL,
    "descriere" TEXT,
    "cost_estimat" DECIMAL(10,2),
    "cine_plateste" VARCHAR(20),
    "suma_proprietar" DECIMAL(10,2),
    "suma_chiriasi" DECIMAL(10,2),
    "stare" VARCHAR(20) NOT NULL DEFAULT 'deschisa',
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inchisa_la" TIMESTAMP(6),

    CONSTRAINT "sesizare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treapta_chirie" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "nr_persoane" INTEGER NOT NULL,
    "chirie_totala" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "treapta_chirie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilizator" (
    "id" SERIAL NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "parola_hash" VARCHAR(255) NOT NULL,
    "nume" VARCHAR(60) NOT NULL,
    "prenume" VARCHAR(60) NOT NULL,
    "telefon" VARCHAR(20),
    "iban" VARCHAR(34),
    "id_client_plati" VARCHAR(100),
    "id_cont_incasare" VARCHAR(100),
    "stare" VARCHAR(20) NOT NULL DEFAULT 'activ',
    "email_verificat" BOOLEAN NOT NULL DEFAULT false,
    "notificari_email" BOOLEAN NOT NULL DEFAULT true,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizat_la" TIMESTAMP(6),
    "ultima_autentificare" TIMESTAMP(6),

    CONSTRAINT "utilizator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cod_promotional" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER,
    "cod" VARCHAR(30) NOT NULL,
    "procent" DECIMAL(5,2) NOT NULL,
    "valabil_pana_la" DATE,
    "utilizari_maxime" INTEGER,
    "utilizari" INTEGER NOT NULL DEFAULT 0,
    "activ" BOOLEAN NOT NULL DEFAULT true,
    "creat_la" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cod_promotional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorit_utilizator_id_anunt_id_key" ON "favorit"("utilizator_id", "anunt_id");

-- CreateIndex
CREATE UNIQUE INDEX "limita_plan_plan_id_cheie_key" ON "limita_plan"("plan_id", "cheie");

-- CreateIndex
CREATE UNIQUE INDEX "recenzie_contract_id_autor_id_destinatar_id_key" ON "recenzie"("contract_id", "autor_id", "destinatar_id");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nume_key" ON "rol"("nume");

-- CreateIndex
CREATE UNIQUE INDEX "treapta_chirie_contract_id_nr_persoane_key" ON "treapta_chirie"("contract_id", "nr_persoane");

-- CreateIndex
CREATE UNIQUE INDEX "utilizator_email_key" ON "utilizator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cod_promotional_cod_key" ON "cod_promotional"("cod");

-- AddForeignKey
ALTER TABLE "abonament" ADD CONSTRAINT "abonament_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_abonament"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "abonament" ADD CONSTRAINT "abonament_utilizator_id_fkey" FOREIGN KEY ("utilizator_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "anunt" ADD CONSTRAINT "anunt_proprietate_id_fkey" FOREIGN KEY ("proprietate_id") REFERENCES "proprietate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cerere_prelungire" ADD CONSTRAINT "cerere_prelungire_obligatie_id_fkey" FOREIGN KEY ("obligatie_id") REFERENCES "obligatie"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contactare" ADD CONSTRAINT "contactare_anunt_id_fkey" FOREIGN KEY ("anunt_id") REFERENCES "anunt"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contactare" ADD CONSTRAINT "contactare_chirias_id_fkey" FOREIGN KEY ("chirias_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_proprietate_id_fkey" FOREIGN KEY ("proprietate_id") REFERENCES "proprietate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contract_chirias" ADD CONSTRAINT "contract_chirias_chirias_id_fkey" FOREIGN KEY ("chirias_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contract_chirias" ADD CONSTRAINT "contract_chirias_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dovada_plata" ADD CONSTRAINT "dovada_plata_contract_chirias_id_fkey" FOREIGN KEY ("contract_chirias_id") REFERENCES "contract_chirias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorit" ADD CONSTRAINT "favorit_anunt_id_fkey" FOREIGN KEY ("anunt_id") REFERENCES "anunt"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorit" ADD CONSTRAINT "favorit_utilizator_id_fkey" FOREIGN KEY ("utilizator_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fisier" ADD CONSTRAINT "fisier_incarcat_de_fkey" FOREIGN KEY ("incarcat_de") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "jurnal_admin" ADD CONSTRAINT "jurnal_admin_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "limita_plan" ADD CONSTRAINT "limita_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_abonament"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mesaj_sesizare" ADD CONSTRAINT "mesaj_sesizare_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mesaj_sesizare" ADD CONSTRAINT "mesaj_sesizare_sesizare_id_fkey" FOREIGN KEY ("sesizare_id") REFERENCES "sesizare"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notificare" ADD CONSTRAINT "notificare_utilizator_id_fkey" FOREIGN KEY ("utilizator_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "obligatie" ADD CONSTRAINT "obligatie_contract_chirias_id_fkey" FOREIGN KEY ("contract_chirias_id") REFERENCES "contract_chirias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "obligatie" ADD CONSTRAINT "obligatie_sesizare_id_fkey" FOREIGN KEY ("sesizare_id") REFERENCES "sesizare"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_abonament" ADD CONSTRAINT "plan_abonament_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plata" ADD CONSTRAINT "plata_obligatie_id_fkey" FOREIGN KEY ("obligatie_id") REFERENCES "obligatie"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plata_abonament" ADD CONSTRAINT "plata_abonament_abonament_id_fkey" FOREIGN KEY ("abonament_id") REFERENCES "abonament"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proprietate" ADD CONSTRAINT "proprietate_proprietar_id_fkey" FOREIGN KEY ("proprietar_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recenzie" ADD CONSTRAINT "recenzie_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recenzie" ADD CONSTRAINT "recenzie_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recenzie" ADD CONSTRAINT "recenzie_destinatar_id_fkey" FOREIGN KEY ("destinatar_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "regula_contract" ADD CONSTRAINT "regula_contract_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sesizare" ADD CONSTRAINT "sesizare_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "utilizator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sesizare" ADD CONSTRAINT "sesizare_proprietate_id_fkey" FOREIGN KEY ("proprietate_id") REFERENCES "proprietate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "treapta_chirie" ADD CONSTRAINT "treapta_chirie_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "utilizator" ADD CONSTRAINT "utilizator_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cod_promotional" ADD CONSTRAINT "cod_promotional_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_abonament"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
