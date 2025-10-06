import api from "./client";
import type {
  ApiListResponse,
  CobrancaRemotaNaoGeradaAnaliticaItem,
  CobrancaRemotaNaoGeradaItem,
  CobrancaRemotaNaoGeradaListItem,
  CobrancaRemotaNaoGeradaResponse,
  CobrancaRemotaNaoGeradaSemanaTotalResponse,
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

    const cleaned = trimmed.replace(/[^\d.,-]+/g, "");
    if (!cleaned) {
      return undefined;
    }

    const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(/,/g, ".") : cleaned;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const toInteger = (value: unknown): number | undefined => {
  const numericValue = toNumber(value);
  if (numericValue == null) {
    return undefined;
  }

  return Math.trunc(numericValue);
};

const mapNaoGeradaItem = (item: CobrancaRemotaNaoGeradaItem): CobrancaRemotaNaoGeradaListItem | null => {
  const idAssistido = toInteger(item.IdAssistido);
  if (idAssistido == null) {
    return null;
  }

  const quantidade = toInteger(item.QtdeTotalProcedimento) ?? 0;
  const valor = toNumber(item.ValorTotalConsulta) ?? 0;
  const nome = (item.NomeAssistido ?? "").toString().trim();
  const procedimentos = (item.IdProcedimentos ?? "").toString().trim();

  return {
    IdAssistido: idAssistido,
    NomeAssistido: nome,
    QtdeTotalProcedimento: quantidade,
    ValorTotalConsulta: valor,
    IdProcedimentos: procedimentos,
  };
};

export const normalizeNaoGeradasResponse = (
  payload: CobrancaRemotaNaoGeradaResponse,
): ApiListResponse<CobrancaRemotaNaoGeradaListItem> => {
  const rawItems = Array.isArray(payload.data) ? payload.data : [];
  const items = rawItems
    .map(mapNaoGeradaItem)
    .filter((item): item is CobrancaRemotaNaoGeradaListItem => item != null);

  const valorTotal = items.reduce((acc, current) => acc + current.ValorTotalConsulta, 0);

  return {
    items,
    total: items.length,
    valorTotal,
  };
};

export const fetchCobrancasNaoGeradas = async (
  params?: Record<string, string | number | undefined>,
): Promise<ApiListResponse<CobrancaRemotaNaoGeradaListItem>> => {
  const response = await api.get<CobrancaRemotaNaoGeradaResponse>(
    "/cobranca/cobranca-remota-nao-gerada",
    {
      headers: { Accept: "text/plain" },
      params,
    },
  );

  if (response.data.cod !== 0) {
    throw new Error(`Resposta com cod ${response.data.cod}`);
  }

  return normalizeNaoGeradasResponse(response.data);
};

export const fetchCobrancasNaoGeradasDetalhe = async (
  params?: Record<string, string | number | undefined>,
): Promise<CobrancaRemotaNaoGeradaAnaliticaItem[]> => {
  const response = await api.get<{ data: CobrancaRemotaNaoGeradaAnaliticaItem[]; cod: number }>(
    "/cobranca/cobranca-remota-nao-gerada-analitica",
    {
      headers: { Accept: "text/plain" },
      params,
    },
  );

  if (response.data.cod !== 0) {
    throw new Error(`Resposta com cod ${response.data.cod}`);
  }

  return Array.isArray(response.data.data) ? response.data.data : [];
};

export type GerarCobrancaRemotaLoteParams = {
  idUsuario: number;
  dataVencimento: string;
  dataInicio?: string;
  dataTermino?: string;
  ids: string[];
};

export type GerarCobrancaRemotaLoteResponse = {
  cod: number;
  msg?: string;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
};

export const gerarCobrancaRemotaLote = async ({
  idUsuario,
  dataVencimento,
  dataInicio,
  dataTermino,
  ids,
}: GerarCobrancaRemotaLoteParams): Promise<GerarCobrancaRemotaLoteResponse> => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Nenhum identificador informado para geração em lote.");
  }

  const queryParams: Record<string, string> = {
    idUsuario: String(idUsuario),
    dataVencimento,
  };

  if (dataInicio) {
    queryParams.dataInicio = dataInicio;
  }

  if (dataTermino) {
    queryParams.dataTermino = dataTermino;
  }

  const response = await api.post<GerarCobrancaRemotaLoteResponse>(
    "/cobranca/gerar-cobranca-remota-lote", 
    ids,
    {
      headers: {
        Accept: "text/plain", 
        "Content-Type": "application/json",
      },
      params: queryParams,
    },
  );

  const payload = response.data;

  if (!payload || typeof payload !== "object" || typeof payload.cod !== "number") {
    throw new Error("Resposta inválida ao gerar cobranças em lote.");
  }

  return payload;
};

export const fetchCobrancasNaoGeradasSemanaTotal = async (): Promise<number> => {
  const response = await api.get<CobrancaRemotaNaoGeradaSemanaTotalResponse>(
    "/cobranca/cobranca-remota-nao-gerada-semana-total",
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

export default fetchCobrancasNaoGeradas;
