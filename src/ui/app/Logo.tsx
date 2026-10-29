const SYMBOL_URL = "/odemuse-symbol.svg";

/** The symbol and the name Ode, set by the brand's logo rules: the note as tall as the capitals, on the baseline. */
export function LogoLockup() {
  return (
    <span className="logo-lockup">
      <img className="logo-lockup__symbol" src={SYMBOL_URL} alt="" />
      Ode
    </span>
  );
}
