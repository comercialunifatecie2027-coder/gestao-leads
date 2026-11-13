import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, X, CircleDashed, type LucideIcon } from 'lucide-react';
import type { StatusConferencia } from '../lib/types';

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

export function Vazio({ icone: Icone = CircleDashed, titulo, texto, acao }: { icone?: LucideIcon; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-2xl bg-brand-50 p-3"><Icone className="h-6 w-6 text-brand-500" /></div>
      <p className="font-semibold text-slate-700">{titulo}</p>
      {texto && <p className="mt-1 max-w-md text-sm text-slate-500">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 no-print">{acoes}</div>}
    </div>
  );
}

const ESTILO_STATUS: Record<StatusConferencia, { cls: string; icone: LucideIcon }> = {
  PENDENTE: { cls: 'bg-slate-100 text-slate-600 ring-slate-200', icone: Clock },
  'EM CONFERÊNCIA': { cls: 'bg-sky-50 text-sky-700 ring-sky-200', icone: CircleDashed },
  CONFERIDO: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icone: CheckCircle2 },
  'COM DIVERGÊNCIA': { cls: 'bg-red-50 text-red-700 ring-red-200', icone: AlertTriangle },
};

export function StatusBadge({ status, pequeno }: { status: StatusConferencia; pequeno?: boolean }) {
  const { cls, icone: I } = ESTILO_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${cls} ${pequeno ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}>
      <I className={pequeno ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {status}
    </span>
  );
}

/** Indicador por canal: verde (=0), laranja (+), vermelho (−), cinza (incompleto) */
export function IndicadorDiferenca({ diferenca, compacto }: { diferenca: number | null; compacto?: boolean }) {
  if (diferenca === null) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"><Clock className="h-3.5 w-3.5" />{compacto ? '—' : 'AGUARDANDO'}</span>;
  }
  if (diferenca === 0) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />CONFERIDO</span>;
  }
  const pos = diferenca > 0;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${pos ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
      <AlertTriangle className="h-3.5 w-3.5" />DIVERGÊNCIA
    </span>
  );
}

export function corDiferenca(d: number | null): string {
  if (d === null) return 'text-slate-400';
  if (d === 0) return 'text-emerald-600';
  return d > 0 ? 'text-orange-600' : 'text-red-600';
}

export function Modal({ aberto, aoFechar, titulo, children, largura = 'max-w-3xl', rodape }: {
  aberto: boolean; aoFechar: () => void; titulo: ReactNode; children: ReactNode; largura?: string; rodape?: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={aoFechar}>
      <div
        role="dialog" aria-modal="true"
        className={`flex max-h-[92vh] w-full ${largura} flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl animate-[entrar_.18s_ease-out]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <button className="btn-fantasma" onClick={aoFechar} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

export function Confirmar({ aberto, titulo, texto, rotuloConfirmar = 'Confirmar', perigo, processando, aoConfirmar, aoCancelar }: {
  aberto: boolean; titulo: string; texto: ReactNode; rotuloConfirmar?: string; perigo?: boolean; processando?: boolean;
  aoConfirmar: () => void; aoCancelar: () => void;
}) {
  return (
    <Modal aberto={aberto} aoFechar={aoCancelar} titulo={titulo} largura="max-w-md"
      rodape={<>
        <button className="btn-secundario" onClick={aoCancelar} disabled={processando}>Cancelar</button>
        <button className={perigo ? 'btn-perigo' : 'btn-primario'} onClick={aoConfirmar} disabled={processando}>
          {processando && <Loader2 className="h-4 w-4 animate-spin" />}{rotuloConfirmar}
        </button>
      </>}>
      <div className="text-sm text-slate-600">{texto}</div>
    </Modal>
  );
}

export function CardIndicador({ titulo, valor, detalhe, icone: Icone, tom = 'brand' }: {
  titulo: string; valor: ReactNode; detalhe?: ReactNode; icone: LucideIcon; tom?: 'brand' | 'verde' | 'vermelho' | 'cinza' | 'laranja';
}) {
  const tons = {
    brand: 'bg-brand-50 text-brand-600',
    verde: 'bg-emerald-50 text-emerald-600',
    vermelho: 'bg-red-50 text-red-600',
    laranja: 'bg-orange-50 text-orange-600',
    cinza: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
        <div className={`rounded-xl p-2 ${tons[tom]}`}><Icone className="h-5 w-5" /></div>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{valor}</p>
      {detalhe && <div className="mt-1 text-xs text-slate-500">{detalhe}</div>}
    </div>
  );
}

export function ErroCarregamento({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <p className="text-sm text-slate-600">{mensagem}</p>
      {aoTentar && <button className="btn-secundario" onClick={aoTentar}>Tentar novamente</button>}
    </div>
  );
}
