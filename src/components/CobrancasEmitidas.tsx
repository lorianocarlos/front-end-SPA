import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { FiCalendar, FiCopy, FiMoreVertical, FiPrinter, FiRotateCcw, FiUser, FiArrowUp, FiArrowDown } from "react-icons/fi";
import AlertDialog from "./AlertDialog";
import Dialog from "./Dialog";
import api from "../api/client";
import fetchCobrancasEmitidas from "../api/cobrancasEmitidas";
import type { ApiListResponse, CobrancaEmitida } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

const initialFilters = {
  nome: "",
  dataEmissaoDe: "",
  dataEmissaoAte: "",
  dataVencimentoDe: "",
  dataVencimentoAte: "",
  situacao: "",
};

const situacaoOptions = [
  { value: "", label: "Todas" },
  { value: "R", label: "Recebida" },
  { value: "Q", label: "Quitada" },
  { value: "X", label: "Cancelada ou Anulada" },
  { value: "C", label: "Cobrada" },
];

type Filters = typeof initialFilters;

type EmitidasResponse = ApiListResponse<CobrancaEmitida>;

type DueDateDialogState = {
  cobranca: CobrancaEmitida;
  novaData: string;
};

type AlertState = {
  title?: string;
  message: string;
  tone?: "info" | "warning" | "danger" | "success";
  confirmLabel?: string;
  onConfirm?: () => void;
};

type SortKey =
  | "id_cobranca"
  | "nm_cliente"
  | "data_criacao_cobranca"
  | "dt_vencimento"
  | "desc1"
  | "status_cobranca"
  | "valor"
  | "data_atualizacao";

type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
} | null;

const sortableColumns: Array<{ key: SortKey; label: string; alignRight?: boolean }> = [
  { key: "id_cobranca", label: "ID" },
  { key: "nm_cliente", label: "Paciente" },
  { key: "data_criacao_cobranca", label: "Emissão" },
  { key: "dt_vencimento", label: "Vencimento" },
  { key: "desc1", label: "Descrição" },
  { key: "status_cobranca", label: "Situação" },
  { key: "valor", label: "Valor", alignRight: true },
  { key: "data_atualizacao", label: "Alteração" },
];

const headerBackgroundStyle = { background: "#0d47a1" };

const parseDateValue = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return timestamp;
  }

  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const fallback = Date.parse([year, month, day].join("-"));
    if (!Number.isNaN(fallback)) {
      return fallback;
    }
  }

  return null;
};

const getComparableValue = (item: CobrancaEmitida, key: SortKey): string | number | null => {
  switch (key) {
    case "valor":
      return item.valor ?? null;
    case "data_criacao_cobranca":
      return parseDateValue(item.data_criacao_cobranca);
    case "dt_vencimento":
      return parseDateValue(item.dt_vencimento);
    case "data_atualizacao":
      return parseDateValue(item.data_atualizacao);
    case "id_cobranca": {
      if (!item.id_cobranca) {
        return null;
      }
      const parsed = Number(item.id_cobranca);
      if (Number.isFinite(parsed)) { // Corrigido para Number.isFinite
        return parsed;
      }
      return item.id_cobranca.trim();
    }
    case "nm_cliente":
      return item.nm_cliente?.trim() ?? null;
    case "desc1":
      return item.desc1?.trim() ?? null;
    case "status_cobranca":
      return item.status_cobranca?.trim() ?? null;
    default:
      return null;
  }
};

const compareItems = (
  left: CobrancaEmitida,
  right: CobrancaEmitida,
  key: SortKey,
  direction: SortDirection,
): number => {
  const valueA = getComparableValue(left, key);
  const valueB = getComparableValue(right, key);

  if (valueA == null && valueB == null) {
    return 0;
  }

  if (valueA == null) {
    return direction === "asc" ? 1 : -1;
  }

  if (valueB == null) {
    return direction === "asc" ? -1 : 1;
  }

  if (typeof valueA === "number" && typeof valueB === "number") {
    return direction === "asc" ? valueA - valueB : valueB - valueA;
  }

  const stringA = typeof valueA === "string" ? valueA : String(valueA);
  const stringB = typeof valueB === "string" ? valueB : String(valueB);
  const comparison = stringA.localeCompare(stringB, "pt-BR", { sensitivity: "base", numeric: true });
  return direction === "asc" ? comparison : -comparison;
};

