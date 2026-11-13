export type Papel = 'admin' | 'atendente';

export type StatusConferencia = 'PENDENTE' | 'EM CONFERÊNCIA' | 'CONFERIDO' | 'COM DIVERGÊNCIA';

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  created_at: string;
}

export interface Canal {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export interface Conferencia {
  id: string;
  data: string; // AAAA-MM-DD
  status: StatusConferencia;
  criado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lancamento {
  id: string;
  conferencia_id: string;
  canal_id: string;
  leads_crm: number | null;
  leads_planilha: number | null;
  diferenca: number | null;
  observacao: string | null;
  atualizado_por: string | null;
  updated_at: string;
}

/** Linha da view v_lancamentos (lançamento + data + canal) */
export interface LinhaLancamento {
  id: string;
  conferencia_id: string;
  data: string;
  status_conferencia: StatusConferencia;
  canal_id: string;
  canal_nome: string;
  canal_ordem: number;
  leads_crm: number | null;
  leads_planilha: number | null;
  diferenca: number | null;
  observacao: string | null;
  criado_por: string | null;
  conferencia_atualizada_por: string | null;
  atualizado_por: string | null;
  updated_at: string;
}

export interface RegistroAuditoria {
  id: number;
  tabela: string;
  acao: string;
  registro_id: string | null;
  conferencia_id: string | null;
  data_referencia: string | null;
  canal_nome: string | null;
  dados_antigos: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  created_at: string;
}

export interface Configuracoes {
  limite_divergencia_recorrente: number;
  considerar_fim_de_semana: boolean;
  dias_edicao_atendente: number;
}

export const CONFIG_PADRAO: Configuracoes = {
  limite_divergencia_recorrente: 3,
  considerar_fim_de_semana: true,
  dias_edicao_atendente: 0,
};

export interface Periodo {
  inicio: string; // AAAA-MM-DD
  fim: string;    // AAAA-MM-DD
  preset: PresetPeriodo;
}

export type PresetPeriodo =
  | 'hoje' | 'ontem' | '7d' | '15d' | '30d' | 'este_mes' | 'mes_anterior' | 'data' | 'personalizado';
