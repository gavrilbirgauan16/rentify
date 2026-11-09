// Rentify - aplicatia web MVC (Express + EJS + Bootstrap), peste baza rentify_cf creata prin Code First.
const config = require('./config'); // citeste si verifica .env (se opreste daca lipseste ceva)
const express = require('express');
const session = require('express-session');
const PgSesiuni = require('connect-pg-simple')(session);
const helmet = require('helmet');
const path = require('path');
const context = require('./src/Repository_CodeFirst/context');
const { incarcaUtilizator } = require('./middleware/autentificare');
const { pregatesteToken, verificaToken } = require('./middleware/csrf');
const autentificareRouter = require('./routes/autentificare');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const app = express();

// Configurare
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (config.esteProductie) app.set('trust proxy', 1); // pe server, in spatele unui proxy HTTPS

// Headere de securitate pentru browser (anti-clickjacking, Content-Security-Policy etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // Pe calculatorul tau (http) nu fortam https, altfel CSS-ul nu s-ar mai incarca de pe telefon.
      upgradeInsecureRequests: config.esteProductie ? [] : null,
    },
  },
  strictTransportSecurity: config.esteProductie,
}));
// API-ul (JSON, laboratorul 7): inaintea sesiunilor si a CSRF, pentru ca nu foloseste cookie-uri.
app.use('/api', apiRouter);
app.use(express.urlencoded({ extended: false })); // citeste datele trimise de formulare

// Fisiere statice: CSS-ul nostru, Bootstrap (instalat cu npm, merge si fara internet) si imaginile incarcate
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sesiuni: tin minte cine e conectat. Se salveaza in PostgreSQL (tabelul "sesiune"),
// deci raman valabile si dupa repornirea aplicatiei.
app.use(session({
  name: 'rentify.sid',
  store: new PgSesiuni({ conString: config.databaseUrl, tableName: 'sesiune' }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                // JavaScript-ul din pagina nu poate citi cookie-ul
    sameSite: 'lax',               // cookie-ul nu pleaca la formulare trimise de pe alte site-uri
    secure: config.esteProductie,  // pe server: doar prin HTTPS
    maxAge: config.durataSesiuneOre * 60 * 60 * 1000,
  },
}));

// Mesaj "flash": se afiseaza o singura data, pe pagina urmatoare, apoi dispare.
// tipMesaj = culoarea Bootstrap: success (verde, implicit) sau warning (galben).
app.use((req, res, next) => {
  res.locals.mesaj = req.session.mesaj || null;
  res.locals.tipMesaj = req.session.tipMesaj || 'success';
  delete req.session.mesaj;
  delete req.session.tipMesaj;
  next();
});

// Utilizatorul conectat (sau null), disponibil in toate paginile ca "utilizator"
app.use(incarcaUtilizator);

// Protectie CSRF: token pentru formulare + verificarea lui la fiecare trimitere (POST)
app.use(pregatesteToken);
app.use(verificaToken);

// Rute
app.get('/', (req, res) => {
  if (res.locals.utilizator && res.locals.utilizator.rol === 'admin') return res.redirect('/admin');
  res.render('acasa');
});
app.use(autentificareRouter);    // /autentificare, /iesire
app.use('/admin', adminRouter);  // tot ce e de admin (protejat)

// 404 - nicio ruta nu s-a potrivit
app.use((req, res) => {
  res.status(404).render('eroare', { titlu: 'Pagina nu există', mesaj_eroare: 'Adresa accesată nu există.' });
});

// 500 - eroare neprevazuta: detaliile raman in consola, utilizatorul vede un mesaj simplu
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render('eroare', { titlu: 'A apărut o eroare', mesaj_eroare: 'Încearcă din nou mai târziu.' });
});

const server = app.listen(config.port, () => console.log(`Rentify ruleaza la http://localhost:${config.port}`));

// La oprire (Ctrl+C sau oprire de catre server) se inchide si conexiunea la baza de date.
async function opreste() {
  server.close(async () => {
    await context.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', opreste);
process.on('SIGTERM', opreste);