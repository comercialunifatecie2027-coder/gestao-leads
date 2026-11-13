import { useEffect, useState } from 'react';
import { listarPerfis } from '../lib/api';
import type { Perfil } from '../lib/types';

let cache: Promise<Perfil[]> | null = null;

export function invalidarPerfis() { cache = null; }

/** Mapa id → nome dos usuários (para exibir responsáveis) */
export function usePerfis() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  useEffect(() => {
    if (!cache) cache = listarPerfis().catch((e) => { cache = null; throw e; });
    cache.then(setPerfis).catch(() => setPerfis([]));
  }, []);
  const nomeDe = (id: string | null | undefined) => (id ? perfis.find((p) => p.id === id)?.nome ?? 'Usuário removido' : '—');
  return { perfis, nomeDe };
}
