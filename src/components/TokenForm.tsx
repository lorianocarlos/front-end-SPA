import { useState } from "react";
import type { FormEvent } from "react";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import { authenticate, validateToken } from "../api/client";
import { useAuth } from "../context/AuthContext";

const LOGO_VERTICAL_SRC = "https://www.puc-rio.br/imagens/brasao_preto_vertical.svg";
const LOGO_HORIZONTAL_SRC = LOGO_VERTICAL_SRC;
const TOKEN_INVALID_ERROR = "TOKEN_INVALID";

const TokenForm = () => {
  const { setToken } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const description = "";

  const ensureValidToken = async (rawToken: string) => {
    const trimmedToken = rawToken.trim();
    if (!trimmedToken) {
      throw new Error(TOKEN_INVALID_ERROR);
    }

    const validation = await validateToken(trimmedToken);
    const validationPayload = validation.data;
    const validationData = validationPayload.data;

    if (validationPayload.cod !== 0 || !validationData?.Valido) {
      throw new Error(TOKEN_INVALID_ERROR);
    }

    return trimmedToken;
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("Informe usuario e senha.");
      return;
    }

    setLoading(true);

    try {
      const response = await authenticate(trimmedUsername, password);
      const payload = response.data;
      const authData = payload.data;

      if (payload.cod !== 0 || !authData?.Tokens?.AccessToken) {
        throw new Error("Resposta de autenticacao invalida.");
      }

      const validatedToken = await ensureValidToken(authData.Tokens.AccessToken);
      const { Tokens, ...profile } = authData;

      setToken(validatedToken, {
        refreshToken: Tokens.RefreshToken ?? null,
        user: profile,
      });
    } catch (cause) {
      console.error(cause);

      if (cause instanceof Error && cause.message === TOKEN_INVALID_ERROR) {
        setError("Token invalido ou expirado.");
        return;
      }

      setError("Credenciais invalidas ou autenticacao indisponivel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="login-shell">
        <div className="login-brand">
          <img className="login-logo login-logo--desktop" src={LOGO_VERTICAL_SRC} alt="Logomarca do SPA" />
          <img className="login-logo login-logo--mobile" src={LOGO_HORIZONTAL_SRC} alt="Logomarca do SPA" />
          <span className="login-headline login-headline--desktop">SPA - Serviço de Psicologia Aplicada</span>
          <span className="login-headline login-headline--mobile">SPA - Serviço de Psicologia Aplicada</span>
        </div>

        <span className="login-divider login-divider--vertical" role="presentation" aria-hidden="true" />
        <span className="login-divider login-divider--horizontal" role="presentation" aria-hidden="true" />

        <div className="login-content">
          <div className="login-content__body">
  
            <p className="login-description">{description}</p>

            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label className="login-label" htmlFor="username">
                  Digite seu login, CPF ou matrícula
                </label>
                <input
                  id="username"
                  className="login-input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="usuario"
                  autoComplete="username"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="password">
                  Senha
                </label>
                <div className="login-field__control">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="login-input login-input--password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="********"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <MdVisibilityOff aria-hidden="true" /> : <MdVisibility aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && <p className="login-error">{error}</p>}

              <div className="login-submit">
                <button type="submit" className="button" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TokenForm;



