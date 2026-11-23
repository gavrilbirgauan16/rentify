// Consumatorul alertelor de securitate: dupa ce parola unui cont a fost schimbata (din pagina contului sau prin
// linkul de resetare), ii trimite proprietarului contului un email. Daca nu a fost el, afla imediat si isi poate
// reseta parola. Serviciile de cont doar publica evenimentul; nu stiu de email (decuplare).
const Evenimente = require('../evenimente');
const emailuri = require('../emailuri');
const posta = require('../email'); // posta.trimite (nu destructurat: testele il pot inlocui cu unul fals)

module.exports = {
  nume: 'email-alerta-securitate',
  la: {
    [Evenimente.PAROLA_SCHIMBATA]: async ({ utilizator, cum, cand }) => {
      if (!utilizator?.email) return;
      const e = emailuri.parolaSchimbata(utilizator, cum, new Date(cand));
      await posta.trimite({ catre: utilizator.email, subiect: e.subiect, text: e.text, html: e.html });
    },
  },
};
