/* Revitalize | generate a shareable PDF of a campus action plan (client-side, jsPDF) */

import {
  formatEmissionsShort,
  formatPercent,
  fmtFixed,
  emissionsEquivalentLabel
} from './analytics.js';
import { SCOPE_LABELS } from './campus-plans.js';

const COLORS = {
  text: [17, 24, 31],
  muted: [91, 102, 112],
  accent: [27, 150, 122],
  scope1: [27, 150, 122],
  scope2: [74, 110, 200],
  scope3: [190, 130, 40],
  rule: [210, 218, 226],
  panel: [244, 246, 248]
};

function scopeColor(scope) {
  if (scope === 1) return COLORS.scope1;
  if (scope === 2) return COLORS.scope2;
  if (scope === 3) return COLORS.scope3;
  return COLORS.muted;
}

function scopeLabel(scope) {
  if (scope === 'all') return 'Whole campus';
  return `Scope ${scope} · ${SCOPE_LABELS[scope] ?? ''}`;
}

function priorityLabel(priority) {
  if (priority === 'high') return 'Start here';
  if (priority === 'medium') return 'Worth prioritizing';
  return 'Recommended';
}

/**
 * Build and download a comprehensive PDF for a campus action plan.
 * Returns true on success, false if jsPDF is unavailable.
 */
