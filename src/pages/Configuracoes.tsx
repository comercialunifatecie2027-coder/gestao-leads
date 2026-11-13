import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, KeyRound, SlidersHorizontal, UserCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { salvarConfiguracao } from '../lib/api';
import { mensagemErro, supabase } from '../lib/supabase';
import type { Configuracoes as Cfg } from '../lib/types';
import { Cabecalho } from '../components/ui';

export function Configuracoes() {
  const { config, recarregarConfig, notificar } = useApp();
  const { perfil, ehAdmin } = useAuth();
  const [form, setForm] = useState<Cfg>(config);
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => setForm(config), [config]);

  const salvarCfg = async (e: FormEvent) => {
    e.preventDefault();
    if (form.limite_divergencia_recorrente < 1 || form.dias_edicao_atendente < 0) {
      notificar('erro', 'Revise os valores informados.');
      return;
    }
    setSalvandoCfg(true);
    try {
      await Promise.all((Object.keys(form) as (keyof Cfg)[]).filter((k) => form[k] !== config[k]).map((k) => salvarConfiguracao(k, form[k])));
      await recarregarConfig();
      notificar('sucesso', 'Configurações salvas.');
    } catch (err) { notificar('erro', mensagemErro(err)); } finally { setSalvandoCfg(false); }
  };

  const trocarSenha = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) return notificar('erro', 'A senha deve ter pelo menos 6 caracteres.');
    if (senha !== confirmacao) return notificar('erro', 'As senhas não conferem.');
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvandoSenha(false);
    if (error) return notificar('erro', mensagemErro(error));
    setSenha(''); setConfirmacao('');
    notificar('sucesso', 'Senha alterada com sucesso.');
  };

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Configurações" subtitulo="Preferências da sua conta e parâmetros do sistema." />

      <section className="card mb-6 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><UserCircle className="h-5 w-5 text-brand-500" />Minha conta</h2>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="rotulo">Nome</dt><dd className="font-medium">{perfil?.nome}</dd></div>
          <div><dt className="rotulo">E-mail</dt><dd className="font-medium">{perfil?.email}</dd></div>
          <div><dt className="rotulo">Nível de acesso</dt><dd className="font-medium">{ehAdmin ? 'Administrador / Gestor' : 'Atendente'}</dd></div>
        </dl>
      </section>

      <section className="card mb-6 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><KeyRound className="h-5 w-5 text-brand-500" />Alterar senha</h2>
        <form onSubmit={trocarSenha} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div><label className="rotulo">Nova senha</label><input type="password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></div>
          <div><label className="rotulo">Confirmar</label><input type="password" className="campo" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" /></div>
          <button className="btn-primario" disabled={salvandoSenha || !senha}>{salvandoSenha && <Loader2 className="h-4 w-4 animate-spin" />}Alterar senha</button>
        </form>
      </section>

      {ehAdmin && (
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><SlidersHorizontal className="h-5 w-5 text-brand-500" />Parâmetros do sistema</h2>
          <form onSubmit={salvarCfg} className="space-y-5">
            <div>
              <label className="rotulo" htmlFor="lim">Divergência recorrente a partir de</label>
              <div className="flex items-center gap-2">
                <input id="lim" type="number" min={1} max={31} className="campo w-24" value={form.limite_divergencia_recorrente}
                  onChange={(e) => setForm({ ...form, limite_divergencia_recorrente: Number(e.target.value) })} />
                <span className="text-sm text-slate-600">dias com divergência no período</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Canais que atingirem esse número recebem o destaque "recorrente" no dashboard e relatórios.</p>
            </div>
            <div>
              <label className="rotulo" htmlFor="dias">Prazo de edição para atendentes</label>
              <div className="flex items-center gap-2">
                <input id="dias" type="number" min={0} max={365} className="campo w-24" value={form.dias_edicao_atendente}
                  onChange={(e) => setForm({ ...form, dias_edicao_atendente: Number(e.target.value) })} />
                <span className="text-sm text-slate-600">dias (0 = sem limite)</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Atendentes não poderão alterar conferências já salvas com data anterior a esse prazo. Gestores sempre podem.</p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={form.considerar_fim_de_semana}
                onChange={(e) => setForm({ ...form, considerar_fim_de_semana: e.target.checked })} />
              <span><b>Considerar sábados e domingos</b> no controle de dias pendentes<br />
                <span className="text-xs text-slate-500">Se desmarcado, fins de semana sem lançamento não aparecem como pendentes.</span></span>
            </label>
            <button className="btn-primario" disabled={salvandoCfg}>{salvandoCfg && <Loader2 className="h-4 w-4 animate-spin" />}Salvar parâmetros</button>
          </form>
        </section>
      )}
    </div>
  );
}
