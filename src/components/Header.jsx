export default function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <img src={new URL('../assets/logotipo.png', import.meta.url).href} alt="PLU Fácil" className="logo-main" />
        <p className="header-description">
          Consulte PLU de carnes e aves ao instante
        </p>
      </div>
    </header>
  );
}
