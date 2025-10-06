import api from "./client";
import type {
  ApiListResponse,
  CobrancaEmitida,
  CobrancaRemotaEmitidaItem,
  CobrancaRemotaEmitidaMesTotalResponse,
  CobrancaRemotaEmitidaResponse,
} from "../types/api";

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const normalized = trimmed.replace(/[^\d.,-]+/g, "");
    if (!normalized) {
      return undefined;
    }

    const hasComma = normalized.includes(",");
    const parsed = Number(hasComma ? normalized.replace(/\./g, "").replace(/,/g, ".") : normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const toInteger = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (numeric == null) {
    return undefined;
  }

  return Math.trunc(numeric);
};

const mapEmitidaItem = (item: CobrancaRemotaEmitidaItem): CobrancaEmitida => {
  const valor = toNumber(item.Valor);

  return {
    id_cobranca: item.IdCobranca != null ? String(item.IdCobranca) : undefined,
    nm_cliente: item.NomeAssistido ?? undefined,
    dt_vencimento: item.DtVencimento ?? undefined,
    data_criacao_cobranca: item.DtCriacao ?? undefined,
    data_atualizacao: item.DtAtualizacao ?? undefined,
    desc1: item.Descricao ?? undefined,
    status_cobranca: item.Situacao ?? undefined,
    valor: valor ?? undefined,
  };
};

export const normalizeEmitidasResponse = (
  payload: CobrancaRemotaEmitidaResponse,
): ApiListResponse<CobrancaEmitida> => {
  const source = Array.isArray(payload.data) ? payload.data : [];
  const items = source.map(mapEmitidaItem);
  const valorTotal = items.reduce((acc, item) => acc + (item.valor ?? 0), 0);

  return {
    items,
    total: items.length,
    valorTotal,
  };
};

export const fetchCobrancasEmitidas = async (
  params?: Record<string, string | number | undefined>,
): Promise<ApiListResponse<CobrancaEmitida>> => {
  const response = await api.get<CobrancaRemotaEmitidaResponse>(
    "/cobranca/cobranca-remota-emitida",
    {
      headers: { Accept: "text/plain" },
      params,
    },
  );

  if (response.data.cod !== 0) {
    throw new Error(`Resposta com cod ${response.data.cod}`);
  }

  return normalizeEmitidasResponse(response.data);
};

export const fetchCobrancasEmitidasMesTotal = async (): Promise<number> => {
  const response = await api.get<CobrancaRemotaEmitidaMesTotalResponse>(
    "/cobranca/cobranca-remota-emitida-mes-total",
    {
      headers: { Accept: "text/plain" },
    },
  );

  if (response.data.cod !== 0) {
    throw new Error(`Resposta com cod ${response.data.cod}`);
  }

  const totalValue = response.data.data?.Total;
  return toInteger(totalValue) ?? 0;
};

export default fetchCobrancasEmitidas;
