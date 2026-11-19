// Regulile conectarii, scrise O SINGURA DATA si folosite si de pagina de login (EJS), si de API (React).
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const { hashParola, verificaParola } = require('./parole');

const utilizatori = new UtilizatorAccessor();

// Amprenta unei parole inventate, calculata o singura data. Cand emailul nu exista, verificam parola fata de ea:
// raspunsul dureaza la fel de mult ca la un email existent, deci nu se poate afla dupa timp cine are cont
// (protectie impotriva "timing attack" - atac prin masurarea timpului de raspuns).
let amprentaFalsa = null;
const amprentaPentruComparatie = async () => (amprentaFalsa ??= await hashParola('parola-inventata-pentru-timp-egal'));

// Verifica emailul si parola. Intoarce { u } daca se poate conecta, altfel { eroare, cod, neconfirmat }.
// Acelasi mesaj pentru email inexistent si parola gresita: nu spunem daca emailul are cont.
async function verificaConectarea(emailBrut, parolaBruta) {
  const email = String(emailBrut || '').trim().toLowerCase();
  const parola = String(parolaBruta || '');
  const u = email && parola ? await utilizatori.getByEmail(email) : null;
  const parolaBuna = await verificaParola(parola, u ? u.parola_hash : await amprentaPentruComparatie());
  if (!u || !parolaBuna) return { eroare: 'Email sau parolă greșită.', cod: 401 };
  if (u.stare === 'blocat') return { eroare: 'Contul tău este blocat. Contactează administratorul.', cod: 403 };
  // Fara email confirmat nu intra (parola era corecta, deci putem spune de ce).
  if (!u.email_verificat) {
    return { eroare: 'Nu ți-ai confirmat încă adresa de email. Caută emailul de la Rentify (verifică și Spam) sau cere un link nou.', cod: 403, neconfirmat: true };
  }
  return { u };
}

// Deschide sesiunea pentru utilizator: sesiune NOUA (protectie impotriva furtului de sesiune, "session fixation"),
// apoi salvata in baza de date inainte de raspuns. pastreaza = campuri din sesiunea veche de pastrat (ex. adresa dorita).
async function deschideSesiunea(req, utilizatorId, pastreaza = {}) {
  await new Promise((gata, esec) => req.session.regenerate((e) => (e ? esec(e) : gata())));
  Object.assign(req.session, pastreaza, { utilizatorId });
  await new Promise((gata, esec) => req.session.save((e) => (e ? esec(e) : gata())));
  await utilizatori.inregistreazaAutentificare(utilizatorId);
}

module.exports = { verificaConectarea, deschideSesiunea };
