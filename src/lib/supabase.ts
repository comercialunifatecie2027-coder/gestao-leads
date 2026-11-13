import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && anonKey && !url.includes('SEU-PROJETO'));

export const supabase: SupabaseClient = createClient(url || 'http://localhost:54321', anonKey || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/**
 * Cliente secundário sem sessão persistida: usado pelo administrador para
 * cadastrar novos usuários sem perder a própria sessão.
 */
export function clienteIsolado(): SupabaseClient {
  return createClient(url || 'http://localhost:54321', anonKey || 'anon', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'gl-cadastro' },
  });
}

/** Traduz mensagens de erro comuns do Supabase/PostgREST para português */
export function mensagemErro(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e ?? 'Erro desconhecido');
  const mapa: [RegExp, string][] = [
    [/Invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/Email not confirmed/i, 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'],
    [/User already registered/i, 'Já existe um usuário cadastrado com este e-mail.'],
    [/Password should be at least/i, 'A senha deve ter pelo menos 6 caracteres.'],
    [/Failed to fetch|NetworkError|Load failed/i, 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'],
    [/JWT expired/i, 'Sua sessão expirou. Entre novamente.'],
    [/canais_nome_unico|duplicate key.*canais/i, 'Já existe um canal com esse nome.'],
    [/violates foreign key constraint.*lancamentos_canal_id/i, 'Este canal possui lançamentos e não pode ser excluído. Desative-o em vez de excluir.'],
    [/row-level security|permission denied/i, 'Você não tem permissão para executar esta ação.'],
    [/rate limit/i, 'Muitas tentativas em sequência. Aguarde um instante e tente novamente.'],
  ];
  for (const [re, txt] of mapa) if (re.test(msg)) return txt;
  return msg.replace(/^CONFLITO:\s*/, '');
}

export function ehConflito(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === 'P0409' || /^CONFLITO/.test(err?.message ?? '');
}
