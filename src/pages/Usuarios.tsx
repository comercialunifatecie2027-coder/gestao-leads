import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { UserPlus, Loader2, ShieldCheck, User as IconeUsuario, Check, Pencil } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { atualizarPerfil, listarPerfis } from '../lib/api';
import { clienteIsolado, mensagemErro } from '../lib/supabase';
import { invalidarPerfis } from '../hooks/usePerfis';
import { formatarDataHora } from '../lib/datas';
import type { Papel, Perfil } from '../lib/types';
import { Cabecalho, Carregando, ErroCarregamento, Modal } from '../components/ui';

export function Usuarios() {
  const { notificar } = useApp();
  const { perfil: eu } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [editar, setEditar] = useState<Perfil | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try { setPerfis(await listarPerfis()); } catch (e) { setErro(mensagemErro(e)); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const atualizar = async (p: Perfil, campos: Partial<Pick<Perfil, 'nome' | 'papel' | 'ativo'>>, msg: string) => {
    try {
      await atualizarPerfil(p.id, campos);
      invalidarPerfis();
      notificar('sucesso', msg);
      await carregar();
      return true;
    } catch (e) { notificar('erro', mensagemErro(e)); return false; }
  };

  const pendentes = perfis.filter((p) => !p.ativo && p.papel === 'atendente');

  return (
    <div>
      <Cabecalho titulo="Usuários" subtitulo="Gerencie acessos, níveis de permissão e aprove novos cadastros."
        acoes={<button className="btn-primario" onClick={() => setNovo(true)}><UserPlus className="h-4 w-4" />Novo usuário</button>} />

      {erro ? <ErroCarregamento mensagem={erro} aoTentar={carregar} /> : carregando ? <Carregando /> : (
        <>
          {pendentes.length > 0 && (
            <div className="card mb-6 border-brand-200 p-5">
              <h3 className="mb-3 font-semibold text-slate-800">Aguardando aprovação ({pendentes.length})</h3>
              <ul className="divide-y divide-slate-100">
                {pendentes.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="flex-1"><p className="font-semibold">{p.nome}</p><p className="text-xs text-slate-500">{p.email} · cadastrado em {formatarDataHora(p.created_at)}</p></div>
                    <div className="flex gap-2">
                      <button className="btn-primario py-2" onClick={() => atualizar(p, { ativo: true }, `${p.nome} aprovado como atendente.`)}><Check className="h-4 w-4" />Aprovar atendente</button>
                      <button className="btn-secundario py-2" onClick={() => atualizar(p, { ativo: true, papel: 'admin' }, `${p.nome} aprovado como administrador.`)}>Aprovar como gestor</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tabela w-full">
                <thead className="bg-slate-50"><tr><th>Nome</th><th>E-mail</th><th>Nível de acesso</th><th>Situação</th><th>Cadastro</th><th /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {perfis.map((p) => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.nome}{p.id === eu?.id && <span className="ml-2 text-xs font-normal text-slate-400">(você)</span>}</td>
                      <td className="text-slate-600">{p.email}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${p.papel === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                          {p.papel === 'admin' ? <ShieldCheck className="h-3.5 w-3.5" /> : <IconeUsuario className="h-3.5 w-3.5" />}
                          {p.papel === 'admin' ? 'Administrador / Gestor' : 'Atendente'}
                        </span>
                      </td>
                      <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{p.ativo ? 'ATIVO' : 'INATIVO'}</span></td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{formatarDataHora(p.created_at)}</td>
                      <td className="text-right"><button className="btn-fantasma text-xs" onClick={() => setEditar(p)}><Pencil className="h-4 w-4" />Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Para bloquear o acesso de alguém, marque o usuário como inativo — o histórico de lançamentos dele é preservado.</p>
        </>
      )}

      <NovoUsuario aberto={novo} aoFechar={() => setNovo(false)} aoCriar={async () => { setNovo(false); invalidarPerfis(); await carregar(); }} />
      <EditarUsuario perfil={editar} aoFechar={() => setEditar(null)}
        aoSalvar={async (p, campos) => { if (await atualizar(p, campos, 'Usuário atualizado.')) setEditar(null); }} />
    </div>
  );
}

function EditarUsuario({ perfil, aoFechar, aoSalvar }: {
  perfil: Perfil | null; aoFechar: () => void; aoSalvar: (p: Perfil, c: Partial<Pick<Perfil, 'nome' | 'papel' | 'ativo'>>) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<Papel>('atendente');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (perfil) { setNome(perfil.nome); setPapel(perfil.papel); setAtivo(perfil.ativo); } }, [perfil]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!perfil) return;
    setSalvando(true);
    await aoSalvar(perfil, { nome: nome.trim(), papel, ativo });
    setSalvando(false);
  };

  return (
    <Modal aberto={!!perfil} aoFechar={aoFechar} titulo="Editar usuário" largura="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <div><label className="rotulo">Nome</label><input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} /></div>
        <div><label className="rotulo">E-mail</label><input className="campo" value={perfil?.email ?? ''} disabled /></div>
        <div><label className="rotulo">Nível de acesso</label>
          <select className="campo" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
            <option value="atendente">Atendente</option><option value="admin">Administrador / Gestor</option>
          </select></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-500" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Usuário ativo (pode acessar o sistema)</label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="btn-primario" disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function NovoUsuario({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: () => Promise<void> }) {
  const { notificar } = useApp();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel>('atendente');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { if (aberto) { setNome(''); setEmail(''); setSenha(''); setPapel('atendente'); setErro(''); } }, [aberto]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) return setErro('A senha inicial deve ter pelo menos 6 caracteres.');
    setSalvando(true);
    try {
      const { data, error } = await clienteIsolado().auth.signUp({
        email: email.trim(), password: senha, options: { data: { nome: nome.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      });
      if (error) throw error;
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('User already registered');
      await atualizarPerfil(data.user.id, { ativo: true, papel, nome: nome.trim() });
      notificar('sucesso', `Usuário ${nome} criado. Ele já pode entrar com o e-mail e a senha informados.`);
      await aoCriar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally { setSalvando(false); }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo usuário" largura="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <div><label className="rotulo">Nome completo</label><input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} autoFocus /></div>
        <div><label className="rotulo">E-mail</label><input type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="rotulo">Senha inicial</label><input type="text" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete="off" />
          <p className="mt-1 text-xs text-slate-500">Compartilhe com o usuário; ele pode trocá-la em Configurações.</p></div>
        <div><label className="rotulo">Nível de acesso</label>
          <select className="campo" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
            <option value="atendente">Atendente</option><option value="admin">Administrador / Gestor</option>
          </select></div>
        {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="btn-primario" disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />}Criar usuário</button>
        </div>
      </form>
    </Modal>
  );
}
