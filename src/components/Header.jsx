export default function Header({ navItems, activePath, buildHref, onNavigate, onAction }) {
  return (
    <header className="app-header">
      <div className="brand-card">
        <img src={new URL('../assets/logotipo.png', import.meta.url).href} alt="PLU Fácil" className="brand-logo" />
        <div className="brand-copy">
          <span>Sem Vencer</span>
          <h1>Controle de validades</h1>
          <p>PLU, lotes e vencimentos</p>
        </div>
      </div>

      <nav className="main-nav" aria-label="Navegação principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.path && activePath === item.path;

          if (item.action) {
            return (
              <button
                key={item.action}
                type="button"
                className="nav-action"
                onClick={() => onAction(item.action)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <a
              key={item.path}
              className={active ? 'active' : ''}
              href={buildHref(item.path)}
              onClick={(event) => onNavigate(event, item.path)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="nav-status">
        <span>Operação</span>
        <strong>Base local ativa</strong>
      </div>
    </header>
  );
}
