// Ecranul cu logo-ul, la pornirea aplicatiei (cat timp verificam sesiunea). Cand vizibil devine false,
// se estompeaza (CSS) si apoi nu mai poate fi atins (visibility: hidden), deci nu incurca pagina de dedesubt.
import Logo from './Logo.jsx';

export default function EcranIntrare({ vizibil }) {
  return (
    <div className={`ecran-intrare${vizibil ? '' : ' ascuns'}`} aria-hidden={!vizibil} role="presentation">
      <div className="continut-intrare">
        <Logo marime={88} faraText />
        <div className="nume">Rent<span>ify</span></div>
      </div>
    </div>
  );
}
