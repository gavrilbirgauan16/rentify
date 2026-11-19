// API-ul pentru conturi (interfata React): inregistrare, confirmarea emailului, parola uitata, resetare.
// Aceleasi reguli ca paginile (servicii/conturi.js + validarea din ContViewModel).
// Raspunsurile publice NU spun daca o adresa are cont: aceeasi structura si acelasi mesaj, oricare ar fi adresa.
const ContViewModel = require('../../models/ContViewModel');
const conturi = require('../../servicii/conturi');

// 202 Accepted = "am primit cererea" (rezultatul vine pe email, nu in raspuns).
const MESAJ_INREGISTRARE = 'Dacă datele sunt corecte, ai primit un email cu linkul de confirmare. Verifică și folderul Spam.';
const MESAJ_RETRIMITERE = 'Dacă există un cont neconfirmat cu această adresă, am trimis un link nou de confirmare.';
const MESAJ_PAROLA_UITATA = 'Dacă există un cont cu această adresă, am trimis un link pentru alegerea unei parole noi (valabil o oră).';
const LINK_INVALID = 'Linkul a expirat, a fost deja folosit sau a fost înlocuit de unul mai nou. Cere un link nou.';

const corp = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// Linkurile cu token nu se pastreaza in cache (nici raspunsurile lor).
const faraCache = (res) => res.set('Cache-Control', 'no-store');

// POST /api/auth/inregistrare
// { rol: "chirias"|"proprietar", prenume, nume, email, telefon, oras, parola, confirmare, termeni: true }
async function inregistrare(req, res) {
  if (res.locals.utilizator) return res.status(409).json({ eroare: 'Ești deja conectat.' });
  const b = corp(req);
  // In JSON bifa vine ca true / false; validarea (aceeasi ca la formular) asteapta "on".
  const model = ContViewModel.dinInregistrare({ ...b, termeni: b.termeni === true ? 'on' : '' });
  const erori = model.valideazaInregistrare();
  if (Object.keys(erori).length > 0) return res.status(400).json({ eroare: 'Date invalide.', erori });
  await conturi.inregistreaza(model);
  res.status(202).json({ mesaj: MESAJ_INREGISTRARE });
}

// POST /api/auth/confirmare  { token }  - pagina deschisa din linkul din email trimite tokenul aici
async function confirmare(req, res) {
  faraCache(res);
  if (!(await conturi.confirmaEmailul(String(corp(req).token || '')))) return res.status(400).json({ eroare: LINK_INVALID });
  res.json({ mesaj: 'Adresa de email a fost confirmată. Acum te poți conecta.' });
}

// POST /api/auth/confirmare/retrimite  { email }
async function retrimiteConfirmarea(req, res) {
  await conturi.retrimiteConfirmarea(corp(req).email);
  res.status(202).json({ mesaj: MESAJ_RETRIMITERE });
}

// POST /api/auth/parola-uitata  { email }
async function parolaUitata(req, res) {
  await conturi.cereResetarea(corp(req).email);
  res.status(202).json({ mesaj: MESAJ_PAROLA_UITATA });
}

// GET /api/auth/resetare/:token - linkul mai e valabil? (React arata formularul sau "link expirat"). Nu consuma linkul.
async function verificaResetarea(req, res) {
  faraCache(res);
  const email = await conturi.emailDinLinkResetare(req.params.token);
  if (!email) return res.status(400).json({ eroare: LINK_INVALID });
  res.json({ email });
}

// POST /api/auth/resetare  { token, parola_noua, confirmare }
// Dupa schimbare, toate sesiunile contului sunt inchise (inclusiv cea din acest browser, daca era conectat).
async function resetare(req, res) {
  faraCache(res);
  const b = corp(req);
  const r = await conturi.reseteazaParola(String(b.token || ''), b.parola_noua, b.confirmare);
  if (r.linkInvalid) return res.status(400).json({ eroare: LINK_INVALID });
  if (r.erori) return res.status(400).json({ eroare: 'Date invalide.', erori: r.erori });
  if (req.session.utilizatorId === r.utilizatorId) delete req.session.utilizatorId;
  res.json({ mesaj: 'Parola a fost schimbată. Conectează-te cu parola nouă.' });
}

module.exports = { inregistrare, confirmare, retrimiteConfirmarea, parolaUitata, verificaResetarea, resetare };
