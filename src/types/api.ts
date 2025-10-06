export type ApiListResponse<T> = {
  total: number;
  valorTotal?: number;
  items: T[];
};

export type ApiDataResponse<T> = {
  data: T;
  cod: number;
};

export type CobrancaRemotaNaoGeradaTotalResponse = ApiDataResponse<number>;

export type CobrancaRemotaNaoGeradaItem = {
  IdAssistido?: number | string | null;
  NomeAssistido?: string | null;
  QtdeTotalProcedimento?: number | string | null;
  ValorTotalConsulta?: number | string | null;
  IdProcedimentos?: string | null;
};

export type CobrancaRemotaNaoGeradaResponse = {
  data: CobrancaRemotaNaoGeradaItem[];
  cod: number;
};

export type CobrancaRemotaNaoGeradaSemanaTotalResponse = {
  data: {
    Total?: number | string | null;
  } | null;
  cod: number;
};

export type CobrancaRemotaNaoGeradaListItem = {
  IdAssistido: number;
  NomeAssistido: string;
  QtdeTotalProcedimento: number;
  ValorTotalConsulta: number;
  IdProcedimentos: string;
};


export type CobrancaRemotaEmitidaItem = {
  IdCobranca?: number;
  NomeAssistido?: string;
  DtVencimento?: string | null;
  DtCriacao?: string | null;
  DtAtualizacao?: string | null;
  Descricao?: string | null;
  Valor?: number | string | null;
  Situacao?: string | null;
};

export type CobrancaRemotaEmitidaResponse = {
  data: CobrancaRemotaEmitidaItem[];
  cod: number;
};

export type CobrancaRemotaEmitidaMesTotalResponse = {
  data: {
    Total?: number | string | null;
  } | null;
  cod: number;
};


export type CobrancaEmitida = {
  id_cobranca?: string;
  id_cliente?: string;
  nm_cliente?: string;
  tipo_cobranca?: string;
  desc1?: string;
  desc2?: string;
  valor?: number;
  status_cobranca?: string;
  dt_vencimento?: string;
  data_criacao_cobranca?: string;
  data_atualizacao?: string;
};

export type CobrancaNaoGeradaResumo = {
  id_cliente_spa?: string;
  paciente?: string;
  quantidadeProcedimentos: number;
  valorTotal: number;
};

export type CobrancaNaoGeradaDetalhe = {
  ID_PROCEDIMENTO?: string;
  ID_CLIENTE_SPA?: string;
  paciente?: string;
  DATA_ATENDIMENTO?: string;
  DESCRICAO?: string;
  classificacao?: string;
  tipo_atendimento?: string;
  estagiario?: string;
  VALOR_CONSULTA?: number;
};

export type SpaAuthTokens = {
  AccessToken: string;
  RefreshToken?: string;
};

export type SpaAuthData = {
  Identificador: string;
  Vinculo: string;
  Nome: string;
  IdUsuario: number;
  IdCC: number;
  IdCliente: number;
  UsernameSGU: string;
  Cpf: string;
  Tokens: SpaAuthTokens;
  FauxGuidIdUsuario: string;
  FauxGuidIdCC: string;
  FauxGuidIdCliente: string;
  Email: string;
  RequerTrocaSenha: boolean;
};

export type SpaAuthProfile = Omit<SpaAuthData, 'Tokens'>;

export type LoginResponse = {
  data: SpaAuthData;
  cod: number;
};
export type TokenValidationData = {
  Papel: string;
  Identificador: string;
  Valido: boolean;
};

export type TokenValidationResponse = {
  data: TokenValidationData;
  cod: number;
};

export type RefreshResponse = {
  data: SpaAuthTokens;
  cod: number;
};

export type CobrancaRemotaNaoGeradaAnaliticaItem = Record<string, unknown>;

export type CobrancaRemotaNaoGeradaAnaliticaResponse = {
  data: CobrancaRemotaNaoGeradaAnaliticaItem[];
  cod: number;
};

// NOVO TIPO COMPLETO: Resposta da chamada de lote, que pode ter 'data: boolean'
// no sucesso (cod: 0) ou mensagens de erro (cod != 0).
export type GerarCobrancaRemotaLoteResponse = {
  cod: number;
  msg?: string;
  error_msg?: string;
  // O campo 'data' existe apenas no sucesso, e é tipado como boolean (ou um tipo que o cliente API consiga mapear)
  data?: unknown; // Usar unknown ou boolean, pois o servidor retorna uma 'data'
};

// Se você estiver usando um cliente API que desempacota o campo 'data' da resposta, 
// o seu tipo pode ser simplesmente:
export type ApiLoteResponse = {
    cod: number;
    msg?: string;
    error_msg?: string;
};
// E a sua função TS de API (gerarCobrancaRemotaLote) usaria Promise<ApiLoteResponse>.
// Vamos continuar usando a estrutura que você já implementou (incluindo error_msg e msg).

