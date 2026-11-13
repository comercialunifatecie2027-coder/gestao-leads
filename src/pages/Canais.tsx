import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Pencil, Power, Trash2, ArrowLeft, Loader2, LineChart as IconeLinha, Infinity as Infinito, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { excluirCanal, primeiraData, salvarCanal } from '../lib/api';
import { mensagemErro } from '../lib/supabase';
import type { Canal, Periodo } from '../lib/types';
import { Cabecalho, Carregando, Confirmar, ErroCarregamento, IndicadorDiferenca, Modal, Vazio, corDiferenca } from '../components/ui';
import { corDoCanal, CaixaGrafico, GraficoEvolucaoDiaria, GraficoDivergencias } from '../components/Graficos';
import { FiltroPeriodo } from '../components/FiltroPeriodo';
import { useDadosPeriodo } from '../hooks/useDadosPeriodo';
import { calcularDiferenca, formatarDiferenca, formatarNumero, formatarPercentual } from '../lib/calculos';
import { descreverPeriodo, diaSemanaCurto, formatarData, hojeISO } from '../lib/datas';
import { ConferenciaDetalhe } from '../components/ConferenciaDetalhe';

export function Canais() {
  const { canais, recarregarCanais, notificar } = useApp();
  const [edicao, setEdicao] = useState<Partial<Canal> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<Canal | null>(null);
  const [processando, setProcessando] = useState(false);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!edicao?.nome?.trim()) return;
    setSalvando(true);
    try {
      await salvarCanal({ ...edicao, nome: edicao.nome, ordem: edicao.ordem ?? (Math.max(0, ...canais.map((c) => c.ordem)) + 1) });
      await recarregarCanais();
      notificar('sucesso', edicao.id ? 'Canal atualizado.' : 'Canal cadastrado. Ele já aparece no lançamento diário.');
      setEdicao(null);
    } catch (err) { notificar('erro', mensagemErro(err)); } finally { setSalvando(false); }
  };

  const alternar = async (c: Canal) => {
    try {
      await salvarCanal({ ...c, ativo: !c.ativo });
      await recarregarCanais();
      notificar('sucesso', c.ativo ? `${c.nome} desativado. O histórico foi mantido.` : `${c.nome} reativado.`);
    } catch (err) { notificar('erro', mensagemErro(err)); }
  };

  const mover = async (c: Canal, dir: -1 | 1) => {
    const lista = [...canais];
    const i = lista.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    try {
      await Promise.all(lista.map((x, k) => (x.ordem !== k + 1 ? salvarCanal({ ...x, ordem: k + 1 }) : null)));
      await recarregarCanais();
    } catch (err) { notificar('erro', mensagemErro(err)); }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setProcessando(true);
    try {
      await excluirCanal(excluir.id);
      await recarregarCanais();
      notificar('sucesso', 'Canal excluído.');
      setExcluir(null);
    } catch (err) { notificar('erro', mensagemErro(err)); } finally { setProcessando(false); }
  };

  return (
    <div>
      <Cabecalho titulo="Canais de Aquisição" subtitulo="Adicione, edite, reordene ou desative canais. Canais desativados saem do lançamento diário, mas o histórico é preservado."
        acoes={<button className="btn-primario" onClick={() => setEdicao({ nome: '', ativo: true })}><Plus className="h-4 w-4" />Novo canal</button>} />

      <div className="card overflow-hidden">
        {canais.length === 0 ? <Vazio titulo="Nenhum canal cadastrado" /> : (
          <ul className="divide-y divide-slate-100">
            {canais.map((c, i) => (
              <li key={c.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${!c.ativo ? 'bg-slate-50/70' : ''}`}>
                <div className="flex items-center gap-1">
                  <button className="btn-fantasma px-1.5" onClick={() => mover(c, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                  <button className="btn-fantasma px-1.5" onClick={() => mover(c, 1)} disabled={i === canais.length - 1} aria-label="Descer"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: corDoCanal(c.id, canais) }} />
                <div className="flex-1">
                  <p className={`font-semibold ${c.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{c.nome}</p>
                  {c.descricao && <p className="text-xs text-slate-500">{c.descricao}</p>}
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${c.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{c.ativo ? 'ATIVO' : 'INATIVO'}</span>
                <div className="flex flex-wrap gap-1">
                  <Link to={`/canais/${c.id}`} className="btn-fantasma text-xs"><IconeLinha className="h-4 w-4" />Histórico</Link>
                  <button className="btn-fantasma text-xs" onClick={() => setEdicao(c)}><Pencil className="h-4 w-4" />Editar</button>
                  <button className="btn-fantasma text-xs" onClick={() => alternar(c)}><Power className="h-4 w-4" />{c.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button className="btn-fantasma text-xs text-red-600" onClick={() => setExcluir(c)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal aberto={!!edicao} aoFechar={() => setEdicao(null)} titulo={edicao?.id ? 'Editar canal' : 'Novo canal'} largura="max-w-md">
        {edicao && (
          <form onSubmit={salvar} className="space-y-4">
            <div><label className="rotulo">Nome do canal</label>
              <input className="campo uppercase" value={edicao.nome ?? ''} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} required maxLength={40} autoFocus placeholder="Ex.: WHATSAPP 2468" /></div>
            <div><label className="rotulo">Descrição (opcional)</label>
              <input className="campo" value={edicao.descricao ?? ''} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} maxLength={120} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secundario" onClick={() => setEdicao(null)}>Cancelar</button>
              <button className="btn-primario" disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
            </div>
          </form>
        )}
      </Modal>
      <Confirmar aberto={!!excluir} titulo="Excluir canal" perigo processando={processando} rotuloConfirmar="Excluir"
        texto={<>Excluir o canal <b>{excluir?.nome}</b>? Só é possível excluir canais sem nenhum lançamento. Para canais com histórico, use <b>Desativar</b>.</>}
        aoCancelar={() => setExcluir(null)} aoConfirmar={confirmarExclusao} />
    </div>
  );
}

/** Histórico completo de um canal específico */
export function CanalHistorico() {
  const { id } = useParams();
  const { canais, periodo, setPeriodo, notificar } = useApp();
  const canal = canais.find((c) => c.id === id);
  const { resumo, linhas, carregando, erro, recarregar } = useDadosPeriodo(periodo, id);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const r = resumo.porCanal[0];

  const verTudo = async () => {
    try {
      const inicio = await primeiraData();
      const p: Periodo = { preset: 'personalizado', inicio: inicio ?? hojeISO(), fim: hojeISO() };
      setPeriodo(p);
    } catch (e) { notificar('erro', mensagemErro(e)); }
  };

  const ordenadas = useMemo(() => [...linhas].sort((a, b) => (a.data < b.data ? 1 : -1)), [linhas]);

  if (!canais.length) return <Carregando />;
  if (!canal) return <Vazio titulo="Canal não encontrado" acao={<Link to="/canais" className="btn-secundario">Voltar</Link>} />;

  return (
    <div>
      <Link to="/canais" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 no-print"><ArrowLeft className="h-4 w-4" />Canais</Link>
      <Cabecalho titulo={`Histórico do canal ${canal.nome}`} subtitulo={descreverPeriodo(periodo)}
        acoes={<button className="btn-secundario" onClick={verTudo}><Infinito className="h-4 w-4" />Histórico completo</button>} />
      <FiltroPeriodo />
      {erro ? <ErroCarregamento mensagem={erro} aoTentar={recarregar} /> : carregando ? <Carregando /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Leads no CRM', formatarNumero(r?.crm ?? 0)],
              ['Leads na planilha', formatarNumero(r?.planilha ?? 0)],
              ['Diferença acumulada', formatarDiferenca(r?.diferenca ?? 0)],
              ['% divergência', formatarPercentual(r?.percentualDivergencia ?? null)],
              ['Dias com divergência', `${r?.diasComDivergencia ?? 0} de ${r?.diasLancados ?? 0}`],
            ].map(([rot, val]) => (
              <div key={rot} className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rot}</p><p className="mt-1 text-2xl font-bold tabular-nums">{val}</p></div>
            ))}
          </div>
          {r?.recorrente && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Este canal apresenta <b>divergências recorrentes</b> no período ({r.diasComDivergencia} dias).</p>}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CaixaGrafico titulo="Evolução diária — CRM × Planilha"><GraficoEvolucaoDiaria porDia={resumo.porDia} /></CaixaGrafico>
            <CaixaGrafico titulo="Divergências por dia"><GraficoDivergencias porDia={resumo.porDia} /></CaixaGrafico>
          </div>
          <div className="card overflow-hidden">
            {ordenadas.length === 0 ? <Vazio titulo="Sem lançamentos deste canal no período" /> : (
              <div className="overflow-x-auto">
                <table className="tabela w-full">
                  <thead className="bg-slate-50"><tr><th>Data</th><th className="text-right">CRM</th><th className="text-right">Planilha</th><th className="text-right">Diferença</th><th>Situação</th><th>Observação</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {ordenadas.map((l) => {
                      const d = calcularDiferenca(l.leads_crm, l.leads_planilha);
                      return (
                        <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetalhe(l.data)}>
                          <td className="whitespace-nowrap font-medium">{formatarData(l.data)} <span className="text-xs capitalize text-slate-400">{diaSemanaCurto(l.data)}</span></td>
                          <td className="text-right tabular-nums">{formatarNumero(l.leads_crm)}</td>
                          <td className="text-right tabular-nums">{formatarNumero(l.leads_planilha)}</td>
                          <td className={`text-right font-bold tabular-nums ${corDiferenca(d)}`}>{formatarDiferenca(d)}</td>
                          <td><IndicadorDiferenca diferenca={d} /></td>
                          <td className="text-slate-600">{l.observacao || <span className="text-slate-300">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      <ConferenciaDetalhe data={detalhe} aoFechar={() => setDetalhe(null)} />
    </div>
  );
}
