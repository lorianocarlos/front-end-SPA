import { Link, useLocation } from "react-router-dom";
import { MdAttachMoney, MdExitToApp, MdHome } from "react-icons/md";
//import logo from "../assets/puc-logo.png";

type TopBarProps = {
  onLogout: () => void;
};

const TopBar = ({ onLogout }: TopBarProps) => {
  const location = useLocation();

  const items = [
    { label: "Início", path: "/", icon: <MdHome aria-hidden="true" /> },
    {
      label: "Cobrança Emitidas",
      path: "/cobrancas/emitidas",
      icon: <MdAttachMoney aria-hidden="true" />,
    },
      {
      label: "Cobrança não Geradas",
      path: "/cobrancas/nao-geradas",
      icon: <MdAttachMoney aria-hidden="true" />,
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname.startsWith(path);
  };

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img src="https://saef.dsi.puc-rio.br/logo_white.png" alt="PUC-Rio" className="topbar__logo" />
        <h1>SPA - Gerenciar Cobranças</h1>
      </div>

      <nav className="topbar__nav" aria-label="Seções principais">
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`topbar__link ${isActive(item.path) ? "active" : ""}`}
          >
            <span className="topbar__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="topbar__label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="topbar__actions">
        <button type="button" className="topbar__logout" onClick={onLogout}>
          <span className="topbar__icon" aria-hidden="true">
            <MdExitToApp />
          </span>
          <span className="topbar__label">Sair</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;


