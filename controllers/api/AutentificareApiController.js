// Autentificarea prin API (pentru interfata React): conectare, iesire, "cine sunt eu".
// Aceleasi reguli ca pagina de login (servicii/autentificare.js); sesiunea e aceeasi (cookie httpOnly).
const { asiguraToken } = require('../../middleware/csrf');

// Ce afla interfata despre utilizatorul conectat (fara parola, fara date in plus).
const catreDto = (u) => ({
  id: u.id,
  prenume: u.prenume,
  nume: u.nume,
  email: u.email,
  rol: u.rol?.nume ?? u.rol,
  schimba_parola: Boolean(u.schimba_parola ?? u.schimbaParola), // parola temporara: interfata il trimite intai la schimbarea ei
});

// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - la fiecare cerere, containerul o apeleaza
// cu serviciul de care are nevoie (primit prin parametru, nu creat aici) si primeste inapoi actiunile.
module.exports = function AutentificareApiController({ autentificare: autentificare }) {
  // POST /api/auth/login  { email, parola }
  // Raspunde cu utilizatorul si cu un token CSRF NOU (sesiunea s-a schimbat, cel vechi nu mai e valabil).
  async function login(req, res) {
    const { u, eroare, cod, neconfirmat } = await autentificare.verificaConectarea(req.body?.email, req.body?.parola);
    if (eroare) return res.status(cod).json({ eroare, ...(neconfirmat ? { neconfirmat: true } : {}) });
    await autentificare.deschideSesiunea(req, u.id);
    res.json({ utilizator: catreDto(u), csrfToken: asiguraToken(req) });
  }

  // POST /api/auth/logout - inchide sesiunea; interfata cere apoi un token CSRF nou
  function logout(req, res) {
    req.session.destroy(() => {
      res.clearCookie('rentify.sid');
      res.status(204).end(); // 204 = reusit, fara continut
    });
  }

  // GET /api/auth/eu - utilizatorul conectat sau 401 (interfata afla la pornire daca e cineva conectat)
  function eu(req, res) {
    const u = res.locals.utilizator;
    if (!u) return res.status(401).json({ eroare: 'Nu ești conectat.' });
    res.json({ utilizator: catreDto({ ...u, nume: u.numeFamilie }) });
  }

  return { login, logout, eu };
};
