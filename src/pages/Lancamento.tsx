import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Save, Loader2, CheckCircle2, AlertTriangle, ListChecks, CircleDashed,
  History, Trash2, RotateCcw, Lock, Info,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { usePerfis } from '../hooks/usePerfis';
import { excluirConferencia, obterConferencia, salvarConferencia, type ItemSalvar } from '../lib/api';
import {
  calcularDiferenca, formatarDiferenca, formatarNumero, lerCampoNumerico, resumirDia, situacaoLinha, statusDaConferencia,
  type Num,
} from '../lib/calculos';
import { diaSemana, formatarData, formatarDataHora, hojeISO, ontemISO, somarDias } from '../lib/datas';
import { ehConflito, mensagemErro } from '../lib/supabase';
import type { Canal, Conferencia } from '../lib/types';
import { Cabecalho, Carregando, Confirmar, ErroCarregamento, IndicadorDiferenca, StatusBadge, corDiferenca } from '../components/ui';
import { ConferenciaDetalhe } from '../components/ConferenciaDetalhe';

interface Valores { crm: string; planilha: string; obs: string }
type Mapa = Record<string, Valores>;

const VAZIO: Valores = { crm: '', planilha: '', obs: '' };

function paraTexto(n: number | null): string { return n === null || n === undefined ? '' : String(n); }

const ESTILO_LINHA = {
  vazio: '',
  parcial: '',
  conferido: 'bg-emerald-50/40',
  positiva: 'bg-orange-50/70',
  negativa: 'bg-red-50/70',
} as const;
const BORDA_LINHA = {
  vazio: 'border-l-transparent',
  parcial: 'border-l-slate-300',
  conferido: 'border-l-emerald-500',
  positiva: 'border-l-orange-500',
  negativa: 'border-l-red-500',
} as const;

