import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, History as IconeHistorico, Pencil } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useDadosPeriodo } from '../hooks/useDadosPeriodo';
import { usePerfis } from '../hooks/usePerfis';
import { FiltroPeriodo } from '../components/FiltroPeriodo';
import { Cabecalho, Carregando, ErroCarregamento, StatusBadge, Vazio, corDiferenca } from '../components/ui';
import { ConferenciaDetalhe } from '../components/ConferenciaDetalhe';
import { formatarDiferenca, formatarNumero } from '../lib/calculos';
import { diaSemanaCurto, formatarData } from '../lib/datas';
import type { StatusConferencia } from '../lib/types';

const FILTROS: ('TODOS' | StatusConferencia)[] = ['TODOS', 'PENDENTE', 'EM CONFERÊNCIA', 'CONFERIDO', 'COM DIVERGÊNCIA'];

export function Historico() {
  const { periodo } = useApp();
  const { perfil, ehAdmin } = useAuth();
  const { nomeDe } = usePerfis();
  const { resumo, conferencias, linhas, carregando, erro, recarregar } = useDadosPeriodo(periodo);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('TODOS');
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const confPorData = useMemo(() => new Map(conferencias.map((c) => [c.data, c])), [conferencias]);

  // Atendente: somente conferências em que lançou ou alterou algum dado
  const minhasDatas = useMemo(() => {
    if (ehAdmin || !perfil) return null;
    const s = new Set<string>();
    for (const c of conferencias) if (c.criado_por === perfil.id || c.atualizado_por === perfil.id) s.add(c.data);
    for (const l of linhas) if (l.atualizado_por === perfil.id) s.add(l.data);
    return s;
  }, [ehAdmin, perfil, conferencias, linhas]);

  const dias = useMemo(() => {
    let lista = [...resumo.porDia].reverse();
    if (minhasDatas) lista = lista.filter((d) => minhasDatas.has(d.data));
    if (filtro !== 'TODOS') lista = lista.filter((d) => d.status === filtro);
    return lista;
  }, [resumo.porDia, filtro, minhasDatas]);

  const contagem = (s: (typeof FILTROS)[number]) => {
    const base = minhasDatas ? resumo.porDia.filter((d) => minhasDatas.has(d.data)) : resumo.porDia;
    return s === 'TODOS' ? base.length : base.filter((d) => d.status === s).length;
  };

  return (
    <div>
      <Cabecalho
        titulo={ehAdmin ? 'Histórico de Conferências' : 'Meus Lançamentos'}
        subtitulo={ehAdmin ? 'Todas as conferências registradas, organizadas por data. Clique em um dia para ver os detalhes.' : 'Conferências em que você registrou ou alterou dados.'}
      />
      <FiltroPeriodo />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.filter((f) => ehAdmin || f !== 'PENDENTE').map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filtro === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {f === 'TODOS' ? 'Todos os dias' : f} <span className="ml-1 opacity-70">{contagem(f)}</span>
          </button>
        ))}
      </div>

      {erro ? <ErroCarregamento mensagem={erro} aoTentar={recarregar} /> : carregando ? <Carregando /> : dias.length === 0 ? (
        <div className="card"><Vazio icone={IconeHistorico} titulo="Nenhum registro encontrado" texto="Não há conferências para o período e filtro selecionados." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabela w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th>Data</th><th className="text-right">Leads CRM</th><th className="text-right">Leads Planilha</th>
                  <th className="text-right">Diferença</th><th className="text-center">Canais c/ divergência</th>
                  <th>Responsável</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dias.map((d) => {
                  const c = confPorData.get(d.data);
                  return (
                    <tr key={d.data} className="cursor-pointer transition hover:bg-brand-50/40" onClick={() => setDetalhe(d.data)}>
                      <td className="whitespace-nowrap font-semibold text-slate-800">
                        {formatarData(d.data)} <span className="ml-1 text-xs font-normal capitalize text-slate-400">{diaSemanaCurto(d.data)}</span>
                      </td>
                      <td className="text-right tabular-nums">{c ? formatarNumero(d.crm) : '—'}</td>
                      <td className="text-right tabular-nums">{c ? formatarNumero(d.planilha) : '—'}</td>
                      <td className={`text-right font-bold tabular-nums ${c ? corDiferenca(d.diferenca) : 'text-slate-300'}`}>{c ? formatarDiferenca(d.diferenca) : '—'}</td>
                      <td className="text-center">
                        {c ? <span className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${d.canaisComDivergencia ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{d.canaisComDivergencia}</span> : '—'}
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{c ? nomeDe(c.criado_por) : '—'}</td>
                      <td><StatusBadge status={d.status} pequeno /></td>
                      <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/lancamento?data=${d.data}`} className="btn-fantasma text-xs" title={c ? 'Editar' : 'Lançar'}>
                          <Pencil className="h-4 w-4" /><span className="hidden xl:inline">{c ? 'Editar' : 'Lançar'}</span>
                        </Link>
                        <button className="btn-fantasma" onClick={() => setDetalhe(d.data)} aria-label="Detalhes"><ChevronRight className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConferenciaDetalhe data={detalhe} aoFechar={() => setDetalhe(null)} />
    </div>
  );
}
