export default function Header({
  navItems,
  activePath,
  buildHref,
  onNavigate,
  onAction,
  usuarioAtual,
}) {
  return (
    <header className="app-header">
      <nav className="main-nav" aria-label="Navegacao principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.path && activePath === item.path;

          if (item.action) {
            return (
              <button key={item.action} type="button" className="nav-action" onClick={() => onAction(item.action)}>
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
        <span>{usuarioAtual?.admin ? 'Admin' : 'Usuario'}</span>
        <strong>{usuarioAtual?.matricula}</strong>
      </div>
    </header>
  );
}
