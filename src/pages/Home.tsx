import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MdPendingActions, MdReceiptLong } from "react-icons/md";
import api from "../api/client";
import fetchCobrancasEmitidas, { fetchCobrancasEmitidasMesTotal } from "../api/cobrancasEmitidas";
import fetchCobrancasNaoGeradas, { fetchCobrancasNaoGeradasSemanaTotal } from "../api/cobrancasNaoGeradas";
import { useAuth } from "../context/AuthContext";
import type { CobrancaRemotaNaoGeradaResponse, CobrancaRemotaNaoGeradaTotalResponse } from "../types/api";
import "./Home.css";

type SummaryTotals = {
  emittedTotal: number;
  emittedCurrentMonthCount: number;
  pendingTotalValor: number;
  pendingWeekCount: number;
  remotePendingTotal: number | null;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) {
    return "--";
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

const formatInteger = (value: number | null | undefined) => {
  if (value == null) {
    return "--";
  }

  return value.toLocaleString("pt-BR");
};

const normalizeRemoteTotal = (payload: unknown): number | null => {
  if (payload == null) {
    return null;
  }

  if (typeof payload === "number") {
    return Number.isFinite(payload) ? payload : null;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    try {
      return normalizeRemoteTotal(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const lookup = new Map<string, unknown>();
    Object.entries(source).forEach(([key, value]) => {
      lookup.set(key, value);
      lookup.set(key.toLowerCase(), value);
    });

    const codValue = lookup.get("cod");
    if (typeof codValue === "number" && codValue !== 0) {
      return null;
    }

    if (typeof codValue === "string") {
      const parsedCod = Number(codValue.trim());
      if (!Number.isNaN(parsedCod) && parsedCod !== 0) {
        return null;
      }
    }

    const preferredKeys = ["data", "valor", "valortotal", "total"];
    for (const key of preferredKeys) {
      if (lookup.has(key)) {
        const candidate = normalizeRemoteTotal(lookup.get(key));
        if (candidate != null) {
          return candidate;
        }
      }
    }

    for (const value of lookup.values()) {
      if (typeof value === "object" && value === payload) {
        continue;
      }

      const candidate = normalizeRemoteTotal(value);
      if (candidate != null) {
        return candidate;
      }
    }

    return null;
  }

  return null;
};

const Home = () => {
  const { token } = useAuth();
  const [totals, setTotals] = useState<SummaryTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteListJson, setRemoteListJson] = useState<string | null>(null);
  const [remoteListError, setRemoteListError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!token) {
      setTotals(null);
      setRemoteListJson(null);
      setRemoteListError("Necessario autenticar para visualizar os dados.");
      setError("Necessario autenticar para visualizar os totais.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchTotals = async () => {
      setLoading(true);
      setError(null);
      setRemoteListJson(null);
      setRemoteListError(null);

      try {
        let hadAnyError = false;
        let remoteTotalFailed = false;
        let remoteListErrorMessage: string | null = null;

        const safeRequest = async <T,>(promise: Promise<T>, label: string): Promise<T | null> => {
          try {
            return await promise;
          } catch (requestError) {
            hadAnyError = true;
            console.error(`Falha ao carregar ${label}`, requestError);
            return null;
          }
        };

        const remotePendingPromise = api
          .get<string | CobrancaRemotaNaoGeradaTotalResponse>(
            "/cobranca/cobranca-remota-nao-gerada-total",
            {
              headers: {
                Accept: "text/plain",
              },
              responseType: "text",
            },
          )
          .then((response) => {
            const normalized = normalizeRemoteTotal(response.data);
            if (normalized == null) {
              remoteTotalFailed = true;
              console.error("Resposta inesperada ao carregar total remoto nao gerado", response.data);
            }
            return normalized;
          })
          .catch((remoteError) => {
            remoteTotalFailed = true;
            console.error("Falha ao carregar total remoto nao gerado", remoteError);
            return null;
          });

        const remoteListPromise = api
          .get<CobrancaRemotaNaoGeradaResponse>(
            "/cobranca/cobranca-remota-nao-gerada",
            {
              headers: {
                Accept: "text/plain",
              },
            },
          )
          .then((response) => response.data)
          .catch((remoteError) => {
            hadAnyError = true;
            remoteListErrorMessage = "Falha ao carregar lista de cobranças não geradas.";
            console.error("Falha ao carregar lista de cobranças não geradas", remoteError);
            return null;
          });

        const [emittedAll, emittedMonthCount, pendingAll, pendingWeek] = await Promise.all([
          safeRequest(fetchCobrancasEmitidas(), "cobrancas emitidas"),
          safeRequest(
            fetchCobrancasEmitidasMesTotal(),
            "cobrancas emitidas do mes total",
          ),
          safeRequest(
            fetchCobrancasNaoGeradas(),
            "cobrancas nao geradas",
          ),
          safeRequest(
            fetchCobrancasNaoGeradasSemanaTotal(),
            "cobrancas nao geradas da semana total",
          ),
        ]);

        const remotePendingTotal = await remotePendingPromise;
        const remoteListData = await remoteListPromise;
        hadAnyError = hadAnyError || remoteTotalFailed;

        let remoteListJsonValue: string | null = null;
        if (remoteListData) {
          if (remoteListData.cod === 0) {
            remoteListJsonValue = JSON.stringify(remoteListData.data, null, 2);
          } else {
            remoteListErrorMessage = `Resposta com cod ${remoteListData.cod}`;
          }
        } else if (!remoteListErrorMessage) {
          remoteListErrorMessage = "Lista de cobrancas nao geradas indisponivel.";
        }

        if (!active) {
          return;
        }

        setRemoteListJson(remoteListJsonValue);
        setRemoteListError(remoteListErrorMessage);

        setTotals({
          emittedTotal: emittedAll?.valorTotal ?? 0,
          emittedCurrentMonthCount: emittedMonthCount ?? 0,
          pendingTotalValor: pendingAll?.valorTotal ?? 0,
          pendingWeekCount: pendingWeek ?? 0,
          remotePendingTotal,
        });

        setError(hadAnyError ? "Nao foi possivel carregar todos os totais." : null);
      } catch (fetchError) {
        console.error("Falha ao carregar totais da pagina inicial", fetchError);
        if (active) {
          setTotals(null);
          setRemoteListJson(null);
          setRemoteListError("Nao foi possivel carregar lista de cobrancas nao geradas.");
          setError("Nao foi possivel carregar os totais no momento.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchTotals();

    return () => {
      active = false;
    };
  }, [token]);

  const emittedValue = formatCurrency(totals?.emittedTotal);
  const emittedMonthValue = formatInteger(totals?.emittedCurrentMonthCount);
  const pendingValue = formatCurrency(totals?.pendingTotalValor);
  const pendingWeekValue = formatInteger(totals?.pendingWeekCount);
  const cardClass = "summary-card" + (loading ? " summary-card--loading" : "");

  return (
    <div className="home-wrapper">
      <section className="home-summary" aria-live="polite" aria-busy={loading}>
        <article className={cardClass}>
          <header className="summary-card__header">
            <span className="summary-card__icon" aria-hidden="true">
              <MdReceiptLong />
            </span>
            <h2 className="summary-card__title">Cobrancas Emitidas</h2>
          </header>
          <p className="summary-card__value">{emittedValue}</p>
          <p className="summary-card__meta">{`${emittedMonthValue} este mes`}</p>
          <Link to="/cobrancas/emitidas" className="summary-card__link">
            Ver detalhes
          </Link>
        </article>

        <article className={cardClass}>
          <header className="summary-card__header">
            <span className="summary-card__icon" aria-hidden="true">
              <MdPendingActions />
            </span>
            <h2 className="summary-card__title">Cobrancas nao geradas</h2>
          </header>
          <p className="summary-card__value">{pendingValue}</p>
          <p className="summary-card__meta">{`${pendingWeekValue} esta semana`}</p>
          <Link to="/cobrancas/nao-geradas" className="summary-card__link">
            Ver detalhes
          </Link>
        </article>
      </section>

      {error && <p className="home-summary__error">{error}</p>}

      {(remoteListJson || remoteListError) && (
        <section className="home-debug" aria-live="polite">
          <h2>cobranca-remota-nao-gerada (debug)</h2>
          {remoteListError ? (
            <p className="home-summary__error">{remoteListError}</p>
          ) : (
            <pre className="home-debug__payload">{remoteListJson}</pre>
          )}
        </section>
      )}

    </div>
  );
};

export default Home;
