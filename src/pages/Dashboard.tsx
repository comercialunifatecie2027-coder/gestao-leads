import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, FileSpreadsheet, Scale, AlertTriangle, CalendarCheck2, Trophy, Repeat, Clock, ArrowRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useDadosPeriodo } from '../hooks/useDadosPeriodo';
import { FiltroPeriodo } from '../components/FiltroPeriodo';
import { CardIndicador, Carregando, Cabecalho, ErroCarregamento } from '../components/ui';
import {
  CaixaGrafico, GraficoCrmPlanilha, GraficoDivergencias, GraficoEvolucaoDiaria, GraficoParticipacao, GraficoVolumePorCanal, corDoCanal,
} from '../components/Graficos';
import { ConferenciaDetalhe } from '../components/ConferenciaDetalhe';
import { formatarDiferenca, formatarNumero, formatarPercentual } from '../lib/calculos';
import { descreverPeriodo, formatarDiaMes, diaSemanaCurto } from '../lib/datas';

export function Dashboard() {
  const { periodo, canais } = useApp();
  const { resumo, carregando, erro, recarregar } = useDadosPeriodo(periodo);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const topVolume = [...resumo.porCanal].sort((a, b) => b.crm - a.crm).filter((c) => c.crm > 0).slice(0, 3);
  const topDivergencia = [...resumo.porCanal].filter((c) => c.divergenciaAbsoluta > 0).sort((a, b) => b.divergenciaAbsoluta - a.divergenciaAbsoluta).slice(0, 3);
  const recorrentes = resumo.porCanal.filter((c) => c.recorrente);

  return (
    <div>
      <Cabecalho titulo="Dashboard" subtitulo={`Visão geral da operação · ${descreverPeriodo(periodo)}`}
        acoes={<Link to="/lancamento" className="btn-primario">Lançar conferência<ArrowRight className="h-4 w-4" /></Link>} />
      <FiltroPeriodo />

      {erro ? <ErroCarregamento mensagem={erro} aoTentar={recarregar} /> : carregando ? <Carregando /> : (
        <div className="space-y-6">
          {resumo.ocorrenciasDivergencia > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800" role="alert">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p><b>Atenção:</b> {resumo.ocorrenciasDivergencia} {resumo.ocorrenciasDivergencia === 1 ? 'ocorrência' : 'ocorrências'} de divergência entre CRM e planilha no período,
                somando {formatarNumero(resumo.divergenciaAbsoluta)} leads de diferença ({formatarPercentual(resumo.percentualDivergencia)} do volume conferido).</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <CardIndicador titulo="Total de leads no CRM" valor={formatarNumero(resumo.totalCrm)} icone={Database} />
            <CardIndicador titulo="Total nas planilhas" valor={formatarNumero(resumo.totalPlanilha)} icone={FileSpreadsheet} tom="cinza" />
            <CardIndicador titulo="Diferença total" valor={formatarDiferenca(resumo.diferencaLiquida)} icone={Scale}
              tom={resumo.diferencaLiquida === 0 ? 'verde' : resumo.diferencaLiquida > 0 ? 'laranja' : 'vermelho'}
              detalhe={<>Divergência absoluta: <b>{formatarNumero(resumo.divergenciaAbsoluta)}</b> · {formatarPercentual(resumo.percentualDivergencia)} do total</>} />
            <CardIndicador titulo="Canais com divergência" valor={resumo.canaisComDivergencia} icone={AlertTriangle}
              tom={resumo.canaisComDivergencia ? 'vermelho' : 'verde'}
              detalhe={`${resumo.ocorrenciasDivergencia} ocorrência(s) no período`} />
            <CardIndicador titulo="Dias com conferência" valor={<>{resumo.diasFinalizados}<span className="text-lg text-slate-400">/{resumo.diasNoPeriodo}</span></>}
              icone={CalendarCheck2} tom={resumo.diasPendentes.length ? 'laranja' : 'verde'}
              detalhe={`${resumo.contagemStatus.CONFERIDO} conferidos · ${resumo.contagemStatus['COM DIVERGÊNCIA']} c/ divergência · ${resumo.diasPendentes.length} pendente(s)`} />
          </div>

          {resumo.diasPendentes.length > 0 && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-500" />
                <h3 className="font-semibold text-slate-800">Dias pendentes de conferência</h3>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{resumo.diasPendentes.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {resumo.diasPendentes.slice(0, 40).map((d) => {
                  const st = resumo.porDia.find((x) => x.data === d)?.status;
                  return (
                    <Link key={d} to={`/lancamento?data=${d}`}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:border-brand-300 hover:bg-brand-50 ${st === 'EM CONFERÊNCIA' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`}
                      title={st}>
                      {formatarDiaMes(d)} <span className="font-normal capitalize text-slate-400">{diaSemanaCurto(d)}</span>
                    </Link>
                  );
                })}
                {resumo.diasPendentes.length > 40 && <span className="px-2 py-1.5 text-xs text-slate-500">+{resumo.diasPendentes.length - 40} dias</span>}
              </div>
              <p className="mt-2 text-xs text-slate-400">Cinza: sem conferência · Azul: em conferência (canais incompletos). Clique para lançar.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Destaque titulo="Canais que mais recebem leads" icone={Trophy}
              itens={topVolume.map((c) => ({ id: c.canal_id, nome: c.nome, valor: formatarNumero(c.crm), extra: formatarPercentual(c.participacao), cor: corDoCanal(c.canal_id, canais) }))} />
            <Destaque titulo="Maior volume de divergências" icone={AlertTriangle}
              itens={topDivergencia.map((c) => ({ id: c.canal_id, nome: c.nome, valor: formatarNumero(c.divergenciaAbsoluta), extra: formatarPercentual(c.percentualDivergencia), cor: corDoCanal(c.canal_id, canais) }))}
              vazio="Nenhuma divergência no período." />
            <Destaque titulo="Divergências recorrentes" icone={Repeat}
              itens={recorrentes.map((c) => ({ id: c.canal_id, nome: c.nome, valor: `${c.diasComDivergencia} dias`, extra: 'recorrente', cor: corDoCanal(c.canal_id, canais) }))}
              vazio="Nenhum canal com divergência recorrente." />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CaixaGrafico titulo="Volume de leads por canal" subtitulo="Leads registrados no CRM">
              <GraficoVolumePorCanal porCanal={resumo.porCanal} canais={canais} />
            </CaixaGrafico>
            <CaixaGrafico titulo="Comparação CRM × Planilha por canal">
              <GraficoCrmPlanilha porCanal={resumo.porCanal} />
            </CaixaGrafico>
            <CaixaGrafico titulo="Evolução diária do volume de leads">
              <GraficoEvolucaoDiaria porDia={resumo.porDia} />
            </CaixaGrafico>
            <CaixaGrafico titulo="Evolução das divergências" subtitulo="Barras: soma das diferenças absolutas · Linha: diferença líquida (CRM − Planilha)">
              <GraficoDivergencias porDia={resumo.porDia} />
            </CaixaGrafico>
            <CaixaGrafico titulo="Participação de cada canal no total de leads" className="xl:col-span-2">
              <GraficoParticipacao porCanal={resumo.porCanal} canais={canais} />
            </CaixaGrafico>
          </div>
        </div>
      )}
      <ConferenciaDetalhe data={detalhe} aoFechar={() => setDetalhe(null)} />
    </div>
  );
}

function Destaque({ titulo, icone: I, itens, vazio = 'Sem dados no período.' }: {
  titulo: string; icone: typeof Trophy; itens: { id: string; nome: string; valor: string; extra: string; cor: string }[]; vazio?: string;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2"><I className="h-4 w-4 text-brand-500" /><h3 className="text-sm font-semibold text-slate-800">{titulo}</h3></div>
      {itens.length === 0 ? <p className="py-4 text-sm text-slate-400">{vazio}</p> : (
        <ul className="space-y-2.5">
          {itens.map((it, i) => (
            <li key={it.id}>
              <Link to={`/canais/${it.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-slate-50">
                <span className="w-4 text-xs font-bold text-slate-400">{i + 1}º</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.cor }} />
                <span className="flex-1 truncate text-sm font-medium text-slate-700">{it.nome}</span>
                <span className="text-sm font-bold tabular-nums text-slate-900">{it.valor}</span>
                <span className="w-16 text-right text-xs text-slate-500">{it.extra}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