export function downloadCampusPlanPdf({ campus, plan, metrics, tier, fresh }) {
  const ns = window.jspdf;
  if (!ns || !ns.jsPDF || !campus || !plan || !metrics) return false;

  // jsPDF's built-in fonts use WinAnsi encoding, so map non-Latin1 glyphs to safe equivalents.
  const clean = s => String(s ?? '')
    .replace(/≈/g, '~')
    .replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
    .replace(/[—–]/g, '-')
    .replace(/→/g, '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/…/g, '...');

  const doc = new ns.jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const setFont = (style = 'normal', size = 10, color = COLORS.text) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const ensureSpace = h => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  const paragraph = (text, { style = 'normal', size = 10, color = COLORS.text, lineH = 5, gap = 2 } = {}) => {
    if (!text) return;
    setFont(style, size, color);
    const lines = doc.splitTextToSize(clean(text), contentW);
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }
    y += gap;
  };

  const rule = (gap = 4) => {
    ensureSpace(gap + 2);
    doc.setDrawColor(COLORS.rule[0], COLORS.rule[1], COLORS.rule[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += gap;
  };

  const sectionHeading = label => {
    ensureSpace(12);
    y += 2;
    setFont('bold', 7.5, COLORS.muted);
    doc.text(String(label).toUpperCase(), margin, y, { charSpace: 0.4 });
    y += 5;
  };

  // ── Header band ──
  doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.rect(0, 0, pageW, 4, 'F');
  y = margin + 2;

  setFont('bold', 8, COLORS.accent);
  doc.text('REVITALIZE', margin, y, { charSpace: 0.8 });
  y += 8;

  setFont('bold', 21, COLORS.text);
  const titleLines = doc.splitTextToSize(clean(`${campus.name} Climate Action Plan`), contentW);
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 9;
  }

  setFont('normal', 10, COLORS.muted);
  const region = campus.region ? ` · ${campus.region}` : '';
  doc.text(`Based on ${metrics.latest.year} emissions data${region}`, margin, y);
  y += 7;

  // Status + tier pills (as text)
  const statusText = plan.onTrack ? 'On track for 2045' : 'Needs a faster pace';
  setFont('bold', 9.5, plan.onTrack ? COLORS.accent : COLORS.scope3);
  doc.text(statusText, margin, y);
  if (tier) {
    setFont('normal', 9.5, COLORS.muted);
    doc.text(`   |   ${tier.title} · ${tier.label}`, margin + doc.getTextWidth(statusText), y);
  }
  y += 6;
  rule(5);

  // ── Summary ──
  sectionHeading('The path to 2045');
  paragraph(plan.summary, { size: 11, lineH: 5.5, gap: 4 });

  // ── Key numbers ──
  sectionHeading('Key numbers');
  const baselineDelta = plan.pctFromBaseline;
  const baselineText = Math.abs(baselineDelta) < 0.5
    ? 'About the same as 2019'
    : `${formatPercent(Math.abs(baselineDelta), 0)} ${baselineDelta >= 0 ? 'lower than 2019' : 'higher than 2019'}`;
  const equiv = emissionsEquivalentLabel(metrics.latest.emissions);

  const stats = [
    ['Latest emissions', formatEmissionsShort(metrics.latest.emissions) + ' t CO2e', equiv ?? ''],
    ['Change since 2019', baselineText, `${formatPercent(plan.pctOfGoal, 0)} of the way to the 2045 goal`],
    ['Cuts needed each year', plan.required != null ? `${fmtFixed(plan.required)}% / yr` : '—', plan.realized != null ? `${fmtFixed(plan.realized)}% / yr achieved since 2019` : '']
  ];

  const colW = contentW / 3;
  const cardH = 26;
  ensureSpace(cardH + 2);
  const cardTop = y;
  stats.forEach((s, i) => {
    const x = margin + colW * i;
    doc.setFillColor(COLORS.panel[0], COLORS.panel[1], COLORS.panel[2]);
    doc.roundedRect(x + 1, cardTop, colW - 2, cardH, 2, 2, 'F');
    setFont('bold', 6.5, COLORS.muted);
    doc.text(clean(s[0]).toUpperCase(), x + 4, cardTop + 6, { charSpace: 0.3 });
    setFont('bold', 12, COLORS.text);
    const valLines = doc.splitTextToSize(clean(s[1]), colW - 8);
    doc.text(valLines[0], x + 4, cardTop + 13);
    setFont('normal', 7.5, COLORS.muted);
    const subLines = doc.splitTextToSize(clean(s[2] ?? ''), colW - 8);
    doc.text(subLines.slice(0, 2), x + 4, cardTop + 18.5);
  });
  y = cardTop + cardH + 6;

  // ── Scope legend ──
  sectionHeading('How emissions are grouped');
  const legend = [
    [1, 'Scope 1', 'Fuel burned on campus, such as gas heating and boilers.'],
    [2, 'Scope 2', 'Electricity the campus buys from the grid.'],
    [3, 'Scope 3', 'Indirect sources like commuting, air travel, and purchased goods.']
  ];
  for (const [scope, label, desc] of legend) {
    ensureSpace(6);
    const c = scopeColor(scope);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.circle(margin + 1.5, y - 1.4, 1.4, 'F');
    setFont('bold', 9, COLORS.text);
    doc.text(label + ':', margin + 5, y);
    setFont('normal', 9, COLORS.muted);
    doc.text(desc, margin + 5 + doc.getTextWidth(label + ': '), y);
    y += 5.5;
  }
  y += 2;
  rule(5);

  // ── Phases ──
  plan.phases.forEach((phase, idx) => {
    ensureSpace(16);
    setFont('bold', 13, COLORS.text);
    const headText = `${idx + 1}.  ${clean(phase.title)}`;
    doc.text(headText, margin, y);
    const headW = doc.getTextWidth(headText);
    setFont('normal', 9, COLORS.muted);
    doc.text(`  (${clean(phase.label)})`, margin + headW, y);
    y += 5;
    if (phase.sub) {
      setFont('italic', 9, COLORS.muted);
      const subLines = doc.splitTextToSize(phase.sub, contentW);
      for (const line of subLines) { ensureSpace(4.5); doc.text(line, margin, y); y += 4.5; }
    }
    y += 2;

    phase.items.forEach(action => {
      // estimate height to keep an action card together
      setFont('normal', 9.5);
      const detailLines = doc.splitTextToSize(clean(action.detail), contentW - 8);
      const titleLines = doc.splitTextToSize(clean(action.title), contentW - 8);
      const blockH = 6 + titleLines.length * 5 + 5 + detailLines.length * 4.6 + (action.metric ? 5 : 0) + 4;
      ensureSpace(blockH);

      const c = scopeColor(action.scope);
      const blockTop = y - 3.5;

      setFont('bold', 10.5, COLORS.text);
      for (const line of titleLines) { ensureSpace(5); doc.text(line, margin + 5, y); y += 5; }

      setFont('bold', 7.5, c);
      const tag = `${scopeLabel(action.scope)}   ·   ${priorityLabel(action.priority)}`;
      doc.text(clean(tag).toUpperCase(), margin + 5, y, { charSpace: 0.2 });
      y += 5;

      setFont('normal', 9.5, COLORS.muted);
      for (const line of detailLines) { ensureSpace(4.6); doc.text(line, margin + 5, y); y += 4.6; }

      if (action.metric) {
        setFont('bold', 9, COLORS.accent);
        ensureSpace(5);
        doc.text(clean(action.metric), margin + 5, y);
        y += 5;
      }
      // accent bar spanning the rendered block
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(margin, blockTop, 1.2, (y - 3) - blockTop, 'F');
      y += 3;
    });
    y += 3;
  });

  // ── Initiatives ──
  rule(5);
  sectionHeading(`Already underway at ${campus.shortName ?? campus.name}`);
  setFont('normal', 9, COLORS.muted);
  paragraph("Real initiatives from UC's latest sustainability report.", { size: 9, color: COLORS.muted, gap: 3 });

  plan.initiatives.forEach(item => {
    setFont('normal', 9.5);
    const detailLines = doc.splitTextToSize(clean(item.detail), contentW - 4);
    ensureSpace(10 + detailLines.length * 4.5);
    setFont('bold', 10, COLORS.text);
    const titleStr = `- ${clean(item.title)}`;
    doc.text(titleStr, margin, y);
    setFont('bold', 8, COLORS.muted);
    doc.text(`[${clean(item.status)}]`, margin + doc.getTextWidth(titleStr + '  '), y);
    y += 5;
    setFont('normal', 9.5, COLORS.muted);
    for (const line of detailLines) { ensureSpace(4.5); doc.text(line, margin + 4, y); y += 4.5; }
    y += 2;
  });

  // ── Disclaimer / footer on every page ──
  rule(4);
  setFont('normal', 7.5, COLORS.muted);
  const disclaimer = `Source: UC Annual Report on Sustainable Practices (${fresh?.latestYear ?? metrics.latest.year}). Plans summarize possible next steps based on verified UC emissions data and published campus initiatives; they are not official UC policy documents.`;
  paragraph(disclaimer, { size: 7.5, color: COLORS.muted, lineH: 3.6, gap: 0 });

  const generated = new Date().toISOString().slice(0, 10);
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setFont('normal', 7.5, COLORS.muted);
    doc.text(clean(`Revitalize · ${campus.name} action plan`), margin, pageH - 8);
    doc.text(`Generated ${generated}   ·   Page ${p} of ${pageCount}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  doc.save(`revitalize-${campus.id}-action-plan.pdf`);
  return true;
}
