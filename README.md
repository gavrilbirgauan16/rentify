\# Rentify



Platformă web pentru managementul chiriilor (proiect PPAW, Bîrgăuan Gavril, grupa 3711a, USV).



\*\*Tehnologii:\*\* Node.js, Express 5, EJS, Bootstrap 5, PostgreSQL, Prisma 7 (Code First).



\## Instalare



1\. `npm install`

2\. Copiază `.env.example` ca `.env` și completează `DATABASE\_URL` și `SESSION\_SECRET`.

3\. Creează baza de date din migrări: `npx prisma migrate deploy`, apoi `npx prisma generate`.

4\. (Opțional) Date de test: `npx prisma db seed`.

5\. Pune parole conturilor de test: `npm run seteaza-parola -- admin@rentify.test ParolaTa123`.



\## Comenzi



| Comandă | Ce face |

|---|---|

| `npm start` | pornește aplicația la http://localhost:3000 |

| `npm run dev` | pornește și repornește singură la fiecare salvare de fișier |

| `npm test` | rulează testele automate |

| `npm run seteaza-parola -- <email> <parola>` | setează parola unui utilizator |



\## Structura



| Folder | Ce conține |

|---|---|

| `models/` | ViewModel-urile (validare, transformări pentru pagini) |

| `controllers/` | logica fiecărei pagini |

| `routes/` | adresele aplicației (`/admin/...` e protejat) |

| `views/` | paginile EJS (`views/admin/...` pentru administrator) |

| `src/NivelAccesDate/` | accesorii: singurul loc care vorbește cu baza de date |

| `middleware/` | autentificare, roluri, CSRF, încărcarea imaginilor |

| `servicii/` | salvarea parolelor (scrypt) |

| `config/` | setările citite din `.env` |

| `prisma/` | schema și migrările (Code First) |

| `test/` | teste automate (`node --test`) |



\## Securitate



\- Parole salvate doar ca amprentă \*\*scrypt\*\* cu sare; mesaj vag la login greșit; limită de 10 încercări greșite / 15 minute.

\- Sesiuni în PostgreSQL, cookie `httpOnly` + `sameSite`, sesiune nouă la conectare.

\- Token \*\*CSRF\*\* în toate formularele; headere de securitate cu \*\*helmet\*\*.

\- Imaginile sunt verificate după conținut (nu doar după extensie), cu nume aleatoare.

\- Toată partea de admin e sub `/admin`, protejată de o singură regulă (conectat + rol `admin`).

