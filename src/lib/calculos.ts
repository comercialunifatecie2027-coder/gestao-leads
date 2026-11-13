import type { Canal, Conferencia, LinhaLancamento, StatusConferencia } from './types';
import { ehFimDeSemana } from './datas';

/** null = campo vazio (NUNCA tratado como zero) */
export type Num = number | null;

export function calcularDiferenca(crm: Num, planilha: Num): Num {
  if (crm === null || planilha === null) return null;
  return crm - planilha;
}

export type SituacaoLinha = 'vazio' | 'parcial' | 'conferido' | 'positiva' | 'negativa';

export function situacaoLinha(crm: Num, planilha: Num): SituacaoLinha {
  if (crm === null && planilha === null) return 'vazio';
  if (crm === null || planilha === null) return 'parcial';
  const d = crm - planilha;
  if (d === 0) return 'conferido';
  return d > 0 ? 'positiva' : 'negativa';
}

/** Espelha public.calcular_status() do banco */
export function statusDaConferencia(linhas: { leads_crm: Num; leads_planilha: Num }[]): StatusConferencia {
  const algum = linhas.some((l) => l.leads_crm !== null || l.leads_planilha !== null);
  if (!algum) return 'PENDENTE';
  if (linhas.some((l) => l.leads_crm === null || l.leads_planilha === null)) return 'EM CONFERÊNCIA';
  if (linhas.some((l) => (l.leads_crm as number) - (l.leads_planilha as number) !== 0)) return 'COM DIVERGÊNCIA';
  return 'CONFERIDO';
}

/** Converte o texto digitado em número (ou null). Retorna undefined se inválido. */
export function lerCampoNumerico(texto: string): Num | undefined {
  const t = texto.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n > 2_000_000_000) return undefined;
  return n;
}

export function formatarDiferenca(d: Num): string {
  if (d === null) return '—';
  if (d > 0) return `+${d.toLocaleString('pt-BR')}`;
  return d.toLocaleString('pt-BR');
}

export function formatarNumero(n: Num | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('pt-BR');
}

