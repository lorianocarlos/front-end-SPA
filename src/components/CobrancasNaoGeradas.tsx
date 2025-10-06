import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { FiCalendar, FiEye, FiLayers, FiRotateCcw, FiUser, FiArrowUp, FiArrowDown } from "react-icons/fi";
import AlertDialog from "./AlertDialog";
import Dialog from "./Dialog";
import fetchCobrancasNaoGeradas, {
  fetchCobrancasNaoGeradasDetalhe,
  gerarCobrancaRemotaLote,
} from "../api/cobrancasNaoGeradas";
import type {
  ApiListResponse,
  CobrancaRemotaNaoGeradaAnaliticaItem,
  CobrancaRemotaNaoGeradaListItem,
} from "../types/api";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate } from "../utils/format";

const initialFilters = {
  nomeAssistido: "",
  dataAtendimentoDe: "",
  dataAtendimentoAte: "",
  valorMin: "",
};

type Filters = typeof initialFilters;

type RemoteListState = ApiListResponse<CobrancaRemotaNaoGeradaListItem>;

const initialBatchForm = {
  dataInicio: "",
  dataTermino: "",
  dataVencimento: "",
};

type BatchForm = typeof initialBatchForm;

type AlertState = {
  title?: string;
  message: string;
  tone?: "info" | "success" | "warning" | "danger";
};

// Tipos para ordenação
type SortKey = "NomeAssistido" | "IdProcedimentos" | "ValorTotalConsulta";
type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
} | null;

const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: "NomeAssistido", label: "Paciente" },
  { key: "IdProcedimentos", label: "Procedimentos" },
  { key: "ValorTotalConsulta", label: "Valor Total" },
];

const parseNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const normalized = value.replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildParams = (filters: Filters) => {
  const params: Record<string, string | number | undefined> = {};

  if (filters.nomeAssistido.trim()) {
    params.nomeAssistido = filters.nomeAssistido.trim();
  }

  if (filters.dataAtendimentoDe) {
    params.dtAtendimentoDe = filters.dataAtendimentoDe;
  }

  if (filters.dataAtendimentoAte) {
    params.dtAtendimentoAte = filters.dataAtendimentoAte;
  }

  const valorConsulta = parseNumber(filters.valorMin);
  if (valorConsulta !== undefined) {
    params.valorConsulta = valorConsulta;
  }

  return params;
};

const parseCurrencyValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const cleaned = trimmed.replace(/[^\d.,-]+/g, "");
    if (!cleaned) {
      return 0;
    }

    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, "").replace(/,/g, ".")
      : cleaned;

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const createLookup = (entry: CobrancaRemotaNaoGeradaAnaliticaItem) => {
  const lookup = new Map<string, unknown>();
  Object.entries(entry).forEach(([key, value]) => {
    lookup.set(key, value);
    lookup.set(key.toLowerCase(), value);
  });
  return lookup;
};

const readString = (lookup: Map<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = lookup.get(key) ?? lookup.get(key.toLowerCase());
    if (value !== undefined && value !== null) {
      const str = String(value).trim();
      if (str.length > 0) {
        return str;
      }
    }
  }
  return undefined;
};

const readAmount = (lookup: Map<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = lookup.get(key) ?? lookup.get(key.toLowerCase());
    const parsed = parseCurrencyValue(value);
    if (parsed !== 0) {
      return parsed;
    }
  }
  return parseCurrencyValue(lookup.get(keys[0]));
};

const formatDetailDate = (value: string | undefined) => {
  if (!value) {
    return "-";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "-";
  }
  if (/^\d{8}$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    return formatDate(iso);
  }
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return formatDate(normalized);
};

// Funções de ordenação
const getComparableValue = (item: CobrancaRemotaNaoGeradaListItem, key: SortKey): string | number | null => {
  switch (key) {
    case "ValorTotalConsulta":
      return item.ValorTotalConsulta ?? null;
    case "NomeAssistido":
      return item.NomeAssistido?.trim() ?? null;
    case "IdProcedimentos":
      return item.IdProcedimentos?.trim() ?? null;
    default:
      return null;
  }
};

const compareItems = (
  left: CobrancaRemotaNaoGeradaListItem,
  right: CobrancaRemotaNaoGeradaListItem,
  key: SortKey,
  direction: SortDirection,
): number => {
  const valueA = getComparableValue(left, key);
  const valueB = getComparableValue(right, key);

  if (valueA == null && valueB == null) return 0;
  if (valueA == null) return direction === "asc" ? 1 : -1;
  if (valueB == null) return direction === "asc" ? -1 : 1;

  if (typeof valueA === "number" && typeof valueB === "number") {
    return direction === "asc" ? valueA - valueB : valueB - valueA;
  }

  const stringA = typeof valueA === "string" ? valueA : String(valueA);
  const stringB = typeof valueB === "string" ? valueB : String(valueB);
  const comparison = stringA.localeCompare(stringB, "pt-BR", { sensitivity: "base", numeric: true });
  return direction === "asc" ? comparison : -comparison;
};

