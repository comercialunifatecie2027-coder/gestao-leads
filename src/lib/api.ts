import { supabase } from './supabase';
import type {
  Canal, Conferencia, Configuracoes, Lancamento, LinhaLancamento, Perfil, RegistroAuditoria,
} from './types';
import { CONFIG_PADRAO } from './types';

const PAGINA = 1000;

/** Busca todas as linhas, paginando (o Supabase limita 1000 linhas por requisição) */
async function buscarTudo<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error) throw error;
    todas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return todas;
}

// ---------------- Canais ----------------
export async function listarCanais(): Promise<Canal[]> {
  const { data, error } = await supabase.from('canais').select('*').order('ordem').order('nome');
  if (error) throw error;
  return data as Canal[];
}

export async function salvarCanal(c: Partial<Canal> & { nome: string }): Promise<void> {
  const payload = {
    nome: c.nome.trim().toUpperCase(),
    descricao: c.descricao?.trim() || null,
    ordem: c.ordem ?? 0,
    ativo: c.ativo ?? true,
  };
  const { error } = c.id
    ? await supabase.from('canais').update(payload).eq('id', c.id)
    : await supabase.from('canais').insert(payload);
  if (error) throw error;
}

export async function excluirCanal(id: string): Promise<void> {
  const { error } = await supabase.from('canais').delete().eq('id', id);
  if (error) throw error;
}

// ---------------- Conferências ----------------
export async function obterConferencia(data: string): Promise<{ conferencia: Conferencia | null; lancamentos: Lancamento[] }> {
  const { data: conf, error } = await supabase.from('conferencias').select('*').eq('data', data).maybeSingle();
  if (error) throw error;
  if (!conf) return { conferencia: null, lancamentos: [] };
  const { data: lanc, error: e2 } = await supabase.from('lancamentos').select('*').eq('conferencia_id', conf.id);
  if (e2) throw e2;
  return { conferencia: conf as Conferencia, lancamentos: (lanc ?? []) as Lancamento[] };
}

export interface ItemSalvar {
  canal_id: string;
  leads_crm: number | null;
  leads_planilha: number | null;
  observacao: string | null;
}

export async function salvarConferencia(data: string, itens: ItemSalvar[], versao: string | null): Promise<Conferencia> {
  const { data: conf, error } = await supabase.rpc('salvar_conferencia', {
    p_data: data,
    p_itens: itens,
    p_versao: versao,
  });
  if (error) throw error;
  return conf as Conferencia;
}

export async function excluirConferencia(id: string): Promise<void> {
  const { error } = await supabase.rpc('excluir_conferencia', { p_conferencia_id: id });
  if (error) throw error;
}

export async function listarConferencias(inicio: string, fim: string): Promise<Conferencia[]> {
  return buscarTudo<Conferencia>((de, ate) =>
    supabase.from('conferencias').select('*').gte('data', inicio).lte('data', fim).order('data', { ascending: false }).range(de, ate),
  );
}

export async function listarLinhas(inicio: string, fim: string, canalId?: string): Promise<LinhaLancamento[]> {
  return buscarTudo<LinhaLancamento>((de, ate) => {
    let q = supabase.from('v_lancamentos').select('*').gte('data', inicio).lte('data', fim);
    if (canalId) q = q.eq('canal_id', canalId);
    return q.order('data', { ascending: false }).order('canal_ordem').order('id').range(de, ate);
  });
}

/** Data da conferência mais antiga (para "histórico completo" de um canal) */
export async function primeiraData(): Promise<string | null> {
  const { data, error } = await supabase.from('conferencias').select('data').order('data').limit(1).maybeSingle();
  if (error) throw error;
  return (data?.data as string) ?? null;
}

export async function listarAuditoria(conferenciaId: string): Promise<RegistroAuditoria[]> {
  const { data, error } = await supabase
    .from('auditoria').select('*').eq('conferencia_id', conferenciaId).order('created_at', { ascending: false }).order('id', { ascending: false });
  if (error) throw error;
  return data as RegistroAuditoria[];
}

// ---------------- Usuários ----------------
export async function listarPerfis(): Promise<Perfil[]> {
  const { data, error } = await supabase.from('perfis').select('*').order('nome');
  if (error) throw error;
  return data as Perfil[];
}

export async function atualizarPerfil(id: string, campos: Partial<Pick<Perfil, 'nome' | 'papel' | 'ativo'>>): Promise<void> {
  const { error } = await supabase.from('perfis').update(campos).eq('id', id);
  if (error) throw error;
}

// ---------------- Configurações ----------------
export async function obterConfiguracoes(): Promise<Configuracoes> {
  const { data, error } = await supabase.from('configuracoes').select('chave, valor');
  if (error) throw error;
  const cfg: Configuracoes = { ...CONFIG_PADRAO };
  for (const r of data ?? []) {
    if (r.chave in cfg) (cfg as unknown as Record<string, unknown>)[r.chave] = r.valor;
  }
  return cfg;
}

export async function salvarConfiguracao(chave: keyof Configuracoes, valor: unknown): Promise<void> {
  const { error } = await supabase.from('configuracoes').update({ valor }).eq('chave', chave);
  if (error) throw error;
}
