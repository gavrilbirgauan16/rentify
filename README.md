# Rentify

![Teste](https://github.com/gavrilbirgauan16/rentify/actions/workflows/ci.yml/badge.svg)

Platformă web pentru închirieri, cu roluri (admin, proprietar, chiriaș) și abonamente.
Proiect PPAW – Bîrgăuan Gavril, grupa 3711a, USV.

**Tehnologii:** Node.js, Express 5, EJS, Bootstrap 5, PostgreSQL, Prisma 7 (Code First).

## Instalare

1. `npm install`
2. Copiază `.env.example` ca `.env` și completează `DATABASE_URL`, `SESSION_SECRET` și `API_KEY`.
3. Creează baza de date din migrări: `npx prisma migrate deploy`, apoi `npx prisma generate`.
4. (Opțional) Date de test: `npx prisma db seed`.
5. Pune parole conturilor de test: `npm run seteaza-parola -- admin@rentify.test ParolaTa123`.

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm run dev` | pornește aplicația la http://localhost:3000 și o repornește la fiecare salvare |
| `npm start` | pornește aplicația (fără repornire automată) |
| `npm test` | rulează testele automate |
| `npm run lint` | verifică codul cu ESLint |
| `npm run verifica` | lint + teste (de rulat înainte de commit) |
| `npm run backup` | copie a bazei de date în `backups/` (de făcut înainte de orice migrare) |
| `npm run seteaza-parola -- <email> <parola>` | setează parola unui utilizator |

## Cum lucrez (Git)

- Fiecare funcție nouă se face pe o **ramură** separată (ex. `abonamente`) și intră în `main` printr-un **Pull Request**.
- Commit-uri mici, de cel mult 5 fișiere, cu mesaj clar.
- La fiecare push, GitHub rulează automat lint + teste (vezi insigna de sus).
- Înainte de o migrare: `npm run backup`.

## API (laboratorul 7)

| Metodă | Adresă | Cheie API |
|---|---|---|
| GET | `/api/anunturi` | nu (doar anunțurile active) |
| GET | `/api/anunturi/:id` | nu |
| POST | `/api/anunturi` | da (`x-api-key`) |
| PUT | `/api/anunturi/:id` | da (`x-api-key`) |

Colecția Postman: `docs/Rentify-API.postman_collection.json` (în Postman, la variabila `apiKey`, pune valoarea din `.env` doar la *Current value*).

## Structura

| Folder | Ce conține |
|---|---|
| `models/` | ViewModel-urile (validare, transformări pentru pagini); `models/api/` – DTO-urile pentru API |
| `controllers/` | logica fiecărei pagini; `controllers/api/` – controllerele API |
| `routes/` | adresele aplicației (`/admin/...` protejat, `/api/...` JSON) |
| `views/` | paginile EJS (`views/admin/...` pentru administrator) |
| `src/NivelAccesDate/` | accesorii: singurul loc care vorbește cu baza de date |
| `middleware/` | autentificare, roluri, CSRF, încărcarea imaginilor, cheia API |
| `servicii/` | salvarea parolelor (scrypt) |
| `config/` | setările citite din `.env` |
| `prisma/` | schema și migrările (Code First) |
| `scripts/` | unelte: setarea parolei, backup |
| `test/` | teste automate (`node --test`) |
| `docs/` | colecția Postman |

## Securitate

- Parole salvate doar ca amprentă **scrypt** cu sare; mesaj vag la login greșit; limită de 10 încercări greșite / 15 minute.
- Sesiuni în PostgreSQL, cookie `httpOnly` + `sameSite`, sesiune nouă la conectare.
- Token **CSRF** în toate formularele; headere de securitate cu **helmet**.
- Imaginile sunt verificate după conținut (nu doar după extensie), cu nume aleatoare.
- Toată partea de admin e sub `/admin`, protejată de o singură regulă (conectat + rol `admin`).
- API-ul: Post/Put doar cu cheie (`x-api-key`, comparată în timp constant); DTO-urile nu expun date personale; limită de cereri.
- Secretele stau doar în `.env` (exclus din Git); `.env.example` are doar valori de umplutură.