const CobrancasNaoGeradas = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<RemoteListState>({ items: [], total: 0, valorTotal: 0 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<CobrancaRemotaNaoGeradaAnaliticaItem[]>([]);
  const [detailResumo, setDetailResumo] = useState<CobrancaRemotaNaoGeradaListItem | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchForm>(initialBatchForm);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [sortConfig, setSortConfig] = useState<SortState>(null);
  // Estado para o JSON de debug da API
  const [debugOutput, setDebugOutput] = useState<string | null>(null);

  const onChange = (field: keyof Filters) => (event: ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const buscar = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setErro(null);
    setDebugOutput(null); // Limpa debug ao buscar

    try {
      const params = buildParams(filters);
      const data = await fetchCobrancasNaoGeradas(params);
      setDados(data);
      setSelectedIds([]);
    } catch (error) {
      console.error("Falha ao carregar cobranças não geradas", error);
      const message = error instanceof Error ? error.message : "Não foi possível carregar as cobranças não geradas.";
      setErro(message);
      setDados({ items: [], total: 0, valorTotal: 0 });
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setFilters(initialFilters);
    setErro(null);
    setDados({ items: [], total: 0, valorTotal: 0 });
    setSelectedIds([]);
    setSortConfig(null);
    setDebugOutput(null); // Limpa debug
    void buscar();
  };

  useEffect(() => {
    void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler de ordenação
  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // Itens ordenados via useMemo
  const sortedItems = useMemo(() => {
    if (!dados.items || dados.items.length === 0) {
      return [];
    }

    const items = [...dados.items];
    if (sortConfig) {
      items.sort((a, b) => compareItems(a, b, sortConfig.key, sortConfig.direction));
    }
    return items;
  }, [dados.items, sortConfig]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((current) => current !== id) : [...prev, id]));
  };

  const allSelectableIds = useMemo(() => dados.items.map((item) => item.IdAssistido), [dados.items]);
  const isAllSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.includes(id));
  const hasSelection = selectedIds.length > 0;

  const toggleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : allSelectableIds);
  };

  const selectedAssistidos = useMemo(
    () =>
      selectedIds
        .map((id) => dados.items.find((item) => item.IdAssistido === id))
        .filter((item): item is CobrancaRemotaNaoGeradaListItem => Boolean(item)),
    [selectedIds, dados.items],
  );

  const selectedProcedimentoIds = useMemo(
    () =>
      selectedAssistidos
        .map((item) => item.IdProcedimentos?.toString().trim())
        .filter((value): value is string => Boolean(value)),
    [selectedAssistidos],
  );

  const closeAlert = () => {
    setAlert(null);
  };

  const onBatchFormChange = (field: keyof BatchForm) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setBatchForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBatchDialogClose = () => {
    if (batchSubmitting) {
      return;
    }
    setBatchDialogOpen(false);
    setBatchError(null);
    setDebugOutput(null); // Limpa debug ao fechar o modal
  };

  const gerarCobrancaLote = () => {
    if (!hasSelection) {
      return;
    }

    setBatchForm((prev) => ({
      dataInicio: prev.dataInicio || "",
      dataTermino: prev.dataTermino || "",
      dataVencimento: prev.dataVencimento || "",
    }));
    setBatchError(null);
    setDebugOutput(null); // Limpa debug ao abrir
    setBatchDialogOpen(true);
  };

  const handleBatchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setDebugOutput(null);

    if (!user?.IdUsuario) {
      setBatchError("Não foi possível identificar o usuário logado.");
      return;
    }

    if (!selectedProcedimentoIds.length) {
      setBatchError("Selecione ao menos uma cobrança válida para gerar.");
      return;
    }

    if (!batchForm.dataInicio) {
      setBatchError("Informe a data inicial do vencimento.");
      return;
    }

    if (!batchForm.dataTermino) {
      setBatchError("Informe a data final do vencimento.");
      return;
    }

    if (batchForm.dataInicio > batchForm.dataTermino) {
      setBatchError("A data inicial deve ser anterior ou igual à data final.");
      return;
    }

    if (!batchForm.dataVencimento) {
      setBatchError("Informe a data de vencimento.");
      return;
    }

    try {
      setBatchSubmitting(true);
      setBatchError(null); // Limpa batchError antes da chamada API

      // A função gerarCobrancaRemotaLote está configurada para enviar 
      // datas na URL e IDs no Body, alinhada com a correção do TS API.
      const result = await gerarCobrancaRemotaLote({
        idUsuario: user.IdUsuario,
        dataVencimento: batchForm.dataVencimento,
        dataInicio: batchForm.dataInicio || undefined,
        dataTermino: batchForm.dataTermino || undefined,
        ids: selectedProcedimentoIds,
      });

      const payloadMessage =
        (typeof result.msg === "string" && result.msg.trim()) ||
        (typeof result.message === "string" && result.message.trim()) ||
        "";

      if (result.cod !== 0) {
        // CAPTURA DE ERRO 1: Falha na API (cod !== 0)
        const debugJson = JSON.stringify(result, null, 2);
        setDebugOutput(debugJson);
        
        // NOVO FLUXO DE ERRO: Fecha o modal e exibe o alerta (revela a área de debug)
        setBatchDialogOpen(false); 
        setAlert({
            tone: "danger",
            title: "Falha ao Gerar Cobranças",
            message: payloadMessage || "A solicitação falhou. Verifique os detalhes na Área de Debug abaixo.",
        });
        return;
      }

      setBatchDialogOpen(false);
      setBatchForm(initialBatchForm);
      setSelectedIds([]);
      setAlert({
        tone: "success",
        title: "Cobrança em lote solicitada",
        message: payloadMessage || "Solicitação enviada com sucesso.",
      });
      void buscar();
    } catch (error) {
      console.error("Falha ao gerar cobrança em lote", error);
      const message = error instanceof Error ? error.message : "Não foi possível gerar as cobranças selecionadas.";
      
      // CAPTURA DE ERRO 2: Exceção na chamada
      const errorObj = error instanceof Error ? { message, stack: error.stack } : error;
      const debugContent = JSON.stringify(errorObj, null, 2);

      setDebugOutput(debugContent);
      
      // NOVO FLUXO DE ERRO: Fecha o modal e exibe o alerta (revela a área de debug)
      setBatchDialogOpen(false);
      setAlert({
          tone: "danger",
          title: "Erro de Comunicação",
          message: message + " Detalhes técnicos estão na Área de Debug.",
      });
    } finally {
      setBatchSubmitting(false);
    }
  };

  const abrirDetalhe = async (item: CobrancaRemotaNaoGeradaListItem) => {
    setDetailResumo(item);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailItems([]);

    try {
      const params = buildParams({
        ...filters,
        nomeAssistido: item.NomeAssistido ?? filters.nomeAssistido,
      });

      const detailData = await fetchCobrancasNaoGeradasDetalhe(params);
      setDetailItems(detailData);
    } catch (error) {
      console.error("Falha ao carregar detalhe de cobrança não gerada", error);
      const message = error instanceof Error ? error.message : "Não foi possível carregar o detalhe.";
      setDetailError(message);
      setDetailItems([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const fecharDetalhe = () => {
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailError(null);
    setDetailItems([]);
    setDetailResumo(null);
  };

  const totalValor = useMemo(
    () => dados.valorTotal ?? dados.items.reduce((acc, item) => acc + (item.ValorTotalConsulta ?? 0), 0),
    [dados.items, dados.valorTotal],
  );

  const detailCards = useMemo(() =>
    detailItems.map((entry) => {
      const lookup = createLookup(entry);
      const title = readString(lookup, "Paciente", "NomeAssistido", "NomePaciente", "nome") ?? "-";
      const idProcedimento = readString(lookup, "IdProcedimento", "ID_PROCEDIMENTO", "ID") ?? "-";
      const descricao = readString(lookup, "Descricao", "DESCRICAO") ?? "";
      const classificacao = readString(lookup, "Classificacao", "NomeClassificacao", "classificacao") ?? "-";
      const dataAtendimento = formatDetailDate(readString(lookup, "DataAtendimento", "DATA_ATENDIMENTO"));
      const tipoAtendimento = readString(lookup, "TipoAtendimento", "tipo_atendimento") ?? "-";
      const estagiario = readString(lookup, "Estagiario", "estagiario", "NomeEstagiario") ?? "-";
      const valor = readAmount(lookup, "ValorConsulta", "VALOR_CONSULTA", "Valor", "VALOR");

      return {
        title,
        idProcedimento,
        descricao,
        classificacao,
        dataAtendimento,
        tipoAtendimento,
        estagiario,
        valor,
      };
    }),
    [detailItems],
  );

  const detailTotal = useMemo(
    () => detailCards.reduce((acc, card) => acc + (card.valor ?? 0), 0),
    [detailCards],
  );

  return (
    <section className="card full">
      <header className="card__header">
        <div>
          <h1>Cobranças não geradas</h1>
          <p className="helper">Filtre e acompanhe as cobranças que ainda não foram emitidas.</p>
        </div>
      </header>

      <form className="filters filters--inline" onSubmit={buscar}>
        <div className="field field--span-2 field--with-icon">
          <label htmlFor="nomeAssistido">Nome assistido</label>
          <input
            id="nomeAssistido"
            type="text"
            value={filters.nomeAssistido}
            onChange={onChange("nomeAssistido")}
            placeholder=""
          />
          <FiUser className="field__icon" aria-hidden="true" />
        </div>

        <div className="field field--with-icon">
          <label htmlFor="dataAtendimentoDe">Data atendimento - de</label>
          <input
            id="dataAtendimentoDe"
            type="date"
            value={filters.dataAtendimentoDe}
            onChange={onChange("dataAtendimentoDe")}
          />
          <FiCalendar className="field__icon" aria-hidden="true" />
        </div>

        <div className="field field--with-icon">
          <label htmlFor="dataAtendimentoAte">Data atendimento - até</label>
          <input
            id="dataAtendimentoAte"
            type="date"
            value={filters.dataAtendimentoAte}
            onChange={onChange("dataAtendimentoAte")}
          />
          <FiCalendar className="field__icon" aria-hidden="true" />
        </div>

        <div className="field field--with-icon">
          <label htmlFor="valorMin">Valor consulta</label>
          <input
            id="valorMin"
            type="text"
            value={filters.valorMin}
            onChange={onChange("valorMin")}
            placeholder="R$ 0,00"
          />
        </div>

        <div className="filters__actions">
          <button type="submit" className="button" disabled={loading}>
            {loading ? "Carregando..." : "Buscar"}
          </button>
          <button type="button" className="button icon-only" onClick={limpar} disabled={loading} aria-label="Limpar filtros">
            <FiRotateCcw aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="summary">
        <span>
          Valor Total Geral: <strong>{formatCurrency(totalValor)}</strong>
        </span>
      </div>

      <div className="table-selection">
        <span className="table-selection__info">
          {hasSelection ? `${selectedIds.length} selecionado(s)` : "Nenhuma cobrança selecionada"}
        </span>
        <div className="table-selection__actions">
          <button type="button" className="button batch" disabled={!hasSelection} onClick={gerarCobrancaLote}>
            <span className="batch-icon">
              <FiLayers aria-hidden="true" />
            </span>
            Solicitar cobrança em lote
          </button>
        </div>
      </div>

      {erro && <p className="error-message">{erro}</p>}

      <div className="table-wrapper" aria-busy={loading}>
        <table className="table table--primary">
          <thead>
            <tr>
              <th className="checkbox-cell" style={{background:"#0d47a1"}}>
                <input type="checkbox" onChange={toggleSelectAll} checked={isAllSelected && allSelectableIds.length > 0} />
              </th>
              {sortableColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{ background: "#0d47a1", cursor: "pointer" }}
                >
                  {col.label}
                  {sortConfig?.key === col.key && (
                    <span className="sort-icon" style={{ marginLeft: "5px" }}>
                      {sortConfig.direction === "asc" ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
                    </span>
                  )}
                </th>
              ))}
              <th style={{background:"#0d47a1"}}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => (
              <tr key={item.IdAssistido} className={detailResumo?.IdAssistido === item.IdAssistido ? "table-row--active" : undefined}>
                <td className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.IdAssistido)}
                    onChange={() => toggleSelection(item.IdAssistido)}
                    aria-label={`Selecionar ${item.NomeAssistido}`}
                  />
                </td>
                <td>{item.NomeAssistido}</td>
                <td className="table__ids">{item.IdProcedimentos}</td>
                <td>{formatCurrency(item.ValorTotalConsulta)}</td>
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => abrirDetalhe(item)}
                    aria-label={`Detalhar cobrança de ${item.NomeAssistido}`}
                  >
                    <FiEye aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}

            {!loading && dados.items.length === 0 && (
              <tr>
                <td colSpan={5} className="table__empty">
                  Nenhuma cobrança encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Área de debug para o resultado da API em caso de falha */}
      {debugOutput && (
        <div 
          className="debug-area card" 
          style={{ 
            marginTop: "20px", 
            padding: "15px", 
            backgroundColor: "#333", 
            color: "#f8f8f2", 
            whiteSpace: "pre-wrap", 
            overflowX: "auto" 
          }}
        >
          <h2>Debug da Requisição (gerar-cobranca-lote)</h2>
          <p style={{ color: '#ffb86c' }}>Resultado da API em caso de falha:</p>
          <pre style={{ border: "1px solid #666", padding: "10px", backgroundColor: "#282a36", borderRadius: "4px" }}>
            {debugOutput}
          </pre>
        </div>
      )}


      <Dialog
        open={batchDialogOpen}
        size="lg"
        onClose={handleBatchDialogClose}
        title="Gerar cobrança em lote"
        description="Informe o intervalo de vencimento e a data limite para cobrança."
        actions={
          <>
            <button
              type="button"
              className="button ghost"
              onClick={handleBatchDialogClose}
              disabled={batchSubmitting}
            >
              Cancelar
            </button>
            <button type="submit" form="batch-form" className="button" disabled={batchSubmitting}>
              {batchSubmitting ? "Enviando..." : "Gerar cobranças"}
            </button>
          </>
        }
      >
        <form id="batch-form" className="modal-form" onSubmit={handleBatchSubmit}>
          <p>
          Selecionados {selectedAssistidos.length} assistido(s) e {selectedProcedimentoIds.length} conjunto(s) de procedimentos.
          </p>
          <div className="modal-field">
            <label htmlFor="batch-data-inicio">Data vencimento - de *</label>
            <input
              id="batch-data-inicio"
              type="date"
              value={batchForm.dataInicio}
              onChange={onBatchFormChange("dataInicio")}
            />
          </div>
          <div className="modal-field">
            <label htmlFor="batch-data-termino">Data vencimento - até *</label>
            <input
              id="batch-data-termino"
              type="date"
              value={batchForm.dataTermino}
              onChange={onBatchFormChange("dataTermino")}
            />
          </div>
          <div className="modal-field">
            <label htmlFor="batch-data-vencimento">Data de vencimento da cobrança *</label>
            <input
              id="batch-data-vencimento"
              type="date"
              value={batchForm.dataVencimento}
              onChange={onBatchFormChange("dataVencimento")}
              required
            />
          </div>
          {batchError && <p className="error-message">{batchError}</p>}
        </form>
      </Dialog><Dialog
        open={detailOpen}
        onClose={fecharDetalhe}
        size="lg"
        title="Detalhe de Cobranças"
        description={detailResumo?.NomeAssistido ?? undefined}
        actions={
          <button type="button" className="button ghost" onClick={fecharDetalhe}>
            Fechar
          </button>
        }
      >
        {detailLoading && <p>Carregando...</p>}
        {!detailLoading && detailError && <p className="error-message">{detailError}</p>}
        {!detailLoading && !detailError && detailCards.length === 0 && <p>Nenhum procedimento encontrado.</p>}
        {!detailLoading && !detailError && detailCards.length > 0 && (
          <div className="charges-detail">
            <div className="charges-detail__summary">
              <span>
                <strong>Total de procedimentos:</strong> {detailCards.length}
              </span>
              <span>
                <strong>Total calculado:</strong> {formatCurrency(detailTotal)}
              </span>
            </div>
            <div className="charges-detail__list">
              {detailCards.map((card, index) => (
                <article key={`${card.idProcedimento}-${index}`} className="charges-detail__card">
                  <header className="charges-detail__header">
                    <div>
                      <p>{card.title}</p>
                      <p className="charges-detail__meta">
                        <span>ID: {card.idProcedimento}</span>
                        {card.descricao && <span>{card.descricao}</span>}
                      </p>
                    </div>
                    <span className="charges-detail__amount">{formatCurrency(card.valor ?? 0)}</span>
                  </header>
                  <dl className="charges-detail__grid">
                    <div>
                      <dt>Classificação</dt>
                      <dd>{card.classificacao}</dd>
                    </div>
                    <div>
                      <dt>Data</dt>
                      <dd>{card.dataAtendimento}</dd>
                    </div>
                    <div>
                      <dt>Tipo de atendimento</dt>
                      <dd>{card.tipoAtendimento}</dd>
                    </div>
                    <div>
                      <dt>Estagiário</dt>
                      <dd>{card.estagiario}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <footer className="charges-detail__footer">
              <span>Total geral:</span>
              <strong>{formatCurrency(detailTotal)}</strong>
            </footer>
          </div>
        )}
      </Dialog>
      <AlertDialog
        open={Boolean(alert)}
        onClose={closeAlert}
        onConfirm={closeAlert}
        tone={alert?.tone ?? "info"}
        title={alert?.title}
        message={alert?.message ?? ""}
      />
    </section>
  );
};

export default CobrancasNaoGeradas;