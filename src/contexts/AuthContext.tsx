import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Perfil } from '../lib/types';

interface AuthCtx {
  session: Session | null;
  perfil: Perfil | null;
  perfilBuscado: boolean;
  carregando: boolean;
  ehAdmin: boolean;
  recuperacaoSenha: boolean;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
  limparRecuperacao: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilBuscado, setPerfilBuscado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [recuperacaoSenha, setRecuperacao] = useState(false);

  const carregarPerfil = useCallback(async (s: Session | null) => {
    if (!s) { setPerfil(null); setPerfilBuscado(false); return; }
    const { data } = await supabase.from('perfis').select('*').eq('id', s.user.id).maybeSingle();
    setPerfil((data as Perfil) ?? null);
    setPerfilBuscado(true);
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      await carregarPerfil(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperacao(true);
      setSession(s);
      // evita deadlock do supabase-js: consulta fora do callback
      setTimeout(() => { void carregarPerfil(s); }, 0);
    });
    return () => { ativo = false; sub.subscription.unsubscribe(); };
  }, [carregarPerfil]);

  const sair = async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  };

  return (
    <Ctx.Provider
      value={{
        session, perfil, perfilBuscado, carregando,
        ehAdmin: perfil?.papel === 'admin' && perfil.ativo,
        recuperacaoSenha,
        sair,
        recarregarPerfil: () => carregarPerfil(session),
        limparRecuperacao: () => setRecuperacao(false),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
