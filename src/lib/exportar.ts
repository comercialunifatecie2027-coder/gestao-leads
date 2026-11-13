import type { ResumoPeriodo } from './calculos';
import { calcularDiferenca, formatarPercentual } from './calculos';
import { descreverPeriodo, formatarData, formatarDataHora } from './datas';
import type { LinhaLancamento, Periodo } from './types';

const TITULO = 'Gestão de Leads | Controle de Aquisição';

function nomeArquivo(periodo: Periodo, ext: string) {
  const f = (s: string) => s.split('-').reverse().join('-');
  return `relatorio-leads_${f(periodo.inicio)}_a_${f(periodo.fim)}.${ext}`;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pct = (v: number | null) => (v === null ? '' : Math.round(v * 10000) / 100);

/** Linhas detalhadas (dia × canal) ordenadas por data e canal */
export function linhasDetalhadas(linhas: LinhaLancamento[]) {
  return [...linhas]
    .sort((a, b) => (a.data === b.data ? a.canal_ordem - b.canal_ordem : a.data < b.data ? -1 : 1))
    .map((l) => {
      const d = calcularDiferenca(l.leads_crm, l.leads_planilha);
      return {
        Data: formatarData(l.data),
        Canal: l.canal_nome,
        'Leads no CRM': l.leads_crm,
        'Leads na Planilha': l.leads_planilha,
        Diferença: d,
        Situação: d === null ? 'INCOMPLETO' : d === 0 ? 'CONFERIDO' : 'DIVERGÊNCIA',
        'Status do dia': l.status_conferencia,
        Observação: l.observacao ?? '',
      };
    });
}

// ---------------- CSV ----------------
export function exportarCsv(linhas: LinhaLancamento[], periodo: Periodo) {
  const dados = linhasDetalhadas(linhas);
  const cab = ['Data', 'Canal', 'Leads no CRM', 'Leads na Planilha', 'Diferença', 'Situação', 'Status do dia', 'Observação'] as const;
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [cab.join(';'), ...dados.map((r) => cab.map((k) => esc(r[k])).join(';'))].join('\r\n');
  // BOM para o Excel abrir corretamente acentos
  baixar(new Blob(['﻿' + corpo], { type: 'text/csv;charset=utf-8' }), nomeArquivo(periodo, 'csv'));
}

// ---------------- Excel ----------------
export async function exportarXlsx(resumo: ResumoPeriodo, linhas: LinhaLancamento[], periodo: Periodo, geradoPor: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const resumoAoa: (string | number | null)[][] = [
    [TITULO],
    ['Relatório gerencial de conferência de leads'],
    [],
    ['Período analisado', descreverPeriodo(periodo)],
    ['Gerado em', formatarDataHora(new Date().toISOString())],
    ['Gerado por', geradoPor],
    [],
    ['Total geral de leads no CRM', resumo.totalCrm],
    ['Total geral de leads nas planilhas', resumo.totalPlanilha],
    ['Diferença acumulada (CRM − Planilha)', resumo.diferencaLiquida],
    ['Divergência absoluta acumulada', resumo.divergenciaAbsoluta],
    ['% de divergência sobre o total conferido', pct(resumo.percentualDivergencia)],
    ['Dias no período', resumo.diasNoPeriodo],
    ['Dias com conferência salva', resumo.diasComConferencia],
    ['Dias conferidos sem divergência', resumo.contagemStatus.CONFERIDO],
    ['Dias com divergência', resumo.contagemStatus['COM DIVERGÊNCIA']],
    ['Dias em conferência (incompletos)', resumo.contagemStatus['EM CONFERÊNCIA']],
    ['Dias pendentes', resumo.contagemStatus.PENDENTE],
    ['Canais com divergência', resumo.canaisComDivergencia],
    ['Ocorrências de divergência (dia × canal)', resumo.ocorrenciasDivergencia],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoa);
  wsResumo['!cols'] = [{ wch: 44 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  const porCanal = resumo.porCanal.map((c) => ({
    Canal: c.nome,
    'Leads no CRM': c.crm,
    'Leads na Planilha': c.planilha,
    'Diferença acumulada': c.diferenca,
    'Divergência absoluta': c.divergenciaAbsoluta,
    '% divergência': pct(c.percentualDivergencia),
    '% participação': pct(c.participacao),
    'Dias lançados': c.diasLancados,
    'Dias com divergência': c.diasComDivergencia,
    Recorrente: c.recorrente ? 'SIM' : 'NÃO',
  }));
  const wsCanal = XLSX.utils.json_to_sheet(porCanal);
  wsCanal['!cols'] = [{ wch: 18 }, ...Array(9).fill({ wch: 16 })];
  XLSX.utils.book_append_sheet(wb, wsCanal, 'Por canal');

  const porDia = resumo.porDia.map((d) => ({
    Data: formatarData(d.data),
    Status: d.status,
    'Leads no CRM': d.temConferencia ? d.crm : null,
    'Leads na Planilha': d.temConferencia ? d.planilha : null,
    Diferença: d.temConferencia ? d.diferenca : null,
    'Divergência absoluta': d.temConferencia ? d.divergenciaAbsoluta : null,
    'Canais com divergência': d.temConferencia ? d.canaisComDivergencia : null,
  }));
  const wsDia = XLSX.utils.json_to_sheet(porDia);
  wsDia['!cols'] = [{ wch: 12 }, { wch: 18 }, ...Array(5).fill({ wch: 16 })];
  XLSX.utils.book_append_sheet(wb, wsDia, 'Histórico diário');

  const wsDet = XLSX.utils.json_to_sheet(linhasDetalhadas(linhas));
  wsDet['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 11 }, { wch: 14 }, { wch: 18 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detalhado');

  const wsObs = XLSX.utils.json_to_sheet(
    resumo.observacoes.map((o) => ({ Data: formatarData(o.data), Canal: o.canal, Diferença: o.diferenca, Observação: o.texto })),
  );
  wsObs['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 11 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsObs, 'Observações');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo(periodo, 'xlsx'));
}

// ---------------- PDF ----------------
export async function exportarPdf(resumo: ResumoPeriodo, periodo: Periodo, geradoPor: string) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const L = doc.internal.pageSize.getWidth();
  const LARANJA: [number, number, number] = [242, 107, 29];
  const n = (v: number) => v.toLocaleString('pt-BR');
  const sinal = (v: number) => (v > 0 ? `+${n(v)}` : n(v));

  // Cabeçalho
  doc.setFillColor(...LARANJA);
  doc.rect(0, 0, L, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Relatório de Conferência de Leads', 14, 11);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`${TITULO} · UniFatecie`, 14, 17.5);
  doc.text(`Período: ${descreverPeriodo(periodo)}`, L - 14, 11, { align: 'right' });
  doc.text(`Gerado em ${formatarDataHora(new Date().toISOString())} por ${geradoPor}`, L - 14, 17.5, { align: 'right' });

  // Indicadores
  const kpis: [string, string][] = [
    ['Leads no CRM', n(resumo.totalCrm)],
    ['Leads nas planilhas', n(resumo.totalPlanilha)],
    ['Diferença acumulada', sinal(resumo.diferencaLiquida)],
    ['Divergência absoluta', `${n(resumo.divergenciaAbsoluta)} (${formatarPercentual(resumo.percentualDivergencia)})`],
    ['Dias analisados', `${resumo.diasComConferencia} de ${resumo.diasNoPeriodo}`],
    ['Canais c/ divergência', `${resumo.canaisComDivergencia} (${resumo.ocorrenciasDivergencia} ocorr.)`],
  ];
  const w = (L - 28 - 5 * 4) / 6;
  kpis.forEach(([rot, val], i) => {
    const x = 14 + i * (w + 4);
    doc.setDrawColor(226, 232, 240); doc.setFillColor(255, 247, 237);
    doc.roundedRect(x, 30, w, 18, 2, 2, 'FD');
    doc.setTextColor(100, 116, 139); doc.setFontSize(7.5); doc.text(rot.toUpperCase(), x + 3, 35.5);
    doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(val, x + 3, 43.5);
    doc.setFont('helvetica', 'normal');
  });

  const estilo = {
    headStyles: { fillColor: LARANJA, textColor: 255, fontStyle: 'bold' as const, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    margin: { left: 14, right: 14 },
  };

  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Resultado por canal', 14, 56);
  autoTable(doc, {
    ...estilo,
    startY: 59,
    head: [['Canal', 'CRM', 'Planilha', 'Diferença', 'Diverg. absoluta', '% diverg.', '% particip.', 'Dias c/ diverg.', 'Recorrente']],
    body: resumo.porCanal.map((c) => [
      c.nome, n(c.crm), n(c.planilha), sinal(c.diferenca), n(c.divergenciaAbsoluta), formatarPercentual(c.percentualDivergencia),
      formatarPercentual(c.participacao), `${c.diasComDivergencia} de ${c.diasLancados}`, c.recorrente ? 'SIM' : '—',
    ]),
    foot: [['TOTAL', n(resumo.totalCrm), n(resumo.totalPlanilha), sinal(resumo.diferencaLiquida), n(resumo.divergenciaAbsoluta),
      formatarPercentual(resumo.percentualDivergencia), '100%', String(resumo.ocorrenciasDivergencia), '']],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    didParseCell: (h) => {
      if (h.section === 'foot' && h.column.index >= 1 && h.column.index <= 6) h.cell.styles.halign = 'right';
      if (h.section === 'foot' && h.column.index === 7) h.cell.styles.halign = 'center';
    },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'center' }, 8: { halign: 'center' } },
  });

  const yFinal = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
  doc.text('Histórico diário de divergências', 14, 16);
  autoTable(doc, {
    ...estilo,
    startY: 19,
    head: [['Data', 'Status', 'CRM', 'Planilha', 'Diferença', 'Diverg. absoluta', 'Canais c/ diverg.']],
    body: resumo.porDia.map((d) => [
      formatarData(d.data), d.status,
      d.temConferencia ? n(d.crm) : '—', d.temConferencia ? n(d.planilha) : '—',
      d.temConferencia ? sinal(d.diferenca) : '—', d.temConferencia ? n(d.divergenciaAbsoluta) : '—',
      d.temConferencia ? String(d.canaisComDivergencia) : '—',
    ]),
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' } },
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 1) {
        const s = String(h.cell.raw);
        if (s === 'COM DIVERGÊNCIA') h.cell.styles.textColor = [185, 28, 28];
        else if (s === 'CONFERIDO') h.cell.styles.textColor = [4, 120, 87];
        else if (s === 'PENDENTE') h.cell.styles.textColor = [100, 116, 139];
      }
    },
  });

  if (resumo.observacoes.length) {
    let y = yFinal() + 10;
    if (y > 170) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Observações registradas no período', 14, y);
    autoTable(doc, {
      ...estilo,
      startY: y + 3,
      head: [['Data', 'Canal', 'Diferença', 'Observação']],
      body: resumo.observacoes.map((o) => [formatarData(o.data), o.canal, o.diferenca === null ? '—' : sinal(o.diferenca), o.texto]),
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 32 }, 2: { cellWidth: 20, halign: 'right' } },
    });
  }

  // Rodapé com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`${TITULO} · Período ${descreverPeriodo(periodo)}`, 14, doc.internal.pageSize.getHeight() - 7);
    doc.text(`Página ${i} de ${total}`, L - 14, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
  }

  doc.save(nomeArquivo(periodo, 'pdf'));
}
