import { useState, type FormEvent } from 'react';
import { Loader2, Lock, Mail, User, ShieldAlert, Database, KeyRound } from 'lucide-react';
import { supabase, mensagemErro } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Marca } from '../components/Layout';

type Modo = 'entrar' | 'cadastrar' | 'recuperar';

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
        <Marca claro />
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">Conferência diária de leads,<br />do CRM à planilha.</h2>
          <p className="mt-4 max-w-md text-brand-100">
            Registre os números de cada canal, identifique divergências na hora e acompanhe a operação com indicadores e relatórios confiáveis.
          </p>
        </div>
        <p className="relative text-xs text-brand-100">UniFatecie · Gestão Comercial</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Marca /></div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(''); setAviso('');
    setProcessando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else if (modo === 'cadastrar') {
        if (nome.trim().length < 3) throw new Error('Informe seu nome completo.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password: senha, options: { data: { nome: nome.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        });
        if (error) throw error;
        if (!data.session) {
          // e-mail confirmado automaticamente pelo banco: tenta entrar direto
          const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
          if (e2) {
            setAviso('Cadastro enviado! Entre com seu e-mail e senha. Se o acesso ainda não estiver liberado, aguarde a aprovação de um gestor.');
            setModo('entrar');
          }
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + import.meta.env.BASE_URL + 'redefinir-senha' });
        if (error) throw error;
        setAviso('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
        setModo('entrar');
      }
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setProcessando(false);
    }
  };

  const titulos: Record<Modo, [string, string]> = {
    entrar: ['Acessar o sistema', 'Entre com seu e-mail e senha corporativos.'],
    cadastrar: ['Solicitar acesso', 'Seu acesso será liberado após aprovação de um gestor.'],
    recuperar: ['Recuperar senha', 'Enviaremos um link de redefinição para seu e-mail.'],
  };

  return (
    <Moldura>
      <h1 className="text-2xl font-bold text-slate-900">{titulos[modo][0]}</h1>
      <p className="mt-1 text-sm text-slate-500">{titulos[modo][1]}</p>
      <form onSubmit={enviar} className="mt-6 space-y-4">
        {modo === 'cadastrar' && (
          <div>
            <label className="rotulo" htmlFor="nome">Nome completo</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="nome" className="campo pl-9" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
            </div>
          </div>
        )}
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="email" type="email" className="campo pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
        </div>
        {modo !== 'recuperar' && (
          <div>
            <label className="rotulo" htmlFor="senha">Senha</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="senha" type="password" className="campo pl-9" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6}
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
            </div>
          </div>
        )}
        {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {aviso && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>}
        <button className="btn-primario w-full py-3" disabled={processando}>
          {processando && <Loader2 className="h-4 w-4 animate-spin" />}
          {modo === 'entrar' ? 'Entrar' : modo === 'cadastrar' ? 'Enviar solicitação' : 'Enviar link'}
        </button>
      </form>
      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        {modo !== 'entrar' && <button className="font-semibold text-brand-600 hover:underline" onClick={() => setModo('entrar')}>Voltar para o login</button>}
        {modo === 'entrar' && (
          <>
            <button className="font-semibold text-brand-600 hover:underline" onClick={() => setModo('recuperar')}>Esqueci minha senha</button>
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setModo('cadastrar')}>Não tem acesso? <span className="font-semibold">Solicitar cadastro</span></button>
          </>
        )}
      </div>
    </Moldura>
  );
}

export function AguardandoAprovacao() {
  const { sair, perfil, recarregarPerfil } = useAuth();
  return (
    <Moldura>
      <div className="mb-4 inline-flex rounded-2xl bg-brand-50 p-3"><ShieldAlert className="h-7 w-7 text-brand-600" /></div>
      <h1 className="text-2xl font-bold text-slate-900">Acesso aguardando aprovação</h1>
      <p className="mt-2 text-sm text-slate-600">
        Olá{perfil ? `, ${perfil.nome}` : ''}! Seu cadastro foi recebido, mas ainda precisa ser aprovado por um administrador.
        Assim que for liberado, você poderá acessar normalmente.
      </p>
      <div className="mt-6 flex gap-2">
        <button className="btn-primario" onClick={() => recarregarPerfil()}>Verificar novamente</button>
        <button className="btn-secundario" onClick={sair}>Sair</button>
      </div>
    </Moldura>
  );
}

export function RedefinirSenha() {
  const { limparRecuperacao } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [processando, setProcessando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) return setErro('A senha deve ter pelo menos 6 caracteres.');
    if (senha !== confirmacao) return setErro('As senhas não conferem.');
    setProcessando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setProcessando(false);
    if (error) return setErro(mensagemErro(error));
    setOk(true);
  };

  return (
    <Moldura>
      <div className="mb-4 inline-flex rounded-2xl bg-brand-50 p-3"><KeyRound className="h-7 w-7 text-brand-600" /></div>
      <h1 className="text-2xl font-bold text-slate-900">Definir nova senha</h1>
      {ok ? (
        <>
          <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Senha alterada com sucesso.</p>
          <button className="btn-primario mt-6 w-full" onClick={() => { limparRecuperacao(); window.location.href = import.meta.env.BASE_URL; }}>Continuar</button>
        </>
      ) : (
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <div><label className="rotulo">Nova senha</label><input type="password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></div>
          <div><label className="rotulo">Confirmar senha</label><input type="password" className="campo" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" /></div>
          {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <button className="btn-primario w-full py-3" disabled={processando}>{processando && <Loader2 className="h-4 w-4 animate-spin" />}Salvar nova senha</button>
        </form>
      )}
    </Moldura>
  );
}

export function SupabaseNaoConfigurado() {
  return (
    <Moldura>
      <div className="mb-4 inline-flex rounded-2xl bg-brand-50 p-3"><Database className="h-7 w-7 text-brand-600" /></div>
      <h1 className="text-2xl font-bold text-slate-900">Conexão com o banco não configurada</h1>
      <p className="mt-2 text-sm text-slate-600">
        Defina as variáveis <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> e{' '}
        <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> no arquivo <code className="rounded bg-slate-100 px-1">.env</code>{' '}
        (ou nas variáveis de ambiente da hospedagem) e reinicie o sistema. O passo a passo completo está no arquivo LEIA-ME.md.
      </p>
    </Moldura>
  );
}
