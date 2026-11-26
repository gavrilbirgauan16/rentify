# Rentify

![Teste](https://github.com/gavrilbirgauan16/rentify/actions/workflows/ci.yml/badge.svg)

Platformă web pentru închirieri, cu roluri (admin, proprietar, chiriaș) și abonamente.
Proiect PPAW - Bîrgăuan Gavril, grupa 3711a, USV.

## Tehnologii

| Parte | Tehnologii |
|---|---|
| Server | **Node.js** 24, **Express.js** 5, JavaScript |
| Interfața utilizatorilor | **React** 19, React Router, Vite; **CSS3** propriu (variabile, Grid, Flexbox, container queries), **HTML5** |
| Panoul de administrare (randare pe server) | **EJS**, **HTML5**, **CSS3**, **Bootstrap** 5.3, JavaScript în browser |
| Bază de date | **PostgreSQL**, **Prisma ORM** 7 (Code First, migrări) |
| Securitate | helmet, express-rate-limit, CSRF, parole **scrypt**, sesiuni cu express-session + connect-pg-simple |
| Alte librării | Awilix (Dependency Injection), Nodemailer (emailuri), Multer (imagini), morphism (DTO-uri API), dotenv |
| Calitate | ESLint, teste automate (`node:test`), CI cu **GitHub Actions**, Postman (API) |
| Arhitectură | MVC + ViewModel, nivel de servicii (logica de business), nivel de acces la date (accesori), API REST, Dependency Injection, cache, evenimente |

## Instalare

1. `npm install`, apoi `npx prisma generate`. Pentru interfața React: `npm install --prefix client`.
2. Copiază `.env.example` ca `.env` și completează `DATABASE_URL`, `SESSION_SECRET` și `API_KEY`.
   Pentru emailuri reale completează și `SMTP_*`, `EMAIL_FROM` și `APP_URL` (adresa interfeței React pe care o deschid
   linkurile din emailuri; în timpul lucrului `http://localhost:5173`); fără SMTP, emailurile apar doar în consolă.
   Pentru Gmail: verificarea în 2 pași + o „parolă de aplicație” (myaccount.google.com/apppasswords).
3. Creează baza de date din migrări: `npx prisma migrate deploy`.
4. (Opțional) Date de test: `npx prisma db seed`.
5. Pune parole conturilor de test: `npm run seteaza-parola -- admin@rentify.test ParolaTa123`.

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm run dev` | pornește aplicația la http://localhost:3000 și o repornește la fiecare salvare |
| `npm run dev` (în `client/`) | pornește interfața React la http://localhost:5173 (cu serverul pornit în altă fereastră) |
| `npm run build` (în `client/`) | împachetează interfața React pentru publicare (în `client/dist/`) |
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

Totul trece prin email, ca într-o aplicație reală (emailuri trimise prin SMTP, cu Nodemailer):

| Acțiune | Ce se întâmplă |
|---|---|
| Cont nou (`/inregistrare`, chiriaș sau proprietar) | email cu link de confirmare (24 de ore); fără confirmare nu te poți conecta; la confirmare primești planul **Gratuit** al rolului |
| Ai uitat parola? (`/parola-uitata`) | link pe email (o oră, o singură folosire) → `/resetare/:token` → parola nouă; toate sesiunile se închid |
| Contul meu → Parola (`/cont`) | ceri parola actuală; celelalte dispozitive sunt deconectate |
| Contul meu → Adresa de email | link pe adresa **nouă**; până la confirmare rămâne cea veche; după confirmare, anunț pe adresa **veche** |
| Parolă temporară (dată de admin) | la intrare ești dus direct la „Alege-ți o parolă nouă”; până atunci, API-ul refuză restul |
| După orice schimbare a parolei | **email de alertă** „Parola a fost schimbată”, cu butonul „Nu am fost eu – resetează parola” |

- Contul de admin nu se poate crea din aplicație.
- Răspunsurile la înregistrare și la parola uitată sunt **aceleași** pentru orice adresă (nu se poate afla cine are cont).
- Alerta de parolă e un **eveniment** (`cont.parola_schimbata`) cu un consumator de email, ca la moderarea anunțurilor.
- În teste (`NODE_ENV=test`) nu se trimite **niciodată** un email real, chiar dacă `.env` are SMTP (`test/config.test.js`).

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

## Interfața React (`client/`)

Interfața pentru chiriași și proprietari, făcută în React peste API-ul de mai sus (`/api/...`).
Panoul de administrare rămâne în EJS (MVC, randat pe server).

- **Pornire în timpul lucrului:** două ferestre CMD: `npm run dev` (serverul, portul 3000) și `npm run dev` în `client/` (portul 5173).
  Vite trimite cererile `/api` și `/uploads` către server (proxy), deci pentru browser totul vine de la aceeași adresă.
- **Autentificare:** aceeași sesiune ca paginile EJS (cookie httpOnly, pe care JavaScript nu îl poate citi) și tokenul CSRF
  în antetul `x-csrf-token`, gestionat de `client/src/api/client.js` (singurul loc care vorbește cu serverul).
- **Contul:** „Ai uitat parola?”, resetarea și confirmarea din email, **Contul meu** (`/cont`: date, parolă, email);
  paginile deschise din linkurile din emailuri (`/confirmare/:token`, `/resetare/:token`, `/cont/email/confirmare/:token`)
  trimit tokenul o singură dată (React, în timpul lucrului, pornește efectele de două ori).
- **Pagini:** Acasă (căutare rapidă și anunțurile noi), Intră în cont / Creează cont
  (un card care se întoarce; crearea contului în 2 pași), 404.
- **Căutarea** (`/cautare`): filtre (cuvinte, oraș, tip, preț, camere, câte persoane), sortare și pagini; totul stă
  în adresă (`/cautare?oras=Suceava&camere_min=2&pagina=2`). Pe ecran îngust, filtrele se deschid într-o fereastră.
- **Pagina anunțului** (`/anunturi/:id`): galerie (poza mărită, cu săgeți), detaliile locuinței, cât plătește fiecare
  persoană, telefonul proprietarului (doar pentru chiriași conectați, cu limita de contactări din plan) și favorite.
- **Zona proprietarului** (`/proprietar`, doar pentru proprietari): **Anunțurile mele** (listă cu limita din plan, adăugare,
  modificare, poze trase cu mouse-ul, publicare / retragere, ștergere cu confirmare) și **Proprietățile mele** (listă,
  adăugare, modificare, dezactivare / activare). Fiecare acțiune e o cerere către API-ul `/api/proprietar/...` (CRUD prin API).
- **Abonamentul meu** (`/proprietar/abonament`): planul curent, cât a folosit din limite, planurile pentru proprietari
  (lunar / anual), istoricul și renunțarea la o schimbare programată. „Alege” duce la pagina de confirmare
  (`/proprietar/abonament/schimba?plan=…&perioada=…`): prețul, creditul și datele le calculează **serverul**;
  la plată se trimit doar planul și perioada (plată simulată, fără date de card).
- **Design:** sistem propriu în CSS3 (`client/src/stiluri/tema.css`): culorile, fonturile și formele sunt variabile;
  se adaptează după lățimea și înălțimea ferestrei; respectă setarea "reduce animațiile" a sistemului.
  Fonturile (Inter, Playfair Display) sunt în proiect, nu se încarcă de pe internet.

## Structura

| Folder | Ce conține |
|---|---|
| `models/` | ViewModel-urile (validare, transformări pentru pagini); `models/api/` - DTO-urile pentru API |
| `controllers/` | logica fiecărei pagini; `controllers/api/` - controllerele API |
| `routes/` | adresele aplicației (`/admin/...` protejat, `/api/...` JSON) |
| `views/` | paginile EJS (`views/admin/...` pentru administrator) |
| `src/NivelAccesDate/` | accesorii: singurul loc care vorbește cu baza de date |
| `middleware/` | autentificare, roluri, CSRF, încărcarea imaginilor, cheia API |
| `servicii/` | nivelul de servicii (logica de business): câte un serviciu pe zonă (ex. `anunturiAdmin`, `abonamentProprietar`), plus parole (scrypt), emailuri, tokenuri, limite, filtre, jurnal, cache, evenimente; `servicii/consumatori/` - cine reacționează la evenimente |
| `infrastructura/` | containerul de Dependency Injection (`container.js`) și abonarea consumatorilor la evenimente (`consumatori.js`) |
| `utils/` | ajutoare pentru controllere (mesaje flash, întoarcerea la lista filtrată) |
| `config/` | setările citite din `.env` |
| `prisma/` | schema și migrările (Code First) |
| `scripts/` | unelte: setarea parolei, backup |
| `test/` | teste automate (`node --test`); `test/integrare/` - testele API-ului cu baza de date |
| `docs/` | colecția Postman |
| `client/` | interfața React: `src/pagini/`, `src/componente/`, `src/api/` (clientul API), `src/sesiune/`, `src/stiluri/` |

## Arhitectura: servicii, Dependency Injection, cache, evenimente

```
cerere HTTP → rută → controller (fabrică) → serviciu (logica) → accesor (Prisma) → PostgreSQL
                          ↑ toate primesc dependențele prin constructor, de la containerul DI
```

- **Nivelul de servicii** (`servicii/`): toată logica de business (regulile planurilor, moderarea, schimbarea abonamentului,
  conturile). Controllerele doar citesc cererea, cheamă serviciul și aleg răspunsul (pagină EJS sau JSON). Aceleași
  servicii sunt folosite și de paginile EJS, și de API (React).
- **Dependency Injection** cu **Awilix** (`infrastructura/container.js`): nicio clasă nu-și mai creează singură
  dependențele (fără `new XAccessor()`); le primește prin constructor, după nume. Fiecare cerere HTTP are propriul
  „scope” (`req.container`). Duratele de viață (verificate în `test/durateViata.test.js`):

  | Durata | Ce | De ce |
  |---|---|---|
  | **Singleton** (o dată pentru toată aplicația) | contextul Prisma, cache-ul, magistrala de evenimente | Prisma ține un „pool” de conexiuni; cache-ul și abonările trebuie să supraviețuiască între cereri |
  | **Scoped** (o dată pe cerere) | accesorii și serviciile | toți cei care lucrează la aceeași cerere împart aceleași obiecte; nu se păstrează nimic între cereri |
  | **Transient** (de fiecare dată) | controllerele | construite din nou la fiecare cerere, ca în ASP.NET Core |

  Containerul e în modul `strict`: refuză un Singleton care ar depinde de un obiect Scoped (ar ține minte o cerere pentru totdeauna).
- **Cache** (`servicii/cache.js`, Singleton): planurile proprietarului se citesc din baza de date cel mult o dată la
  10 minute; când adminul schimbă un plan, cache-ul se golește imediat. Cache-ul e în memoria procesului.
- **Evenimente** (`servicii/evenimente.js`, pe `EventEmitter` din Node.js): când adminul aprobă sau respinge un anunț,
  serviciul **publică** `anunt.aprobat` / `anunt.respins`, fără să știe cine ascultă. Doi **consumatori independenți**
  (`servicii/consumatori/`): emailul către proprietar și jurnalul adminului. Dacă unul eșuează (ex. serverul de email),
  celălalt rulează oricum, iar aprobarea rămâne valabilă. Un consumator nou se adaugă doar în `infrastructura/consumatori.js`.

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
