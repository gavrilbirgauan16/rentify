// Autentificarea prin API (pentru interfata React): conectare, iesire, "cine sunt eu".
// Aceleasi reguli ca pagina de login (servicii/autentificare.js); sesiunea e aceeasi (cookie httpOnly).
const { verificaConectarea, deschideSesiunea } = require('../../servicii/autentificare');
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

// POST /api/auth/login  { email, parola }
// Raspunde cu utilizatorul si cu un token CSRF NOU (sesiunea s-a schimbat, cel vechi nu mai e valabil).
async function login(req, res) {
  const { u, eroare, cod, neconfirmat } = await verificaConectarea(req.body?.email, req.body?.parola);
  if (eroare) return res.status(cod).json({ eroare, ...(neconfirmat ? { neconfirmat: true } : {}) });
  await deschideSesiunea(req, u.id);
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

module.exports = { login, logout, eu };
