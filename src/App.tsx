import { Navigate, Route, Routes } from "react-router-dom";
import TokenForm from "./components/TokenForm";
import { useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import CobrancasEmitidasPage from "./pages/CobrancasEmitidasPage";
import CobrancasNaoGeradasPage from "./pages/CobrancasNaoGeradasPage";
import TopBar from "./components/TopBar";
import "./App.css";

function App() {
  const { isAuthenticated, clearToken } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <TokenForm />
      </div>
    );
  }

  return (
    <div className="protected-layout">
      <TopBar onLogout={clearToken} />

      <div className="protected-content">
        <main className="protected-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cobrancas/emitidas" element={<CobrancasEmitidasPage />} />
            <Route path="/cobrancas/nao-geradas" element={<CobrancasNaoGeradasPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
