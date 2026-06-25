/* Revitalize | export campus action plans as CSV */

import { formatEmissionsShort, formatPercent, fmtFixed } from './analytics.js';

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

/**
 * Build the CSV text for a campus action plan (pure, testable).
 */
export function buildPlanCsv({ campus, plan, metrics, tier, fresh }) {
  if (!campus || !plan || !metrics) return '';

  const rows = [];
  const year = metrics.latest.year;
  const baselineDelta = plan.pctFromBaseline;
  const baselineText = Math.abs(baselineDelta) < 0.5
    ? 'About the same as 2019'
    : `${formatPercent(Math.abs(baselineDelta), 0)} ${baselineDelta >= 0 ? 'lower than 2019' : 'higher than 2019'}`;

  rows.push(csvRow(['Revitalize campus action plan']));
  rows.push(csvRow(['Campus', campus.name]));
  rows.push(csvRow(['Region', campus.region ?? '']));
  rows.push(csvRow(['Data year', year]));
  rows.push(csvRow(['Generated', new Date().toISOString().slice(0, 10)]));
  rows.push(csvRow(['Source', `UC Annual Report on Sustainable Practices (${fresh?.latestYear ?? year})`]));
  rows.push('');

  rows.push(csvRow(['Summary']));
  rows.push(csvRow([plan.summary]));
  rows.push(csvRow(['Status', plan.onTrack ? 'On track for 2045' : 'Needs a faster pace']));
  rows.push(csvRow(['Climate tier', `${tier?.title ?? ''} · ${tier?.label ?? ''}`]));
  rows.push('');

  rows.push(csvRow(['Metric', 'Value', 'Notes']));
  rows.push(csvRow(['Latest emissions', formatEmissionsShort(metrics.latest.emissions), 't CO₂e']));
  rows.push(csvRow(['Change since 2019', baselineText, `${formatPercent(plan.pctOfGoal, 0)} of the way to the 2045 goal`]));
  rows.push(csvRow([
    'Cuts needed each year',
    plan.required != null ? `${fmtFixed(plan.required)}% / yr` : '',
    plan.realized != null ? `${fmtFixed(plan.realized)}% / yr achieved since 2019` : ''
  ]));
  rows.push('');

  rows.push(csvRow(['Phase', 'Timeline', 'Priority', 'Scope', 'Action', 'Detail', 'Metric']));
  for (const phase of plan.phases) {
    for (const action of phase.items) {
      const scope = action.scope === 'all' ? 'Whole campus' : `Scope ${action.scope}`;
      rows.push(csvRow([
        phase.title,
        phase.label,
        action.priority,
        scope,
        action.title,
        action.detail,
        action.metric ?? ''
      ]));
    }
  }
  rows.push('');

  rows.push(csvRow(['Initiative', 'Status', 'Detail']));
  for (const item of plan.initiatives) {
    rows.push(csvRow([item.title, item.status, item.detail]));
  }
  rows.push('');

  rows.push(csvRow([
    'Disclaimer',
    'Plans are based on verified UC emissions data and published campus sustainability initiatives. They summarize possible next steps and are not official UC policy documents.'
  ]));

  return rows.join('\n');
}

/**
 * Build and download a CSV of the current campus action plan.
 */
export function downloadCampusPlanCsv(state) {
  if (!state || !state.campus || !state.plan || !state.metrics) return false;

  const csv = buildPlanCsv(state);
  if (!csv) return false;

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `revitalize-${state.campus.id}-action-plan.csv`;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
