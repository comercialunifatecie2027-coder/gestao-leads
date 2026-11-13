import { useEffect, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { descreverPeriodo, hojeISO, periodoDoPreset, ROTULOS_PRESET } from '../lib/datas';
import type { PresetPeriodo } from '../lib/types';

const PRESETS: PresetPeriodo[] = ['hoje', 'ontem', '7d', '15d', '30d', 'este_mes', 'mes_anterior', 'data', 'personalizado'];

export function FiltroPeriodo() {
  const { periodo, setPeriodo } = useApp();
  const [inicio, setInicio] = useState(periodo.inicio);
  const [fim, setFim] = useState(periodo.fim);
  const [erro, setErro] = useState('');

  useEffect(() => { setInicio(periodo.inicio); setFim(periodo.fim); }, [periodo]);

  const escolher = (p: PresetPeriodo) => {
    setErro('');
    setPeriodo(periodoDoPreset(p, new Date(), { inicio: periodo.inicio, fim: periodo.fim }));
  };

  const aplicar = () => {
    if (!inicio || (periodo.preset === 'personalizado' && !fim)) { setErro('Informe as datas.'); return; }
    if (periodo.preset === 'data') { setPeriodo({ preset: 'data', inicio, fim: inicio }); setErro(''); return; }
    if (inicio > fim) { setErro('A data inicial deve ser anterior ou igual à data final.'); return; }
    setErro('');
    setPeriodo({ preset: 'personalizado', inicio, fim });
  };

  const manual = periodo.preset === 'personalizado' || periodo.preset === 'data';

  return (
    <div className="card mb-6 p-4 no-print">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarDays className="h-4 w-4 text-brand-500" /> Período
        </div>
        {/* chips em telas médias/grandes */}
        <div className="hidden flex-wrap gap-1.5 md:flex">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => escolher(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                periodo.preset === p ? 'bg-brand-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {ROTULOS_PRESET[p]}
            </button>
          ))}
        </div>
        {/* seletor em celulares */}
        <select className="campo md:hidden" value={periodo.preset} onChange={(e) => escolher(e.target.value as PresetPeriodo)} aria-label="Período">
          {PRESETS.map((p) => <option key={p} value={p}>{ROTULOS_PRESET[p]}</option>)}
        </select>
        <div className="text-xs text-slate-500 lg:ml-auto">
          Exibindo: <span className="font-semibold text-slate-700">{descreverPeriodo(periodo)}</span>
        </div>
      </div>
      {manual && (
        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-end">
          <div>
            <label className="rotulo" htmlFor="f-inicio">{periodo.preset === 'data' ? 'Data' : 'Data inicial'}</label>
            <input id="f-inicio" type="date" className="campo" value={inicio} max={hojeISO()} onChange={(e) => setInicio(e.target.value)} />
          </div>
          {periodo.preset === 'personalizado' && (
            <div>
              <label className="rotulo" htmlFor="f-fim">Data final</label>
              <input id="f-fim" type="date" className="campo" value={fim} max={hojeISO()} onChange={(e) => setFim(e.target.value)} />
            </div>
          )}
          <button className="btn-primario" onClick={aplicar}><Check className="h-4 w-4" />Aplicar filtro</button>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}
