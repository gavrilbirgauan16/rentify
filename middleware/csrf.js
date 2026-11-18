// Protectie CSRF (Cross-Site Request Forgery).
// Problema: daca adminul e conectat si deschide un site rau, acel site poate trimite in ascuns un formular
// catre aplicatia noastra (ex. "dezactiveaza proprietatea 3"), iar browserul ataseaza singur cookie-ul de sesiune.
// Solutia: fiecare sesiune primeste un cod secret (token). Fiecare formular al nostru il trimite intr-un camp ascuns,
// iar serverul accepta un POST doar daca acel cod se potriveste. Un site strain nu are cum sa-l stie.
const crypto = require('crypto');

const METODE_SIGURE = ['GET', 'HEAD', 'OPTIONS'];

// Creeaza (o singura data pe sesiune) tokenul si il pune la dispozitia paginilor ca "csrfToken".
function pregatesteToken(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// Tokenul sesiunii, creat daca nu exista inca (pentru API: React il cere o data, la pornire).
function asiguraToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

// true daca tokenul trimis e cel din sesiune (comparatie in timp constant).
// Formularele HTML il trimit in campul ascuns "_csrf"; React (API) il trimite in antetul "x-csrf-token".
function tokenValid(req) {
  const trimis = Buffer.from(String((req.body && req.body._csrf) || req.get('x-csrf-token') || ''));
  const asteptat = Buffer.from(String(req.session.csrfToken || ''));
  return trimis.length > 0 && trimis.length === asteptat.length && crypto.timingSafeEqual(trimis, asteptat);
}

// Pagina afisata cand tokenul lipseste sau e gresit (ex. formular vechi, deschis inainte de o reconectare).
function refuza(res) {
  return res.status(403).render('eroare', {
    titlu: 'Formular expirat',
    mesaj_eroare: 'Formularul nu mai este valid. Întoarce-te, reîncarcă pagina și încearcă din nou.',
  });
}

// Verificarea pentru formularele obisnuite. Formularele cu fisiere (multipart) sunt citite abia de multer,
// asa ca pe acelea le verifica middleware-ul de incarcare a imaginilor, dupa ce le citeste.
function verificaToken(req, res, next) {
  if (METODE_SIGURE.includes(req.method)) return next();
  if (req.is('multipart/form-data')) return next();
  if (!tokenValid(req)) return refuza(res);
  next();
}

// Varianta pentru API (raspunde cu JSON, nu cu pagina). Atacul CSRF are nevoie de cookie-ul de sesiune
// (browserul il trimite singur), deci regula se aplica doar cererilor care il au:
//  - cererile cu antetul x-api-key sunt de la programe (Postman, alte aplicatii) -> trec; cheia o verifica cereCheie;
//  - cererile FARA cookie de sesiune nu au un cont conectat de "furat" -> trec; autentificarea le opreste mai departe
//    (ex. 401 "cheie lipsa"), cu mesajul potrivit - ca la laboratorul 7;
//  - cererile din browser, CU cookie de sesiune (React), trebuie sa aiba antetul x-csrf-token.
const areCookieDeSesiune = (req) => /(^|;\s*)rentify\.sid=/.test(req.get('cookie') || '');

function verificaTokenApi(req, res, next) {
  if (METODE_SIGURE.includes(req.method) || req.get('x-api-key') || !areCookieDeSesiune(req)) return next();
  if (!req.session || !tokenValid(req)) {
    return res.status(403).json({
      eroare: 'Cerere respinsă: din browser trimite tokenul CSRF în antetul x-csrf-token (îl primești de la GET /api/auth/csrf); '
        + 'dintr-un program trimite cheia API în antetul x-api-key.',
    });
  }
  next();
}

module.exports = { pregatesteToken, verificaToken, tokenValid, refuza, asiguraToken, verificaTokenApi };