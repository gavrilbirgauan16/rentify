# Rentify

![Teste](https://github.com/gavrilbirgauan16/rentify/actions/workflows/ci.yml/badge.svg)

Platformă web pentru închirieri, cu roluri (admin, proprietar, chiriaș) și abonamente.
Proiect PPAW - Bîrgăuan Gavril, grupa 3711a, USV.

## Tehnologii

| Parte | Tehnologii |
|---|---|
| Server | **Node.js** 24, **Express.js** 5, JavaScript |
| Pagini (randare pe server) | **EJS**, **HTML5**, **CSS3**, **Bootstrap** 5.3, JavaScript în browser |
| Bază de date | **PostgreSQL**, **Prisma ORM** 7 (Code First, migrări) |
| Securitate | helmet, express-rate-limit, CSRF, parole **scrypt**, sesiuni cu express-session + connect-pg-simple |
| Alte librării | Nodemailer (emailuri), Multer (imagini), morphism (DTO-uri API), dotenv |
| Calitate | ESLint, teste automate (`node:test`), CI cu **GitHub Actions**, Postman (API) |
| Arhitectură | MVC + ViewModel, nivel separat de acces la date (accesori), API REST |

## Instalare

1. `npm install`, apoi `npx prisma generate`.
2. Copiază `.env.example` ca `.env` și completează `DATABASE_URL`, `SESSION_SECRET` și `API_KEY`.
   Pentru emailuri reale completează și `SMTP_*`, `EMAIL_FROM`, `APP_URL`; fără ele, emailurile apar doar în consolă.
3. Creează baza de date din migrări: `npx prisma migrate deploy`.
4. (Opțional) Date de test: `npx prisma db seed`.
5. Pune parole conturilor de test: `npm run seteaza-parola -- admin@rentify.test ParolaTa123`.

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm run dev` | pornește aplicația la http://localhost:3000 și o repornește la fiecare salvare |
| `npm start` | pornește aplicația (fără repornire automată) |
| `npm test` | rulează testele automate (fără bază de date) |
| `npm run test:integrare` | testele API-ului pe baza separată `rentify_test` (setările în `.env.test`, după `.env.test.example`) |
| `npm run lint` | verifică codul cu ESLint |
| `npm run verifica` | lint + teste (de rulat înainte de commit) |
| `npm run backup` | copie a bazei de date în `backups/` (de făcut înainte de orice migrare) |
| `npm run seteaza-parola -- <email> <parola>` | setează parola unui utilizator |
| `npm run test-orm` | laboratorul 4: afișează date din bază prin accesori (aplicație consolă) |
| `npm run test-orm-loading` | laboratorul 4: compară Eager loading și Lazy loading (numărul de interogări SQL) |

## Cum lucrez (Git)

- Fiecare funcție nouă se face pe o **ramură** separată (ex. `abonamente`) și intră în `main` printr-un **Pull Request**.
- Commit-uri mici, de cel mult 5 fișiere, cu mesaj clar.
- La fiecare push, GitHub rulează automat lint + teste (vezi insigna de sus).
- Înainte de o migrare: `npm run backup`.

## Conturi

- Înregistrare ca chiriaș sau proprietar (`/inregistrare`); contul de admin nu se poate crea din aplicație.
- Confirmarea emailului e obligatorie înainte de conectare (link valabil 24 de ore).
- Chiriașul și proprietarul primesc automat planul **Gratuit** al rolului lor la confirmare.
- Parola uitată: link pe email, valabil o oră; după resetare se închid toate sesiunile.
- "Contul meu" (`/cont`): date personale, schimbarea parolei, schimbarea emailului (cu reconfirmare).

## Zona proprietarului (`/proprietar`)

- **Proprietățile mele** și **Anunțurile mele** (cu imagini): fiecare proprietar vede și modifică doar datele lui
  (căutare după id + proprietar, deci un id schimbat în adresă duce la 404).
- Limitele din plan (proprietăți active, anunțuri publicate) **blochează** adăugarea și reactivarea; adminul e doar avertizat.
- **Abonamentul meu**: planul curent, cât s-a folosit din limite, istoricul și schimbarea planului:
  - **upgrade** - începe imediat; zilele plătite și nefolosite se scad din preț (credit proporțional, rotunjit în jos);
  - **downgrade** - începe după ce se termină perioada plătită; se poate renunța la el, cu rambursare;
  - plata este **simulată** (nu se cer date de card); prețul se recalculează mereu pe server;
  - două plăți trimise deodată (dublu-click, două ferestre) nu trec amândouă: schimbarea blochează contul până se termină.

## Moderarea anunțurilor

| Stare | Ce înseamnă |
|---|---|
| Ciornă | salvat doar pentru proprietar |
| În așteptare | trimis spre publicare, așteaptă aprobarea adminului |
| Activ | aprobat și vizibil pe site |
| Inactiv | scos de pe site |
| Respins | adminul l-a respins, cu motiv; proprietarul îl corectează și îl retrimite |

- "Publică" trimite anunțul spre aprobare; adminul îl **aprobă** sau îl **respinge cu motiv**, iar proprietarul primește un email.
- Orice modificare de **conținut** (text, preț, poze) a unui anunț aprobat îl trimite din nou la aprobare;
  dezactivarea și reactivarea fără modificări îi păstrează aprobarea.
- Adminul nu modifică un anunț în așteptare (doar îl aprobă sau îl respinge) și aprobă exact varianta pe care a văzut-o
  (dacă proprietarul o schimbă între timp, aprobarea se oprește).
- Regulile sunt verificate și în baza de date (CHECK): stările permise și motivul obligatoriu la respingere.

## Ștergerea datelor

| Fel | Ce înseamnă | Unde |
|---|---|---|
| Ștergere **fizică** (hard delete) | rândul dispare din baza de date | favoritele chiriașului, pozele unui anunț (și fișierul de pe disc) |
| Ștergere **logică** (soft delete) | rândul rămâne, marcat ca șters (`sters_la`), dar nu mai apare nicăieri | anunțurile |

- Fizic se șterge doar ce nu e folosit de alte tabele: un favorit sau o poză nu lasă "găuri" în istoric.
- Un anunț are contactări, favorite și vizionări legate de el, deci se șterge **logic**: dispare din căutare,
  din pagina anunțului, din Anunțurile mele, din favorite și din API (Get și GetAll), dar istoricul rămâne.
- Proprietarul șterge din **Anunțurile mele** (cu confirmare); ștergerea îi eliberează locul din plan.
- Adminul vede anunțurile șterse la **Anunțuri → Afișează: Doar cele șterse** și le poate **restaura**;
  un anunț restaurat revine ca ciornă și trebuie aprobat din nou (acțiunea apare în jurnal).
- În baza de date (CHECK): un anunț șters nu poate fi activ sau în așteptare, deci nu poate ajunge pe site
  chiar dacă o interogare ar uita condiția.

## API

Două feluri de clienți: programele (Postman) trimit cheia API în antetul `x-api-key`,
iar interfața din browser folosește contul conectat (cookie de sesiune) și tokenul CSRF în antetul `x-csrf-token`.

| Metodă | Adresă | Cine |
|---|---|---|
| GET | `/api/anunturi` | oricine: căutare în anunțurile active (filtre, sortare, paginare în antetele `X-Total-Count`, `X-Pagina`, `X-Total-Pagini`); cu cheie: toate anunțurile |
| GET | `/api/anunturi/:id` | oricine: un anunț activ (numără vizualizarea); cu cheie: orice anunț |
| POST, PUT | `/api/anunturi`, `/api/anunturi/:id` | cu cheie API (laboratorul 7) |
| GET | `/api/auth/csrf` | oricine: tokenul CSRF |
| POST | `/api/auth/login`, `/api/auth/logout` | conectare / ieșire |
| GET | `/api/auth/eu` | utilizatorul conectat |
| POST | `/api/auth/inregistrare` | cont nou de chiriaș sau proprietar; răspunsul e același și pentru o adresă deja folosită |
| POST | `/api/auth/confirmare`, `/api/auth/confirmare/retrimite` | confirmarea emailului cu tokenul din link / link nou |
| POST | `/api/auth/parola-uitata` | linkul de resetare pe email |
| GET, POST | `/api/auth/resetare/:token`, `/api/auth/resetare` | verificarea linkului / parola nouă (închide toate sesiunile contului) |
| GET, PUT | `/api/cont` | contul conectat: profilul (prenume, nume, telefon, oraș) |
| POST | `/api/cont/parola` | schimbarea parolei (cu parola curentă); închide celelalte sesiuni; merge și cu parola temporară de la admin |
| POST | `/api/cont/email`, `/api/cont/email/confirmare` | schimbarea emailului: link pe adresa nouă, apoi confirmarea lui |
| GET, POST | `/api/proprietar/proprietati` | proprietar: proprietățile lui (cu limita din plan) / proprietate nouă |
| GET, PUT | `/api/proprietar/proprietati/:id` | proprietar: o proprietate a lui |
| POST | `/api/proprietar/proprietati/:id/dezactiveaza`, `.../activeaza` | proprietar: scoate din uz (și anunțurile ei) / repune în uz, dacă planul permite |
| GET, POST | `/api/proprietar/anunturi` | proprietar: anunțurile lui (starea, motivul respingerii, pozele) / anunț nou |
| GET, PUT | `/api/proprietar/anunturi/:id` | proprietar: un anunț al lui; o schimbare de conținut a unui anunț aprobat cere reaprobare |
| POST | `/api/proprietar/anunturi/:id/publica`, `.../retrage` | proprietar: trimite spre aprobare (sau republică direct) / scoate de pe site |
| DELETE | `/api/proprietar/anunturi/:id` | proprietar: ștergere logică (204; apoi anunțul nu mai există pentru API: 404) |
| POST, DELETE | `/api/proprietar/anunturi/:id/imagini`, `.../imagini/:idImagine` | proprietar: pozele (multipart, câmpul `imagini`, maxim 6, verificate după conținut) |
| GET | `/api/proprietar/abonament` | proprietar: abonamentul curent, schimbarea programată, limitele folosite, planurile, istoricul |
| GET | `/api/proprietar/abonament/previzualizare?plan=&perioada=` | proprietar: cât costă schimbarea și de când (nu schimbă nimic) |
| POST | `/api/proprietar/abonament/schimba` | proprietar: schimbă planul (`plan`, `perioada`), cu plată simulată; prețul îl calculează serverul; 409 dacă abonamentul s-a schimbat între timp |
| DELETE | `/api/proprietar/abonament/programat` | proprietar: renunță la schimbarea programată (plata ei se rambursează) |
| GET | `/api/contactari` | chiriaș: câte contactări mai are luna asta |
| POST | `/api/anunturi/:id/contact` | chiriaș: telefonul proprietarului (consumă o contactare din plan) |
| GET, POST, DELETE | `/api/favorite`, `/api/favorite/:id` | chiriaș: favoritele |

Filtrele căutării: `q`, `oras`, `tip`, `pret_min`, `pret_max`, `camere_min`, `persoane`, `sort` (`noi`, `pret_asc`, `pret_desc`), `pagina`, `pe_pagina`.

Colecția Postman: `docs/Rentify-API.postman_collection.json`. În tab-ul Variables, `apiKey`, `emailChirias`, `parolaChirias`, `emailProprietar` și `parolaProprietar` se completează doar la Current value.

## Structura

| Folder | Ce conține |
|---|---|
| `models/` | ViewModel-urile (validare, transformări pentru pagini); `models/api/` - DTO-urile pentru API |
| `controllers/` | logica fiecărei pagini; `controllers/api/` - controllerele API |
| `routes/` | adresele aplicației (`/admin/...` protejat, `/api/...` JSON) |
| `views/` | paginile EJS (`views/admin/...` pentru administrator) |
| `src/NivelAccesDate/` | accesorii: singurul loc care vorbește cu baza de date |
| `middleware/` | autentificare, roluri, CSRF, încărcarea imaginilor, cheia API |
| `servicii/` | logica comună: parole (scrypt), emailuri, linkuri din email (tokenuri), limitele planurilor, filtre și paginare, jurnalul adminului, date calendaristice |
| `utils/` | ajutoare pentru controllere (mesaje flash, întoarcerea la lista filtrată) |
| `config/` | setările citite din `.env` |
| `prisma/` | schema și migrările (Code First) |
| `scripts/` | unelte: setarea parolei, backup |
| `test/` | teste automate (`node --test`); `test/integrare/` - testele API-ului cu baza de date |
| `docs/` | colecția Postman |

## Securitate

- Parole salvate doar ca amprentă **scrypt** cu sare; mesaj vag la login greșit; limită de 10 încercări greșite / 15 minute.
- Sesiuni în PostgreSQL, cookie `httpOnly` + `sameSite`, sesiune nouă la conectare.
- Token **CSRF** în toate formularele; headere de securitate cu **helmet**.
- Imaginile sunt verificate după conținut (nu doar după extensie), cu nume aleatoare.
- Toată partea de admin e sub `/admin`, protejată de o singură regulă (conectat + rol `admin`).
- API-ul: Post/Put doar cu cheie (`x-api-key`, comparată în timp constant); din browser, token CSRF în antet; DTO-urile nu expun date personale (telefonul doar prin contactare); limită de cereri.
- Linkurile din emailuri: 32 de octeți aleatori, în bază se păstrează doar amprenta SHA-256, se folosesc o singură dată și expiră.
- Mesaje generice la înregistrare și la parola uitată (nu se află dacă un email are cont).
- Secretele stau doar în `.env` (exclus din Git); `.env.example` are doar valori de umplutură.
