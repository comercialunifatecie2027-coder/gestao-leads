import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { listarAuditoria, listarConferencias, listarLinhas } from '../lib/api';
import { calcularDiferenca, formatarDiferenca, formatarNumero, resumirDia } from '../lib/calculos';
import { diaSemana, formatarData, formatarDataHora } from '../lib/datas';
import { mensagemErro } from '../lib/supabase';
import type { Conferencia, LinhaLancamento, RegistroAuditoria } from '../lib/types';
import { usePerfis } from '../hooks/usePerfis';
import { Carregando, IndicadorDiferenca, Modal, StatusBadge, Vazio, corDiferenca } from './ui';

type Aba = 'canais' | 'alteracoes';

function valorTxt(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'vazio';
  return String(v);
}

function descreverAlteracao(r: RegistroAuditoria): string[] {
  const a = (r.dados_antigos ?? {}) as Record<string, unknown>;
  const n = (r.dados_novos ?? {}) as Record<string, unknown>;
  if (r.tabela === 'conferencias') {
    if (r.acao === 'INSERT') return ['Conferência criada'];
    if (r.acao === 'DELETE') return ['Conferência excluída (cópia dos dados preservada)'];
    return [`Status: ${valorTxt(a.status)} → ${valorTxt(n.status)}`];
  }
  const campos: [string, string][] = [['leads_crm', 'CRM'], ['leads_planilha', 'Planilha'], ['observacao', 'Observação']];
  if (r.acao === 'INSERT') {
    return [campos.filter(([k]) => n[k] !== null && n[k] !== undefined).map(([k, rot]) => `${rot}: ${valorTxt(n[k])}`).join(' · ') || 'Canal incluído sem valores'];
  }
  return campos.filter(([k]) => JSON.stringify(a[k] ?? null) !== JSON.stringify(n[k] ?? null))
    .map(([k, rot]) => `${rot}: ${valorTxt(a[k])} → ${valorTxt(n[k])}`);
}

export function ConferenciaDetalhe({ data, aoFechar, abaInicial = 'canais', podeEditar = true }: {
  data: string | null; aoFechar: () => void; abaInicial?: Aba; podeEditar?: boolean;
}) {
  const { nomeDe } = usePerfis();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [conf, setConf] = useState<Conferencia | null>(null);
  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setAba(abaInicial);
    let ativo = true;
    (async () => {
      setCarregando(true); setErro(null);
      try {
        const [c, l] = await Promise.all([listarConferencias(data, data), listarLinhas(data, data)]);
        const cf = c[0] ?? null;
        const au = cf ? await listarAuditoria(cf.id) : [];
        if (!ativo) return;
        setConf(cf); setLinhas([...l].sort((a, b) => a.canal_ordem - b.canal_ordem)); setAuditoria(au);
      } catch (e) {
        if (ativo) setErro(mensagemErro(e));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [data, abaInicial]);

  const resumo = resumirDia(linhas);

  return (
    <Modal
      aberto={!!data}
      aoFechar={aoFechar}
      largura="max-w-5xl"
      titulo={data ? <span>Conferência de {formatarData(data)} <span className="text-sm font-medium capitalize text-slate-500">· {diaSemana(data)}</span></span> : ''}
      rodape={data && podeEditar ? (
        <Link to={`/lancamento?data=${data}`} className="btn-primario" onClick={aoFechar}><Pencil className="h-4 w-4" />Abrir no lançamento</Link>
      ) : undefined}
    >
      {carregando ? <Carregando /> : erro ? <p className="text-sm text-red-600">{erro}</p> : !conf ? (
        <Vazio titulo="Nenhuma conferência salva nesta data" texto="Este dia está PENDENTE de conferência." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <StatusBadge status={conf.status} />
            <span>Responsável: <b>{nomeDe(conf.criado_por)}</b></span>
            <span>Última alteração: <b>{nomeDe(conf.atualizado_por)}</b> em {formatarDataHora(conf.updated_at)}</span>
          </div>
          <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {(['canais', 'alteracoes'] as Aba[]).map((a) => (
              <button key={a} onClick={() => setAba(a)}
                className={`flex-1 rounded-lg px-3 py-2 transition ${aba === a ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                {a === 'canais' ? 'Canais e observações' : `Histórico de alterações (${auditoria.length})`}
              </button>
            ))}
          </div>

          {aba === 'canais' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="tabela w-full">
                <thead className="bg-slate-50"><tr><th>Canal</th><th className="text-right">CRM</th><th className="text-right">Planilha</th><th className="text-right">Diferença</th><th>Situação</th><th>Observação</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {linhas.map((l) => {
                    const d = calcularDiferenca(l.leads_crm, l.leads_planilha);
                    return (
                      <tr key={l.id}>
                        <td className="font-semibold">{l.canal_nome}</td>
                        <td className="text-right tabular-nums">{formatarNumero(l.leads_crm)}</td>
                        <td className="text-right tabular-nums">{formatarNumero(l.leads_planilha)}</td>
                        <td className={`text-right font-bold tabular-nums ${corDiferenca(d)}`}>{formatarDiferenca(d)}</td>
                        <td><IndicadorDiferenca diferenca={d} /></td>
                        <td className="min-w-[200px] text-slate-600">{l.observacao || <span className="text-slate-400">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr><td>TOTAL</td><td className="text-right">{formatarNumero(resumo.totalCrm)}</td><td className="text-right">{formatarNumero(resumo.totalPlanilha)}</td>
                    <td className={`text-right ${corDiferenca(resumo.diferencaTotal)}`}>{formatarDiferenca(resumo.diferencaTotal)}</td>
                    <td colSpan={2} className="text-xs font-medium text-slate-500">{resumo.canaisComDivergencia} com divergência · {resumo.canaisSemDivergencia} sem divergência · {resumo.canaisPendentes} incompletos</td></tr>
                </tfoot>
              </table>
            </div>
          ) : auditoria.length === 0 ? (
            <Vazio titulo="Sem alterações registradas" texto="Somente administradores visualizam alterações feitas por outros usuários." />
          ) : (
            <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
              {auditoria.map((r) => (
                <li key={r.id} className="relative">
                  <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${r.acao === 'DELETE' ? 'bg-red-500' : r.acao === 'INSERT' ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                  <p className="text-xs text-slate-500">{formatarDataHora(r.created_at)} · <b className="text-slate-700">{r.usuario_nome ?? 'Sistema'}</b></p>
                  <p className="text-sm font-semibold text-slate-800">{r.canal_nome ?? 'Conferência'}</p>
                  {descreverAlteracao(r).map((t, i) => <p key={i} className="text-sm text-slate-600">{t}</p>)}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Modal>
  );
}