export function formatarPercentual(p: number | null, casas = 1): string {
  if (p === null || !Number.isFinite(p)) return '—';
  return `${(p * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export interface ResumoDia {
  totalCrm: number;
  totalPlanilha: number;
  diferencaTotal: number;
  canaisConferidos: number;     // os dois campos preenchidos
  canaisComDivergencia: number; // preenchidos e diferença ≠ 0
  canaisSemDivergencia: number; // preenchidos e diferença = 0
  canaisPendentes: number;      // algum campo vazio
}

export function resumirDia(linhas: { leads_crm: Num; leads_planilha: Num }[]): ResumoDia {
  const r: ResumoDia = {
    totalCrm: 0, totalPlanilha: 0, diferencaTotal: 0,
    canaisConferidos: 0, canaisComDivergencia: 0, canaisSemDivergencia: 0, canaisPendentes: 0,
  };
  for (const l of linhas) {
    if (l.leads_crm !== null) r.totalCrm += l.leads_crm;
    if (l.leads_planilha !== null) r.totalPlanilha += l.leads_planilha;
    const d = calcularDiferenca(l.leads_crm, l.leads_planilha);
    if (d === null) { r.canaisPendentes++; continue; }
    r.canaisConferidos++;
    r.diferencaTotal += d;
    if (d === 0) r.canaisSemDivergencia++; else r.canaisComDivergencia++;
  }
  return r;
}

// ---------------------------------------------------------------------
// Agregação por período
// ---------------------------------------------------------------------

export interface ResumoCanal {
  canal_id: string;
  nome: string;
  ordem: number;
  crm: number;
  planilha: number;
  diferenca: number;           // líquida (soma de CRM − Planilha nas linhas completas)
  divergenciaAbsoluta: number; // soma de |CRM − Planilha|
  diasLancados: number;        // dias com os dois campos preenchidos
  diasComDivergencia: number;
  participacao: number;        // fração do total de leads no CRM
  percentualDivergencia: number | null; // divergência absoluta / CRM (linhas completas)
  recorrente: boolean;
}

export interface ResumoDiaPeriodo {
  data: string;
  status: StatusConferencia;
  crm: number;
  planilha: number;
  diferenca: number;
  divergenciaAbsoluta: number;
  canaisComDivergencia: number;
  temConferencia: boolean;
}

export interface Observacao {
  data: string;
  canal: string;
  texto: string;
  diferenca: Num;
}

export interface ResumoPeriodo {
  totalCrm: number;
  totalPlanilha: number;
  diferencaLiquida: number;
  divergenciaAbsoluta: number;
  percentualDivergencia: number | null;
  diasNoPeriodo: number;          // dias considerados para controle
  diasComConferencia: number;     // existe conferência salva
  diasFinalizados: number;        // CONFERIDO ou COM DIVERGÊNCIA
  diasPendentes: string[];        // sem conferência ou EM CONFERÊNCIA
  canaisComDivergencia: number;   // canais distintos com ao menos 1 divergência
  ocorrenciasDivergencia: number; // nº de pares (dia, canal) divergentes
  porCanal: ResumoCanal[];
  porDia: ResumoDiaPeriodo[];
  observacoes: Observacao[];
  contagemStatus: Record<StatusConferencia, number>;
}

export function agregarPeriodo(params: {
  linhas: LinhaLancamento[];
  conferencias: Pick<Conferencia, 'data' | 'status'>[];
  canais: Pick<Canal, 'id' | 'nome' | 'ordem'>[];
  dias: string[];
  considerarFimDeSemana: boolean;
  limiteRecorrente: number;
}): ResumoPeriodo {
  const { linhas, conferencias, canais, dias, considerarFimDeSemana, limiteRecorrente } = params;
  const statusPorData = new Map(conferencias.map((c) => [c.data, c.status]));

  const canaisMap = new Map<string, ResumoCanal>();
  const garantirCanal = (id: string, nome: string, ordem: number) => {
    let c = canaisMap.get(id);
    if (!c) {
      c = {
        canal_id: id, nome, ordem, crm: 0, planilha: 0, diferenca: 0, divergenciaAbsoluta: 0,
        diasLancados: 0, diasComDivergencia: 0, participacao: 0, percentualDivergencia: null, recorrente: false,
      };
      canaisMap.set(id, c);
    }
    return c;
  };
  for (const c of canais) garantirCanal(c.id, c.nome, c.ordem);

  const diaMap = new Map<string, ResumoDiaPeriodo>();
  const crmCompletoPorCanal = new Map<string, number>();
  const observacoes: Observacao[] = [];

  let totalCrm = 0, totalPlanilha = 0, diferencaLiquida = 0, divergenciaAbsoluta = 0, crmCompleto = 0;
  let ocorrencias = 0;

  for (const l of linhas) {
    const c = garantirCanal(l.canal_id, l.canal_nome, l.canal_ordem);
    let d = diaMap.get(l.data);
    if (!d) {
      d = {
        data: l.data, status: l.status_conferencia, crm: 0, planilha: 0, diferenca: 0,
        divergenciaAbsoluta: 0, canaisComDivergencia: 0, temConferencia: true,
      };
      diaMap.set(l.data, d);
    }
    if (l.leads_crm !== null) { c.crm += l.leads_crm; d.crm += l.leads_crm; totalCrm += l.leads_crm; }
    if (l.leads_planilha !== null) { c.planilha += l.leads_planilha; d.planilha += l.leads_planilha; totalPlanilha += l.leads_planilha; }
    const dif = calcularDiferenca(l.leads_crm, l.leads_planilha);
    if (dif !== null) {
      c.diasLancados++;
      c.diferenca += dif; d.diferenca += dif; diferencaLiquida += dif;
      const abs = Math.abs(dif);
      c.divergenciaAbsoluta += abs; d.divergenciaAbsoluta += abs; divergenciaAbsoluta += abs;
      crmCompleto += l.leads_crm as number;
      crmCompletoPorCanal.set(l.canal_id, (crmCompletoPorCanal.get(l.canal_id) ?? 0) + (l.leads_crm as number));
      if (dif !== 0) { c.diasComDivergencia++; d.canaisComDivergencia++; ocorrencias++; }
    }
    if (l.observacao && l.observacao.trim()) {
      observacoes.push({ data: l.data, canal: l.canal_nome, texto: l.observacao.trim(), diferenca: dif });
    }
  }

  const porCanal = [...canaisMap.values()]
    .map((c) => {
      const base = crmCompletoPorCanal.get(c.canal_id) ?? 0;
      return {
        ...c,
        participacao: totalCrm > 0 ? c.crm / totalCrm : 0,
        percentualDivergencia: base > 0 ? c.divergenciaAbsoluta / base : c.divergenciaAbsoluta > 0 ? 1 : null,
        recorrente: limiteRecorrente > 0 && c.diasComDivergencia >= limiteRecorrente,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  const contagemStatus: Record<StatusConferencia, number> = {
    PENDENTE: 0, 'EM CONFERÊNCIA': 0, CONFERIDO: 0, 'COM DIVERGÊNCIA': 0,
  };
  const diasConsiderados = dias.filter((d) => considerarFimDeSemana || !ehFimDeSemana(d) || statusPorData.has(d));
  const porDia: ResumoDiaPeriodo[] = diasConsiderados.map((data) => {
    const existente = diaMap.get(data);
    const status = statusPorData.get(data) ?? 'PENDENTE';
    contagemStatus[status]++;
    if (existente) return { ...existente, status };
    return {
      data, status, crm: 0, planilha: 0, diferenca: 0, divergenciaAbsoluta: 0, canaisComDivergencia: 0,
      temConferencia: statusPorData.has(data),
    };
  });

  const diasPendentes = porDia.filter((d) => d.status === 'PENDENTE' || d.status === 'EM CONFERÊNCIA').map((d) => d.data);

  observacoes.sort((a, b) => (a.data === b.data ? a.canal.localeCompare(b.canal) : a.data < b.data ? 1 : -1));

  return {
    totalCrm,
    totalPlanilha,
    diferencaLiquida,
    divergenciaAbsoluta,
    percentualDivergencia: crmCompleto > 0 ? divergenciaAbsoluta / crmCompleto : null,
    diasNoPeriodo: porDia.length,
    diasComConferencia: porDia.filter((d) => statusPorData.has(d.data)).length,
    diasFinalizados: contagemStatus.CONFERIDO + contagemStatus['COM DIVERGÊNCIA'],
    diasPendentes,
    canaisComDivergencia: porCanal.filter((c) => c.diasComDivergencia > 0).length,
    ocorrenciasDivergencia: ocorrencias,
    porCanal,
    porDia,
    observacoes,
    contagemStatus,
  };
}
