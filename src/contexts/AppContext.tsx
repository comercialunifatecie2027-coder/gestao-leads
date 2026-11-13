import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { periodoDoPreset } from '../lib/datas';
import { listarCanais, obterConfiguracoes } from '../lib/api';
import type { Canal, Configuracoes, Periodo } from '../lib/types';
import { CONFIG_PADRAO } from '../lib/types';

// ---------------- Toasts (mensagens de sucesso/erro) ----------------
type TipoToast = 'sucesso' | 'erro' | 'info';
interface Toast { id: number; tipo: TipoToast; texto: string }

// ---------------- Contexto geral ----------------
interface AppCtx {
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  canais: Canal[];
  config: Configuracoes;
  recarregarCanais: () => Promise<void>;
  recarregarConfig: () => Promise<void>;
  notificar: (tipo: TipoToast, texto: string) => void;
}

const Ctx = createContext<AppCtx | null>(null);
const CHAVE_PERIODO = 'gl-periodo';

function periodoInicial(): Periodo {
  try {
    const salvo = sessionStorage.getItem(CHAVE_PERIODO);
    if (salvo) {
      const p = JSON.parse(salvo) as Periodo;
      // presets relativos são recalculados (ex.: "Ontem" sempre é ontem)
      if (p.preset === 'personalizado' || p.preset === 'data') return p;
      return periodoDoPreset(p.preset);
    }
  } catch { /* ignora */ }
  return periodoDoPreset('este_mes');
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodoState] = useState<Periodo>(periodoInicial);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [config, setConfig] = useState<Configuracoes>(CONFIG_PADRAO);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const notificar = useCallback((tipo: TipoToast, texto: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, tipo, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 8000 : 4500);
  }, []);

  const recarregarCanais = useCallback(async () => {
    try { setCanais(await listarCanais()); } catch (e) { console.error(e); }
  }, []);
  const recarregarConfig = useCallback(async () => {
    try { setConfig(await obterConfiguracoes()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { void recarregarCanais(); void recarregarConfig(); }, [recarregarCanais, recarregarConfig]);

  const setPeriodo = (p: Periodo) => {
    setPeriodoState(p);
    try { sessionStorage.setItem(CHAVE_PERIODO, JSON.stringify(p)); } catch { /* ignora */ }
  };

  return (
    <Ctx.Provider value={{ periodo, setPeriodo, canais, config, recarregarCanais, recarregarConfig, notificar }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2 no-print" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'erro' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg animate-[entrar_.2s_ease-out] ${
              t.tipo === 'sucesso' ? 'border-emerald-200' : t.tipo === 'erro' ? 'border-red-200' : 'border-slate-200'
            }`}
          >
            {t.tipo === 'sucesso' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />}
            {t.tipo === 'erro' && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
            {t.tipo === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />}
            <p className="flex-1 text-sm text-slate-700">{t.texto}</p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-slate-400 hover:text-slate-600" aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp fora do AppProvider');
  return c;
}
