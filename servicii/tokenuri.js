// Tokenurile din linkurile trimise pe email: aleatoare (32 de octeti), folosibile o singura data si cu termen.
// In baza de date pastram doar amprenta SHA-256; tokenul propriu-zis exista doar in email.
// Accesorul vine prin constructor, de la containerul DI (laboratorul 10).
const crypto = require('crypto');

const VALABILITATE_MINUTE = {
  confirmare_email: 24 * 60,
  resetare_parola: 60,
  schimbare_email: 24 * 60,
};

const amprenta = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Un token arata ca o insiruire de litere, cifre, "-" si "_" (43 de caractere).
const formaValida = (token) => /^[A-Za-z0-9_-]{43}$/.test(String(token));

class Tokenuri {
  constructor({ tokenAccessor }) {
    this.tokenuri = tokenAccessor;
  }

  // Creeaza un token si intoarce textul lui (de pus in link).
  async creeaza(utilizatorId, tip, emailNou = null) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiraLa = new Date(Date.now() + VALABILITATE_MINUTE[tip] * 60 * 1000);
    await this.tokenuri.creeaza({ utilizatorId, tip, hash: amprenta(token), expiraLa, emailNou });
    return token;
  }

  // Gaseste tokenul valid (fara sa-l consume) - pentru afisarea formularului de resetare.
  async verifica(token, tip) {
    if (!formaValida(token)) return null;
    return this.tokenuri.getValid(amprenta(token), tip);
  }

  // Gaseste si CONSUMA tokenul (merge o singura data). Intoarce inregistrarea sau null.
  async foloseste(token, tip) {
    const t = await this.verifica(token, tip);
    if (!t) return null;
    return (await this.tokenuri.marcheazaFolosit(t.id)) ? t : null;
  }
}

module.exports = Tokenuri;
// Functiile pure (fara baza de date) raman disponibile direct, pentru teste si pentru cine are nevoie de ele.
module.exports.amprenta = amprenta;
module.exports.formaValida = formaValida;
module.exports.VALABILITATE_MINUTE = VALABILITATE_MINUTE;