const buildParams = (source: Filters) => {
  const params: Record<string, string> = {};

  if (source.nome.trim()) {
    params.nomeAssistido = source.nome.trim();
  }

  if (source.dataEmissaoDe) {
    params.dtEmissaoDe = source.dataEmissaoDe;
  }

  if (source.dataEmissaoAte) {
    params.dtEmissaoAte = source.dataEmissaoAte;
  }

  if (source.dataVencimentoDe) {
    params.dtVencimentoDe = source.dataVencimentoDe;
  }

  if (source.dataVencimentoAte) {
    params.dtVencimentoAte = source.dataVencimentoAte;
  }

  if (source.situacao.trim()) {
    params.situacao = source.situacao.trim();
  }

  return params;
};

const toDisplayDate = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  return trimmed;
};

const toApiDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }
  return trimmed;
};

const CobrancasEmitidas = () => {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<EmitidasResponse | null>(null);
  const [actionsDialog, setActionsDialog] = useState<CobrancaEmitida | null>(null);
  const [dueDateDialog, setDueDateDialog] = useState<DueDateDialogState | null>(null);
  const [updatingDueDate, setUpdatingDueDate] = useState(false);
  const [lastUpdatedId, setLastUpdatedId] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [sortConfig, setSortConfig] = useState<SortState>(null);

  const onChange = (field: keyof Filters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const buscar = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const params = buildParams(filters);
      const data = await fetchCobrancasEmitidas(Object.keys(params).length ? params : undefined);
      setDados(data);
      setActionsDialog(null);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Não foi possível carregar as cobranças emitidas.";
      setErro(message);
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setFilters(initialFilters);
    setErro(null);
    setDados(null);
    setActionsDialog(null);
    setDueDateDialog(null);
    setLastUpdatedId(null);
    setAlert(null);
    setSortConfig(null);
    void buscar();
  };

  const openActionsDialog = (cobranca: CobrancaEmitida) => {
    setActionsDialog(cobranca);
  };

  const closeActionsDialog = () => {
    setActionsDialog(null);
  };

  const showAlert = (config: AlertState) => {
    setAlert(config);
  };

  const handleAlertClose = () => {
    setAlert(null);
  };

  const handleAlertConfirm = () => {
    if (alert?.onConfirm) {
      alert.onConfirm();
    }
    setAlert(null);
  };

  const handleGerarSegundaVia = (cobranca: CobrancaEmitida) => {
    if (!cobranca.id_cobranca) return;
    closeActionsDialog();
    showAlert({
      title: "Funcionalidade indisponível",
      message: "Funcionalidade de gerar segunda via ainda não estã disponível.",
      tone: "info",
    });
  };

  const handleImprimirBoleto = (cobranca: CobrancaEmitida) => {
    if (!cobranca.id_cobranca) return;
    closeActionsDialog();
    showAlert({
      title: "Funcionalidade indisponível",
      message: "Funcionalidade de impressão do boleto ainda não está disponível.",
      tone: "info",
    });
  };

  const openDueDateDialog = (cobranca: CobrancaEmitida) => {
    if (!cobranca.id_cobranca) return;
    closeActionsDialog();
    setDueDateDialog({ cobranca, novaData: toDisplayDate(cobranca.dt_vencimento) });
  };

  const onDueDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDueDateDialog((prev) => (prev ? { ...prev, novaData: value } : prev));
  };

  const handleCloseDueDateDialog = () => {
    if (updatingDueDate) return;
    setDueDateDialog(null);
  };

  const submitDueDate = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const current = dueDateDialog;
    if (!current || !current.cobranca.id_cobranca) {
      return;
    }

    const payloadDate = toApiDate(current.novaData);
    if (!payloadDate) {
      showAlert({
        title: "Data obrigatória",
        message: "Informe uma data de vencimento.",
        tone: "warning",
      });
      return;
    }

    setUpdatingDueDate(true);
    try {
      await api.patch(`/cobrancas/${current.cobranca.id_cobranca}/vencimento`, { novaData: payloadDate });
      setDueDateDialog(null);
      setLastUpdatedId(current.cobranca.id_cobranca ?? null);
      await buscar();
    } catch (error) {
      console.error(error);
      showAlert({
        title: "Erro ao atualizar",
        message: "Erro ao atualizar a data de vencimento. Verifique o formato informado.",
        tone: "danger",
      });
    } finally {
      setUpdatingDueDate(false);
    }
  };

  useEffect(() => {
    void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lógica de Ordenação
  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // Memória para os itens ordenados
  const sortedItems = useMemo(() => {
    if (!dados || !dados.items || !sortConfig) {
      return dados?.items ?? [];
    }

    // Cria uma cópia para não modificar o estado original
    const sortableItems = [...dados.items];

    sortableItems.sort((a, b) => compareItems(a, b, sortConfig.key, sortConfig.direction));

    return sortableItems;
  }, [dados, sortConfig]);

  const totalRegistros = dados?.total ?? 0;
  const totalValorFormatado = formatCurrency(dados?.valorTotal ?? 0);

 return (
<section className="card full cobrancas-emitidas">
   <header className="card__header">
    <div>
     <h1>Cobranças emitidas</h1>
           <p className="helper">Filtre e acompanhe as cobranças que jé foram emitidas.</p>
    </div>
   </header>

   <form className="filters filters--inline" onSubmit={buscar}>
    {/* Campo Nome Paciente (Corrigido) */}
    <div className="field field--span-2 field--with-icon">
     <label htmlFor="filtro-nome">Nome paciente</label>
     <input
      id="filtro-nome"
      value={filters.nome}
      onChange={onChange("nome")}
      placeholder="Nome do assistido"
     />
     <FiUser className="field__icon" aria-hidden="true" />
    </div> {/* Fechamento correto do div do Nome Paciente */}

    {/* Campo Data Emissão - de (Corrigido) */}
    <div className="field field--with-icon">
     <label htmlFor="filtro-emissao-de">Data emissão - de</label>
     <input
      id="filtro-emissao-de"
      type="date"
      value={filters.dataEmissaoDe}
      onChange={onChange("dataEmissaoDe")}
     />
     <FiCalendar className="field__icon" aria-hidden="true" />
    </div> {/* Fechamento correto do div da Data Emissão - de */}

    {/* Campo Data Emissão - até (Corrigido) */}
    <div className="field field--with-icon">
     <label htmlFor="filtro-emissao-ate">Data emissão - até</label>
     <input
      id="filtro-emissao-ate"
      type="date"
      value={filters.dataEmissaoAte}
      onChange={onChange("dataEmissaoAte")}
     />
     <FiCalendar className="field__icon" aria-hidden="true" />
    </div> {/* Fechamento correto do div da Data Emissão - até */}

    {/* Campo Data Vencimento - de (Corrigido) */}
    <div className="field field--with-icon">
     <label htmlFor="filtro-vencimento-de">Data vencimento - de</label>
     <input
      id="filtro-vencimento-de"
      type="date"
      value={filters.dataVencimentoDe}
      onChange={onChange("dataVencimentoDe")}
     />
     <FiCalendar className="field__icon" aria-hidden="true" />
    </div> {/* Fechamento correto do div da Data Vencimento - de */}

    {/* Campo Data Vencimento - até (Corrigido) */}
    <div className="field field--with-icon">
     <label htmlFor="filtro-vencimento-ate">Data vencimento - até</label>
     <input
      id="filtro-vencimento-ate"
      type="date"
      value={filters.dataVencimentoAte}
      onChange={onChange("dataVencimentoAte")}
     />
     <FiCalendar className="field__icon" aria-hidden="true" />
    </div> {/* Fechamento correto do div da Data Vencimento - até */}

    {/* Campo Situação (Corrigido) */}
    <div className="field">
     <label htmlFor="filtro-situacao">Situação</label>
     <select id="filtro-situacao" value={filters.situacao} onChange={onChange("situacao")}>
      {situacaoOptions.map((option) => (
       <option key={option.value} value={option.value}>
        {option.label}
       </option>
      ))}
     </select>
    </div> {/* Fechamento correto do div da Situação */}

    <div className="filters__actions">
     <button type="submit" className="button" disabled={loading}>
      {loading ? "Buscando..." : "Buscar"}
     </button>
     <button
      type="button"
      className="button icon-only"
      onClick={limpar}
      disabled={loading}
      aria-label="Limpar filtros"
     >
      <FiRotateCcw aria-hidden="true" />
     </button>
    </div>
   </form>
      <div className="cobrancas-emitidas__totals">
        <span>Valor total: <strong>{totalValorFormatado}</strong></span>
        <span>Cobranças emitidas: <strong>{totalRegistros}</strong></span>
      </div>

      {erro && <p className="error">{erro}</p>}

      {dados && dados.items.length > 0 && (
        <div className="table-wrapper">
          <table className="table table--primary cobrancas-emitidas__table">
            <thead>
              <tr>
                {sortableColumns.map((col) => (
                  <th
                    key={col.key}
                    className={col.alignRight ? "cobrancas-emitidas__align-right" : undefined}
                    onClick={() => handleSort(col.key)}
                    style={headerBackgroundStyle}
                  >
                    <span className="cobrancas-emitidas__sort-label">
                      {col.label}
                      {sortConfig?.key === col.key &&
                        (sortConfig.direction === "asc" ? (
                          <FiArrowUp className="cobrancas-emitidas__sort-icon" aria-label="Ordem ascendente" />
                        ) : (
                          <FiArrowDown className="cobrancas-emitidas__sort-icon" aria-label="Ordem descendente" />
                        ))}
                    </span>
                  </th>
                ))}
                <th className="cobrancas-emitidas__actions-header" aria-label="Ação" style={headerBackgroundStyle}>
                  #
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => ( // Usando sortedItems
                <tr
                  key={item.id_cobranca}
                  className={
                    actionsDialog?.id_cobranca === item.id_cobranca ||
                    dueDateDialog?.cobranca.id_cobranca === item.id_cobranca ||
                    lastUpdatedId === item.id_cobranca
                      ? "table-row--active"
                      : undefined
                  }
                >
                  <td>{item.id_cobranca ?? "-"}</td>
                  <td className="cobrancas-emitidas__paciente">{item.nm_cliente ?? "-"}</td>
                  <td>{formatDate(item.data_criacao_cobranca)}</td>
                  <td>{formatDate(item.dt_vencimento)}</td>
                  <td className="cobrancas-emitidas__descricao">{item.desc1 ?? "-"}</td>
                  <td>{item.status_cobranca ?? "-"}</td>
                  <td className="cobrancas-emitidas__align-right">{formatCurrency(item.valor ?? 0)}</td>
                  <td>{formatDate(item.data_atualizacao, true)}</td>
                  <td className="cobrancas-emitidas__actions-cell">
                    <button
                      type="button"
                      className="actions-trigger"
                      onClick={() => openActionsDialog(item)}
                      aria-label="Abrir s da cobrança"
                    >
                      <FiMoreVertical aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dados && dados.items.length === 0 && <p>Nenhuma cobrança encontrada.</p>}

      {actionsDialog && (
        <Dialog
          open
          //{description={actionsDialog.nm_cliente ?? undefined}}
          onClose={closeActionsDialog}
          actions={
            <button type="button" className="button ghost" onClick={closeActionsDialog}>
              Fechar
            </button>
          }
        >
          <div className="modal-form">
            <button
              type="button"
              className="actions-menu__item"
              onClick={() => handleGerarSegundaVia(actionsDialog)}
            >
              <FiCopy className="actions-menu__icon" aria-hidden="true" />
              <span className="actions-menu__label">Gerar segunda via</span>
            </button>
            <button
              type="button"
              className="actions-menu__item"
              onClick={() => openDueDateDialog(actionsDialog)}
            >
              <FiCalendar className="actions-menu__icon" aria-hidden="true" />
              <span className="actions-menu__label">Alterar data venc.</span>
            </button>
            <button
              type="button"
              className="actions-menu__item"
              onClick={() => handleImprimirBoleto(actionsDialog)}
            >
              <FiPrinter className="actions-menu__icon" aria-hidden="true" />
              <span className="actions-menu__label">Imprimir boleto</span>
            </button>
          </div>
        </Dialog>
      )}

      {dueDateDialog && (
        <Dialog
          open
          title="Alterar data de vencimento"
          description="Informe a nova data de vencimento."
          onClose={handleCloseDueDateDialog}
          actions={
            <>
              <button type="button" className="button ghost" onClick={handleCloseDueDateDialog} disabled={updatingDueDate}>
                Cancelar
              </button>
              <button type="submit" form="due-date-form" className="button" disabled={updatingDueDate}>
                {updatingDueDate ? "Salvando..." : "Salvar"}
              </button>
            </>
          }
        >
          <form id="due-date-form" className="modal-form" onSubmit={submitDueDate}>
            <div className="modal-field">
              <span>Nova data de vencimento</span>
              <input
                type="text"
                value={dueDateDialog.novaData}
                onChange={onDueDateChange}
                placeholder="dd/mm/aaaa"
                autoFocus
              />
            </div>
          </form>
        </Dialog>
      )}

      {alert && (
        <AlertDialog
          open
          title={alert.title}
          message={alert.message}
          tone={alert.tone}
          confirmLabel={alert.confirmLabel}
          onConfirm={handleAlertConfirm}
          onClose={handleAlertClose}
        />
      )}
    </section>
  );
};

export default CobrancasEmitidas;