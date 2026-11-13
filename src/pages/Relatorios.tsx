import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileText, FileDown, Printer, Loader2, Repeat, ArrowLeftRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useDadosPeriodo } from '../hooks/useDadosPeriodo';
import { FiltroPeriodo } from '../components/FiltroPeriodo';
import { Cabecalho, Carregando, ErroCarregamento, StatusBadge, Vazio, corDiferenca } from '../components/ui';
import { CaixaGrafico, GraficoCrmPlanilha, GraficoDivergencias, GraficoParticipacao, corDoCanal } from '../components/Graficos';
import { ConferenciaDetalhe } from '../components/ConferenciaDetalhe';
import { calcularDiferenca, formatarDiferenca, formatarNumero, formatarPercentual } from '../lib/calculos';
import { descreverPeriodo, diaSemanaCurto, formatarData, formatarDataHora, hojeISO, ontemISO, somarDias } from '../lib/datas';
import { exportarCsv, exportarPdf, exportarXlsx } from '../lib/exportar';
import { listarLinhas } from '../lib/api';
import { mensagemErro } from '../lib/supabase';
import type { LinhaLancamento } from '../lib/types';

type Aba = 'resumo' | 'diario' | 'comparar';

export function Relatorios() {
  const { periodo, canais, notificar } = useApp();
  const { perfil } = useAuth();
  const { resumo, linhas, carregando, erro, recarregar } = useDadosPeriodo(periodo);
  const [aba, setAba] = useState<Aba>('resumo');
  const [exportando, setExportando] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const exportar = async (tipo: 'xlsx' | 'pdf' | 'csv') => {
    if (!linhas.length) { notificar('info', 'Não há lançamentos no período selecionado para exportar.'); return; }
    setExportando(tipo);
    try {
      const quem = perfil?.nome ?? '';
      if (tipo === 'xlsx') await exportarXlsx(resumo, linhas, periodo, quem);
      else if (tipo === 'pdf') await exportarPdf(resumo, periodo, quem);
      else exportarCsv(linhas, periodo);
      notificar('sucesso', 'Arquivo gerado com sucesso.');
    } catch (e) {
      notificar('erro', `Falha ao gerar o arquivo: ${mensagemErro(e)}`);
    } finally {
      setExportando(null);
    }
  };

  const BotaoExp = ({ tipo, icone: I, rotulo }: { tipo: 'xlsx' | 'pdf' | 'csv'; icone: typeof FileText; rotulo: string }) => (
    <button className="btn-secundario" onClick={() => exportar(tipo)} disabled={!!exportando || carregando}>
      {exportando === tipo ? <Loader2 className="h-4 w-4 animate-spin" /> : <I className="h-4 w-4" />}{rotulo}
    </button>
  );

  return (
    <div>
      <Cabecalho
        titulo="Relatórios Gerenciais"
        subtitulo={`Período analisado: ${descreverPeriodo(periodo)}`}
        acoes={<>
          <BotaoExp tipo="xlsx" icone={FileSpreadsheet} rotulo="Excel" />
          <BotaoExp tipo="pdf" icone={FileText} rotulo="PDF" />
          <BotaoExp tipo="csv" icone={FileDown} rotulo="CSV" />
          <button className="btn-primario" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</button>
        </>}
      />
      <FiltroPeriodo />

      {/* cabeçalho exclusivo da impressão */}
      <div className="so-print mb-4 border-b-4 border-brand-500 pb-3">
        <p className="text-xl font-bold">Relatório de Conferência de Leads — UniFatecie</p>
        <p className="text-sm text-slate-600">Período: {descreverPeriodo(periodo)} · Gerado em {formatarDataHora(new Date().toISOString())} por {perfil?.nome}</p>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold no-print">
        {([['resumo', 'Resumo do período'], ['diario', 'Detalhamento diário por canal'], ['comparar', 'Comparar dias']] as [Aba, string][]).map(([a, r]) => (
          <button key={a} onClick={() => setAba(a)} className={`flex-1 rounded-lg px-3 py-2 transition ${aba === a ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{r}</button>
        ))}
      </div>

      {erro ? <ErroCarregamento mensagem={erro} aoTentar={recarregar} /> : carregando ? <Carregando /> : aba === 'resumo' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi rotulo="Leads no CRM" valor={formatarNumero(resumo.totalCrm)} />
            <Kpi rotulo="Leads nas planilhas" valor={formatarNumero(resumo.totalPlanilha)} />
            <Kpi rotulo="Diferença acumulada" valor={formatarDiferenca(resumo.diferencaLiquida)} cor={corDiferenca(resumo.diferencaLiquida)} />
            <Kpi rotulo="% de divergência" valor={formatarPercentual(resumo.percentualDivergencia)} sub={`${formatarNumero(resumo.divergenciaAbsoluta)} leads (absoluto)`} />
            <Kpi rotulo="Dias analisados" valor={`${resumo.diasComConferencia}`} sub={`de ${resumo.diasNoPeriodo} no período · ${resumo.diasPendentes.length} pendente(s)`} />
            <Kpi rotulo="Canais c/ divergência" valor={`${resumo.canaisComDivergencia}`} sub={`${resumo.ocorrenciasDivergencia} ocorrência(s)`} />
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-800">Resultados por canal</h3></div>
            <div className="overflow-x-auto">
              <table className="tabela w-full">
                <thead className="bg-slate-50">
                  <tr><th>Canal</th><th className="text-right">CRM</th><th className="text-right">Planilha</th><th className="text-right">Diferença</th>
                    <th className="text-right">Diverg. absoluta</th><th className="text-right">% diverg.</th><th className="text-right">% participação</th>
                    <th className="text-center">Dias c/ divergência</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumo.porCanal.map((c) => (
                    <tr key={c.canal_id} className={c.recorrente ? 'bg-red-50/40' : ''}>
                      <td className="font-semibold">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: corDoCanal(c.canal_id, canais) }} />{c.nome}
                        {c.recorrente && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700"><Repeat className="h-3 w-3" />RECORRENTE</span>}
                      </td>
                      <td className="text-right tabular-nums">{formatarNumero(c.crm)}</td>
                      <td className="text-right tabular-nums">{formatarNumero(c.planilha)}</td>
                      <td className={`text-right font-bold tabular-nums ${corDiferenca(c.diferenca)}`}>{formatarDiferenca(c.diferenca)}</td>
                      <td className="text-right tabular-nums">{formatarNumero(c.divergenciaAbsoluta)}</td>
                      <td className="text-right tabular-nums">{formatarPercentual(c.percentualDivergencia)}</td>
                      <td className="text-right tabular-nums">{formatarPercentual(c.participacao)}</td>
                      <td className="text-center tabular-nums">{c.diasComDivergencia} <span className="text-slate-400">de {c.diasLancados}</span></td>
                      <td className="text-right no-print"><Link className="text-xs font-semibold text-brand-600 hover:underline" to={`/canais/${c.canal_id}`}>Histórico</Link></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <tr><td>TOTAL</td><td className="text-right">{formatarNumero(resumo.totalCrm)}</td><td className="text-right">{formatarNumero(resumo.totalPlanilha)}</td>
                    <td className={`text-right ${corDiferenca(resumo.diferencaLiquida)}`}>{formatarDiferenca(resumo.diferencaLiquida)}</td>
                    <td className="text-right">{formatarNumero(resumo.divergenciaAbsoluta)}</td><td className="text-right">{formatarPercentual(resumo.percentualDivergencia)}</td>
                    <td className="text-right">100%</td><td className="text-center">{resumo.ocorrenciasDivergencia}</td><td /></tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CaixaGrafico titulo="Comparativo CRM × Planilha por canal"><GraficoCrmPlanilha porCanal={resumo.porCanal} /></CaixaGrafico>
            <CaixaGrafico titulo="Participação percentual por canal"><GraficoParticipacao porCanal={resumo.porCanal} canais={canais} /></CaixaGrafico>
            <CaixaGrafico titulo="Histórico diário de divergências" className="xl:col-span-2"><GraficoDivergencias porDia={resumo.porDia} /></CaixaGrafico>
          </div>

          <div className="card overflow-hidden print-break">
            <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-800">Histórico diário</h3></div>
            <div className="overflow-x-auto">
              <table className="tabela w-full">
                <thead className="bg-slate-50"><tr><th>Data</th><th>Status</th><th className="text-right">CRM</th><th className="text-right">Planilha</th><th className="text-right">Diferença</th><th className="text-right">Diverg. absoluta</th><th className="text-center">Canais c/ diverg.</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {[...resumo.porDia].reverse().map((d) => (
                    <tr key={d.data} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetalhe(d.data)}>
                      <td className="whitespace-nowrap font-medium">{formatarData(d.data)} <span className="text-xs capitalize text-slate-400">{diaSemanaCurto(d.data)}</span></td>
                      <td><StatusBadge status={d.status} pequeno /></td>
                      <td className="text-right tabular-nums">{d.temConferencia ? formatarNumero(d.crm) : '—'}</td>
                      <td className="text-right tabular-nums">{d.temConferencia ? formatarNumero(d.planilha) : '—'}</td>
                      <td className={`text-right font-bold tabular-nums ${d.temConferencia ? corDiferenca(d.diferenca) : 'text-slate-300'}`}>{d.temConferencia ? formatarDiferenca(d.diferenca) : '—'}</td>
                      <td className="text-right tabular-nums">{d.temConferencia ? formatarNumero(d.divergenciaAbsoluta) : '—'}</td>
                      <td className="text-center tabular-nums">{d.temConferencia ? d.canaisComDivergencia : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-semibold text-slate-800">Observações registradas no período ({resumo.observacoes.length})</h3>
            {resumo.observacoes.length === 0 ? <p className="text-sm text-slate-400">Nenhuma observação registrada.</p> : (
              <ul className="divide-y divide-slate-100">
                {resumo.observacoes.map((o, i) => (
                  <li key={i} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                    <span className="w-24 shrink-0 text-sm font-semibold text-slate-700">{formatarData(o.data)}</span>
                    <span className="w-36 shrink-0 text-sm font-medium text-slate-600">{o.canal} <span className={`ml-1 font-bold ${corDiferenca(o.diferenca)}`}>{formatarDiferenca(o.diferenca)}</span></span>
                    <span className="text-sm text-slate-600">{o.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : aba === 'diario' ? (
        <DetalhamentoDiario linhas={linhas} />
      ) : (
        <CompararDias />
      )}
      <ConferenciaDetalhe data={detalhe} aoFechar={() => setDetalhe(null)} />
    </div>
  );
}

function Kpi({ rotulo, valor, sub, cor = 'text-slate-900' }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/** Matriz dia × canal com CRM / Planilha / Diferença */
function DetalhamentoDiario({ linhas }: { linhas: LinhaLancamento[] }) {
  const { canais } = useApp();
  const [canalSel, setCanalSel] = useState<string>('');
  const canaisUsados = useMemo(() => {
    const ids = new Set(linhas.map((l) => l.canal_id));
    return canais.filter((c) => ids.has(c.id));
  }, [linhas, canais]);
  const visiveis = canalSel ? canaisUsados.filter((c) => c.id === canalSel) : canaisUsados;
  const datas = useMemo(() => [...new Set(linhas.map((l) => l.data))].sort().reverse(), [linhas]);
  const idx = useMemo(() => new Map(linhas.map((l) => [`${l.data}|${l.canal_id}`, l])), [linhas]);

  if (!linhas.length) return <div className="card"><Vazio titulo="Sem lançamentos no período" /></div>;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 no-print">
        <label className="text-sm font-medium text-slate-600" htmlFor="canal-sel">Canal:</label>
        <select id="canal-sel" className="campo w-auto" value={canalSel} onChange={(e) => setCanalSel(e.target.value)}>
          <option value="">Todos os canais</option>
          {canaisUsados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span className="text-xs text-slate-500">Cada célula: CRM / Planilha e a diferença.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="tabela w-full">
          <thead className="bg-slate-50">
            <tr><th className="sticky left-0 bg-slate-50">Data</th>{visiveis.map((c) => <th key={c.id} className="text-center">{c.nome}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {datas.map((d) => (
              <tr key={d}>
                <td className="sticky left-0 whitespace-nowrap bg-white font-medium">{formatarData(d)}</td>
                {visiveis.map((c) => {
                  const l = idx.get(`${d}|${c.id}`);
                  const dif = l ? calcularDiferenca(l.leads_crm, l.leads_planilha) : null;
                  return (
                    <td key={c.id} className={`text-center ${dif ? (dif > 0 ? 'bg-orange-50' : 'bg-red-50') : ''}`} title={l?.observacao ?? ''}>
                      {l ? (
                        <>
                          <span className="tabular-nums text-slate-700">{formatarNumero(l.leads_crm)} / {formatarNumero(l.leads_planilha)}</span>
                          <span className={`block text-xs font-bold ${corDiferenca(dif)}`}>{formatarDiferenca(dif)}{l.observacao ? ' 💬' : ''}</span>
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Comparação lado a lado entre duas datas */
function CompararDias() {
  const { canais } = useApp();
  const [a, setA] = useState(somarDias(ontemISO(), -7));
  const [b, setB] = useState(ontemISO());
  const [dados, setDados] = useState<{ a: LinhaLancamento[]; b: LinhaLancamento[] } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const comparar = async () => {
    setCarregando(true); setErro(null);
    try {
      const [la, lb] = await Promise.all([listarLinhas(a, a), listarLinhas(b, b)]);
      setDados({ a: la, b: lb });
    } catch (e) { setErro(mensagemErro(e)); } finally { setCarregando(false); }
  };

  const linhas = useMemo(() => {
    if (!dados) return [];
    const ids = new Set([...dados.a, ...dados.b].map((l) => l.canal_id));
    return canais.filter((c) => ids.has(c.id)).map((c) => ({
      canal: c,
      a: dados.a.find((l) => l.canal_id === c.id),
      b: dados.b.find((l) => l.canal_id === c.id),
    }));
  }, [dados, canais]);

  const soma = (arr: (LinhaLancamento | undefined)[], k: 'leads_crm' | 'leads_planilha') => arr.reduce((s, l) => s + (l?.[k] ?? 0), 0);
  const variacao = (x: number | null | undefined, y: number | null | undefined) => {
    if (x === null || x === undefined || y === null || y === undefined) return '—';
    const d = y - x;
    const p = x > 0 ? ` (${d >= 0 ? '+' : ''}${((d / x) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)` : '';
    return `${d > 0 ? '+' : ''}${d.toLocaleString('pt-BR')}${p}`;
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div><label className="rotulo">Dia A</label><input type="date" className="campo" value={a} max={hojeISO()} onChange={(e) => setA(e.target.value)} /></div>
        <ArrowLeftRight className="mx-2 hidden h-5 w-5 self-center text-slate-400 sm:block" />
        <div><label className="rotulo">Dia B</label><input type="date" className="campo" value={b} max={hojeISO()} onChange={(e) => setB(e.target.value)} /></div>
        <button className="btn-primario" onClick={comparar} disabled={!a || !b || carregando}>
          {carregando && <Loader2 className="h-4 w-4 animate-spin" />}Comparar
        </button>
      </div>
      {erro && <ErroCarregamento mensagem={erro} />}
      {dados && (linhas.length === 0 ? <div className="card"><Vazio titulo="Nenhuma das datas possui lançamentos" /></div> : (
        <div className="card overflow-x-auto">
          <table className="tabela w-full">
            <thead className="bg-slate-50">
              <tr><th rowSpan={2}>Canal</th><th colSpan={3} className="border-l text-center">{formatarData(a)}</th><th colSpan={3} className="border-l text-center">{formatarData(b)}</th><th rowSpan={2} className="border-l text-right">Variação CRM (B − A)</th></tr>
              <tr><th className="border-l text-right">CRM</th><th className="text-right">Planilha</th><th className="text-right">Dif.</th><th className="border-l text-right">CRM</th><th className="text-right">Planilha</th><th className="text-right">Dif.</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map(({ canal, a: la, b: lb }) => {
                const da = la ? calcularDiferenca(la.leads_crm, la.leads_planilha) : null;
                const db = lb ? calcularDiferenca(lb.leads_crm, lb.leads_planilha) : null;
                return (
                  <tr key={canal.id}>
                    <td className="font-semibold">{canal.nome}</td>
                    <td className="border-l text-right tabular-nums">{formatarNumero(la?.leads_crm)}</td>
                    <td className="text-right tabular-nums">{formatarNumero(la?.leads_planilha)}</td>
                    <td className={`text-right font-bold ${corDiferenca(da)}`}>{formatarDiferenca(da)}</td>
                    <td className="border-l text-right tabular-nums">{formatarNumero(lb?.leads_crm)}</td>
                    <td className="text-right tabular-nums">{formatarNumero(lb?.leads_planilha)}</td>
                    <td className={`text-right font-bold ${corDiferenca(db)}`}>{formatarDiferenca(db)}</td>
                    <td className="border-l text-right font-semibold tabular-nums">{variacao(la?.leads_crm, lb?.leads_crm)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td>TOTAL</td>
                <td className="border-l text-right">{formatarNumero(soma(linhas.map((l) => l.a), 'leads_crm'))}</td>
                <td className="text-right">{formatarNumero(soma(linhas.map((l) => l.a), 'leads_planilha'))}</td><td />
                <td className="border-l text-right">{formatarNumero(soma(linhas.map((l) => l.b), 'leads_crm'))}</td>
                <td className="text-right">{formatarNumero(soma(linhas.map((l) => l.b), 'leads_planilha'))}</td><td />
                <td className="border-l text-right">{variacao(dados.a.length ? soma(linhas.map((l) => l.a), 'leads_crm') : null, dados.b.length ? soma(linhas.map((l) => l.b), 'leads_crm') : null)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}
