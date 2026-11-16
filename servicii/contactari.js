// Contactarea unui proprietar de catre un chirias = dezvaluirea telefonului din anunt.
// Functii pure, testate in test/contactari.test.js. Limita vine din planul chiriasului (max_contactari_luna).
//
// Regula: prima dezvaluire a telefonului unui anunt intr-o luna consuma o contactare; acelasi anunt, din nou
// in aceeasi luna, NU mai consuma (chiriasul nu pierde contactari daca reincarca pagina sau revine la anunt).
const limite = require('./limite');

// Luna de numarare incepe in prima zi a lunii (in Romania): folosim D.inceputLuna din servicii/date.js,
// aceeasi functie ca la incasarile lunii din panou.
// Decide ce se intampla cand chiriasul cere telefonul.
//   dejaContactat: a mai cerut telefonul ACESTUI anunt luna asta
//   folosite: cate anunturi diferite a contactat luna asta
//   maxim: limita din plan (null = nelimitat, 0 = fara abonament / plan fara contactari)
// Intoarce { permis, consuma, ramase } (ramase = null daca e nelimitat).
function decide({ dejaContactat, folosite, maxim }) {
  const ramaseDupa = (n) => (maxim === null ? null : Math.max(0, maxim - n));
  if (dejaContactat) return { permis: true, consuma: false, ramase: ramaseDupa(folosite) };
  if (!limite.maiPoate(folosite, maxim)) return { permis: false, consuma: false, ramase: 0 };
  return { permis: true, consuma: true, ramase: ramaseDupa(folosite + 1) };
}

module.exports = { decide };
