// Parola noua, din linkul primit pe email (/resetare/:token).
//   1. GET  /api/auth/resetare/:token - linkul mai e valabil? (NU il consuma: poti reincarca pagina linistit)
//   2. POST /api/auth/resetare        - parola noua; linkul se foloseste o singura data
// Dupa schimbare, serverul inchide TOATE sesiunile contului (cine era conectat cu parola veche e scos afara)
// si trimite un email de alerta "Parola ta a fost schimbata".
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { useSesiune } from '../../sesiune/sesiune.js';
import CardSimplu from '../../componente/CardSimplu.jsx';
import { CampParola } from '../../componente/Camp.jsx';

export default function ResetareParola() {
  const { token } = useParams();
  const navigheaza = useNavigate();
  const { reimprospateaza } = useSesiune();
  const link = useApi(`/auth/resetare/${encodeURIComponent(token)}`);
  const [parola, setParola] = useState('');
  const [confirmare, setConfirmare] = useState('');
  const [erori, setErori] = useState({});
  const [eroare, setEroare] = useState(null);
  const [seTrimite, setSeTrimite] = useState(false);

  async function trimite(e) {
    e.preventDefault();
    setEroare(null);
    setSeTrimite(true);
    try {
      const { date } = await api.post('/auth/resetare', { token, parola_noua: parola, confirmare });
      setParola('');
      setConfirmare('');
      await reimprospateaza(); // daca era conectat in acest browser, serverul tocmai l-a deconectat
      navigheaza('/intrare', { replace: true, state: { mesaj: date.mesaj } });
    } catch (err) {
      setErori(err.erori);
      if (Object.keys(err.erori).length === 0) setEroare(err); // ex. linkul a expirat intre timp
      setSeTrimite(false);
    }
  }

  const schimba = (seteaza, camp) => (e) => {
    seteaza(e.target.value);
    setErori((er) => ({ ...er, [camp]: undefined }));
  };

  if (link.eroare) {
    return (
      <CardSimplu iconita="⏳" titlu="Linkul nu mai e valabil">
        <p className="nota" role="alert">{link.eroare.message}</p>
        <Link className="buton buton-principal buton-lat" to="/parola-uitata">Cere un link nou</Link>
      </CardSimplu>
    );
  }
  if (!link.date) return <div className="pagina-simpla"><div className="card-schelet card-simplu" /></div>;

  return (
    <CardSimplu titlu="Alege o parolă nouă" subtitlu={<>Pentru contul <strong>{link.date.email}</strong>.</>}>
      <form className="formular-simplu" onSubmit={trimite}>
        {eroare && <div className="alerta alerta-eroare" role="alert">{eroare.message} <Link to="/parola-uitata">Cere un link nou</Link></div>}
        {/* emailul ascuns ajuta managerul de parole al browserului sa salveze parola noua la contul potrivit */}
        <input type="email" autoComplete="username" value={link.date.email} readOnly hidden />
        <CampParola eticheta="Parola nouă" autoComplete="new-password" required minLength={8} autoFocus value={parola}
          onChange={schimba(setParola, 'parola_noua')} eroare={erori.parola_noua} placeholder="Parolă nouă (min. 8 caractere)" />
        <CampParola eticheta="Repetă parola nouă" autoComplete="new-password" required value={confirmare}
          onChange={schimba(setConfirmare, 'confirmare')} eroare={erori.confirmare} placeholder="Repetă parola" />
        <button className="buton buton-principal buton-lat" type="submit" disabled={seTrimite}>
          {seTrimite ? 'Se salvează…' : 'Salvează parola nouă'}
        </button>
      </form>
      <p className="nota">După schimbare vei fi deconectat de pe toate dispozitivele și primești un email de confirmare.</p>
    </CardSimplu>
  );
}
