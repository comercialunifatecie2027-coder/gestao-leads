import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarConferencias, listarLinhas } from '../lib/api';
import { agregarPeriodo, type ResumoPeriodo } from '../lib/calculos';
import { diasDoIntervalo, hojeISO } from '../lib/datas';
import { mensagemErro } from '../lib/supabase';
import type { Conferencia, LinhaLancamento, Periodo } from '../lib/types';
import { useApp } from '../contexts/AppContext';

/** Carrega e agrega todos os dados de um período (usado por Dashboard, Histórico e Relatórios) */
export function useDadosPeriodo(periodo: Periodo, canalId?: string) {
  const { canais, config } = useApp();
  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [l, c] = await Promise.all([
        listarLinhas(periodo.inicio, periodo.fim, canalId),
        listarConferencias(periodo.inicio, periodo.fim),
      ]);
      setLinhas(l);
      setConferencias(c);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [periodo.inicio, periodo.fim, canalId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const resumo: ResumoPeriodo = useMemo(() => {
    // dias futuros não entram no controle de pendências
    const fimEfetivo = periodo.fim > hojeISO() ? hojeISO() : periodo.fim;
    const canaisBase = canalId
      ? canais.filter((c) => c.id === canalId)
      : canais.filter((c) => c.ativo);
    return agregarPeriodo({
      linhas,
      conferencias,
      canais: canaisBase,
      dias: diasDoIntervalo(periodo.inicio, fimEfetivo),
      considerarFimDeSemana: config.considerar_fim_de_semana,
      limiteRecorrente: config.limite_divergencia_recorrente,
    });
  }, [linhas, conferencias, canais, canalId, config, periodo.inicio, periodo.fim]);

  return { linhas, conferencias, resumo, carregando, erro, recarregar: carregar };
}
