// Formularul de abonament nou: dupa ce alegi utilizatorul, lista de planuri arata doar planurile pentru rolul lui
// (proprietar sau chirias), iar campul "metoda" apare doar cand bifezi "a platit acum".
// Fara JavaScript formularul merge la fel: serverul verifica oricum aceleasi reguli.
(function () {
  const utilizator = document.getElementById('utilizator_id');
  const plan = document.getElementById('plan_id');
  const plataAcum = document.getElementById('plata_acum');
  const blocMetoda = document.getElementById('bloc_metoda');
  if (!utilizator || !plan) return;

  function filtreazaPlanuri() {
    const rol = utilizator.selectedOptions[0]?.dataset.rol || '';
    plan.querySelectorAll('optgroup').forEach(function (grup) {
      const potrivit = !rol || grup.dataset.rol === rol;
      grup.hidden = !potrivit;
      grup.disabled = !potrivit;
    });
    const ales = plan.selectedOptions[0];
    if (ales && ales.parentElement.disabled) plan.value = '';
  }

  function arataMetoda() {
    if (blocMetoda && plataAcum) blocMetoda.hidden = !plataAcum.checked;
  }

  utilizator.addEventListener('change', filtreazaPlanuri);
  if (plataAcum) plataAcum.addEventListener('change', arataMetoda);
  filtreazaPlanuri();
  arataMetoda();
})();