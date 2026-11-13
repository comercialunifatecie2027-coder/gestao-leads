import { describe, expect, it } from 'vitest';
import { agregarPeriodo, calcularDiferenca, lerCampoNumerico, resumirDia, situacaoLinha, statusDaConferencia } from '../src/lib/calculos';
import { diasDoIntervalo, formatarData, periodoDoPreset } from '../src/lib/datas';
import type { LinhaLancamento } from '../src/lib/types';

describe('diferença e situação', () => {
  it('segue CRM − Planilha', () => {
    expect(calcularDiferenca(150, 150)).toBe(0);
    expect(calcularDiferenca(150, 145)).toBe(5);
    expect(calcularDiferenca(145, 150)).toBe(-5);
  });
  it('campo vazio não é zero', () => {
    expect(calcularDiferenca(null, 10)).toBeNull();
    expect(situacaoLinha(null, null)).toBe('vazio');
    expect(situacaoLinha(0, null)).toBe('parcial');
    expect(situacaoLinha(0, 0)).toBe('conferido');
    expect(situacaoLinha(10, 3)).toBe('positiva');
    expect(situacaoLinha(3, 10)).toBe('negativa');
  });
  it('lê campos numéricos sem aceitar negativos', () => {
    expect(lerCampoNumerico('')).toBeNull();
    expect(lerCampoNumerico(' 12 ')).toBe(12);
    expect(lerCampoNumerico('0')).toBe(0);
    expect(lerCampoNumerico('-3')).toBeUndefined();
    expect(lerCampoNumerico('1.5')).toBeUndefined();
  });
});

describe('status da conferência', () => {
  const l = (c: number | null, p: number | null) => ({ leads_crm: c, leads_planilha: p });
  it('PENDENTE quando nada foi preenchido', () => expect(statusDaConferencia([l(null, null), l(null, null)])).toBe('PENDENTE'));
  it('EM CONFERÊNCIA com campos faltando', () => expect(statusDaConferencia([l(10, 10), l(5, null)])).toBe('EM CONFERÊNCIA'));
  it('CONFERIDO com zeros preenchidos', () => expect(statusDaConferencia([l(0, 0), l(7, 7)])).toBe('CONFERIDO'));
  it('COM DIVERGÊNCIA', () => expect(statusDaConferencia([l(0, 0), l(7, 8)])).toBe('COM DIVERGÊNCIA'));
});

describe('resumo do dia', () => {
  it('totaliza e conta canais', () => {
    const r = resumirDia([
      { leads_crm: 150, leads_planilha: 145 },
      { leads_crm: 100, leads_planilha: 100 },
      { leads_crm: 20, leads_planilha: null },
    ]);
    expect(r).toMatchObject({ totalCrm: 270, totalPlanilha: 245, diferencaTotal: 5, canaisConferidos: 2, canaisComDivergencia: 1, canaisSemDivergencia: 1, canaisPendentes: 1 });
  });
});

describe('agregação por período', () => {
  const linha = (data: string, canal: string, crm: number | null, pla: number | null, obs: string | null = null): LinhaLancamento => ({
    id: data + canal, conferencia_id: data, data, status_conferencia: 'COM DIVERGÊNCIA', canal_id: canal, canal_nome: canal.toUpperCase(),
    canal_ordem: canal === 'meta' ? 1 : 2, leads_crm: crm, leads_planilha: pla, diferenca: crm !== null && pla !== null ? crm - pla : null,
    observacao: obs, criado_por: null, conferencia_atualizada_por: null, atualizado_por: null, updated_at: '',
  });
  it('acumula dias sem misturar e identifica pendências e recorrência', () => {
    const r = agregarPeriodo({
      linhas: [
        linha('2026-11-01', 'meta', 100, 90, 'Falha integração'),
        linha('2026-11-01', 'google', 50, 50),
        linha('2026-11-02', 'meta', 80, 85),
        linha('2026-11-02', 'google', 40, 40),
      ],
      conferencias: [{ data: '2026-11-01', status: 'COM DIVERGÊNCIA' }, { data: '2026-11-02', status: 'COM DIVERGÊNCIA' }],
      canais: [{ id: 'meta', nome: 'META', ordem: 1 }, { id: 'google', nome: 'GOOGLE', ordem: 2 }],
      dias: diasDoIntervalo('2026-11-01', '2026-11-03'),
      considerarFimDeSemana: true,
      limiteRecorrente: 2,
    });
    expect(r.totalCrm).toBe(270);
    expect(r.totalPlanilha).toBe(265);
    expect(r.diferencaLiquida).toBe(5);
    expect(r.divergenciaAbsoluta).toBe(15);
    expect(r.diasComConferencia).toBe(2);
    expect(r.diasPendentes).toEqual(['2026-11-03']);
    expect(r.canaisComDivergencia).toBe(1);
    expect(r.ocorrenciasDivergencia).toBe(2);
    const meta = r.porCanal.find((c) => c.canal_id === 'meta')!;
    expect(meta.recorrente).toBe(true);
    expect(meta.participacao).toBeCloseTo(180 / 270);
    expect(r.observacoes).toHaveLength(1);
    expect(r.porDia.find((d) => d.data === '2026-11-02')!.diferenca).toBe(-5);
  });
  it('ignora fins de semana sem lançamento quando configurado', () => {
    // 07/11/2026 é sábado e 08/11/2026 é domingo
    const r = agregarPeriodo({ linhas: [], conferencias: [], canais: [], dias: diasDoIntervalo('2026-11-06', '2026-11-09'), considerarFimDeSemana: false, limiteRecorrente: 3 });
    expect(r.diasPendentes).toEqual(['2026-11-06', '2026-11-09']);
  });
});

describe('datas', () => {
  const agora = new Date(2026, 10, 9, 10, 30); // 09/11/2026
  it('presets', () => {
    expect(periodoDoPreset('ontem', agora)).toMatchObject({ inicio: '2026-11-08', fim: '2026-11-08' });
    expect(periodoDoPreset('7d', agora)).toMatchObject({ inicio: '2026-11-03', fim: '2026-11-09' });
    expect(periodoDoPreset('15d', agora)).toMatchObject({ inicio: '2026-10-26' });
    expect(periodoDoPreset('30d', agora)).toMatchObject({ inicio: '2026-10-11' });
    expect(periodoDoPreset('este_mes', agora)).toMatchObject({ inicio: '2026-11-01', fim: '2026-11-09' });
    expect(periodoDoPreset('mes_anterior', agora)).toMatchObject({ inicio: '2026-10-01', fim: '2026-10-31' });
  });
  it('intervalo do exemplo 01/11 a 09/11 tem 9 dias', () => expect(diasDoIntervalo('2026-11-01', '2026-11-09')).toHaveLength(9));
  it('formato DD/MM/AAAA', () => expect(formatarData('2026-11-09')).toBe('09/11/2026'));
});
