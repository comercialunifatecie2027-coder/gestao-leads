import type { ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts';
import type { ResumoCanal, ResumoDiaPeriodo } from '../lib/calculos';
import { formatarPercentual } from '../lib/calculos';
import { formatarData, formatarDiaMes } from '../lib/datas';
import type { Canal } from '../lib/types';

// Paleta categórica validada (ordem fixa — a cor acompanha o canal, nunca a posição no ranking)
export const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const COR_CRM = '#eb6834';
export const COR_PLANILHA = '#2a78d6';
export const COR_DIVERGENCIA = '#e34948';
const COR_EIXO = '#64748b';
const COR_GRADE = '#eef2f6';

export function corDoCanal(canalId: string, canais: Pick<Canal, 'id' | 'ordem' | 'nome'>[]): string {
  const ordenados = [...canais].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  const i = ordenados.findIndex((c) => c.id === canalId);
  return i >= 0 && i < PALETA.length ? PALETA[i] : '#94a3b8';
}

const fmt = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v));

export function CaixaGrafico({ titulo, subtitulo, children, className = '' }: { titulo: string; subtitulo?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="font-semibold text-slate-800">{titulo}</h3>
      {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DicaPadrao({ active, payload, label, rotulo }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; rotulo?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-800">{rotulo ? rotulo(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="text-slate-800">{fmt(p.value)}</b>
        </p>
      ))}
    </div>
  );
}

const eixo = { tick: { fill: COR_EIXO, fontSize: 12 }, axisLine: false, tickLine: false } as const;

export function GraficoVolumePorCanal({ porCanal, canais }: { porCanal: ResumoCanal[]; canais: Canal[] }) {
  const dados = [...porCanal].sort((a, b) => b.crm - a.crm).map((c) => ({ nome: c.nome, Leads: c.crm, cor: corDoCanal(c.canal_id, canais) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 44)}>
      <BarChart data={dados} layout="vertical" margin={{ left: 10, right: 40 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke={COR_GRADE} />
        <XAxis type="number" {...eixo} tickFormatter={fmt} />
        <YAxis type="category" dataKey="nome" {...eixo} width={110} />
        <Tooltip content={<DicaPadrao />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="Leads" name="Leads no CRM" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#334155', fontSize: 12, formatter: fmt }}>
          {dados.map((d) => <Cell key={d.nome} fill={d.cor} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoCrmPlanilha({ porCanal }: { porCanal: ResumoCanal[] }) {
  const dados = porCanal.map((c) => ({ nome: c.nome, CRM: c.crm, Planilha: c.planilha }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={COR_GRADE} />
        <XAxis dataKey="nome" {...eixo} interval={0} height={40} tick={<TickQuebrado />} />
        <YAxis {...eixo} tickFormatter={fmt} width={50} />
        <Tooltip content={<DicaPadrao />} cursor={{ fill: '#f8fafc' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="CRM" name="CRM" fill={COR_CRM} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Planilha" name="Planilha" fill={COR_PLANILHA} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoEvolucaoDiaria({ porDia }: { porDia: ResumoDiaPeriodo[] }) {
  const dados = porDia.filter((d) => d.temConferencia).map((d) => ({ data: d.data, CRM: d.crm, Planilha: d.planilha }));
  if (dados.length === 0) return <SemDados />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={dados}>
        <CartesianGrid vertical={false} stroke={COR_GRADE} />
        <XAxis dataKey="data" {...eixo} tickFormatter={formatarDiaMes} minTickGap={16} />
        <YAxis {...eixo} tickFormatter={fmt} width={50} />
        <Tooltip content={<DicaPadrao rotulo={formatarData} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="CRM" stroke={COR_CRM} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="Planilha" stroke={COR_PLANILHA} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoDivergencias({ porDia }: { porDia: ResumoDiaPeriodo[] }) {
  const dados = porDia.filter((d) => d.temConferencia).map((d) => ({
    data: d.data, 'Divergência absoluta': d.divergenciaAbsoluta, 'Diferença líquida': d.diferenca,
  }));
  if (dados.length === 0) return <SemDados />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={dados}>
        <CartesianGrid vertical={false} stroke={COR_GRADE} />
        <XAxis dataKey="data" {...eixo} tickFormatter={formatarDiaMes} minTickGap={16} />
        <YAxis {...eixo} tickFormatter={fmt} width={50} />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        <Tooltip content={<DicaPadrao rotulo={formatarData} />} cursor={{ fill: '#f8fafc' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Divergência absoluta" fill={COR_DIVERGENCIA} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line type="monotone" dataKey="Diferença líquida" stroke="#334155" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function GraficoParticipacao({ porCanal, canais }: { porCanal: ResumoCanal[]; canais: Canal[] }) {
  const dados = porCanal.filter((c) => c.crm > 0).map((c) => ({ nome: c.nome, valor: c.crm, pct: c.participacao, cor: corDoCanal(c.canal_id, canais) }));
  if (dados.length === 0) return <SemDados />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[220px] w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="58%" outerRadius="90%" paddingAngle={1} stroke="#fff" strokeWidth={2}>
              {dados.map((d) => <Cell key={d.nome} fill={d.cor} />)}
            </Pie>
            <Tooltip formatter={(v: unknown, n: unknown) => [fmt(v), String(n)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 sm:w-1/2">
        {[...dados].sort((a, b) => b.valor - a.valor).map((d) => (
          <li key={d.nome} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: d.cor }} />
            <span className="flex-1 truncate text-slate-700">{d.nome}</span>
            <span className="tabular-nums text-slate-500">{fmt(d.valor)}</span>
            <span className="w-14 text-right font-semibold tabular-nums text-slate-800">{formatarPercentual(d.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TickQuebrado({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const partes = String(payload?.value ?? '').split(' ');
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor="middle" fill={COR_EIXO} fontSize={11}>
      {partes.map((p, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>{p}</tspan>)}
    </text>
  );
}

function SemDados() {
  return <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Sem lançamentos no período selecionado.</div>;
}
