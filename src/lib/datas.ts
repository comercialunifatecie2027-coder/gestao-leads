import {
  addDays, eachDayOfInterval, endOfMonth, format, isWeekend, parseISO, startOfMonth, subDays, subMonths,
  differenceInCalendarDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Periodo, PresetPeriodo } from './types';

/** Data local (fuso do navegador) no formato AAAA-MM-DD */
export function isoLocal(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function hojeISO(agora: Date = new Date()): string {
  return isoLocal(agora);
}

export function ontemISO(agora: Date = new Date()): string {
  return isoLocal(subDays(agora, 1));
}

/** AAAA-MM-DD -> Date local à meia-noite (evita deslocamento de fuso) */
export function paraData(iso: string): Date {
  return parseISO(iso);
}

/** AAAA-MM-DD -> DD/MM/AAAA */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function formatarDataHora(isoTs: string | null | undefined): string {
  if (!isoTs) return '—';
  return format(new Date(isoTs), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function diaSemana(iso: string): string {
  return format(paraData(iso), 'EEEE', { locale: ptBR });
}

export function diaSemanaCurto(iso: string): string {
  return format(paraData(iso), 'EEE', { locale: ptBR }).replace('.', '');
}

export function formatarDiaMes(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export const ROTULOS_PRESET: Record<PresetPeriodo, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  '7d': 'Últimos 7 dias',
  '15d': 'Últimos 15 dias',
  '30d': 'Últimos 30 dias',
  este_mes: 'Este mês',
  mes_anterior: 'Mês anterior',
  data: 'Data específica',
  personalizado: 'Período personalizado',
};

/**
 * Calcula o intervalo de um preset. "Últimos N dias" inclui hoje
 * (ex.: últimos 7 dias em 09/11 = 03/11 a 09/11).
 */
export function periodoDoPreset(preset: PresetPeriodo, agora: Date = new Date(), base?: Partial<Periodo>): Periodo {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  switch (preset) {
    case 'hoje':
      return { preset, inicio: isoLocal(hoje), fim: isoLocal(hoje) };
    case 'ontem': {
      const o = subDays(hoje, 1);
      return { preset, inicio: isoLocal(o), fim: isoLocal(o) };
    }
    case '7d':
      return { preset, inicio: isoLocal(subDays(hoje, 6)), fim: isoLocal(hoje) };
    case '15d':
      return { preset, inicio: isoLocal(subDays(hoje, 14)), fim: isoLocal(hoje) };
    case '30d':
      return { preset, inicio: isoLocal(subDays(hoje, 29)), fim: isoLocal(hoje) };
    case 'este_mes':
      return { preset, inicio: isoLocal(startOfMonth(hoje)), fim: isoLocal(hoje) };
    case 'mes_anterior': {
      const m = subMonths(hoje, 1);
      return { preset, inicio: isoLocal(startOfMonth(m)), fim: isoLocal(endOfMonth(m)) };
    }
    case 'data': {
      const d = base?.inicio ?? isoLocal(subDays(hoje, 1));
      return { preset, inicio: d, fim: d };
    }
    case 'personalizado':
    default:
      return {
        preset: 'personalizado',
        inicio: base?.inicio ?? isoLocal(subDays(hoje, 6)),
        fim: base?.fim ?? isoLocal(hoje),
      };
  }
}

/** Lista todos os dias (AAAA-MM-DD) do intervalo, inclusive */
export function diasDoIntervalo(inicio: string, fim: string): string[] {
  if (!inicio || !fim || inicio > fim) return [];
  return eachDayOfInterval({ start: paraData(inicio), end: paraData(fim) }).map(isoLocal);
}

export function ehFimDeSemana(iso: string): boolean {
  return isWeekend(paraData(iso));
}

export function qtdDias(inicio: string, fim: string): number {
  return differenceInCalendarDays(paraData(fim), paraData(inicio)) + 1;
}

export function somarDias(iso: string, n: number): string {
  return isoLocal(addDays(paraData(iso), n));
}

export function descreverPeriodo(p: Periodo): string {
  if (p.inicio === p.fim) return formatarData(p.inicio);
  return `${formatarData(p.inicio)} a ${formatarData(p.fim)}`;
}
