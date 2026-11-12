// Formularul de inregistrare: telefonul e obligatoriu doar pentru proprietari (afisam "(opțional)" doar la chiriasi).
// Doar ajutor vizual; regula reala o verifica serverul.
document.querySelectorAll('input[name="rol"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.getElementById('tel_optional').textContent = radio.value === 'proprietar' ? '' : '(opțional)';
  });
});
