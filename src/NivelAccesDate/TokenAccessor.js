// Metode de acces la date pentru tokenurile din linkurile trimise pe email (tabelul token_cont).
const context = require('../Repository_CodeFirst/context');

class TokenAccessor {
  // Token nou. Tokenurile nefolosite de acelasi tip ale utilizatorului se anuleaza:
  // merge doar ultimul link trimis (ex. daca cere de doua ori resetarea parolei).
  async creeaza({ utilizatorId, tip, hash, expiraLa, emailNou = null }) {
    return context.$transaction([
      context.token_cont.updateMany({ where: { utilizator_id: utilizatorId, tip, folosit_la: null }, data: { folosit_la: new Date() } }),
      context.token_cont.create({ data: { utilizator_id: utilizatorId, tip, hash_token: hash, expira_la: expiraLa, email_nou: emailNou } }),
    ]);
  }

  // Tokenul valid (nefolosit, neexpirat) cu amprenta data, cu utilizatorul lui. Null daca nu exista.
  async getValid(hash, tip) {
    return context.token_cont.findFirst({
      where: { hash_token: hash, tip, folosit_la: null, expira_la: { gt: new Date() } },
      include: { utilizator: { select: { id: true, email: true, nume: true, prenume: true, stare: true, rol: { select: { nume: true } } } } },
    });
  }

  // Marcheaza tokenul ca folosit. Intoarce true doar pentru prima folosire (doua clicuri simultane nu trec amandoua).
  async marcheazaFolosit(id) {
    const r = await context.token_cont.updateMany({ where: { id, folosit_la: null }, data: { folosit_la: new Date() } });
    return r.count === 1;
  }
}

module.exports = TokenAccessor;
