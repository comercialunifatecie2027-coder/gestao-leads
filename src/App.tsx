import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { Carregando } from './components/ui';
import { AguardandoAprovacao, Login, RedefinirSenha, SupabaseNaoConfigurado } from './pages/Acesso';
import { Dashboard } from './pages/Dashboard';
import { Lancamento } from './pages/Lancamento';
import { Historico } from './pages/Historico';
import { Relatorios } from './pages/Relatorios';
import { Canais, CanalHistorico } from './pages/Canais';
import { Usuarios } from './pages/Usuarios';
import { Configuracoes } from './pages/Configuracoes';
import { supabaseConfigurado } from './lib/supabase';

function SoAdmin({ children }: { children: ReactNode }) {
  const { ehAdmin } = useAuth();
  return ehAdmin ? <>{children}</> : <Navigate to="/lancamento" replace />;
}

function Rotas() {
  const { session, perfil, perfilBuscado, carregando, ehAdmin, recuperacaoSenha } = useAuth();
  const local = useLocation();

  if (carregando) return <div className="flex min-h-screen items-center justify-center"><Carregando texto="Iniciando..." /></div>;
  if (recuperacaoSenha || (session && local.pathname === '/redefinir-senha')) return <RedefinirSenha />;
  if (!session) return <Login />;
  if (!perfil && perfilBuscado) return <AguardandoAprovacao />;
  if (!perfil) return <div className="flex min-h-screen items-center justify-center"><Carregando texto="Carregando perfil..." /></div>;
  if (!perfil.ativo) return <AguardandoAprovacao />;

  return (
    <AppProvider key={perfil.id}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={ehAdmin ? <Dashboard /> : <Navigate to="/lancamento" replace />} />
          <Route path="lancamento" element={<Lancamento />} />
          <Route path="historico" element={<Historico />} />
          <Route path="relatorios" element={<SoAdmin><Relatorios /></SoAdmin>} />
          <Route path="canais" element={<SoAdmin><Canais /></SoAdmin>} />
          <Route path="canais/:id" element={<SoAdmin><CanalHistorico /></SoAdmin>} />
          <Route path="usuarios" element={<SoAdmin><Usuarios /></SoAdmin>} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default function App() {
  if (!supabaseConfigurado) return <SupabaseNaoConfigurado />;
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  );
}
