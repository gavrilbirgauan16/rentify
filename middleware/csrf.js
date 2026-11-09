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

// true daca tokenul trimis de formular e cel din sesiune (comparatie in timp constant).
function tokenValid(req) {
  const trimis = Buffer.from(String((req.body && req.body._csrf) || ''));
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

module.exports = { pregatesteToken, verificaToken, tokenValid, refuza };