export function Lancamento() {
  const { canais, config, notificar } = useApp();
  const { ehAdmin } = useAuth();
  const { nomeDe } = usePerfis();
  const [params, setParams] = useSearchParams();
  const data = params.get('data') || ontemISO();

  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [canaisTela, setCanaisTela] = useState<Canal[]>([]);
  const [valores, setValores] = useState<Mapa>({});
  const [original, setOriginal] = useState<Mapa>({});
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msgErro, setMsgErro] = useState<string | null>(null);
  const [trocaPendente, setTrocaPendente] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const carregar = useCallback(async () => {
    if (!canais.length) return;
    setCarregando(true); setErroCarga(null); setMsgErro(null);
    try {
      const { conferencia: conf, lancamentos } = await obterConferencia(data);
      const porCanal = new Map(lancamentos.map((l) => [l.canal_id, l]));
      // canais já lançados (mesmo se hoje estiverem inativos) + canais ativos
      const lista = canais.filter((c) => c.ativo || porCanal.has(c.id));
      const mapa: Mapa = {};
      for (const c of lista) {
        const l = porCanal.get(c.id);
        mapa[c.id] = l ? { crm: paraTexto(l.leads_crm), planilha: paraTexto(l.leads_planilha), obs: l.observacao ?? '' } : { ...VAZIO };
      }
      setConferencia(conf);
      setCanaisTela(lista);
      setValores(mapa);
      setOriginal(mapa);
    } catch (e) {
      setErroCarga(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [data, canais]);

  useEffect(() => { void carregar(); }, [carregar]);

  const alterado = useMemo(
    () => canaisTela.some((c) => {
      const a = valores[c.id] ?? VAZIO, b = original[c.id] ?? VAZIO;
      return a.crm !== b.crm || a.planilha !== b.planilha || a.obs.trim() !== b.obs.trim();
    }),
    [valores, original, canaisTela],
  );

  // aviso ao fechar/atualizar com alterações não salvas
  useEffect(() => {
    if (!alterado) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [alterado]);

  const irPara = (nova: string) => {
    if (!nova || nova === data) return;
    if (nova > hojeISO()) { notificar('erro', 'Não é possível lançar uma data futura.'); return; }
    if (alterado) { setTrocaPendente(nova); return; }
    setParams({ data: nova });
  };

  const linhasNum = canaisTela.map((c) => {
    const v = valores[c.id] ?? VAZIO;
    const crm = lerCampoNumerico(v.crm), planilha = lerCampoNumerico(v.planilha);
    return { canal: c, v, crm: (crm === undefined ? null : crm) as Num, planilha: (planilha === undefined ? null : planilha) as Num };
  });
  const resumo = resumirDia(linhasNum.map((l) => ({ leads_crm: l.crm, leads_planilha: l.planilha })));
  const statusPrevisto = statusDaConferencia(linhasNum.map((l) => ({ leads_crm: l.crm, leads_planilha: l.planilha })));
  const algumPreenchido = linhasNum.some((l) => l.crm !== null || l.planilha !== null || l.v.obs.trim());

  const limiteAtendente = config.dias_edicao_atendente;
  const bloqueado = !ehAdmin && !!conferencia && limiteAtendente > 0 && data < somarDias(hojeISO(), -limiteAtendente);

  const atualizar = (canalId: string, campo: keyof Valores, valor: string) => {
    if (campo !== 'obs') valor = valor.replace(/\D/g, '').slice(0, 9); // só dígitos: impede negativos e decimais
    setValores((m) => ({ ...m, [canalId]: { ...(m[canalId] ?? VAZIO), [campo]: valor } }));
  };

  // Enter avança para o próximo campo numérico (CRM → Planilha → próximo canal)
  const ordemCampos = canaisTela.flatMap((c) => [`${c.id}:crm`, `${c.id}:planilha`]);
  const aoTeclar = (chave: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const i = ordemCampos.indexOf(chave);
    const prox = ordemCampos[i + 1];
    if (prox) refs.current[prox]?.focus();
    else refs.current['salvar' as string]?.focus();
  };

  const salvar = async () => {
    setMsgErro(null);
    if (!algumPreenchido) { setMsgErro('Preencha ao menos um campo antes de salvar.'); return; }
    const itens: ItemSalvar[] = linhasNum.map((l) => ({
      canal_id: l.canal.id, leads_crm: l.crm, leads_planilha: l.planilha, observacao: l.v.obs.trim() || null,
    }));
    setSalvando(true);
    try {
      const conf = await salvarConferencia(data, itens, conferencia?.updated_at ?? null);
      setConferencia(conf);
      setOriginal(valores);
      notificar('sucesso', `Conferência de ${formatarData(data)} salva com sucesso. Status: ${conf.status}.`);
    } catch (e) {
      const m = mensagemErro(e);
      setMsgErro(m);
      notificar('erro', ehConflito(e) ? m : `Não foi possível salvar: ${m}`);
    } finally {
      setSalvando(false);
    }
  };

  const descartar = () => setValores(original);

  const excluir = async () => {
    if (!conferencia) return;
    setExcluindo(true);
    try {
      await excluirConferencia(conferencia.id);
      notificar('sucesso', `Conferência de ${formatarData(data)} excluída.`);
      setConfirmarExclusao(false);
      await carregar();
    } catch (e) {
      notificar('erro', mensagemErro(e));
    } finally {
      setExcluindo(false);
    }
  };

  const ehOntem = data === ontemISO();

  return (
    <div>
      <Cabecalho
        titulo="Lançamento Diário"
        subtitulo="Informe a quantidade de leads de cada canal no CRM e na planilha de controle."
        acoes={conferencia && (
          <>
            <button className="btn-secundario" onClick={() => setDetalheAberto(true)}><History className="h-4 w-4" />Histórico de alterações</button>
            {ehAdmin && <button className="btn-secundario text-red-600" onClick={() => setConfirmarExclusao(true)}><Trash2 className="h-4 w-4" />Excluir</button>}
          </>
        )}
      />

      {/* Seleção de data */}
      <div className="card mb-6 flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <button className="btn-secundario px-3" onClick={() => irPara(somarDias(data, -1))} aria-label="Dia anterior"><ChevronLeft className="h-4 w-4" /></button>
          <div>
            <label className="rotulo" htmlFor="data-ref">Data de referência</label>
            <input id="data-ref" type="date" className="campo w-44 font-semibold" value={data} max={hojeISO()}
              onChange={(e) => irPara(e.target.value)} />
          </div>
          <button className="btn-secundario px-3" onClick={() => irPara(somarDias(data, 1))} disabled={data >= hojeISO()} aria-label="Próximo dia"><ChevronRight className="h-4 w-4" /></button>
          {!ehOntem && <button className="btn-fantasma text-brand-600" onClick={() => irPara(ontemISO())}>Ir para ontem</button>}
        </div>
        <div className="md:ml-4">
          <p className="text-lg font-bold text-slate-900">{formatarData(data)}</p>
          <p className="text-sm capitalize text-slate-500">{diaSemana(data)}{ehOntem && ' · ontem'}{data === hojeISO() && ' · hoje'}</p>
        </div>
        <div className="flex flex-col items-start gap-1 md:ml-auto md:items-end">
          <StatusBadge status={conferencia ? conferencia.status : 'PENDENTE'} />
          <p className="text-xs text-slate-500">
            {conferencia
              ? <>Lançado por <b>{nomeDe(conferencia.criado_por)}</b> · última alteração por <b>{nomeDe(conferencia.atualizado_por)}</b> em {formatarDataHora(conferencia.updated_at)}</>
              : 'Nenhuma conferência salva para esta data.'}
          </p>
        </div>
      </div>

      {erroCarga ? <ErroCarregamento mensagem={erroCarga} aoTentar={carregar} /> : carregando || !canais.length ? <Carregando /> : (
        <>
          {bloqueado && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              Atendentes podem editar apenas conferências dos últimos {limiteAtendente} dias. Para alterar esta data, solicite a um gestor.
            </div>
          )}
          {resumo.canaisComDivergencia > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>{resumo.canaisComDivergencia} {resumo.canaisComDivergencia === 1 ? 'canal apresenta' : 'canais apresentam'} divergência</b> entre CRM e planilha.
                Registre na observação o motivo identificado.
              </span>
            </div>
          )}

          {/* Tabela (tablet/desktop) */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="tabela w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-44">Canal</th>
                    <th className="w-36">Leads no CRM</th>
                    <th className="w-36">Leads na Planilha</th>
                    <th className="w-28 text-right">Diferença</th>
                    <th className="w-40">Situação</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhasNum.map(({ canal, v, crm, planilha }) => {
                    const sit = situacaoLinha(crm, planilha);
                    const dif = calcularDiferenca(crm, planilha);
                    return (
                      <tr key={canal.id} className={`border-l-4 transition-colors ${BORDA_LINHA[sit]} ${ESTILO_LINHA[sit]}`}>
                        <td className="font-semibold text-slate-800">
                          {canal.nome}
                          {!canal.ativo && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">INATIVO</span>}
                        </td>
                        <td>
                          <input ref={(el) => { refs.current[`${canal.id}:crm`] = el; }} className="campo text-right font-semibold tabular-nums"
                            inputMode="numeric" placeholder="—" value={v.crm} disabled={bloqueado}
                            onChange={(e) => atualizar(canal.id, 'crm', e.target.value)} onKeyDown={aoTeclar(`${canal.id}:crm`)}
                            aria-label={`Leads no CRM — ${canal.nome}`} />
                        </td>
                        <td>
                          <input ref={(el) => { refs.current[`${canal.id}:planilha`] = el; }} className="campo text-right font-semibold tabular-nums"
                            inputMode="numeric" placeholder="—" value={v.planilha} disabled={bloqueado}
                            onChange={(e) => atualizar(canal.id, 'planilha', e.target.value)} onKeyDown={aoTeclar(`${canal.id}:planilha`)}
                            aria-label={`Leads na planilha — ${canal.nome}`} />
                        </td>
                        <td className={`text-right text-base font-bold tabular-nums ${corDiferenca(dif)}`}>{formatarDiferenca(dif)}</td>
                        <td><IndicadorDiferenca diferenca={dif} /></td>
                        <td>
                          <input className="campo" placeholder={dif ? 'Descreva o motivo da divergência' : 'Opcional'} value={v.obs} maxLength={500}
                            disabled={bloqueado} onChange={(e) => atualizar(canal.id, 'obs', e.target.value)} aria-label={`Observação — ${canal.nome}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="font-bold uppercase text-slate-700">Total do dia</td>
                    <td className="pr-7 text-right text-base font-bold tabular-nums">{formatarNumero(resumo.totalCrm)}</td>
                    <td className="pr-7 text-right text-base font-bold tabular-nums">{formatarNumero(resumo.totalPlanilha)}</td>
                    <td className={`text-right text-base font-bold tabular-nums ${corDiferenca(resumo.canaisConferidos ? resumo.diferencaTotal : null)}`}>
                      {resumo.canaisConferidos ? formatarDiferenca(resumo.diferencaTotal) : '—'}
                    </td>
                    <td colSpan={2}><StatusBadge status={statusPrevisto} pequeno /> <span className="ml-1 text-xs text-slate-500">status ao salvar</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cartões (celular) */}
          <div className="space-y-3 md:hidden">
            {linhasNum.map(({ canal, v, crm, planilha }) => {
              const sit = situacaoLinha(crm, planilha);
              const dif = calcularDiferenca(crm, planilha);
              return (
                <div key={canal.id} className={`card border-l-4 p-4 ${BORDA_LINHA[sit]} ${ESTILO_LINHA[sit]}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-bold text-slate-800">{canal.nome}</p>
                    <IndicadorDiferenca diferenca={dif} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="rotulo">CRM</label>
                      <input className="campo text-right font-semibold" inputMode="numeric" placeholder="—" value={v.crm} disabled={bloqueado}
                        onChange={(e) => atualizar(canal.id, 'crm', e.target.value)} aria-label={`Leads no CRM — ${canal.nome}`} /></div>
                    <div><label className="rotulo">Planilha</label>
                      <input className="campo text-right font-semibold" inputMode="numeric" placeholder="—" value={v.planilha} disabled={bloqueado}
                        onChange={(e) => atualizar(canal.id, 'planilha', e.target.value)} aria-label={`Leads na planilha — ${canal.nome}`} /></div>
                    <div><label className="rotulo">Diferença</label>
                      <p className={`py-2.5 text-right text-lg font-bold ${corDiferenca(dif)}`}>{formatarDiferenca(dif)}</p></div>
                  </div>
                  <input className="campo mt-2" placeholder="Observação" value={v.obs} maxLength={500} disabled={bloqueado}
                    onChange={(e) => atualizar(canal.id, 'obs', e.target.value)} />
                </div>
              );
            })}
            <div className="card p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="rotulo">Total CRM</p><p className="text-lg font-bold">{formatarNumero(resumo.totalCrm)}</p></div>
                <div><p className="rotulo">Total Planilha</p><p className="text-lg font-bold">{formatarNumero(resumo.totalPlanilha)}</p></div>
                <div><p className="rotulo">Diferença</p><p className={`text-lg font-bold ${corDiferenca(resumo.canaisConferidos ? resumo.diferencaTotal : null)}`}>{resumo.canaisConferidos ? formatarDiferenca(resumo.diferencaTotal) : '—'}</p></div>
              </div>
            </div>
          </div>

          {/* Resumo do dia */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Mini icone={ListChecks} rotulo="Canais conferidos" valor={`${resumo.canaisConferidos} de ${canaisTela.length}`} cor="text-brand-600 bg-brand-50" />
            <Mini icone={CheckCircle2} rotulo="Sem divergência" valor={resumo.canaisSemDivergencia} cor="text-emerald-600 bg-emerald-50" />
            <Mini icone={AlertTriangle} rotulo="Com divergência" valor={resumo.canaisComDivergencia} cor="text-red-600 bg-red-50" />
            <Mini icone={CircleDashed} rotulo="Aguardando preenchimento" valor={resumo.canaisPendentes} cor="text-slate-600 bg-slate-100" />
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5" />
            Campo vazio significa "não informado" (diferente de zero). Um canal só é conferido quando CRM e planilha estão preenchidos — mesmo que com 0.
          </p>

          {/* Barra de ação */}
          <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:shadow-card">
            {msgErro && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{msgErro}</span>
                {/Recarregue/.test(msgErro) && <button className="font-semibold underline" onClick={carregar}>Recarregar</button>}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-500">
                {alterado ? <span className="font-semibold text-brand-700">● Há alterações não salvas</span> : conferencia ? 'Todos os dados estão salvos.' : 'Preencha os números e salve a conferência.'}
              </p>
              <div className="flex gap-2 sm:ml-auto">
                {alterado && <button className="btn-secundario" onClick={descartar} disabled={salvando}><RotateCcw className="h-4 w-4" />Descartar</button>}
                <button
                  ref={(el) => { refs.current['salvar'] = el as unknown as HTMLInputElement; }}
                  className="btn-primario flex-1 px-6 py-3 text-base sm:flex-none" onClick={salvar}
                  disabled={salvando || bloqueado || (!alterado && !!conferencia)}
                >
                  {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  SALVAR CONFERÊNCIA DO DIA
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <Confirmar
        aberto={!!trocaPendente}
        titulo="Alterações não salvas"
        texto={<>Você alterou dados de {formatarData(data)} que ainda não foram salvos. Deseja sair desta data e descartar as alterações?</>}
        rotuloConfirmar="Descartar e continuar" perigo
        aoCancelar={() => setTrocaPendente(null)}
        aoConfirmar={() => { const d = trocaPendente!; setTrocaPendente(null); setOriginal(valores); setParams({ data: d }); }}
      />
      <Confirmar
        aberto={confirmarExclusao}
        titulo="Excluir conferência"
        texto={<>Tem certeza que deseja excluir a conferência de <b>{formatarData(data)}</b> com todos os canais e observações? Uma cópia dos dados fica registrada no histórico de alterações.</>}
        rotuloConfirmar="Excluir definitivamente" perigo processando={excluindo}
        aoCancelar={() => setConfirmarExclusao(false)} aoConfirmar={excluir}
      />
      {conferencia && (
        <ConferenciaDetalhe data={detalheAberto ? data : null} abaInicial="alteracoes" aoFechar={() => setDetalheAberto(false)} />
      )}
      {!ehAdmin && (
        <p className="mt-6 text-center text-xs text-slate-400">
          Consulte seus lançamentos anteriores em <Link className="font-semibold text-brand-600" to="/historico">Meus Lançamentos</Link>.
        </p>
      )}
    </div>
  );
}

function Mini({ icone: I, rotulo, valor, cor }: { icone: typeof ListChecks; rotulo: string; valor: React.ReactNode; cor: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`rounded-xl p-2 ${cor}`}><I className="h-5 w-5" /></div>
      <div>
        <p className="text-xs font-medium text-slate-500">{rotulo}</p>
        <p className="text-xl font-bold tabular-nums text-slate-900">{valor}</p>
      </div>
    </div>
  );
}
