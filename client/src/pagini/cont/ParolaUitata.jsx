// "Ai uitat parola?" (/parola-uitata): scrii emailul, primesti pe email un link pentru o parola noua (valabil o ora).
// POST /api/auth/parola-uitata. Raspunsul e ACELASI oricare ar fi adresa: nu aflam (si nu afla nimeni)
// daca un email are cont - altfel formularul ar putea fi folosit ca sa ghicesti cine e client Rentify.
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../../api/client.js';
import CardSimplu from '../../componente/CardSimplu.jsx';
import { Camp } from '../../componente/Camp.jsx';

export default function ParolaUitata() {
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email ?? ''); // emailul scris deja la "Intra in cont", daca exista
  const [trimis, setTrimis] = useState(null); // mesajul serverului, dupa trimitere
  const [eroare, setEroare] = useState(null);
  const [seTrimite, setSeTrimite] = useState(false);

  async function trimite(e) {
    e.preventDefault();
    setEroare(null);
    setSeTrimite(true);
    try {
      const { date } = await api.post('/auth/parola-uitata', { email: email.trim() });
      setTrimis(date.mesaj);
    } catch (err) {
      setEroare(err); // ex. prea multe cereri intr-un timp scurt (429)
    } finally {
      setSeTrimite(false);
    }
  }

  if (trimis) {
    return (
      <CardSimplu iconita="✉️" titlu="Verifică-ți emailul">
        <p className="nota" role="status">{trimis}</p>
        <p className="nota">Nu a venit în câteva minute? Verifică folderul Spam sau încearcă din nou.</p>
        <button className="buton buton-moale buton-lat" type="button" onClick={() => setTrimis(null)}>Trimite din nou</button>
        <p className="schimba"><Link to="/intrare">← Înapoi la intrarea în cont</Link></p>
      </CardSimplu>
    );
  }

  return (
    <CardSimplu titlu="Ai uitat parola?" subtitlu="Scrie emailul contului și îți trimitem un link pentru o parolă nouă.">
      <form className="formular-simplu" onSubmit={trimite}>
        {eroare && <div className="alerta alerta-eroare" role="alert">{eroare.message}</div>}
        <Camp eticheta="Email" type="email" autoComplete="email" required autoFocus value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="Email (nume@exemplu.ro)" />
        <button className="buton buton-principal buton-lat" type="submit" disabled={seTrimite}>
          {seTrimite ? 'Se trimite…' : 'Trimite linkul'}
        </button>
      </form>
      <p className="schimba">Ți-ai amintit? <Link to="/intrare">Intră în cont</Link></p>
    </CardSimplu>
  );
}
