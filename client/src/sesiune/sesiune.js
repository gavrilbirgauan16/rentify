// Sesiunea in interfata: cine e conectat. Un "context" React = o valoare pe care orice componenta o poate citi
// direct (useSesiune()), fara s-o primeasca din parinte in parinte. O pune la dispozitie SesiuneProvider.
import { createContext, useContext } from 'react';

export const SesiuneContext = createContext(null);

// { verificata, utilizator } - verificata = false cat timp inca intrebam serverul (la pornire);
// utilizator = null daca nu e nimeni conectat, altfel { id, prenume, nume, email, rol, schimba_parola }.
export function useSesiune() {
  const sesiune = useContext(SesiuneContext);
  if (!sesiune) throw new Error('useSesiune se foloseste doar in interiorul <SesiuneProvider>.');
  return sesiune;
}
