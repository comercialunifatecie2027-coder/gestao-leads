import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardCheck, History, FileBarChart, Radio, Users, Settings, LogOut, Menu, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const ITENS_MENU = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard, admin: true },
  { para: '/lancamento', rotulo: 'Lançamento Diário', icone: ClipboardCheck, admin: false },
  { para: '/historico', rotulo: 'Histórico', icone: History, admin: false },
  { para: '/relatorios', rotulo: 'Relatórios', icone: FileBarChart, admin: true },
  { para: '/canais', rotulo: 'Canais de Aquisição', icone: Radio, admin: true },
  { para: '/usuarios', rotulo: 'Usuários', icone: Users, admin: true },
  { para: '/configuracoes', rotulo: 'Configurações', icone: Settings, admin: false },
];

export function Marca({ claro }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
        <ClipboardCheck className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className={`text-[15px] font-bold ${claro ? 'text-white' : 'text-slate-900'}`}>Gestão de Leads</p>
        <p className={`text-[11px] font-medium ${claro ? 'text-brand-100' : 'text-slate-500'}`}>Controle de Aquisição · UniFatecie</p>
      </div>
    </div>
  );
}

export function Layout() {
  const { perfil, ehAdmin, sair } = useAuth();
  const [aberto, setAberto] = useState(false);
  const local = useLocation();
  useEffect(() => setAberto(false), [local.pathname]);

  const itens = ITENS_MENU.filter((i) => !i.admin || ehAdmin);
  const iniciais = (perfil?.nome ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const menu = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {itens.map(({ para, rotulo, icone: I }) => (
        <NavLink
          key={para}
          to={para}
          end={para === '/'}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`h-5 w-1 rounded-full ${isActive ? 'bg-brand-500' : 'bg-transparent'}`} />
              <I className={`h-5 w-5 ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              {rotulo === 'Histórico' && !ehAdmin ? 'Meus Lançamentos' : rotulo}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const usuario = (
    <div className="m-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{iniciais}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{perfil?.nome}</p>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{ehAdmin ? 'Administrador / Gestor' : 'Atendente'}</p>
      </div>
      <button onClick={sair} className="btn-fantasma" title="Sair" aria-label="Sair"><LogOut className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Sidebar fixa (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex no-print">
        <div className="px-5 py-6"><Marca /></div>
        {menu}
        {usuario}
      </aside>

      {/* Barra superior (mobile/tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden no-print">
        <Marca />
        <button className="btn-fantasma" onClick={() => setAberto(true)} aria-label="Abrir menu"><Menu className="h-6 w-6" /></button>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden no-print">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl animate-[entrar_.15s_ease-out]">
            <div className="flex items-center justify-between px-5 py-5">
              <Marca />
              <button className="btn-fantasma" onClick={() => setAberto(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
            </div>
            {menu}
            {usuario}
          </aside>
        </div>
      )}

      <main className="lg:pl-64 print-full">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
